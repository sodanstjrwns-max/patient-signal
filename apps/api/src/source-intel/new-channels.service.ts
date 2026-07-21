/**
 * 신규 인용 채널 탐지 서비스
 *
 * 최근 윈도우(기본 30일) vs 베이스라인(그 이전 60일)을 비교해
 * AI 응답 인용 출처에서 새로 나타났거나 급성장한 도메인을 탐지한다.
 *
 * 분류:
 *  - NEW: 베이스라인 0회 → 최근 minCitations회 이상
 *  - SURGING: 베이스라인 소량 → 최근 5배 이상 성장
 *
 * 카테고리 휴리스틱:
 *  - social: 소셜 플랫폼
 *  - directory: 병원 디렉토리/예약/가격비교
 *  - hospital_site: 병원 자체 사이트로 추정 (dental/plant/ortho 등 토큰)
 *  - satellite_suspect: 위성 사이트(PBN) 의심 — 익명 TLD + 범용 영단어 도메인
 *  - wiki_media: 위키/미디어/커뮤니티
 *  - other
 */
import { Injectable } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { CacheService } from '../common/cache/cache.service';

const prisma = new PrismaClient();

const SOCIAL_DOMAINS = new Set([
  'instagram.com', 'tiktok.com', 'facebook.com', 'threads.com', 'threads.net',
  'reddit.com', 'x.com', 'twitter.com', 'youtube.com', 'youtu.be',
  'blog.naver.com', 'cafe.naver.com', 'm.cafe.naver.com', 'post.naver.com',
  'brunch.co.kr', 'daangn.com', 'linkedin.com', 'pinterest.com',
]);

const DIRECTORY_DOMAINS = new Set([
  '114.co.kr', 'goodoc.co.kr', 'unni.app', 'gangnamunni.com', 'jp.gangnamunni.com',
  'modoodoc.com', 'booking.naver.com', 'map.naver.com', 'hidoc.co.kr', 'mobile.hidoc.co.kr',
  'banksalad.com', 'cashwalk.com', 'cashdoc.me', 'whatclinic.com', 'placidway.com',
  'bookimed.com', 'us-uk.bookimed.com', 'icloudhospital.com', 'dentavacation.com',
  'medicaltravelkorea.com', 'koreadentaltourism.com', 'koreaclinicguide.com',
  'creatrip.com', 'konest.com', 'yeoshin.co.kr', 'zippoom.com', 'ssomeday.com',
]);

const WIKI_MEDIA_DOMAINS = new Set([
  'namu.wiki', 'ja.namu.wiki', 'wikipedia.org', 'zh.wikipedia.org', 'ja.wikipedia.org',
  'mk.co.kr', 'health.chosun.com', 'dmedinews.com', 'ebianews.com', 'jfdaily.com',
  'hira.or.kr', 'nhis.or.kr', 'dentalblog.kr',
]);

// 위성 사이트 의심 시그널: 익명성 높은 TLD
const SUSPECT_TLDS = ['xyz', 'site', 'online', 'club', 'top', 'icu', 'space', 'store'];
// 범용 영단어 조합 (언론사/블로그 위장 패턴)
const SUSPECT_NAME_PATTERN = /(guide|journal|insight|media|center|centre|expert|open|daily|today|review|hub|post|news|learning|report|times|weekly|magazine)/i;

const HOSPITAL_SITE_PATTERN = /(dental|dent(?![a-z])|plant|implant|ortho|chika|clinic|dc(?=\.|-)|tooth|teeth|smile|denti)/i;

export interface NewChannelEntry {
  domain: string;
  category: 'social' | 'directory' | 'hospital_site' | 'satellite_suspect' | 'wiki_media' | 'other';
  status: 'NEW' | 'SURGING';
  isOurs: boolean;
  recentCount: number;
  baselineCount: number;
  growthX: number | null; // 배수 (baseline 0이면 null)
  platforms: Record<string, number>;
  mentionRate: number; // 이 도메인이 인용된 응답 중 우리 병원 언급 비율 (%)
  firstSeenAt: string | null;
  sampleUrls: { url: string; count: number }[];
}

export interface NewChannelsResult {
  windowDays: number;
  baselineDays: number;
  minCitations: number;
  totals: {
    recentDomains: number;
    newDomains: number;
    surgingDomains: number;
    satelliteSuspects: number;
  };
  channels: NewChannelEntry[];
  generatedAt: string;
}

@Injectable()
export class NewChannelsService {
  constructor(private cache: CacheService) {}

  async detect(
    hospitalId: string,
    options?: { windowDays?: number; baselineDays?: number; minCitations?: number },
  ): Promise<NewChannelsResult> {
    const windowDays = Math.min(Math.max(options?.windowDays ?? 30, 7), 90);
    const baselineDays = Math.min(Math.max(options?.baselineDays ?? 60, 14), 180);
    const minCitations = Math.min(Math.max(options?.minCitations ?? 10, 3), 100);

    const cacheKey = `source-intel:new-channels:${hospitalId}:${windowDays}:${baselineDays}:${minCitations}`;
    return this.cache.getOrSet(cacheKey, 6 * 3600, () =>
      this.compute(hospitalId, windowDays, baselineDays, minCitations),
    );
  }

  /**
   * 집계는 전부 DB(SQL)에서 수행 — 90일치 응답 원본을 앱으로 끌어오면
   * 수십만 URL 행 전송으로 타임아웃 나므로 (실측 3분+) unnest 집계로 처리.
   */
  private async compute(
    hospitalId: string,
    windowDays: number,
    baselineDays: number,
    minCitations: number,
  ): Promise<NewChannelsResult> {
    if (!/^[0-9a-f-]{36}$/i.test(hospitalId)) {
      throw new Error('invalid hospitalId');
    }
    const now = new Date();
    const windowStart = new Date(now.getTime() - windowDays * 86400_000);
    const baselineStart = new Date(windowStart.getTime() - baselineDays * 86400_000);
    const wsIso = windowStart.toISOString();
    const bsIso = baselineStart.toISOString();

    // 우리 병원 도메인 (isOurs 판정)
    const hospital = await prisma.hospital.findUnique({
      where: { id: hospitalId },
      select: { websiteUrl: true },
    });
    const ourDomain = this.rootDomain(hospital?.websiteUrl || '');

    // 공통 CTE: 응답 → URL 전개 (citedSources + citedUrl + Gemini sourceHints 실URL)
    // sinceIso로 스캔 범위를 좁힐 수 있게 함수화 (②③는 recent 윈도우만 필요)
    const urlsCte = (sinceIso: string) => `
      WITH urls AS (
        SELECT r.id AS rid, r.ai_platform AS plat, r.is_mentioned AS men, r.created_at AS ct,
               lower(regexp_replace(regexp_replace(regexp_replace(u.url, '^https?://', ''), '^(www|m)\\.', ''), '[/:?#].*$', '')) AS domain,
               regexp_replace(regexp_replace(u.url, '[?#].*$', ''), '/$', '') AS norm_url
        FROM ai_responses r
        CROSS JOIN LATERAL (
          SELECT unnest(r.cited_sources) AS url
          UNION ALL
          SELECT r.cited_url WHERE r.cited_url IS NOT NULL
          UNION ALL
          SELECT src->>'url'
          FROM jsonb_array_elements(
            CASE WHEN r.ai_platform = 'GEMINI' AND jsonb_typeof(r.source_hints->'sources') = 'array'
                 THEN r.source_hints->'sources' ELSE '[]'::jsonb END
          ) AS src
        ) u
        WHERE r.hospital_id = '${hospitalId}'
          AND r.created_at >= '${sinceIso}'
          AND u.url LIKE 'http%'
          AND u.url NOT LIKE '%vertexaisearch%'
      )`;

    // ① 도메인 단위 집계
    const domainRows = await prisma.$queryRawUnsafe<Array<{
      domain: string;
      recent: number;
      baseline: number;
      recent_responses: number;
      mentioned: number;
      first_seen: Date | null;
    }>>(`
      ${urlsCte(bsIso)}
      SELECT domain,
             count(*) FILTER (WHERE ct >= '${wsIso}')::int AS recent,
             count(*) FILTER (WHERE ct < '${wsIso}')::int AS baseline,
             count(DISTINCT rid) FILTER (WHERE ct >= '${wsIso}')::int AS recent_responses,
             count(DISTINCT rid) FILTER (WHERE ct >= '${wsIso}' AND men)::int AS mentioned,
             min(ct) FILTER (WHERE ct >= '${wsIso}') AS first_seen
      FROM urls
      WHERE domain != ''
      GROUP BY domain
    `);

    const recentDomains = domainRows.filter(r => r.recent > 0).length;

    // NEW/SURGING 후보 선별
    type Candidate = (typeof domainRows)[number] & { status: 'NEW' | 'SURGING' };
    const candidates: Candidate[] = [];
    for (const r of domainRows) {
      if (r.recent < minCitations) continue;
      if (r.baseline === 0) candidates.push({ ...r, status: 'NEW' });
      else if (r.recent >= r.baseline * 5 && r.baseline < minCitations)
        candidates.push({ ...r, status: 'SURGING' });
    }
    candidates.sort((a, b) => b.recent - a.recent);
    const topCandidates = candidates.slice(0, 50);

    // ② 후보 도메인의 플랫폼 분해 + 샘플 URL (후보가 있을 때만)
    const platMap = new Map<string, Record<string, number>>();
    const urlMap = new Map<string, { url: string; count: number }[]>();
    if (topCandidates.length > 0) {
      const domainList = topCandidates
        .map(c => `'${c.domain.replace(/'/g, "''")}'`)
        .join(',');

      const platRows = await prisma.$queryRawUnsafe<Array<{ domain: string; plat: string; cnt: number }>>(`
        ${urlsCte(wsIso)}
        SELECT domain, plat, count(*)::int AS cnt
        FROM urls
        WHERE ct >= '${wsIso}' AND domain IN (${domainList})
        GROUP BY domain, plat
      `);
      for (const r of platRows) {
        const m = platMap.get(r.domain) || {};
        m[r.plat] = r.cnt;
        platMap.set(r.domain, m);
      }

      const urlRows = await prisma.$queryRawUnsafe<Array<{ domain: string; norm_url: string; cnt: number }>>(`
        ${urlsCte(wsIso)}
        SELECT domain, norm_url, cnt FROM (
          SELECT domain, norm_url, count(*)::int AS cnt,
                 row_number() OVER (PARTITION BY domain ORDER BY count(*) DESC) AS rn
          FROM urls
          WHERE ct >= '${wsIso}' AND domain IN (${domainList})
          GROUP BY domain, norm_url
        ) t WHERE rn <= 3
      `);
      for (const r of urlRows) {
        const arr = urlMap.get(r.domain) || [];
        arr.push({ url: r.norm_url, count: r.cnt });
        urlMap.set(r.domain, arr);
      }
    }

    const channels: NewChannelEntry[] = topCandidates.map(c => ({
      domain: c.domain,
      category: this.categorize(c.domain),
      status: c.status,
      isOurs: !!ourDomain && c.domain === ourDomain,
      recentCount: c.recent,
      baselineCount: c.baseline,
      growthX: c.baseline > 0 ? Math.round((c.recent / c.baseline) * 10) / 10 : null,
      platforms: platMap.get(c.domain) || {},
      mentionRate: c.recent_responses > 0 ? Math.round((c.mentioned / c.recent_responses) * 100) : 0,
      firstSeenAt: c.first_seen ? new Date(c.first_seen).toISOString() : null,
      sampleUrls: (urlMap.get(c.domain) || []).sort((a, b) => b.count - a.count),
    }));
    return {
      windowDays,
      baselineDays,
      minCitations,
      totals: {
        recentDomains,
        newDomains: candidates.filter(c => c.status === 'NEW').length,
        surgingDomains: candidates.filter(c => c.status === 'SURGING').length,
        satelliteSuspects: channels.filter(c => c.category === 'satellite_suspect').length,
      },
      channels,
      generatedAt: new Date().toISOString(),
    };
  }

  // ── 헬퍼 ──────────────────────────────────────────────

  /** 서브도메인 유지하되 www/m 프리픽스만 제거한 도메인 */
  private rootDomain(url: string): string {
    try {
      const h = new URL(url).hostname.toLowerCase();
      return h.replace(/^(www|m)\./, '');
    } catch {
      return '';
    }
  }

  private categorize(domain: string): NewChannelEntry['category'] {
    if (SOCIAL_DOMAINS.has(domain)) return 'social';
    if (DIRECTORY_DOMAINS.has(domain)) return 'directory';
    if (WIKI_MEDIA_DOMAINS.has(domain) || [...WIKI_MEDIA_DOMAINS].some(d => domain.endsWith('.' + d) || domain.endsWith(d)))
      return 'wiki_media';

    const tld = domain.split('.').pop() || '';
    const name = domain.split('.').slice(0, -1).join('.');

    // 위성 사이트 의심: 익명 TLD 또는 (org/net + 범용 영단어 조합 + 병원 토큰 없음)
    if (SUSPECT_TLDS.includes(tld)) return 'satellite_suspect';
    if (
      ['org', 'net'].includes(tld) &&
      SUSPECT_NAME_PATTERN.test(name) &&
      !HOSPITAL_SITE_PATTERN.test(name)
    ) {
      return 'satellite_suspect';
    }

    if (HOSPITAL_SITE_PATTERN.test(domain)) return 'hospital_site';
    return 'other';
  }
}
