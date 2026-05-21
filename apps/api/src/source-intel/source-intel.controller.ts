/**
 * Source Intelligence API
 *
 * Endpoints:
 *  POST /source-intel/enrich/:hospitalId    — 백그라운드 enrich 시작
 *  GET  /source-intel/status/:hospitalId    — enrich 진행 상태
 *  GET  /source-intel/top-sources/:hospitalId — Influence 순 TOP 소스
 *  GET  /source-intel/instagram/:hospitalId  — 인스타 인사이트
 *  GET  /source-intel/hint-keywords/:hospitalId — AI hint keyword 집계
 *  GET  /source-intel/source-detail/:snapshotId — 단일 소스 상세
 *  GET  /source-intel/summary/:hospitalId    — 출처 인텔리전스 통합 요약
 */
import { Controller, Get, Param, Post, Query, UseGuards, NotFoundException, Body } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { PrismaClient } from '@prisma/client';
import { SourcePipelineService } from './source-pipeline.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

const prisma = new PrismaClient();

// 진행 상태 in-memory (간단 캐시; 프로덕션에선 Redis 권장)
const ENRICH_STATUS = new Map<string, {
  status: 'idle' | 'running' | 'done' | 'error';
  total: number;
  processed: number;
  newSnapshots: number;
  aiAnalyzed: number;
  failed: number;
  startedAt?: Date;
  finishedAt?: Date;
  error?: string;
  currentUrl?: string;
}>();

@ApiTags('source-intel')
@Controller('source-intel')
@UseGuards(JwtAuthGuard)
export class SourceIntelController {
  constructor(private pipeline: SourcePipelineService) {}

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  @Post('enrich/:hospitalId')
  @ApiOperation({ summary: '인용 URL 일괄 크롤+AI분석 (백그라운드)' })
  async enrich(
    @Param('hospitalId') hospitalId: string,
    @Query('days') days?: string,
    @Query('limit') limit?: string,
    @Query('analyze') analyze?: string,
  ) {
    const existing = ENRICH_STATUS.get(hospitalId);
    if (existing?.status === 'running') {
      return { status: 'already_running', progress: existing };
    }

    ENRICH_STATUS.set(hospitalId, {
      status: 'running',
      total: 0,
      processed: 0,
      newSnapshots: 0,
      aiAnalyzed: 0,
      failed: 0,
      startedAt: new Date(),
    });

    const daysNum = parseInt(days || '30');
    const limitNum = limit ? parseInt(limit) : undefined;
    const analyzeWithAI = analyze !== 'false';

    // fire-and-forget
    (async () => {
      try {
        const result = await this.pipeline.enrichHospital(hospitalId, {
          days: daysNum,
          limit: limitNum,
          concurrency: 4,
          analyzeWithAI,
          onProgress: (p) => {
            const s = ENRICH_STATUS.get(hospitalId);
            if (s) {
              s.processed = p.done;
              s.total = p.total;
              s.currentUrl = p.current;
            }
          },
        });
        ENRICH_STATUS.set(hospitalId, {
          status: 'done',
          total: result.totalUrls,
          processed: result.processed,
          newSnapshots: result.newSnapshots,
          aiAnalyzed: result.aiAnalyzed,
          failed: result.failed,
          startedAt: ENRICH_STATUS.get(hospitalId)?.startedAt,
          finishedAt: new Date(),
        });
      } catch (e: any) {
        ENRICH_STATUS.set(hospitalId, {
          ...ENRICH_STATUS.get(hospitalId)!,
          status: 'error',
          error: e.message,
          finishedAt: new Date(),
        });
      }
    })();

    return { status: 'started', config: { days: daysNum, limit: limitNum, analyzeWithAI } };
  }

  @Get('status/:hospitalId')
  @ApiOperation({ summary: 'enrich 진행 상태' })
  async status(@Param('hospitalId') hospitalId: string) {
    return ENRICH_STATUS.get(hospitalId) || { status: 'idle' };
  }

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  @Get('top-sources/:hospitalId')
  @ApiOperation({ summary: 'Influence Score TOP 소스' })
  async topSources(
    @Param('hospitalId') hospitalId: string,
    @Query('limit') limit?: string,
    @Query('tone') tone?: string, // POSITIVE | NEGATIVE | COMPARATIVE
  ) {
    const limitNum = parseInt(limit || '30');

    // 인용된 URL — 우리 병원 응답에서 등장한 것만
    const since = new Date(); since.setDate(since.getDate() - 30);
    const responses = await prisma.aIResponse.findMany({
      where: { hospitalId, createdAt: { gte: since } },
      select: { citedSources: true, citedUrl: true, sourceHints: true, aiPlatform: true },
    });

    const ourCitedNormalized = new Set<string>();
    for (const r of responses) {
      const raws = [...(r.citedSources || []), ...(r.citedUrl ? [r.citedUrl] : [])];
      // gemini real URLs
      if (r.aiPlatform === 'GEMINI' && r.sourceHints) {
        try {
          const arr = Array.isArray((r.sourceHints as any)?.sources) ? (r.sourceHints as any).sources : [];
          for (const s of arr) {
            if (s.url && typeof s.url === 'string' && !s.url.includes('vertexaisearch')) raws.push(s.url);
          }
        } catch {}
      }
      for (const u of raws) {
        if (typeof u === 'string' && !u.includes('vertexaisearch')) {
          ourCitedNormalized.add(this.normalize(u));
        }
      }
    }

    const allSnapshots = await prisma.citedSourceSnapshot.findMany({
      where: {
        normalizedUrl: { in: Array.from(ourCitedNormalized) },
        fetchStatus: 'success',
      },
      orderBy: { influenceScore: 'desc' },
    });

    // 분석 데이터에 따라 필터
    const filtered = allSnapshots.filter(s => {
      const analysis = (s.hospitalAnalysis as any)?.[hospitalId];
      if (tone) {
        return analysis?.ourTone === tone;
      }
      return true;
    }).slice(0, limitNum);

    return {
      total: filtered.length,
      sources: filtered.map(s => this.serializeSnapshot(s, hospitalId)),
    };
  }

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  @Get('instagram/:hospitalId')
  @ApiOperation({ summary: 'Instagram 인사이트 — 핸들/릴/캡션 분석' })
  async instagram(
    @Param('hospitalId') hospitalId: string,
    @Query('days') days?: string,
  ) {
    const daysNum = parseInt(days || '30');
    const since = new Date(); since.setDate(since.getDate() - daysNum);

    // Hospital
    const hospital = await prisma.hospital.findUnique({
      where: { id: hospitalId },
      select: { name: true, websiteUrl: true, nameAliases: true },
    });
    if (!hospital) throw new NotFoundException('병원 없음');

    // 1) AI 응답에서 인스타 URL 집계
    const responses = await prisma.aIResponse.findMany({
      where: { hospitalId, createdAt: { gte: since } },
      select: {
        citedSources: true,
        citedUrl: true,
        aiPlatform: true,
        isMentioned: true,
        sentimentLabel: true,
        competitorsMentioned: true,
        sourceHints: true,
      },
    });

    type IgUrlStat = {
      url: string;
      count: number;
      platforms: Set<string>;
      mentionedCount: number;
      positive: number;
      negative: number;
      neutral: number;
      coCompetitors: Map<string, number>;
    };

    const igUrlMap = new Map<string, IgUrlStat>();
    let totalCitations = 0;
    let igCitations = 0;

    for (const r of responses) {
      const raws = [...(r.citedSources || []), ...(r.citedUrl ? [r.citedUrl] : [])];
      if (r.aiPlatform === 'GEMINI' && r.sourceHints) {
        try {
          const arr = Array.isArray((r.sourceHints as any)?.sources) ? (r.sourceHints as any).sources : [];
          for (const s of arr) {
            if (s.url && typeof s.url === 'string' && !s.url.includes('vertexaisearch')) raws.push(s.url);
          }
        } catch {}
      }

      for (const url of raws) {
        if (typeof url !== 'string') continue;
        totalCitations++;
        if (!this.isInstagram(url)) continue;
        igCitations++;

        const norm = this.normalize(url);
        if (!igUrlMap.has(norm)) {
          igUrlMap.set(norm, {
            url: norm,
            count: 0,
            platforms: new Set(),
            mentionedCount: 0,
            positive: 0,
            negative: 0,
            neutral: 0,
            coCompetitors: new Map(),
          });
        }
        const m = igUrlMap.get(norm)!;
        m.count++;
        m.platforms.add(r.aiPlatform);
        if (r.isMentioned) m.mentionedCount++;
        const sent = r.sentimentLabel?.toUpperCase();
        if (sent === 'POSITIVE') m.positive++;
        else if (sent === 'NEGATIVE') m.negative++;
        else m.neutral++;
        for (const c of (r.competitorsMentioned || [])) {
          m.coCompetitors.set(c, (m.coCompetitors.get(c) || 0) + 1);
        }
      }
    }

    // 2) Snapshot 매칭 (있으면 메타 첨부)
    const igUrls = Array.from(igUrlMap.keys());
    const snapshots = await prisma.citedSourceSnapshot.findMany({
      where: { normalizedUrl: { in: igUrls } },
    });
    const snapByUrl = new Map(snapshots.map(s => [s.normalizedUrl, s]));

    // 3) URL별 상세
    const igUrls_detail = Array.from(igUrlMap.values())
      .sort((a, b) => b.count - a.count)
      .map(m => {
        const snap = snapByUrl.get(m.url);
        const analysis = snap ? (snap.hospitalAnalysis as any)?.[hospitalId] : null;
        const topCo = Array.from(m.coCompetitors.entries())
          .sort((a, b) => b[1] - a[1])
          .slice(0, 5)
          .map(([name, count]) => ({ name, count }));
        return {
          url: m.url,
          citations: m.count,
          platforms: Array.from(m.platforms),
          mentionedCount: m.mentionedCount,
          mentionRate: m.count > 0 ? Math.round((m.mentionedCount / m.count) * 100) : 0,
          sentiment: { positive: m.positive, negative: m.negative, neutral: m.neutral },
          topCoCompetitors: topCo,
          // snapshot info
          snapshot: snap ? {
            id: snap.id,
            handle: snap.igHandle,
            mediaType: snap.igMediaType,
            title: snap.title,
            caption: snap.igCaption,
            ogImage: snap.ogImage,
            publishedAt: snap.publishedAt,
            fetchStatus: snap.fetchStatus,
            influenceScore: snap.influenceScore,
          } : null,
          analysis: analysis || null,
        };
      });

    // 4) 핸들별 집계
    const handleMap = new Map<string, { handle: string; count: number; urls: number; isOurs: boolean; sentiment: { p: number; n: number; nu: number } }>();
    for (const url of igUrls_detail) {
      let handle = url.snapshot?.handle || this.extractHandleFromUrl(url.url) || '(unknown)';
      if (!handleMap.has(handle)) {
        const isOurs = this.matchesOurHandle(handle, hospital.name, hospital.websiteUrl, hospital.nameAliases);
        handleMap.set(handle, { handle, count: 0, urls: 0, isOurs, sentiment: { p: 0, n: 0, nu: 0 } });
      }
      const h = handleMap.get(handle)!;
      h.count += url.citations;
      h.urls++;
      h.sentiment.p += url.sentiment.positive;
      h.sentiment.n += url.sentiment.negative;
      h.sentiment.nu += url.sentiment.neutral;
    }

    const handles = Array.from(handleMap.values()).sort((a, b) => b.count - a.count);
    const ours = handles.find(h => h.isOurs);

    // 5) AI 플랫폼별
    const aiByPlatform = new Map<string, number>();
    for (const url of igUrls_detail) {
      for (const p of url.platforms) {
        aiByPlatform.set(p, (aiByPlatform.get(p) || 0) + url.citations);
      }
    }

    return {
      hospital: { name: hospital.name },
      period: `최근 ${daysNum}일`,
      summary: {
        totalCitations,
        igCitations,
        igPercent: totalCitations > 0 ? Math.round((igCitations / totalCitations) * 10000) / 100 : 0,
        uniqueUrls: igUrls_detail.length,
        uniqueHandles: handles.length,
        snapshotsAvailable: snapshots.length,
        analyzedCount: igUrls_detail.filter(u => u.analysis).length,
      },
      ourHandle: ours ? {
        handle: ours.handle,
        citations: ours.count,
        urls: ours.urls,
        sharePercent: igCitations > 0 ? Math.round((ours.count / igCitations) * 1000) / 10 : 0,
      } : null,
      aiPlatformDistribution: Array.from(aiByPlatform.entries())
        .map(([p, c]) => ({ platform: p, citations: c, percent: igCitations > 0 ? Math.round((c / igCitations) * 1000) / 10 : 0 }))
        .sort((a, b) => b.citations - a.citations),
      topHandles: handles.slice(0, 15),
      topUrls: igUrls_detail.slice(0, 20),
      diagnosis: this.diagnoseInstagram(igCitations, totalCitations, ours, handles),
    };
  }

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  @Get('hint-keywords/:hospitalId')
  @ApiOperation({ summary: 'AI hint keyword 집계' })
  async hintKeywords(
    @Param('hospitalId') hospitalId: string,
    @Query('days') days?: string,
  ) {
    const daysNum = parseInt(days || '30');
    const since = new Date(); since.setDate(since.getDate() - daysNum);

    const responses = await prisma.aIResponse.findMany({
      where: { hospitalId, createdAt: { gte: since }, sourceHints: { not: null as any } },
      select: { aiPlatform: true, sourceHints: true, isMentioned: true, competitorsMentioned: true },
    });

    type Kw = {
      keyword: string;
      total: number;
      withUs: number;
      withCompetitor: number;
      platforms: Map<string, number>;
      category: string;
    };
    const map = new Map<string, Kw>();

    const categorize = (kw: string): string => {
      const k = kw.toLowerCase();
      if (k.includes('리뷰') || k.includes('평점') || k.includes('후기')) return 'REVIEW_SIGNAL';
      if (k.includes('공식') || k.includes('홈페이지') || k.includes('홈피')) return 'OFFICIAL_SIGNAL';
      if (k.includes('보건') || k.includes('심평원') || k.includes('식약처')) return 'AUTHORITY_SIGNAL';
      if (k.includes('유튜브') || k.includes('영상') || k.includes('동영상')) return 'VIDEO_SIGNAL';
      if (k.includes('인스타') || k.includes('instagram')) return 'SOCIAL_SIGNAL';
      if (k.includes('블로그') || k.includes('카페') || k.includes('포스트')) return 'BLOG_SIGNAL';
      if (k.includes('지도') || k.includes('네이버 플레이스') || k.includes('places')) return 'MAP_SIGNAL';
      if (k.includes('뉴스') || k.includes('기사')) return 'NEWS_SIGNAL';
      return 'OTHER';
    };

    for (const r of responses) {
      const hints = (r.sourceHints as any)?.hintKeywords || [];
      const hasCompetitor = (r.competitorsMentioned || []).length > 0;
      for (const raw of hints) {
        if (typeof raw !== 'string') continue;
        const kw = raw.trim();
        if (!kw || kw.length > 40) continue;
        if (!map.has(kw)) {
          map.set(kw, { keyword: kw, total: 0, withUs: 0, withCompetitor: 0, platforms: new Map(), category: categorize(kw) });
        }
        const m = map.get(kw)!;
        m.total++;
        if (r.isMentioned) m.withUs++;
        if (hasCompetitor) m.withCompetitor++;
        m.platforms.set(r.aiPlatform, (m.platforms.get(r.aiPlatform) || 0) + 1);
      }
    }

    const keywords = Array.from(map.values())
      .sort((a, b) => b.total - a.total)
      .slice(0, 50)
      .map(k => ({
        keyword: k.keyword,
        category: k.category,
        total: k.total,
        withUs: k.withUs,
        withCompetitor: k.withCompetitor,
        usShare: k.total > 0 ? Math.round((k.withUs / k.total) * 100) : 0,
        compShare: k.total > 0 ? Math.round((k.withCompetitor / k.total) * 100) : 0,
        platforms: Array.from(k.platforms.entries()).map(([p, c]) => ({ platform: p, count: c })),
      }));

    // 카테고리 집계
    const byCategory = new Map<string, { category: string; total: number; withUs: number; withCompetitor: number }>();
    for (const k of keywords) {
      if (!byCategory.has(k.category)) byCategory.set(k.category, { category: k.category, total: 0, withUs: 0, withCompetitor: 0 });
      const c = byCategory.get(k.category)!;
      c.total += k.total;
      c.withUs += k.withUs;
      c.withCompetitor += k.withCompetitor;
    }

    return {
      period: `최근 ${daysNum}일`,
      totalUniqueKeywords: keywords.length,
      keywords,
      byCategory: Array.from(byCategory.values()).sort((a, b) => b.total - a.total),
    };
  }

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  @Get('source-detail/:snapshotId')
  @ApiOperation({ summary: '단일 소스 상세 (본문 + 분석)' })
  async sourceDetail(@Param('snapshotId') snapshotId: string, @Query('hospitalId') hospitalId?: string) {
    const snap = await prisma.citedSourceSnapshot.findUnique({ where: { id: snapshotId } });
    if (!snap) throw new NotFoundException('Snapshot not found');
    return this.serializeSnapshot(snap, hospitalId, true);
  }

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  @Get('summary/:hospitalId')
  @ApiOperation({ summary: '출처 인텔리전스 통합 요약' })
  async summary(@Param('hospitalId') hospitalId: string) {
    const since = new Date(); since.setDate(since.getDate() - 30);
    const responses = await prisma.aIResponse.findMany({
      where: { hospitalId, createdAt: { gte: since } },
      select: { citedSources: true, citedUrl: true, sourceHints: true, aiPlatform: true },
    });
    const ourUrls = new Set<string>();
    for (const r of responses) {
      const raws = [...(r.citedSources || []), ...(r.citedUrl ? [r.citedUrl] : [])];
      if (r.aiPlatform === 'GEMINI' && r.sourceHints) {
        try {
          const arr = Array.isArray((r.sourceHints as any)?.sources) ? (r.sourceHints as any).sources : [];
          for (const s of arr) if (s.url && typeof s.url === 'string' && !s.url.includes('vertexaisearch')) raws.push(s.url);
        } catch {}
      }
      for (const u of raws) {
        if (typeof u === 'string' && !u.includes('vertexaisearch')) ourUrls.add(this.normalize(u));
      }
    }

    const snaps = await prisma.citedSourceSnapshot.findMany({
      where: { normalizedUrl: { in: Array.from(ourUrls) } },
      select: {
        id: true, fetchStatus: true, sourceType: true, authorityScore: true,
        influenceScore: true, hospitalAnalysis: true, totalCitations: true,
      },
    });

    let analyzed = 0, mentionsUs = 0, positive = 0, negative = 0, comparative = 0, neutral = 0;
    let outdated = 0, incorrect = 0;
    const positiveQuotes: { quote: string; url: string; snapId: string }[] = [];
    const negativeQuotes: { quote: string; url: string; snapId: string }[] = [];
    const accuracyIssues: { url: string; snapId: string; action: string | null; type: string }[] = [];

    for (const s of snaps) {
      const a = (s.hospitalAnalysis as any)?.[hospitalId];
      if (a) {
        analyzed++;
        if (a.mentionsUs) mentionsUs++;
        if (a.ourTone === 'POSITIVE') positive++;
        else if (a.ourTone === 'NEGATIVE') negative++;
        else if (a.ourTone === 'COMPARATIVE') comparative++;
        else if (a.ourTone === 'NEUTRAL') neutral++;
        if (a.claimAccuracy === 'OUTDATED') outdated++;
        if (a.claimAccuracy === 'INCORRECT') incorrect++;
        if (a.ourTone === 'POSITIVE' && a.extractedQuote) {
          positiveQuotes.push({ quote: a.extractedQuote, url: '', snapId: s.id });
        }
        if (a.ourTone === 'NEGATIVE' && a.extractedQuote) {
          negativeQuotes.push({ quote: a.extractedQuote, url: '', snapId: s.id });
        }
        if ((a.claimAccuracy === 'OUTDATED' || a.claimAccuracy === 'INCORRECT')) {
          accuracyIssues.push({ url: '', snapId: s.id, action: a.recommendedAction, type: a.claimAccuracy });
        }
      }
    }

    return {
      totalSnapshots: snaps.length,
      analyzed,
      coverage: snaps.length > 0 ? Math.round((analyzed / snaps.length) * 100) : 0,
      mentionsUs,
      toneDistribution: {
        positive, negative, comparative, neutral,
        positiveRate: analyzed > 0 ? Math.round((positive / analyzed) * 100) : 0,
        negativeRate: analyzed > 0 ? Math.round((negative / analyzed) * 100) : 0,
      },
      accuracyIssues: { outdated, incorrect, total: outdated + incorrect },
      positiveQuotes: positiveQuotes.slice(0, 10),
      negativeQuotes: negativeQuotes.slice(0, 10),
      accuracyAlerts: accuracyIssues.slice(0, 10),
    };
  }

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // 헬퍼
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  private normalize(url: string): string {
    try {
      const u = new URL(url);
      const params = u.searchParams;
      const toRemove: string[] = [];
      params.forEach((_, k) => {
        if (k.startsWith('utm_') || ['ref', 'source', 'fbclid', 'gclid'].includes(k.toLowerCase())) toRemove.push(k);
      });
      toRemove.forEach(k => params.delete(k));
      let n = `${u.protocol}//${u.hostname}${u.pathname}`;
      const qs = params.toString();
      if (qs) n += '?' + qs;
      return n.replace(/\/$/, '');
    } catch { return url; }
  }

  private isInstagram(url: string): boolean {
    try {
      const h = new URL(url).hostname.toLowerCase();
      return h === 'instagram.com' || h === 'www.instagram.com' || h.endsWith('.instagram.com');
    } catch { return false; }
  }

  private extractHandleFromUrl(url: string): string | null {
    try {
      const u = new URL(url);
      const path = u.pathname.replace(/^\/+|\/+$/g, '');
      if (!path) return null;
      const seg = path.split('/')[0]?.toLowerCase();
      if (!seg) return null;
      if (['p', 'reel', 'reels', 'stories', 'explore', 'popular', 'tv', 'tags'].includes(seg)) return `(${seg})`;
      return `@${seg}`;
    } catch { return null; }
  }

  private matchesOurHandle(handle: string, name: string, website?: string | null, aliases?: string[]): boolean {
    if (!handle || handle.startsWith('(')) return false;
    const h = handle.replace(/^@/, '').toLowerCase();
    const tokens = new Set<string>();
    const nameSlug = name.toLowerCase().replace(/치과의원|치과|병원|의원/g, '').replace(/[^a-z0-9가-힣]/g, '');
    if (nameSlug) tokens.add(nameSlug);
    for (const al of (aliases || [])) {
      tokens.add(al.toLowerCase().replace(/[^a-z0-9]/g, ''));
    }
    if (website) {
      try {
        const host = new URL(website).hostname.replace(/^www\./, '').split('.')[0];
        if (host) tokens.add(host.toLowerCase());
      } catch {}
    }
    // 핸들에 토큰 조각이 들어있는지
    for (const t of tokens) {
      if (t && t.length >= 3 && h.includes(t)) return true;
    }
    return false;
  }

  private diagnoseInstagram(igCount: number, total: number, ours: any, handles: any[]): string[] {
    const diag: string[] = [];
    const pct = total > 0 ? (igCount / total) * 100 : 0;
    if (pct > 5) diag.push(`⚠️ 인스타 인용 ${pct.toFixed(1)}% — 일반 평균(1~3%) 대비 높음. Perplexity 영향 가능성 큼`);
    if (!ours || ours.count < 10) diag.push('🚨 우리 병원 공식 인스타가 AI 인용 풀에 거의 노출 안됨');
    const topNonOurs = handles.filter(h => !h.isOurs).slice(0, 1)[0];
    if (topNonOurs && topNonOurs.count > 50) diag.push(`🎯 ${topNonOurs.handle}이(가) ${topNonOurs.count}회 인용 — 벤치마크 대상`);
    return diag;
  }

  private serializeSnapshot(s: any, hospitalId?: string, includeBody = false) {
    const analysis = hospitalId ? (s.hospitalAnalysis as any)?.[hospitalId] : null;
    return {
      id: s.id,
      url: s.url,
      normalizedUrl: s.normalizedUrl,
      domain: s.domain,
      sourceType: s.sourceType,
      category: s.category,
      authorityScore: s.authorityScore,
      title: s.title,
      description: s.description,
      ogImage: s.ogImage,
      author: s.author,
      publisher: s.publisher,
      publishedAt: s.publishedAt,
      language: s.language,
      bodyLength: s.bodyLength,
      wordCount: s.wordCount,
      bodyText: includeBody ? s.bodyText : undefined,
      igHandle: s.igHandle,
      igMediaType: s.igMediaType,
      igCaption: s.igCaption,
      fetchStatus: s.fetchStatus,
      fetchedAt: s.fetchedAt,
      freshnessScore: s.freshnessScore,
      totalCitations: s.totalCitations,
      citingAiPlatforms: s.citingAiPlatforms,
      influenceScore: s.influenceScore,
      lastCitedAt: s.lastCitedAt,
      analysis,
    };
  }
}
