/**
 * Source Pipeline — 인용 URL을 받아서 크롤 → 분석 → 저장 → Influence Score 계산까지 처리하는 통합 서비스
 *
 * 호출 흐름:
 *  enrichHospital(hospitalId) — 우리 병원이 인용된 모든 URL을 일괄 처리
 *  enrichUrl(url, hospital) — 단일 URL 처리
 */
import { Injectable, Logger } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { SourceCrawlerService, CrawlResult } from './source-crawler.service';
import { SourceAnalyzerService, HospitalAnalysis } from './source-analyzer.service';
import { classifyDomain, isOwnHospital } from '../ai-crawler/breadth.classifier';

const prisma = new PrismaClient();

const EXTRACT_REAL_DOMAIN = (s: any): string | null => {
  if (!s || typeof s !== 'object') return null;
  const t = (s.title || '').toString().trim().toLowerCase();
  const d = (s.domain || '').toString().trim().toLowerCase();
  const ok = (x: string) => x.length > 0 && x.includes('.') && !x.includes(' ') && !x.includes('vertexaisearch');
  if (ok(t)) return t.replace(/^www\./, '');
  if (ok(d)) return d.replace(/^www\./, '');
  return null;
};

function normalizeUrl(url: string): string {
  try {
    const u = new URL(url);
    // utm/ref/fbclid 제거
    const params = u.searchParams;
    const toRemove: string[] = [];
    params.forEach((_, k) => {
      if (k.startsWith('utm_') || ['ref', 'source', 'fbclid', 'gclid'].includes(k.toLowerCase())) {
        toRemove.push(k);
      }
    });
    toRemove.forEach(k => params.delete(k));
    let normalized = `${u.protocol}//${u.hostname}${u.pathname}`;
    const qs = params.toString();
    if (qs) normalized += '?' + qs;
    return normalized.replace(/\/$/, '');
  } catch {
    return url;
  }
}

function getDomain(url: string): string | null {
  try {
    return new URL(url).hostname.replace(/^www\./, '').toLowerCase();
  } catch { return null; }
}

function detectSourceType(url: string, domain: string): string {
  if (domain === 'instagram.com') {
    if (url.includes('/reel/') || url.includes('/reels/')) return 'instagram_reel';
    if (url.includes('/p/')) return 'instagram_post';
    if (url.includes('/stories/')) return 'instagram_story';
    return 'instagram_profile';
  }
  if (domain.includes('youtube.com') || domain === 'youtu.be') return 'youtube_video';
  if (domain.includes('tistory.com')) return 'tistory_blog';
  if (domain.includes('blog.naver.com') || domain === 'blog.naver.com') return 'naver_blog';
  if (domain.includes('cafe.naver.com')) return 'naver_cafe';
  if (domain.includes('m.search.naver.com') || domain === 'search.naver.com') return 'naver_search';
  if (domain.includes('kin.naver.com')) return 'naver_kin';
  if (domain === 'modoodoc.com' || domain === 'goodoc.co.kr' || domain === 'hidoc.co.kr') return 'medical_portal';
  if (domain.endsWith('.ac.kr') || domain.endsWith('.go.kr')) return 'official';
  return 'web';
}

@Injectable()
export class SourcePipelineService {
  private readonly logger = new Logger(SourcePipelineService.name);

  constructor(
    private crawler: SourceCrawlerService,
    private analyzer: SourceAnalyzerService,
  ) {}

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // 단일 URL 처리 (이미 snapshot이 있으면 캐시 사용, 없으면 새로 크롤)
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  async enrichUrl(
    url: string,
    hospitalInfo: {
      hospitalId: string;
      name: string;
      websiteUrl?: string | null;
      nameAliases?: string[];
    },
    options: { force?: boolean; analyzeWithAI?: boolean } = {},
  ): Promise<{ snapshot: any; isNew: boolean; analyzed: boolean }> {
    const normalized = normalizeUrl(url);
    const domain = getDomain(url);
    if (!domain) {
      throw new Error(`Invalid URL: ${url}`);
    }

    // 기존 snapshot 확인
    const existing = await prisma.citedSourceSnapshot.findUnique({ where: { url } });

    let snapshot = existing;
    let isNew = false;

    // 새로 크롤 필요한 경우
    if (!existing || options.force) {
      const crawlResult = await this.crawler.crawl(url);
      const sourceType = detectSourceType(url, domain);
      const breadth = classifyDomain(domain);
      const isOwn = isOwnHospital(domain, hospitalInfo.name, hospitalInfo.websiteUrl, hospitalInfo.nameAliases);
      const effectiveCategory = isOwn ? 'HOSPITAL_OFFICIAL' : breadth.category;
      const effectiveAuthority = isOwn ? Math.max(8, breadth.authority) : breadth.authority;

      const data: any = {
        url,
        normalizedUrl: normalized,
        domain,
        sourceType: isOwn ? 'hospital_official' : sourceType,
        category: effectiveCategory,
        authorityScore: effectiveAuthority,
        title: crawlResult.title || null,
        description: crawlResult.description || null,
        ogImage: crawlResult.ogImage || null,
        author: crawlResult.author || null,
        publisher: crawlResult.publisher || null,
        publishedAt: crawlResult.publishedAt || null,
        language: crawlResult.language || null,
        bodyText: crawlResult.bodyText || null,
        bodyLength: crawlResult.bodyLength || null,
        wordCount: crawlResult.wordCount || null,
        igHandle: crawlResult.igHandle || null,
        igMediaType: crawlResult.igMediaType || null,
        igCaption: crawlResult.igCaption || null,
        fetchStatus: crawlResult.fetchStatus,
        fetchedAt: new Date(),
        httpStatus: crawlResult.httpStatus || null,
        fetchErrorMessage: crawlResult.errorMessage || null,
        fetchDurationMs: crawlResult.durationMs || null,
        freshnessScore: this.calcFreshness(crawlResult.publishedAt),
      };

      if (existing) {
        snapshot = await prisma.citedSourceSnapshot.update({ where: { url }, data });
      } else {
        snapshot = await prisma.citedSourceSnapshot.create({ data });
        isNew = true;
      }
    }

    // AI 분석 (옵션 & 본문 있을 때만)
    let analyzed = false;
    if (options.analyzeWithAI !== false && snapshot && snapshot.fetchStatus === 'success' && snapshot.bodyText) {
      const existingAnalysis = (snapshot.hospitalAnalysis as Record<string, any>) || {};
      if (options.force || !existingAnalysis[hospitalInfo.hospitalId]) {
        const result = await this.analyzer.analyze({
          hospitalName: hospitalInfo.name,
          hospitalAliases: hospitalInfo.nameAliases,
          hospitalWebsite: hospitalInfo.websiteUrl,
          pageTitle: snapshot.title,
          pageDescription: snapshot.description,
          pageBody: snapshot.bodyText,
          pagePublisher: snapshot.publisher,
          pageUrl: url,
        });

        if (result) {
          const merged = { ...existingAnalysis, [hospitalInfo.hospitalId]: result };
          snapshot = await prisma.citedSourceSnapshot.update({
            where: { url },
            data: { hospitalAnalysis: merged },
          });
          analyzed = true;
        }
      }
    }

    return { snapshot, isNew, analyzed };
  }

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // 병원 단위 일괄 처리 — 인용된 모든 URL을 크롤+분석
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  async enrichHospital(
    hospitalId: string,
    options: { days?: number; limit?: number; concurrency?: number; analyzeWithAI?: boolean; onProgress?: (p: { done: number; total: number; current?: string }) => void } = {},
  ): Promise<{
    totalUrls: number;
    processed: number;
    newSnapshots: number;
    aiAnalyzed: number;
    failed: number;
    errors: { url: string; error: string }[];
  }> {
    const days = options.days || 30;
    const concurrency = options.concurrency || 4;
    const since = new Date();
    since.setDate(since.getDate() - days);

    const hospital = await prisma.hospital.findUnique({
      where: { id: hospitalId },
      select: { name: true, websiteUrl: true, nameAliases: true },
    });
    if (!hospital) throw new Error('Hospital not found');

    // 1) 모든 인용 URL 수집 (Gemini 디코딩 포함)
    const responses = await prisma.aIResponse.findMany({
      where: { hospitalId, createdAt: { gte: since } },
      select: {
        citedSources: true,
        citedUrl: true,
        aiPlatform: true,
        sourceHints: true,
        isMentioned: true,
      },
    });

    // URL → {count, platforms, mentionedCount} 집계
    const urlMap = new Map<string, { count: number; platforms: Set<string>; mentionedCount: number; lastCited: Date }>();
    for (const r of responses) {
      const raws = [...(r.citedSources || []), ...(r.citedUrl ? [r.citedUrl] : [])];
      // Gemini hints
      const hints: string[] = [];
      if (r.aiPlatform === 'GEMINI' && r.sourceHints) {
        try {
          const arr = Array.isArray((r.sourceHints as any)?.sources) ? (r.sourceHints as any).sources : [];
          for (const s of arr) {
            if (s.url && typeof s.url === 'string' && !s.url.includes('vertexaisearch')) hints.push(s.url);
          }
        } catch {}
      }

      const allUrls = [...raws];
      // Gemini redirect → 실제 URL이 source_hints.sources[].url에 있으면 우선 사용
      for (const u of hints) {
        if (u && !allUrls.includes(u)) allUrls.push(u);
      }

      for (const url of allUrls) {
        if (!url || typeof url !== 'string') continue;
        if (url.includes('vertexaisearch.cloud.google.com')) continue; // 디코딩 불가한 리다이렉트 스킵
        const normalized = normalizeUrl(url);
        if (!urlMap.has(normalized)) {
          urlMap.set(normalized, { count: 0, platforms: new Set(), mentionedCount: 0, lastCited: new Date() });
        }
        const m = urlMap.get(normalized)!;
        m.count++;
        m.platforms.add(r.aiPlatform);
        if (r.isMentioned) m.mentionedCount++;
      }
    }

    // 인용 횟수 순으로 정렬 → 한도 적용
    let urls = Array.from(urlMap.entries()).sort((a, b) => b[1].count - a[1].count);
    if (options.limit && options.limit > 0) urls = urls.slice(0, options.limit);
    const totalUrls = urls.length;

    let processed = 0, newSnapshots = 0, aiAnalyzed = 0, failed = 0;
    const errors: { url: string; error: string }[] = [];

    // 동시 처리 (chunked)
    const chunks: typeof urls[] = [];
    for (let i = 0; i < urls.length; i += concurrency) {
      chunks.push(urls.slice(i, i + concurrency));
    }

    for (const chunk of chunks) {
      await Promise.all(chunk.map(async ([url, meta]) => {
        try {
          const { snapshot, isNew, analyzed } = await this.enrichUrl(
            url,
            { hospitalId, name: hospital.name, websiteUrl: hospital.websiteUrl, nameAliases: hospital.nameAliases },
            { analyzeWithAI: options.analyzeWithAI !== false },
          );
          if (snapshot) {
            // 인용 통계 업데이트
            await prisma.citedSourceSnapshot.update({
              where: { url },
              data: {
                totalCitations: meta.count,
                citingAiPlatforms: Array.from(meta.platforms),
                lastCitedAt: meta.lastCited,
                influenceScore: this.calcInfluence(snapshot, meta),
              },
            });
          }
          if (isNew) newSnapshots++;
          if (analyzed) aiAnalyzed++;
          processed++;
          options.onProgress?.({ done: processed, total: totalUrls, current: url });
        } catch (e: any) {
          failed++;
          errors.push({ url, error: e.message?.substring(0, 200) || 'Unknown' });
        }
      }));
    }

    return { totalUrls, processed, newSnapshots, aiAnalyzed, failed, errors };
  }

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // Influence Score = (Authority × 0.3) + (CitationFreq × 0.25)
  //                 + (Cross-AI × 0.2) + (Freshness × 0.15) + (Tone × 0.1)
  // 결과: 0~10 점수
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  private calcInfluence(snapshot: any, meta: { count: number; platforms: Set<string>; mentionedCount: number }): number {
    const authority = (snapshot.authorityScore || 5) / 10;
    // citation frequency: log scale, 100회 = 1.0
    const freq = Math.min(1, Math.log10(meta.count + 1) / 2);
    const crossAI = Math.min(1, meta.platforms.size / 7);
    const freshness = snapshot.freshnessScore || 0.5;
    // tone: 분석 안된 상태면 0.5
    let tone = 0.5;
    const analysis = snapshot.hospitalAnalysis;
    if (analysis && typeof analysis === 'object') {
      const tones = Object.values(analysis).map((a: any) => a?.ourTone);
      if (tones.includes('POSITIVE')) tone = 1;
      else if (tones.includes('NEGATIVE')) tone = 0;
      else if (tones.includes('COMPARATIVE')) tone = 0.4;
    }

    const score =
      authority * 0.3 +
      freq * 0.25 +
      crossAI * 0.2 +
      freshness * 0.15 +
      tone * 0.1;

    return Math.round(score * 1000) / 100; // 0~10
  }

  private calcFreshness(publishedAt?: Date | null): number {
    if (!publishedAt) return 0.5;
    const ageMs = Date.now() - publishedAt.getTime();
    const ageDays = ageMs / (24 * 60 * 60 * 1000);
    if (ageDays < 0) return 1; // 미래 (잘못된 데이터)
    if (ageDays <= 7) return 1.0;
    if (ageDays <= 30) return 0.85;
    if (ageDays <= 90) return 0.7;
    if (ageDays <= 365) return 0.5;
    if (ageDays <= 730) return 0.3;
    return 0.15;
  }
}
