import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { AIPlatform, Prisma } from '@prisma/client';
import { isIP } from 'node:net';
import { PrismaService } from '../common/prisma/prisma.service';

const TRACKING_PARAMETERS = new Set([
  'fbclid', 'gclid', 'msclkid', 'igshid', '_ga', 'mc_cid', 'mc_eid',
]);
const MASKED_GEMINI_HOST = 'vertexaisearch.cloud.google.com';
const BATCH_SIZE = 400;
const CHANNELS = ['WEBSITE', 'BLOG', 'INSTAGRAM', 'YOUTUBE'] as const;
export type OfficialChannel = typeof CHANNELS[number];
export type RegisteredChannels = Record<OfficialChannel, string | null>;

export type WebsiteAnalysisStatus =
  | 'DOMAIN_REQUIRED'
  | 'NO_MEASUREMENTS'
  | 'NO_CITATIONS'
  | 'READY';

export interface WebsiteAnalysisFilters {
  days: number;
  platform: AIPlatform | 'ALL';
  channel?: OfficialChannel;
  domain?: string;
  page: number;
  pageSize: number;
  now?: Date;
}

export interface WebsiteResponseRow {
  id: string;
  aiPlatform: AIPlatform;
  createdAt: Date;
  isMentioned: boolean;
  archivedPromptText: string | null;
  citedSources: string[];
  citedUrl: string | null;
  sourceHints: unknown;
  prompt: { promptText: string } | null;
}

export interface CitationUrl {
  key: string;
  url: string;
  path: string;
  pathname: string;
  search: string;
  host: string;
}

export interface WebsiteScope {
  domain: string;
  scopePath: string;
  scopeSearch: string;
  scopeMode: 'PATH_SUBTREE' | 'EXACT_URL' | 'NAVER_ACCOUNT' | 'SOCIAL_PROFILE';
  channel: OfficialChannel;
  ownerAccount?: string;
}

interface MutablePage {
  key: string;
  url: string;
  path: string;
  citationResponses: number;
  mentionedResponses: number;
  byPlatform: Map<AIPlatform, number>;
  lastCitedAt: string;
  examples: Array<{
    responseId: string;
    question: string;
    platform: AIPlatform;
    responseDate: string;
    isMentioned: boolean;
  }>;
}

function parsedHttpUrl(input: string): URL | null {
  const trimmed = input.trim();
  if (!trimmed || trimmed.length > 2048 || /\s/.test(trimmed)) return null;
  try {
    const url = new URL(
      /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`,
    );
    if (!['http:', 'https:'].includes(url.protocol)) return null;
    if (url.username || url.password || url.port) return null;
    return url;
  } catch {
    return null;
  }
}

function normalizedHost(hostname: string): string {
  const host = hostname.toLowerCase().replace(/\.$/, '').replace(/^www\./, '');
  if (host === 'm.blog.naver.com') return 'blog.naver.com';
  if (host === 'm.instagram.com') return 'instagram.com';
  if (host === 'm.youtube.com') return 'youtube.com';
  return host;
}

function isPublicDomain(host: string): boolean {
  if (isIP(host) || host.length > 253) return false;
  const labels = host.split('.');
  return labels.length >= 2 && labels.every(
    (label) => label.length > 0 && label.length <= 63 &&
      /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/.test(label),
  ) && /^[a-z]{2,63}$|^xn--[a-z0-9-]+$/.test(labels[labels.length - 1]);
}

/** A chosen domain matches only that hostname and its www form. Other subdomains stay separate. */
export function normalizeWebsiteDomain(input: string): string {
  return normalizeWebsiteScope(input).domain;
}

export function normalizeWebsiteScope(input: string, channel: OfficialChannel = 'WEBSITE'): WebsiteScope {
  const url = parsedHttpUrl(input);
  const host = url && normalizedHost(url.hostname);
  if (!host || !isPublicDomain(host) || host === MASKED_GEMINI_HOST) {
    throw new BadRequestException('올바른 공개 홈페이지 도메인을 입력해주세요.');
  }
  const scopePath = url!.pathname === '/' ? '/' : url!.pathname.replace(/\/$/, '');
  const scopeSearch = cleanedSearch(url!);
  // These are shared hosts: a root URL cannot establish ownership of the
  // platform's other accounts, regardless of the selected channel.
  const sharedHost = ['blog.naver.com', 'instagram.com', 'youtube.com',
    'medium.com', 'velog.io', 'brunch.co.kr', 'tistory.com'].includes(host);
  if (sharedHost && scopePath === '/') {
    throw new BadRequestException('공유 플랫폼은 병원 계정이 포함된 URL을 입력해주세요.');
  }
  if (channel === 'INSTAGRAM' && host !== 'instagram.com') {
    throw new BadRequestException('인스타그램 계정 URL을 입력해주세요.');
  }
  if (channel === 'YOUTUBE' && host !== 'youtube.com') {
    throw new BadRequestException('유튜브 채널 URL을 입력해주세요.');
  }
  if (channel === 'BLOG' && host === 'blog.naver.com') {
    const first = scopePath.split('/')[1];
    const ownerAccount = /^\/[a-z\d_-]+$/i.test(scopePath) ? first.toLowerCase()
      : /^\/Post(?:View|List)\.naver$/i.test(scopePath)
        ? url!.searchParams.get('blogId')?.toLowerCase() : null;
    if (!ownerAccount || !/^[a-z\d_-]+$/i.test(ownerAccount)) {
      throw new BadRequestException('네이버 블로그 계정 주소를 입력해주세요.');
    }
    const queryAccount = queryParam(url!, 'blogId');
    if (queryAccount && queryAccount.toLowerCase() !== ownerAccount) {
      throw new BadRequestException('네이버 블로그 계정 주소를 입력해주세요.');
    }
    return { domain: host, scopePath: `/${ownerAccount}`, scopeSearch: '',
      scopeMode: 'NAVER_ACCOUNT', channel, ownerAccount };
  }
  if (host === 'instagram.com') {
    if (!/^\/[a-z\d._]{1,30}$/i.test(scopePath) ||
      ['p', 'reel', 'reels', 'stories', 'explore', 'accounts', 'direct', 'about', 'developer', 'legal']
        .includes(scopePath.slice(1).toLowerCase())) {
      throw new BadRequestException('인스타그램 계정 URL을 입력해주세요.');
    }
    return { domain: host, scopePath: scopePath.toLowerCase(), scopeSearch: '',
      scopeMode: 'SOCIAL_PROFILE', channel };
  }
  if (host === 'youtube.com') {
    if (!/^\/(?:@[^/]+|(?:channel|c|user)\/[^/]+)$/.test(scopePath)) {
      throw new BadRequestException('유튜브 채널 URL을 입력해주세요.');
    }
    return { domain: host, scopePath, scopeSearch: '',
      scopeMode: 'SOCIAL_PROFILE', channel };
  }
  return {
    domain: host,
    scopePath,
    scopeSearch,
    scopeMode: scopeSearch ? 'EXACT_URL' : 'PATH_SUBTREE',
    channel,
  };
}

function cleanedSearch(url: URL): string {
  const cleanParams = new URLSearchParams();
  url.searchParams.forEach((value, key) => {
    const lowered = key.toLowerCase();
    if (!lowered.startsWith('utm_') && !TRACKING_PARAMETERS.has(lowered)) {
      cleanParams.append(key, value);
    }
  });
  const search = cleanParams.toString();
  return search ? `?${search}` : '';
}

export function normalizeCitationUrl(input: string): CitationUrl | null {
  const url = parsedHttpUrl(input);
  if (!url) return null;
  const host = normalizedHost(url.hostname);
  if (!isPublicDomain(host) || host === MASKED_GEMINI_HOST) return null;

  const pathname = url.pathname === '/' ? '/' : url.pathname.replace(/\/$/, '');
  const search = cleanedSearch(url);
  const pagePath = `${pathname}${search}`;
  // The key deliberately ignores scheme and www while retaining meaningful query parameters.
  return {
    key: `${host}${pagePath}`,
    url: `${url.protocol}//${url.host}${pagePath}`,
    path: pagePath,
    pathname,
    search,
    host,
  };
}

function queryParam(url: URL, name: string): string | null {
  for (const [key, value] of url.searchParams) {
    if (key.toLowerCase() === name.toLowerCase()) return value;
  }
  return null;
}

/** Naver desktop, mobile and PostView links for one post share one page key. */
function naverAccountCitation(input: string, ownerAccount: string): CitationUrl | null {
  const url = parsedHttpUrl(input);
  if (!url || normalizedHost(url.hostname) !== 'blog.naver.com') return null;
  const pathname = url.pathname.replace(/\/$/, '') || '/';
  let account: string | null;
  let path: string;
  if (/^\/Post(?:View|List)\.naver$/i.test(pathname)) {
    account = queryParam(url, 'blogId');
    const logNo = queryParam(url, 'logNo');
    path = logNo ? `/${ownerAccount}/${encodeURIComponent(logNo)}` : `/${ownerAccount}`;
  } else {
    const segments = pathname.split('/').filter(Boolean);
    account = segments[0] || null;
    const logNo = queryParam(url, 'logNo');
    path = logNo ? `/${ownerAccount}/${encodeURIComponent(logNo)}`
      : `/${ownerAccount}${segments.length > 1 ? `/${segments.slice(1).join('/')}` : ''}`;
  }
  if (!account || account.toLowerCase() !== ownerAccount) return null;
  const queryAccount = queryParam(url, 'blogId');
  if (queryAccount && queryAccount.toLowerCase() !== ownerAccount) return null;
  return {
    key: `blog.naver.com${path}`,
    url: `https://blog.naver.com${path}`,
    path,
    pathname: path,
    search: '',
    host: 'blog.naver.com',
  };
}

/** Returns only URL evidence inside the saved account/domain scope. */
export function matchCitationToScope(input: string, scope: WebsiteScope): CitationUrl | null {
  if (scope.scopeMode === 'NAVER_ACCOUNT') {
    return naverAccountCitation(input, scope.ownerAccount!);
  }
  const citation = normalizeCitationUrl(input);
  if (!citation || citation.host !== scope.domain) return null;
  const pathname = scope.scopeMode === 'SOCIAL_PROFILE' && scope.domain === 'instagram.com'
    ? citation.pathname.toLowerCase() : citation.pathname;
  const matches = scope.scopeMode === 'EXACT_URL'
    ? pathname === scope.scopePath && citation.search === scope.scopeSearch
    : scope.scopePath === '/' || pathname === scope.scopePath ||
      pathname.startsWith(`${scope.scopePath}/`);
  if (!matches) return null;
  // Social post URLs do not encode their owner. The profile path above is the
  // sole basis for ownership; /p, /reel, /watch and /shorts cannot match it.
  if (scope.scopeMode === 'SOCIAL_PROFILE' && scope.domain === 'instagram.com') {
    return { ...citation, key: `${citation.host}${pathname}${citation.search}`,
      path: `${pathname}${citation.search}`, pathname };
  }
  return citation;
}

export interface RegisteredChannelCitation {
  channel: OfficialChannel;
  citation: CitationUrl;
}

/** Precompile registered scopes once when classifying a batch of source URLs. */
export function createRegisteredChannelCitationMatcher(channels: RegisteredChannels) {
  const scopes = CHANNELS.flatMap((channel) => {
    const url = channels[channel];
    if (!url) return [];
    try { return [normalizeWebsiteScope(url, channel)]; }
    catch { return []; } // Legacy root/shared URLs cannot establish ownership.
  });
  return (input: string): RegisteredChannelCitation[] => scopes.flatMap((scope) => {
    const citation = matchCitationToScope(input, scope);
    return citation ? [{ channel: scope.channel, citation }] : [];
  });
}

export function matchRegisteredChannelCitation(
  input: string, channels: RegisteredChannels,
): RegisteredChannelCitation[] {
  return createRegisteredChannelCitationMatcher(channels)(input);
}

function sourceHintUrls(hints: unknown): string[] {
  if (!hints || typeof hints !== 'object') return [];
  const sources = (hints as { sources?: unknown }).sources;
  if (!Array.isArray(sources)) return [];
  const urls: string[] = [];
  for (const source of sources) {
    if (!source || typeof source !== 'object') continue;
    const item = source as Record<string, unknown>;
    for (const value of [item.url, item.uri, item.link]) {
      // A bare hostname in a hint is insufficient evidence for the home page.
      if (typeof value === 'string' && /^https?:\/\//i.test(value.trim())) {
        urls.push(value);
      }
    }
    // A title that is only a domain does not identify the cited page.
    if (typeof item.title === 'string' && /^https?:\/\//i.test(item.title.trim())) {
      urls.push(item.title);
    }
  }
  return urls;
}

function isMaskedGeminiUrl(input: string): boolean {
  const url = parsedHttpUrl(input);
  return !!url && normalizedHost(url.hostname) === MASKED_GEMINI_HOST;
}

export function kstPeriod(days: number, now: Date): {
  fromDate: string;
  toDate: string;
  from: Date;
  before: Date;
} {
  const toDate = new Date(now.getTime() + 9 * 60 * 60 * 1000)
    .toISOString().slice(0, 10);
  const today = new Date(`${toDate}T00:00:00.000Z`);
  const kstOffset = 9 * 60 * 60 * 1000;
  const fromDay = new Date(today.getTime() - (days - 1) * 24 * 60 * 60 * 1000);
  const from = new Date(fromDay.getTime() - kstOffset);
  const before = new Date(today.getTime() + 24 * 60 * 60 * 1000 - kstOffset);
  return { fromDate: fromDay.toISOString().slice(0, 10), toDate, from, before };
}

/** Adds one measured response to each distinct first party page cited by that response. */
export function aggregateWebsiteResponse(
  row: WebsiteResponseRow,
  domain: string,
  pages: Map<string, MutablePage>,
  scopePath = '/',
  scopeSearch = '',
  scope?: WebsiteScope,
): { matched: boolean; unresolvedGemini: boolean } {
  const hints = sourceHintUrls(row.sourceHints);
  const sources = [
    ...(row.citedSources || []),
    ...(row.citedUrl ? [row.citedUrl] : []),
    ...hints,
  ];
  const maskedCount = row.aiPlatform === AIPlatform.GEMINI
    ? new Set([...(row.citedSources || []), ...(row.citedUrl ? [row.citedUrl] : [])]
      .filter(isMaskedGeminiUrl)).size
    : 0;
  const realHintCount = new Set(hints.map(normalizeCitationUrl)
    .filter((item): item is CitationUrl => item !== null)
    .map((item) => item.key)).size;
  // This is a lower-bound warning: do not invent a page from a hint that only
  // identifies a domain, or assume one real URL resolves several masked links.
  const unresolvedGemini = maskedCount > realHintCount;
  const matchedInResponse = new Set<string>();
  const collectedDate = new Date(row.createdAt.getTime() + 9 * 60 * 60 * 1000)
    .toISOString().slice(0, 10);
  for (const source of sources) {
    const citation = scope ? matchCitationToScope(source, scope) : normalizeCitationUrl(source);
    const pathMatches = scope || (citation && (scopeSearch
      ? citation.pathname === scopePath && citation.search === scopeSearch
      : scopePath === '/' || citation.pathname === scopePath ||
        citation.pathname.startsWith(`${scopePath}/`)));
    if (!citation || citation.host !== domain || !pathMatches ||
      matchedInResponse.has(citation.key)) {
      continue;
    }
    matchedInResponse.add(citation.key);
    let page = pages.get(citation.key);
    if (!page) {
      page = {
        key: citation.key,
        url: citation.url,
        path: citation.path,
        citationResponses: 0,
        mentionedResponses: 0,
        byPlatform: new Map(),
        lastCitedAt: collectedDate,
        examples: [],
      };
      pages.set(citation.key, page);
    }
    page.citationResponses++;
    if (row.isMentioned) page.mentionedResponses++;
    page.byPlatform.set(row.aiPlatform, (page.byPlatform.get(row.aiPlatform) || 0) + 1);
    if (collectedDate > page.lastCitedAt) page.lastCitedAt = collectedDate;
    if (page.examples.length < 3) {
      page.examples.push({
        responseId: row.id,
        question: row.archivedPromptText ?? row.prompt?.promptText ?? '',
        platform: row.aiPlatform,
        responseDate: collectedDate,
        isMentioned: row.isMentioned,
      });
    }
  }
  return { matched: matchedInResponse.size > 0, unresolvedGemini };
}

@Injectable()
export class WebsiteAnalysisService {
  constructor(private readonly prisma: PrismaService) {}

  async getAnalysis(hospitalId: string, filters: WebsiteAnalysisFilters) {
    const hospital = await this.prisma.hospital.findUnique({
      where: { id: hospitalId },
      select: { websiteUrl: true, blogUrl: true, instagramUrl: true, youtubeUrl: true },
    });
    if (!hospital) throw new NotFoundException('병원을 찾을 수 없습니다.');

    const channel = filters.channel ?? 'WEBSITE';
    if (!CHANNELS.includes(channel)) throw new BadRequestException('지원하지 않는 공식 채널입니다.');
    const registeredChannels: RegisteredChannels = {
      WEBSITE: hospital.websiteUrl || null,
      BLOG: hospital.blogUrl || null,
      INSTAGRAM: hospital.instagramUrl || null,
      YOUTUBE: hospital.youtubeUrl || null,
    };
    const registeredWebsiteUrl = registeredChannels.WEBSITE;
    const selectedChannelUrl = registeredChannels[channel];
    const chosen = filters.domain?.trim() || selectedChannelUrl;
    const scope = chosen ? normalizeWebsiteScope(chosen, channel) : null;
    const domain = scope?.domain || null;
    const domainSource = filters.domain?.trim()
      ? 'override' : selectedChannelUrl ? 'hospital' : 'missing';
    const { fromDate, toDate, from, before } = kstPeriod(
      filters.days, filters.now ?? new Date(),
    );
    const base = {
      hospitalId,
      createdAt: { gte: from, lt: before },
      ...(filters.platform === 'ALL' ? {} : { aiPlatform: filters.platform }),
    } satisfies Prisma.AIResponseWhereInput;

    const baseResult = {
      domain,
      domainSource,
      channel,
      registeredChannels,
      selectedChannelUrl,
      registeredWebsiteUrl,
      hostPolicy: domain === 'blog.naver.com' || domain === 'instagram.com' ||
        domain === 'youtube.com' ? 'EXACT_WWW_AND_PLATFORM_MOBILE' as const : 'EXACT_AND_WWW' as const,
      scopePath: scope?.scopePath || null,
      scopeSearch: scope?.scopeSearch || '',
      scopeMode: scope?.scopeMode || null,
      dateBasis: 'CREATED_AT_KST' as const,
      periodDays: filters.days,
      fromDate,
      toDate,
      platform: filters.platform,
      page: filters.page,
      pageSize: filters.pageSize,
      totalResponses: 0,
      citedResponseCount: 0,
      pageCount: 0,
      unresolvedGeminiResponses: 0,
      hasMorePages: false,
      pages: [] as Array<{
        url: string;
        path: string;
        citationResponses: number;
        mentionedResponses: number;
        byPlatform: Array<{ platform: AIPlatform; count: number }>;
        lastCitedAt: string;
        examples: MutablePage['examples'];
      }>,
    };

    if (!domain) return { ...baseResult, status: 'DOMAIN_REQUIRED' as WebsiteAnalysisStatus };

    // Keep rows and internal cost fields out of the response. A bounded indexed date
    // scan keeps DB and application memory use stable even for busy hospitals.
    const pages = new Map<string, MutablePage>();
    let totalResponses = 0;
    let citedResponseCount = 0;
    let unresolvedGeminiResponses = 0;
    let cursorId: string | null = null;
    for (;;) {
      const rows: WebsiteResponseRow[] = await this.prisma.aIResponse.findMany({
        where: base,
        select: {
          id: true,
          aiPlatform: true,
          createdAt: true,
          isMentioned: true,
          archivedPromptText: true,
          citedSources: true,
          citedUrl: true,
          sourceHints: true,
          prompt: { select: { promptText: true } },
        },
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        take: BATCH_SIZE,
        ...(cursorId ? { cursor: { id: cursorId }, skip: 1 } : {}),
      });
      if (rows.length === 0) break;
      for (const row of rows) {
        totalResponses++;
        const result = aggregateWebsiteResponse(
          row, domain, pages, scope!.scopePath, scope!.scopeSearch, scope!,
        );
        if (result.matched) citedResponseCount++;
        if (result.unresolvedGemini) unresolvedGeminiResponses++;
      }
      cursorId = rows[rows.length - 1].id;
      if (rows.length < BATCH_SIZE) break;
    }

    const sorted = [...pages.values()].sort(
      (a, b) => b.citationResponses - a.citationResponses ||
        b.lastCitedAt.localeCompare(a.lastCitedAt) || a.path.localeCompare(b.path),
    );
    const offset = (filters.page - 1) * filters.pageSize;
    const selected = sorted.slice(offset, offset + filters.pageSize).map((item) => ({
      url: item.url,
      path: item.path,
      citationResponses: item.citationResponses,
      mentionedResponses: item.mentionedResponses,
      byPlatform: [...item.byPlatform.entries()]
        .map(([platform, count]) => ({ platform, count }))
        .sort((a, b) => b.count - a.count || a.platform.localeCompare(b.platform)),
      lastCitedAt: item.lastCitedAt,
      examples: item.examples,
    }));
    const status: WebsiteAnalysisStatus = totalResponses === 0
      ? 'NO_MEASUREMENTS' : pages.size === 0 ? 'NO_CITATIONS' : 'READY';
    return {
      ...baseResult,
      status,
      totalResponses,
      citedResponseCount,
      pageCount: pages.size,
      unresolvedGeminiResponses,
      hasMorePages: offset + selected.length < pages.size,
      pages: selected,
    };
  }
}
