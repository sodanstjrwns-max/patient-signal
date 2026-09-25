import { Injectable, NotFoundException } from '@nestjs/common';
import { AIPlatform } from '@prisma/client';
import { CitationUrl, kstPeriod, normalizeCitationUrl } from '../ai-crawler/website-analysis.service';
import { CacheService } from '../common/cache/cache.service';
import { withHeavySlot } from '../common/heavy-slot';
import { PrismaService } from '../common/prisma/prisma.service';

const PLATFORMS = [AIPlatform.CHATGPT, AIPlatform.GEMINI, AIPlatform.PERPLEXITY] as const;
type MeasuredPlatform = typeof PLATFORMS[number];
type Channel = 'blog' | 'cafe' | 'place' | 'search' | 'other';
const MASKED_GEMINI_HOST = 'vertexaisearch.cloud.google.com';

export interface NaverSourceRow {
  id: string;
  aiPlatform: AIPlatform;
  createdAt: Date;
  citedSources: string[];
  citedUrl: string | null;
  sourceHints: unknown;
}

function channelCounts(): Record<Channel, number> {
  return { blog: 0, cafe: 0, place: 0, search: 0, other: 0 };
}

function emptyMetrics() {
  return {
    totalResponses: 0, responsesWithCitations: 0, totalCitations: 0,
    naverResponseCount: 0, naverCitations: 0, naverChannels: channelCounts(),
    naverShortResponses: 0, naverShortCitations: 0,
    naverAssetResponses: 0, naverAssetCitations: 0,
    geminiMaskedResponses: 0, geminiMaskedReferences: 0,
    geminiDomainEvidence: { totalDomains: 0, naverDomains: 0, naverResponses: 0, naverChannels: channelCounts() },
  };
}

type Metrics = ReturnType<typeof emptyMetrics>;

function isHost(host: string, base: string): boolean {
  return host === base || host.endsWith(`.${base}`);
}

function naverChannel(host: string): Channel | null {
  if (!isHost(host, 'naver.com')) return null;
  if (host === 'blog.naver.com' || host === 'm.blog.naver.com') return 'blog';
  if (host === 'cafe.naver.com' || host === 'm.cafe.naver.com') return 'cafe';
  if (['place.naver.com', 'm.place.naver.com', 'map.naver.com', 'm.map.naver.com'].includes(host)) return 'place';
  if (host === 'search.naver.com' || host === 'm.search.naver.com') return 'search';
  return 'other';
}

function hostnameOnly(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const candidate = value.trim().toLowerCase().replace(/^www\./, '').replace(/\.$/, '');
  if (!/^[a-z0-9-]+(?:\.[a-z0-9-]+)+$/.test(candidate) || candidate === MASKED_GEMINI_HOST) return null;
  return candidate;
}

function addFullUrl(value: unknown, urls: Map<string, CitationUrl>, bareHosts?: Set<string>): void {
  if (typeof value !== 'string' || !/^https?:\/\//i.test(value.trim())) return;
  const citation = normalizeCitationUrl(value);
  if (!citation) return;
  // Gemini hint URLs that identify only a host are domain evidence, not a page citation.
  if (bareHosts && citation.pathname === '/' && !citation.search) bareHosts.add(citation.host);
  else urls.set(citation.key, citation);
}

export function aggregateNaverSourceRow(row: NaverSourceRow, metrics: Metrics): void {
  metrics.totalResponses++;
  const urls = new Map<string, CitationUrl>();
  const bareHosts = new Set<string>();
  const masked = new Set<string>();
  for (const value of [...(row.citedSources || []), ...(row.citedUrl ? [row.citedUrl] : [])]) {
    if (row.aiPlatform === AIPlatform.GEMINI && typeof value === 'string') {
      try {
        if (new URL(value).hostname.toLowerCase().replace(/^www\./, '') === MASKED_GEMINI_HOST) {
          masked.add(value);
          continue;
        }
      } catch { /* malformed citations are ignored */ }
    }
    addFullUrl(value, urls);
  }
  if (row.aiPlatform === AIPlatform.GEMINI) {
    const hints = row.sourceHints && typeof row.sourceHints === 'object'
      ? (row.sourceHints as { sources?: unknown }).sources : null;
    for (const source of Array.isArray(hints) ? hints : []) {
      if (!source || typeof source !== 'object') continue;
      const item = source as Record<string, unknown>;
      for (const value of [item.url, item.uri, item.link, item.title]) {
        if (typeof value === 'string' && /^https?:\/\//i.test(value.trim())) addFullUrl(value, urls, bareHosts);
        else {
          const host = hostnameOnly(value);
          if (host) bareHosts.add(host);
        }
      }
      const domain = hostnameOnly(item.domain);
      if (domain) bareHosts.add(domain);
    }
  }

  metrics.totalCitations += urls.size;
  if (urls.size) metrics.responsesWithCitations++;
  let naver = false, short = false, asset = false;
  const fullHosts = new Set<string>();
  for (const citation of urls.values()) {
    fullHosts.add(citation.host);
    const channel = naverChannel(citation.host);
    if (channel) { metrics.naverCitations++; metrics.naverChannels[channel]++; naver = true; }
    else if (isHost(citation.host, 'naver.me')) { metrics.naverShortCitations++; short = true; }
    else if (isHost(citation.host, 'pstatic.net')) { metrics.naverAssetCitations++; asset = true; }
  }
  if (naver) metrics.naverResponseCount++;
  if (short) metrics.naverShortResponses++;
  if (asset) metrics.naverAssetResponses++;
  if (masked.size) { metrics.geminiMaskedResponses++; metrics.geminiMaskedReferences += masked.size; }
  let naverDomainEvidence = false;
  for (const host of bareHosts) {
    if (fullHosts.has(host)) continue;
    metrics.geminiDomainEvidence.totalDomains++;
    const channel = naverChannel(host);
    if (channel) {
      metrics.geminiDomainEvidence.naverDomains++;
      metrics.geminiDomainEvidence.naverChannels[channel]++;
      naverDomainEvidence = true;
    }
  }
  if (naverDomainEvidence) metrics.geminiDomainEvidence.naverResponses++;
}

@Injectable()
export class NaverSourceAnalysisService {
  constructor(private readonly prisma: PrismaService, private readonly cache: CacheService) {}

  async analyze(hospitalId: string, days: number, now = new Date()) {
    const { fromDate, toDate, from, before } = kstPeriod(days, now);
    const key = `ps:admin:naver-sources:${hospitalId}:${days}:${toDate}`;
    const cached = await this.cache.get<Awaited<ReturnType<NaverSourceAnalysisService['collect']>>>(key);
    if (cached !== null) return cached;
    return withHeavySlot(async () => {
      const result = await this.collect(hospitalId, days, fromDate, toDate, from, before);
      await this.cache.set(key, result, 300);
      return result;
    });
  }

  private async collect(hospitalId: string, days: number, fromDate: string, toDate: string, from: Date, before: Date) {
    const hospital = await this.prisma.hospital.findUnique({ where: { id: hospitalId }, select: { id: true, name: true } });
    if (!hospital) throw new NotFoundException('병원을 찾을 수 없습니다.');
    const metrics = Object.fromEntries(PLATFORMS.map((p) => [p, emptyMetrics()])) as Record<MeasuredPlatform, Metrics>;
    let cursorId: string | null = null;
    for (;;) {
      const rows: NaverSourceRow[] = await this.prisma.aIResponse.findMany({
        where: { hospitalId, aiPlatform: { in: [...PLATFORMS] }, createdAt: { gte: from, lt: before } },
        select: { id: true, aiPlatform: true, createdAt: true, citedSources: true, citedUrl: true, sourceHints: true },
        orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
        take: 400,
        ...(cursorId ? { cursor: { id: cursorId }, skip: 1 } : {}),
      });
      if (!rows.length) break;
      for (const row of rows) if (row.aiPlatform in metrics) aggregateNaverSourceRow(row, metrics[row.aiPlatform as MeasuredPlatform]);
      cursorId = rows[rows.length - 1].id;
      if (rows.length < 400) break;
    }
    return {
      hospital: { id: hospital.id, name: hospital.name }, periodDays: days,
      fromDate, toDate, dateBasis: 'CREATED_AT_KST' as const,
      explanation: '저장된 AI 답변의 출처 인용이며, AI가 네이버를 직접 크롤링한 횟수는 아닙니다.',
      platforms: PLATFORMS.map((platform) => {
        const m = metrics[platform];
        return { platform, ...m,
          naverResponseRatePct: m.totalResponses ? Math.round(m.naverResponseCount / m.totalResponses * 1000) / 10 : 0,
          naverCitationSharePct: m.totalCitations ? Math.round(m.naverCitations / m.totalCitations * 1000) / 10 : 0,
        };
      }),
    };
  }
}
