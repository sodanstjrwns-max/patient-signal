import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';
import Anthropic from '@anthropic-ai/sdk';

/**
 * ═══════════════════════════════════════════════════════════
 *  AI 인용 역분석 서비스 v2.0
 * 
 *  핵심 플로우:
 *  1. 병원의 최근 크롤링/라이브 쿼리에서 인용된 URL 수집
 *  2. 상위 인용 페이지를 실제 크롤링하여 콘텐츠 구조 분석
 *  3. "AI가 왜 이 페이지를 인용했는지" 패턴 추출
 *  4. 우리 병원 콘텐츠와 GAP 비교
 *  5. 구체 지시어 생성 ("이 블로그에 ___를 추가하세요")
 *  6. 56주 콘텐츠 캘린더 연동 (역분석 → 캘린더 자동 주입)
 *  7. GEO 콘텐츠 생성 시 역분석 결과를 프롬프트에 반영
 * ═══════════════════════════════════════════════════════════
 */

export interface CrawledPage {
  url: string;
  domain: string;
  title: string;
  content: string;        // 본문 텍스트 (최대 3000자)
  headings: string[];     // H2/H3 목록
  hasTables: boolean;
  hasLists: boolean;
  hasFaq: boolean;
  hasSchema: boolean;     // JSON-LD 스키마 마크업 포함 여부
  hasNumbers: boolean;    // 구체적 수치 포함 여부
  wordCount: number;
  citedByPlatforms: string[];
  citationCount: number;
}

export interface CitationPattern {
  avgWordCount: number;
  avgHeadingCount: number;
  tableRatio: number;
  listRatio: number;
  faqRatio: number;
  schemaRatio: number;
  numberDensity: number;       // 수치 밀도 (수치 개수 / 1000자)
  definitionSentences: number;
  numericDataPoints: number;
  comparisonElements: number;
  processSteps: number;
  topKeywords: string[];
  commonHeadingPatterns: string[];
  citationDrivers: string[];   // AI가 인용한 핵심 이유들
}

export interface Directive {
  priority: 'critical' | 'high' | 'medium';
  category: string;
  action: string;
  example: string;
  reason: string;
  estimatedImpact: string;
  seoTag?: string;   // 네이버/구글/AI엔진 어디에 효과적인지
}

export interface AnalysisResult {
  query: string;
  targetKeyword: string;
  analyzedPages: {
    url: string;
    domain: string;
    title: string;
    citedByPlatforms: string[];
    citationCount: number;
    strengths: string[];
  }[];
  citationPatterns: CitationPattern;
  directives: Directive[];
  contentScore: {
    current: number;
    potential: number;
    improvements: string[];
  };
  seoUpgrade: {           // SEO 콘텐츠 업그레이드 지시어
    naverOptimization: string[];
    googleOptimization: string[];
    aiEngineOptimization: string[];
    schemaMarkupSuggestions: string[];
  };
  calendarSuggestions?: {  // 56주 캘린더 연동 제안
    suggestedTopics: { topic: string; keyword: string; funnelStage: string; reason: string }[];
    contentTypeRecommendation: string;
  };
  summary: string;
}

@Injectable()
export class CitationAnalyzerService {
  private readonly logger = new Logger(CitationAnalyzerService.name);
  private anthropic: Anthropic | null = null;

  constructor(private prisma: PrismaService) {
    this.initializeApi();
  }

  private initializeApi() {
    const apiKey = process.env.ANTHROPIC_API_KEY?.trim();
    if (apiKey && apiKey.length > 20 && apiKey.startsWith('sk-ant-')) {
      this.anthropic = new Anthropic({ apiKey });
      this.logger.log('Citation Analyzer v2: Anthropic API 초기화 완료');
    } else {
      this.logger.warn('Citation Analyzer v2: Anthropic API 키 미설정');
    }
  }

  // ================================================================
  // 메인 분석 엔트리포인트
  // ================================================================

  /**
   * 특정 질문에 대한 인용 역분석 실행
   */
  async analyzeForQuery(
    hospitalId: string,
    query: string,
    options: { maxPages?: number; includeOurContent?: string } = {},
  ): Promise<AnalysisResult> {
    const maxPages = options.maxPages || 5;
    
    this.logger.log(`[Citation Analysis v2] 시작: "${query.substring(0, 40)}..." (hospitalId=${hospitalId})`);

    // ── 1단계: 인용된 URL 수집 ──
    const citedUrls = await this.collectCitedUrls(hospitalId, query);
    this.logger.log(`[Citation Analysis] 인용 URL ${citedUrls.length}개 수집`);

    if (citedUrls.length === 0) {
      const freshUrls = await this.fetchFreshCitations(query);
      citedUrls.push(...freshUrls);
      this.logger.log(`[Citation Analysis] 실시간 수집으로 ${freshUrls.length}개 추가`);
    }

    // ── 2단계: 상위 페이지 크롤링 ──
    const rankedUrls = this.rankUrls(citedUrls).slice(0, maxPages);
    const crawledPages = await this.crawlPages(rankedUrls);
    this.logger.log(`[Citation Analysis] ${crawledPages.length}개 페이지 크롤링 완료`);

    if (crawledPages.length === 0) {
      return this.buildEmptyResult(query);
    }

    // ── 3단계: AI로 패턴 분석 + 지시어 생성 ──
    const hospital = await this.prisma.hospital.findUnique({
      where: { id: hospitalId },
      select: { 
        name: true, specialtyType: true, 
        regionSido: true, regionSigungu: true,
        keyProcedures: true, hospitalStrengths: true,
        coreTreatments: true,
      },
    });

    const analysisResult = await this.analyzeWithAI(
      query,
      crawledPages,
      hospital,
      options.includeOurContent,
    );

    // ── 4단계: DB 저장 ──
    try {
      await this.prisma.citationAnalysis.create({
        data: {
          hospitalId,
          queryText: query,
          targetKeyword: analysisResult.targetKeyword,
          analyzedUrls: crawledPages.map(p => p.url),
          topCitationCount: crawledPages.length,
          citationPatterns: analysisResult.citationPatterns as any,
          gapAnalysis: analysisResult.seoUpgrade as any,
          directives: analysisResult.directives as any,
          contentScore: analysisResult.contentScore as any,
          analysisModel: 'claude-haiku-4-5',
          status: 'COMPLETED',
        },
      });
    } catch (err) {
      this.logger.warn(`[Citation Analysis] DB 저장 실패: ${err.message}`);
    }

    return analysisResult;
  }

  /**
   * 병원의 전체 프롬프트 기반 일괄 역분석 (PRO 전용)
   * - 상위 인용 패턴을 종합 분석
   * - 56주 캘린더에 자동 반영
   */
  async analyzeBulk(hospitalId: string, options?: { limit?: number }): Promise<{
    totalAnalyzed: number;
    topDirectives: Directive[];
    calendarUpdated: number;
  }> {
    const limit = options?.limit || 10;
    
    // 최근 크롤링에서 인용 빈도 높은 키워드 추출
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const responses = await this.prisma.aIResponse.findMany({
      where: {
        hospitalId,
        responseDate: { gte: thirtyDaysAgo },
        citedSources: { isEmpty: false },
      },
      select: {
        prompt: { select: { promptText: true } },
        citedSources: true,
      },
      take: 200,
    });

    // 프롬프트별 인용 URL 빈도 집계
    const promptCitations = new Map<string, number>();
    for (const r of responses) {
      if (r.prompt?.promptText) {
        const count = promptCitations.get(r.prompt.promptText) || 0;
        promptCitations.set(r.prompt.promptText, count + r.citedSources.length);
      }
    }

    // 인용 많은 순으로 정렬 → 상위 N개 분석
    const topPrompts = Array.from(promptCitations.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, limit)
      .map(([text]) => text);

    const allDirectives: Directive[] = [];
    let totalAnalyzed = 0;

    for (const promptText of topPrompts) {
      try {
        const result = await this.analyzeForQuery(hospitalId, promptText, { maxPages: 3 });
        allDirectives.push(...result.directives);
        totalAnalyzed++;

        // Rate limit 방지
        await new Promise(r => setTimeout(r, 2000));
      } catch (err) {
        this.logger.warn(`[Bulk Analysis] "${promptText.substring(0, 30)}" 분석 실패: ${err.message}`);
      }
    }

    // 지시어 중복 제거 + 우선순위 정렬
    const deduped = this.deduplicateDirectives(allDirectives);

    // 56주 캘린더 자동 업데이트
    let calendarUpdated = 0;
    try {
      calendarUpdated = await this.updateCalendarWithDirectives(hospitalId, deduped);
    } catch (err) {
      this.logger.warn(`[Bulk Analysis] 캘린더 업데이트 실패: ${err.message}`);
    }

    return {
      totalAnalyzed,
      topDirectives: deduped.slice(0, 15),
      calendarUpdated,
    };
  }

  // ================================================================
  // 56주 콘텐츠 캘린더 관리
  // ================================================================

  /**
   * 56주 콘텐츠 캘린더 생성
   * 병원의 핵심 시술 + 지역 + 퍼널 기반으로 52주 자동 생성
   */
  async generateCalendar(hospitalId: string): Promise<{ created: number; weekRange: string }> {
    const hospital = await this.prisma.hospital.findUnique({
      where: { id: hospitalId },
      select: {
        name: true, specialtyType: true,
        regionSido: true, regionSigungu: true,
        keyProcedures: true, coreTreatments: true,
        hospitalStrengths: true,
      },
    });

    if (!hospital) throw new Error('병원을 찾을 수 없습니다');

    const procedures = hospital.coreTreatments?.length > 0
      ? hospital.coreTreatments
      : hospital.keyProcedures || ['일반 진료'];

    const region = `${hospital.regionSido} ${hospital.regionSigungu}`;
    const strengths = hospital.hospitalStrengths || [];

    if (!this.anthropic) {
      // AI 없이 기본 캘린더 생성
      return this.generateBasicCalendar(hospitalId, procedures, region);
    }

    // AI로 56주 캘린더 생성
    const prompt = `당신은 대한민국 치과/병원 콘텐츠 마케팅 전략가입니다.

## 병원 정보
- 병원명: ${hospital.name}
- 진료과: ${hospital.specialtyType}
- 지역: ${region}
- 핵심 시술: ${procedures.join(', ')}
- 차별점: ${strengths.join(', ') || '미입력'}

## 56주 콘텐츠 캘린더 생성 규칙

1. **퍼널 비율**: AWARENESS 35% / CONSIDERATION 30% / DECISION 20% / RETENTION 10% / ADVOCACY 5%
2. **시술 커버리지**: 각 핵심 시술별 최소 8편 (퍼널 전 단계 커버)
3. **계절성 반영**: 여름(미백/교정), 겨울(임플란트), 봄가을(검진/스케일링), 방학(학생 교정)
4. **콘텐츠 유형 믹스**: BLOG 60% / COMPARISON 15% / FAQ 10% / GUIDE 10% / CASE_STUDY 5%
5. **AI 인용 최적화 키워드**: 환자가 ChatGPT/Perplexity에 물어볼 법한 질문형 키워드
6. **주 1편 원칙**: 총 56편 (1년+4주 버퍼)

## 출력 형식 (JSON 배열):
[
  {
    "weekNumber": 1,
    "topic": "구체적 주제 (예: '강남 임플란트 비용, 100만원 vs 300만원 차이의 진짜 이유')",
    "targetKeyword": "검색 키워드 (예: '강남 임플란트 비용')",
    "funnelStage": "AWARENESS|CONSIDERATION|DECISION|RETENTION|ADVOCACY",
    "procedure": "관련 시술",
    "contentType": "BLOG|COMPARISON|FAQ|GUIDE|CASE_STUDY",
    "priority": "HIGH|MEDIUM|LOW"
  }
]

반드시 56개 항목의 JSON 배열로만 응답하세요.`;

    try {
      const message = await this.anthropic.messages.create({
        model: 'claude-haiku-4-5',
        max_tokens: 8000,
        messages: [{ role: 'user', content: prompt }],
      });

      const responseText = message.content
        .filter((b: any) => b.type === 'text')
        .map((b: any) => b.text)
        .join('');

      const jsonMatch = responseText.match(/\[[\s\S]*\]/);
      if (!jsonMatch) {
        this.logger.warn('[Calendar] AI 응답에서 JSON 배열 추출 실패, 기본 캘린더 생성');
        return this.generateBasicCalendar(hospitalId, procedures, region);
      }

      const calendarItems = JSON.parse(jsonMatch[0]);
      
      // 기존 캘린더 삭제 후 재생성
      await this.prisma.contentCalendar.deleteMany({ where: { hospitalId } });

      const now = new Date();
      const startOfWeek = new Date(now);
      startOfWeek.setDate(now.getDate() - now.getDay() + 1); // 다음 월요일

      let created = 0;
      for (const item of calendarItems) {
        if (!item.weekNumber || !item.topic) continue;

        const scheduledDate = new Date(startOfWeek);
        scheduledDate.setDate(startOfWeek.getDate() + (item.weekNumber - 1) * 7);
        
        const yearWeek = `${scheduledDate.getFullYear()}-W${String(this.getISOWeek(scheduledDate)).padStart(2, '0')}`;

        try {
          await this.prisma.contentCalendar.create({
            data: {
              hospitalId,
              weekNumber: item.weekNumber,
              yearWeek,
              scheduledDate,
              topic: item.topic,
              targetKeyword: item.targetKeyword || item.topic,
              funnelStage: item.funnelStage || 'AWARENESS',
              procedure: item.procedure,
              contentType: item.contentType || 'BLOG',
              status: 'PLANNED',
              priority: item.priority || 'MEDIUM',
            },
          });
          created++;
        } catch (err) {
          // unique constraint 충돌 등 무시
          this.logger.debug(`[Calendar] Week ${item.weekNumber} 생성 건너뜀: ${err.message}`);
        }
      }

      const lastDate = new Date(startOfWeek);
      lastDate.setDate(startOfWeek.getDate() + 55 * 7);

      return {
        created,
        weekRange: `${startOfWeek.toISOString().split('T')[0]} ~ ${lastDate.toISOString().split('T')[0]}`,
      };
    } catch (err) {
      this.logger.error(`[Calendar] AI 캘린더 생성 실패: ${err.message}`);
      return this.generateBasicCalendar(hospitalId, procedures, region);
    }
  }

  /**
   * 캘린더 목록 조회
   */
  async getCalendar(hospitalId: string, options?: {
    status?: string;
    limit?: number;
    offset?: number;
  }) {
    const where: any = { hospitalId };
    if (options?.status) where.status = options.status;

    const [items, total] = await Promise.all([
      this.prisma.contentCalendar.findMany({
        where,
        orderBy: { weekNumber: 'asc' },
        take: options?.limit || 56,
        skip: options?.offset || 0,
      }),
      this.prisma.contentCalendar.count({ where }),
    ]);

    // 통계 추가
    const stats = await this.prisma.contentCalendar.groupBy({
      by: ['status'],
      where: { hospitalId },
      _count: true,
    });

    const funnelStats = await this.prisma.contentCalendar.groupBy({
      by: ['funnelStage'],
      where: { hospitalId },
      _count: true,
    });

    return {
      items,
      total,
      stats: stats.reduce((acc, s) => ({ ...acc, [s.status]: s._count }), {}),
      funnelDistribution: funnelStats.reduce((acc, f) => ({ ...acc, [f.funnelStage]: f._count }), {}),
    };
  }

  /**
   * 특정 주차 캘린더 항목에 역분석 실행 → SEO 지시어 주입
   */
  async analyzeCalendarWeek(hospitalId: string, weekNumber: number): Promise<{
    calendarItem: any;
    analysis: AnalysisResult;
    updated: boolean;
  }> {
    const calendarItem = await this.prisma.contentCalendar.findUnique({
      where: { hospitalId_weekNumber: { hospitalId, weekNumber } },
    });

    if (!calendarItem) throw new Error(`${weekNumber}주차 캘린더 항목이 없습니다`);

    // 해당 주제로 인용 역분석 실행
    const analysis = await this.analyzeForQuery(hospitalId, calendarItem.targetKeyword, {
      maxPages: 5,
    });

    // 캘린더 항목에 SEO 지시어 주입
    await this.prisma.contentCalendar.update({
      where: { hospitalId_weekNumber: { hospitalId, weekNumber } },
      data: {
        seoDirectives: {
          directives: analysis.directives,
          seoUpgrade: analysis.seoUpgrade,
          contentScore: analysis.contentScore,
          analyzedAt: new Date().toISOString(),
        } as any,
        citationAnalysisId: null, // 분석 ID는 별도 저장
        status: 'ANALYZED',
      },
    });

    return {
      calendarItem: { ...calendarItem, status: 'ANALYZED' },
      analysis,
      updated: true,
    };
  }

  /**
   * 역분석 결과를 GEO 콘텐츠 생성에 주입할 프롬프트 생성
   */
  async buildGeoPromptEnhancement(hospitalId: string, targetKeyword: string): Promise<{
    additionalInstructions: string;
    seoDirectives: Directive[];
  }> {
    // 해당 키워드의 최근 역분석 결과 조회
    const recentAnalysis = await this.prisma.citationAnalysis.findFirst({
      where: {
        hospitalId,
        targetKeyword: { contains: targetKeyword.split(' ')[0] },
        status: 'COMPLETED',
      },
      orderBy: { createdAt: 'desc' },
    });

    if (!recentAnalysis) {
      // 분석 결과 없으면 실시간 분석
      const analysis = await this.analyzeForQuery(hospitalId, targetKeyword, { maxPages: 3 });
      return {
        additionalInstructions: this.formatDirectivesAsInstructions(analysis.directives, analysis.seoUpgrade),
        seoDirectives: analysis.directives,
      };
    }

    const directives = (recentAnalysis.directives as any[]) || [];
    const seoUpgrade = (recentAnalysis.gapAnalysis as any) || {};

    return {
      additionalInstructions: this.formatDirectivesAsInstructions(directives, seoUpgrade),
      seoDirectives: directives,
    };
  }

  // ================================================================
  // 1단계: 인용 URL 수집
  // ================================================================

  private async collectCitedUrls(hospitalId: string, query: string): Promise<{
    url: string;
    platform: string;
    count: number;
  }[]> {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const keywords = query.replace(/[?？\s]+/g, ' ').trim().split(/\s+/).filter(k => k.length >= 2);
    
    const responses = await this.prisma.aIResponse.findMany({
      where: {
        hospitalId,
        responseDate: { gte: thirtyDaysAgo },
        citedSources: { isEmpty: false },
      },
      select: {
        citedSources: true,
        aiPlatform: true,
        prompt: { select: { promptText: true } },
      },
      take: 200,
    });

    const liveResponses = await this.prisma.liveQueryResponse.findMany({
      where: {
        liveQuery: { hospitalId },
        citedSources: { isEmpty: false },
        createdAt: { gte: thirtyDaysAgo },
      },
      select: {
        citedSources: true,
        platform: true,
        liveQuery: { select: { queryText: true } },
      },
      take: 100,
    });

    const urlMap = new Map<string, { platforms: Set<string>; count: number; relevant: boolean }>();

    for (const r of responses) {
      const isRelevant = keywords.some(k => r.prompt?.promptText?.includes(k));
      for (const url of r.citedSources) {
        if (!this.isValidUrl(url)) continue;
        const entry = urlMap.get(url) || { platforms: new Set(), count: 0, relevant: false };
        entry.platforms.add(r.aiPlatform);
        entry.count++;
        if (isRelevant) entry.relevant = true;
        urlMap.set(url, entry);
      }
    }

    for (const r of liveResponses) {
      const isRelevant = keywords.some(k => r.liveQuery?.queryText?.includes(k));
      for (const url of r.citedSources) {
        if (!this.isValidUrl(url)) continue;
        const entry = urlMap.get(url) || { platforms: new Set(), count: 0, relevant: false };
        entry.platforms.add(r.platform);
        entry.count++;
        if (isRelevant) entry.relevant = true;
        urlMap.set(url, entry);
      }
    }

    return Array.from(urlMap.entries())
      .map(([url, data]) => ({
        url,
        platform: Array.from(data.platforms).join(','),
        count: data.count,
        relevant: data.relevant,
      }))
      .sort((a, b) => {
        if (a.relevant !== b.relevant) return a.relevant ? -1 : 1;
        return b.count - a.count;
      })
      .slice(0, 20);
  }

  private async fetchFreshCitations(query: string): Promise<{
    url: string;
    platform: string;
    count: number;
  }[]> {
    const perplexityApiKey = process.env.PERPLEXITY_API_KEY?.trim();
    if (!perplexityApiKey) return [];

    try {
      const response = await fetch('https://api.perplexity.ai/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${perplexityApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'sonar',
          messages: [{ role: 'user', content: query }],
          temperature: 0,
          return_citations: true,
          search_recency_filter: 'month',
        }),
      });

      const data = await response.json();
      const citations: string[] = data.citations || [];

      return citations
        .filter(url => this.isValidUrl(url))
        .map(url => ({ url, platform: 'PERPLEXITY', count: 1 }));
    } catch (err) {
      this.logger.warn(`[Citation Analysis] Perplexity 실시간 수집 실패: ${err.message}`);
      return [];
    }
  }

  // ================================================================
  // 2단계: 페이지 크롤링
  // ================================================================

  private rankUrls(urls: { url: string; platform: string; count: number }[]): typeof urls {
    return urls
      .filter(u => {
        const url = u.url.toLowerCase();
        if (url.match(/\.(com|co\.kr|net)\/?$/)) return false;
        if (url.includes('/search?') || url.includes('/login')) return false;
        if (url.includes('youtube.com/watch')) return false; // 영상은 크롤링 불가
        return true;
      })
      .sort((a, b) => {
        const scoreA = this.urlContentScore(a.url) + a.count;
        const scoreB = this.urlContentScore(b.url) + b.count;
        return scoreB - scoreA;
      });
  }

  private urlContentScore(url: string): number {
    let score = 0;
    if (url.includes('blog')) score += 3;
    if (url.includes('naver.com')) score += 2;
    if (url.includes('post') || url.includes('article')) score += 2;
    if (url.includes('health') || url.includes('medical') || url.includes('dental')) score += 2;
    if (url.includes('wiki')) score += 1;
    if (url.includes('news')) score += 1;
    // 의료 전문 사이트 가산
    if (url.includes('goodoc') || url.includes('modoodoc') || url.includes('hira')) score += 3;
    return score;
  }

  private async crawlPages(urls: { url: string; platform: string; count: number }[]): Promise<CrawledPage[]> {
    const results: CrawledPage[] = [];

    // 병렬 크롤링 (최대 3개 동시)
    const chunks = this.chunkArray(urls, 3);
    for (const chunk of chunks) {
      const chunkResults = await Promise.allSettled(
        chunk.map(async (urlInfo) => {
          const page = await this.crawlSinglePage(urlInfo.url);
          if (page && page.content.length > 100) {
            page.citedByPlatforms = urlInfo.platform.split(',');
            page.citationCount = urlInfo.count;
            return page;
          }
          return null;
        })
      );

      for (const result of chunkResults) {
        if (result.status === 'fulfilled' && result.value) {
          results.push(result.value);
        }
      }
    }

    return results;
  }

  private async crawlSinglePage(url: string): Promise<CrawledPage | null> {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 10000);

      const response = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; PatientSignalBot/1.0; +https://patientsignal.co)',
          'Accept': 'text/html,application/xhtml+xml',
          'Accept-Language': 'ko-KR,ko;q=0.9',
        },
        signal: controller.signal,
      });
      clearTimeout(timeout);

      if (!response.ok) return null;

      const html = await response.text();
      return this.parseHtml(url, html);
    } catch (err) {
      return null;
    }
  }

  private parseHtml(url: string, html: string): CrawledPage {
    const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
    const title = titleMatch ? titleMatch[1].trim() : '';

    // 본문 텍스트 추출
    let textContent = html
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
      .replace(/<nav[^>]*>[\s\S]*?<\/nav>/gi, '')
      .replace(/<header[^>]*>[\s\S]*?<\/header>/gi, '')
      .replace(/<footer[^>]*>[\s\S]*?<\/footer>/gi, '')
      .replace(/<aside[^>]*>[\s\S]*?<\/aside>/gi, '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/&[a-z]+;/gi, ' ')
      .replace(/\s+/g, ' ')
      .trim();

    if (textContent.length > 3000) {
      textContent = textContent.substring(0, 3000);
    }

    // H2/H3 헤딩 추출
    const headings: string[] = [];
    const headingRegex = /<h[23][^>]*>([\s\S]*?)<\/h[23]>/gi;
    let match;
    while ((match = headingRegex.exec(html)) !== null) {
      const headingText = match[1].replace(/<[^>]+>/g, '').trim();
      if (headingText.length > 0) headings.push(headingText);
    }

    // 구조 체크
    const hasTables = /<table/i.test(html);
    const hasLists = /<[ou]l/i.test(html) && (html.match(/<li/gi) || []).length >= 3;
    const hasFaq = /faq|자주\s*묻는|질문과\s*답|Q\s*\./i.test(html) || 
                   (html.match(/<(dt|summary|details)/gi) || []).length >= 2 ||
                   headings.some(h => h.includes('?') || h.includes('？'));
    
    // JSON-LD 스키마 마크업 체크
    const hasSchema = /application\/ld\+json/i.test(html) || 
                      /itemtype="http/i.test(html) ||
                      /schema\.org/i.test(html);
    
    // 수치 데이터 밀도 체크
    const numberMatches = textContent.match(/\d+[\.,]?\d*\s*(%|만원|원|년|개월|주|일|시간|점|배|건|명)/g) || [];
    const hasNumbers = numberMatches.length >= 3;

    const domain = this.extractDomain(url);
    const wordCount = textContent.replace(/\s+/g, '').length;

    return {
      url, domain, title, content: textContent, headings,
      hasTables, hasLists, hasFaq, hasSchema, hasNumbers,
      wordCount, citedByPlatforms: [], citationCount: 0,
    };
  }

  // ================================================================
  // 3단계: AI 분석 + 지시어 생성 (SEO 강화)
  // ================================================================

  private async analyzeWithAI(
    query: string,
    pages: CrawledPage[],
    hospital: any,
    ourContent?: string,
  ): Promise<AnalysisResult> {
    if (!this.anthropic) {
      return this.buildFallbackAnalysis(query, pages, hospital);
    }

    const pageSummaries = pages.map((p, i) => `
### 인용 페이지 ${i + 1}: ${p.title}
- URL: ${p.url}
- 도메인: ${p.domain}
- 인용 AI: ${p.citedByPlatforms.join(', ')}
- 인용 횟수: ${p.citationCount}회
- 글자수: ${p.wordCount}자 | H2/H3: ${p.headings.length}개 | 표: ${p.hasTables ? '✅' : '❌'} | 리스트: ${p.hasLists ? '✅' : '❌'} | FAQ: ${p.hasFaq ? '✅' : '❌'} | 스키마: ${p.hasSchema ? '✅' : '❌'} | 수치: ${p.hasNumbers ? '✅' : '❌'}
- 소제목: ${p.headings.join(' | ') || '없음'}
- 본문 앞부분:
${p.content.substring(0, 1200)}
`).join('\n---\n');

    const hospitalInfo = hospital
      ? `\n병원명: ${hospital.name}\n진료과: ${hospital.specialtyType}\n지역: ${hospital.regionSido} ${hospital.regionSigungu}\n핵심시술: ${(hospital.keyProcedures || []).join(', ')}\n차별점: ${(hospital.hospitalStrengths || []).join(', ')}`
      : '';

    const ourContentSection = ourContent
      ? `\n\n### 우리 병원 기존 콘텐츠:\n${ourContent.substring(0, 1500)}`
      : '';

    const prompt = `당신은 2026년 기준 AI 검색엔진(ChatGPT, Perplexity, Gemini, Claude) + 네이버 AI 브리핑 + 구글 AI Overview의 인용 알고리즘을 역분석하는 전문가입니다.

## 분석 목표
환자가 AI에게 "${query}"라고 질문했을 때, AI가 인용한 상위 페이지들을 역분석하여:
1. AI가 이 페이지들을 왜 인용했는지 패턴을 추출
2. 네이버 AI 브리핑에 선택되려면 필요한 요소 분석
3. 구글 AI Overview에서 인용되려면 필요한 구조 분석
4. 우리 병원 콘텐츠가 인용되려면 무엇을 추가/수정해야 하는지 구체 지시어 생성
${hospitalInfo}

## AI가 인용한 상위 ${pages.length}개 페이지:
${pageSummaries}
${ourContentSection}

## 반드시 JSON 형식으로만 응답하세요:
{
  "targetKeyword": "핵심 타겟 키워드",
  "citationPatterns": {
    "avgWordCount": 평균글자수,
    "avgHeadingCount": 평균H2H3수,
    "tableRatio": 표비율(0~1),
    "listRatio": 리스트비율,
    "faqRatio": FAQ비율,
    "schemaRatio": 스키마마크업비율,
    "numberDensity": 수치밀도(수치수/1000자),
    "definitionSentences": 정의문평균수,
    "numericDataPoints": 수치데이터평균수,
    "comparisonElements": 비교요소평균수,
    "processSteps": 프로세스단계평균수,
    "topKeywords": ["공통키워드 5개"],
    "commonHeadingPatterns": ["인용페이지 공통 H2 패턴 5개"],
    "citationDrivers": ["AI가 이 페이지들을 인용한 핵심 이유 3~5개"]
  },
  "analyzedPages": [
    {
      "url": "URL",
      "domain": "도메인",
      "title": "제목",
      "citedByPlatforms": ["PERPLEXITY"],
      "citationCount": 횟수,
      "strengths": ["이 페이지의 인용 이유 3가지 (구체적으로)"]
    }
  ],
  "directives": [
    {
      "priority": "critical|high|medium",
      "category": "비교표|수치데이터|FAQ|프로세스|구조|키워드|신뢰성|최신성|스키마|네이버최적화|구글최적화",
      "action": "구체적으로 무엇을 추가/수정해야 하는지 (블로그 글 작성 지시어 수준)",
      "example": "실제 삽입할 텍스트/표/리스트 예시",
      "reason": "왜 이것이 AI 인용 + SEO에 도움이 되는지",
      "estimatedImpact": "예상 효과",
      "seoTag": "NAVER|GOOGLE|AI_ENGINE|ALL"
    }
  ],
  "contentScore": {
    "current": 현재인용가능성점수(0~100),
    "potential": 지시어반영후예상점수,
    "improvements": ["점수향상근거 3가지"]
  },
  "seoUpgrade": {
    "naverOptimization": ["네이버 AI 브리핑/스마트블록에 선택되려면 할 것 3~5개"],
    "googleOptimization": ["구글 AI Overview/Featured Snippet에 인용되려면 할 것 3~5개"],
    "aiEngineOptimization": ["ChatGPT/Perplexity/Gemini에서 인용되려면 할 것 3~5개"],
    "schemaMarkupSuggestions": ["추가해야 할 스키마 마크업 종류 (FAQPage, HowTo, MedicalCondition 등)"]
  },
  "calendarSuggestions": {
    "suggestedTopics": [
      {"topic": "이 분석에서 파생되는 추가 콘텐츠 주제", "keyword": "타겟키워드", "funnelStage": "AWARENESS|CONSIDERATION|DECISION", "reason": "왜 이 주제를 다뤄야 하는지"}
    ],
    "contentTypeRecommendation": "이 키워드에 가장 적합한 콘텐츠 유형 (BLOG/COMPARISON/FAQ/GUIDE)"
  },
  "summary": "핵심 요약 2~3줄"
}

### 지시어 작성 규칙:
1. **최소 6개, 최대 10개** 지시어 (critical 3개+, high 3개+)
2. 각 action은 **"~를 추가하세요"** 수준으로 구체적
3. example에는 실제 블로그에 붙여넣기 할 수 있는 예시
4. seoTag로 네이버/구글/AI엔진 어디에 효과적인지 명시
5. 인용 페이지에서 **실제 발견된 패턴** 기반 역추론
6. 한국어 의료 콘텐츠에 맞는 실전 지시어
7. calendarSuggestions에 파생 콘텐츠 주제 2~4개 제안`;

    try {
      const message = await this.anthropic.messages.create({
        model: 'claude-haiku-4-5',
        max_tokens: 6000,
        messages: [{ role: 'user', content: prompt }],
      });

      const responseText = message.content
        .filter((b: any) => b.type === 'text')
        .map((b: any) => b.text)
        .join('');

      const jsonMatch = responseText.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        this.logger.warn('[Citation Analysis] AI 응답에서 JSON 추출 실패');
        return this.buildFallbackAnalysis(query, pages, hospital);
      }

      const parsed = JSON.parse(jsonMatch[0]);
      
      return {
        query,
        targetKeyword: parsed.targetKeyword || query,
        analyzedPages: parsed.analyzedPages || pages.map(p => ({
          url: p.url, domain: p.domain, title: p.title,
          citedByPlatforms: p.citedByPlatforms, citationCount: p.citationCount,
          strengths: [],
        })),
        citationPatterns: parsed.citationPatterns || this.extractBasicPatterns(pages),
        directives: parsed.directives || [],
        contentScore: parsed.contentScore || { current: 30, potential: 75, improvements: [] },
        seoUpgrade: parsed.seoUpgrade || {
          naverOptimization: [], googleOptimization: [],
          aiEngineOptimization: [], schemaMarkupSuggestions: [],
        },
        calendarSuggestions: parsed.calendarSuggestions,
        summary: parsed.summary || '',
      };
    } catch (err) {
      this.logger.error(`[Citation Analysis] AI 분석 실패: ${err.message}`);
      return this.buildFallbackAnalysis(query, pages, hospital);
    }
  }

  // ================================================================
  // 최근 분석 이력 조회
  // ================================================================

  async getRecentAnalyses(hospitalId: string, limit = 10) {
    return this.prisma.citationAnalysis.findMany({
      where: { hospitalId, status: 'COMPLETED' },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
  }

  async getCitationStats(hospitalId: string) {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const responses = await this.prisma.aIResponse.findMany({
      where: {
        hospitalId,
        responseDate: { gte: thirtyDaysAgo },
        citedSources: { isEmpty: false },
      },
      select: { citedSources: true, aiPlatform: true },
    });

    const domainCounts = new Map<string, { count: number; platforms: Set<string> }>();
    let totalCitations = 0;

    for (const r of responses) {
      for (const url of r.citedSources) {
        const domain = this.extractDomain(url);
        const entry = domainCounts.get(domain) || { count: 0, platforms: new Set() };
        entry.count++;
        entry.platforms.add(r.aiPlatform);
        domainCounts.set(domain, entry);
        totalCitations++;
      }
    }

    const topDomains = Array.from(domainCounts.entries())
      .map(([domain, data]) => ({
        domain,
        count: data.count,
        platforms: Array.from(data.platforms),
        percentage: totalCitations > 0 ? Math.round((data.count / totalCitations) * 100) : 0,
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 15);

    const naverCount = topDomains
      .filter(d => d.domain.includes('naver'))
      .reduce((sum, d) => sum + d.count, 0);

    return {
      totalCitations,
      totalDomains: domainCounts.size,
      topDomains,
      naverCitationRate: totalCitations > 0 ? Math.round((naverCount / totalCitations) * 100) : 0,
    };
  }

  // ================================================================
  // 유틸리티
  // ================================================================

  private formatDirectivesAsInstructions(directives: any[], seoUpgrade: any): string {
    const lines: string[] = [];
    
    lines.push('\n## 🔍 인용 역분석 기반 SEO 강화 지시어\n');
    lines.push('아래는 AI가 실제로 인용한 상위 페이지를 역분석하여 도출한 지시어입니다. 반드시 반영하세요.\n');

    // critical 지시어 우선
    const criticals = (directives || []).filter((d: any) => d.priority === 'critical');
    if (criticals.length > 0) {
      lines.push('### 🚨 필수 반영 (Critical)');
      criticals.forEach((d: any, i: number) => {
        lines.push(`${i + 1}. **[${d.category}]** ${d.action}`);
        if (d.example) lines.push(`   예시: ${d.example.substring(0, 200)}`);
      });
    }

    const highs = (directives || []).filter((d: any) => d.priority === 'high');
    if (highs.length > 0) {
      lines.push('\n### ⚡ 강력 권장 (High)');
      highs.forEach((d: any, i: number) => {
        lines.push(`${i + 1}. **[${d.category}]** ${d.action}`);
      });
    }

    // SEO 플랫폼별 최적화
    if (seoUpgrade) {
      if (seoUpgrade.naverOptimization?.length > 0) {
        lines.push('\n### 🟢 네이버 AI 브리핑 최적화');
        seoUpgrade.naverOptimization.forEach((item: string) => lines.push(`- ${item}`));
      }
      if (seoUpgrade.googleOptimization?.length > 0) {
        lines.push('\n### 🔵 구글 AI Overview 최적화');
        seoUpgrade.googleOptimization.forEach((item: string) => lines.push(`- ${item}`));
      }
      if (seoUpgrade.schemaMarkupSuggestions?.length > 0) {
        lines.push('\n### 📋 스키마 마크업 추가');
        lines.push(`bodyHtml 마지막에 다음 스키마를 포함하세요: ${seoUpgrade.schemaMarkupSuggestions.join(', ')}`);
      }
    }

    return lines.join('\n');
  }

  private extractBasicPatterns(pages: CrawledPage[]): CitationPattern {
    const n = pages.length || 1;
    
    // 수치 밀도 계산
    let totalNumbers = 0;
    let totalWords = 0;
    for (const p of pages) {
      const nums = p.content.match(/\d+[\.,]?\d*\s*(%|만원|원|년|개월|주|일|시간|점|배|건|명)/g) || [];
      totalNumbers += nums.length;
      totalWords += p.wordCount;
    }

    return {
      avgWordCount: Math.round(pages.reduce((s, p) => s + p.wordCount, 0) / n),
      avgHeadingCount: Math.round(pages.reduce((s, p) => s + p.headings.length, 0) / n),
      tableRatio: pages.filter(p => p.hasTables).length / n,
      listRatio: pages.filter(p => p.hasLists).length / n,
      faqRatio: pages.filter(p => p.hasFaq).length / n,
      schemaRatio: pages.filter(p => p.hasSchema).length / n,
      numberDensity: totalWords > 0 ? Math.round((totalNumbers / totalWords) * 1000 * 10) / 10 : 0,
      definitionSentences: 0,
      numericDataPoints: totalNumbers,
      comparisonElements: 0,
      processSteps: 0,
      topKeywords: [],
      commonHeadingPatterns: pages.flatMap(p => p.headings).slice(0, 5),
      citationDrivers: [],
    };
  }

  private buildFallbackAnalysis(query: string, pages: CrawledPage[], hospital: any): AnalysisResult {
    const patterns = this.extractBasicPatterns(pages);
    const directives: Directive[] = [];

    // 기본 지시어 (AI 없이)
    directives.push({
      priority: 'critical',
      category: '수치데이터',
      action: '구체적 수치(성공률, 비용, 기간, 연구 결과)를 최소 8개 이상 포함하세요.',
      example: '"본원 임플란트 5년 생존율 97.2% (2024년 기준 3,200건)" 형식으로 삽입',
      reason: 'AI는 구체 수치가 포함된 문장을 정의/팩트로 인식하여 인용 확률이 급상승합니다',
      estimatedImpact: '인용 가능성 25~40% 향상',
      seoTag: 'ALL',
    });

    directives.push({
      priority: 'critical',
      category: '네이버최적화',
      action: '첫 100~150자에 핵심 답변을 즉시 제시하세요. 네이버 AI 브리핑이 이 부분을 발췌합니다.',
      example: '"[시술명]의 평균 비용은 X~Y만원이며, [핵심포인트 3가지]를 확인해야 합니다."',
      reason: '네이버 AI 브리핑은 글 시작부분의 정의/요약문을 우선 발췌합니다',
      estimatedImpact: '네이버 AI 브리핑 노출 확률 2~3배 향상',
      seoTag: 'NAVER',
    });

    directives.push({
      priority: 'critical',
      category: '구글최적화',
      action: '각 H2 시작 직후 40~60자의 정의/요약문을 배치하세요. 구글 AI Overview가 이를 인용합니다.',
      example: '"임플란트란 상실된 치아를 대체하기 위해 인공 치근을 잇몸뼈에 식립하는 시술입니다."',
      reason: '구글 AI Overview는 H2 아래 첫 문장의 정의형 문장을 우선 인용합니다',
      estimatedImpact: '구글 AI Overview 인용 확률 30% 향상',
      seoTag: 'GOOGLE',
    });

    if (patterns.tableRatio > 0.3) {
      directives.push({
        priority: 'high',
        category: '비교표',
        action: '인용 페이지 대부분이 비교표를 포함합니다. HTML <table>로 3개 이상 대안 비교, 7개+ 항목 비교표를 추가하세요.',
        example: '<table><thead><tr><th>구분</th><th>시술A</th><th>시술B</th><th>시술C</th></tr></thead>...',
        reason: 'AI가 구조화된 비교 데이터를 선호합니다. 구글 Table Snippet으로도 노출됩니다.',
        estimatedImpact: '인용 가능성 20~30% 향상',
        seoTag: 'ALL',
      });
    }

    if (patterns.faqRatio > 0.3) {
      directives.push({
        priority: 'high',
        category: 'FAQ',
        action: '최소 6~8개 환자 관점 FAQ를 추가하세요. 첫 문장=결론, 수치 필수.',
        example: 'Q. 임플란트 시술은 아픈가요?\nA. 대부분의 환자분이 VAS 통증점수 3~4점(10점 만점)으로...',
        reason: 'AI가 FAQ 형식의 Q&A를 직접 인용하는 빈도가 매우 높습니다. FAQPage 스키마도 추가 권장.',
        estimatedImpact: '인용 가능성 15~25% 향상',
        seoTag: 'ALL',
      });
    }

    directives.push({
      priority: 'high',
      category: '스키마',
      action: 'FAQPage, MedicalCondition, HowTo 스키마 마크업을 추가하세요.',
      example: '<script type="application/ld+json">{"@context":"https://schema.org","@type":"FAQPage","mainEntity":[...]}</script>',
      reason: '스키마 마크업이 있는 페이지는 구글 AI Overview에서 2배 높은 인용률을 보입니다',
      estimatedImpact: '구글 리치 결과 + AI Overview 인용 확률 향상',
      seoTag: 'GOOGLE',
    });

    if (patterns.avgWordCount > 2000) {
      directives.push({
        priority: 'high',
        category: '구조',
        action: `글 분량을 최소 ${Math.round(patterns.avgWordCount * 0.8)}자 이상으로 확보하세요. H2 소제목은 질문형으로.`,
        example: `인용 페이지 평균 ${patterns.avgWordCount}자. "임플란트 비용, 왜 병원마다 다를까?" 형태 소제목`,
        reason: '짧은 글은 AI가 충분한 정보를 추출하지 못해 인용하지 않습니다',
        estimatedImpact: '인용 대상 진입 기본 조건',
        seoTag: 'ALL',
      });
    }

    return {
      query,
      targetKeyword: query.replace(/[?？]/g, '').trim(),
      analyzedPages: pages.map(p => ({
        url: p.url, domain: p.domain, title: p.title,
        citedByPlatforms: p.citedByPlatforms, citationCount: p.citationCount,
        strengths: [],
      })),
      citationPatterns: patterns,
      directives,
      contentScore: { current: 25, potential: 70, improvements: ['비교표 추가', '수치 데이터 보강', 'FAQ + 스키마 추가'] },
      seoUpgrade: {
        naverOptimization: ['첫 100~150자 즉답형 도입부', 'H2를 질문형으로 변경', '리스트·표 비율 35%+ 확보'],
        googleOptimization: ['E-E-A-T 신호 강화 (경험+전문성+권위+신뢰)', 'Featured Snippet 타겟 정의문', '<table> HTML 비교표'],
        aiEngineOptimization: ['정의문·수치문·비교문·과정문 각 2회+', '구체 수치 8개+', '권위 출처 3개+'],
        schemaMarkupSuggestions: ['FAQPage', 'MedicalCondition', 'HowTo'],
      },
      summary: `상위 ${pages.length}개 인용 페이지 분석 완료. 네이버 AI 브리핑 + 구글 AI Overview + ChatGPT/Perplexity 인용을 위해 비교표, 구체 수치, FAQ, 스키마 마크업 강화가 필요합니다.`,
    };
  }

  private buildEmptyResult(query: string): AnalysisResult {
    return {
      query,
      targetKeyword: query.replace(/[?？]/g, '').trim(),
      analyzedPages: [],
      citationPatterns: {
        avgWordCount: 0, avgHeadingCount: 0, tableRatio: 0, listRatio: 0, faqRatio: 0,
        schemaRatio: 0, numberDensity: 0,
        definitionSentences: 0, numericDataPoints: 0, comparisonElements: 0, processSteps: 0,
        topKeywords: [], commonHeadingPatterns: [], citationDrivers: [],
      },
      directives: [{
        priority: 'critical',
        category: '데이터',
        action: '이 키워드에 대한 인용 데이터가 부족합니다. 실시간 질문을 먼저 실행하여 인용 데이터를 수집해주세요.',
        example: '라이브 쿼리에서 이 질문을 먼저 실행 → 인용 URL 수집 → 재분석',
        reason: '분석할 인용 데이터가 없으면 역분석이 불가능합니다',
        estimatedImpact: '-',
        seoTag: 'ALL',
      }],
      contentScore: { current: 0, potential: 0, improvements: [] },
      seoUpgrade: {
        naverOptimization: [], googleOptimization: [],
        aiEngineOptimization: [], schemaMarkupSuggestions: [],
      },
      summary: '인용 데이터 부족. 먼저 실시간 질문으로 데이터를 수집해주세요.',
    };
  }

  private deduplicateDirectives(directives: Directive[]): Directive[] {
    const seen = new Set<string>();
    const result: Directive[] = [];

    // critical 우선, 그 다음 high, medium
    const sorted = [...directives].sort((a, b) => {
      const order = { critical: 0, high: 1, medium: 2 };
      return (order[a.priority] || 2) - (order[b.priority] || 2);
    });

    for (const d of sorted) {
      const key = `${d.category}-${d.action.substring(0, 30)}`;
      if (!seen.has(key)) {
        seen.add(key);
        result.push(d);
      }
    }

    return result;
  }

  private async updateCalendarWithDirectives(hospitalId: string, directives: Directive[]): Promise<number> {
    // PLANNED 상태인 다음 4주치 캘린더 항목에 지시어 주입
    const upcoming = await this.prisma.contentCalendar.findMany({
      where: {
        hospitalId,
        status: 'PLANNED',
      },
      orderBy: { weekNumber: 'asc' },
      take: 4,
    });

    let updated = 0;
    for (const item of upcoming) {
      // 해당 주제에 관련된 지시어 필터링
      const relevantDirectives = directives.filter(d =>
        d.priority === 'critical' || d.priority === 'high'
      ).slice(0, 5);

      if (relevantDirectives.length > 0) {
        await this.prisma.contentCalendar.update({
          where: { id: item.id },
          data: {
            seoDirectives: {
              directives: relevantDirectives,
              injectedAt: new Date().toISOString(),
              source: 'bulk_analysis',
            } as any,
          },
        });
        updated++;
      }
    }

    return updated;
  }

  private async generateBasicCalendar(hospitalId: string, procedures: string[], region: string) {
    await this.prisma.contentCalendar.deleteMany({ where: { hospitalId } });

    const funnelStages = ['AWARENESS', 'CONSIDERATION', 'DECISION', 'RETENTION', 'ADVOCACY'];
    const contentTypes = ['BLOG', 'COMPARISON', 'FAQ', 'GUIDE', 'BLOG'];

    const now = new Date();
    const startOfWeek = new Date(now);
    startOfWeek.setDate(now.getDate() - now.getDay() + 1);

    let created = 0;
    for (let week = 1; week <= 56; week++) {
      const procedure = procedures[(week - 1) % procedures.length];
      const funnel = funnelStages[(week - 1) % funnelStages.length];
      const contentType = contentTypes[(week - 1) % contentTypes.length];

      const scheduledDate = new Date(startOfWeek);
      scheduledDate.setDate(startOfWeek.getDate() + (week - 1) * 7);
      const yearWeek = `${scheduledDate.getFullYear()}-W${String(this.getISOWeek(scheduledDate)).padStart(2, '0')}`;

      const topicTemplates: Record<string, string[]> = {
        AWARENESS: [
          `${procedure}, 이런 증상이면 꼭 확인해야 합니다`,
          `${region} ${procedure} 전 반드시 알아야 할 기본 상식`,
          `${procedure} 미루면 어떻게 되나요? 전문의가 알려드립니다`,
        ],
        CONSIDERATION: [
          `${region} ${procedure} 비용 완전 비교 가이드`,
          `${procedure} vs 대안 시술, 나에게 맞는 선택은?`,
          `${procedure} 병원 고를 때 반드시 확인할 체크리스트`,
        ],
        DECISION: [
          `${region} ${procedure} 전문 병원 선택 가이드`,
          `${procedure} 시술 과정과 회복 기간 총정리`,
          `${procedure} 전 후 주의사항 완벽 정리`,
        ],
        RETENTION: [
          `${procedure} 후 관리법, 오래 유지하는 비결`,
          `${procedure} 후 정기 검진이 중요한 이유`,
        ],
        ADVOCACY: [
          `${procedure} 실제 환자 후기와 경험담`,
          `가족·지인에게 추천하는 ${procedure} 이야기`,
        ],
      };

      const templates = topicTemplates[funnel] || topicTemplates.AWARENESS;
      const topic = templates[(week - 1) % templates.length];

      try {
        await this.prisma.contentCalendar.create({
          data: {
            hospitalId,
            weekNumber: week,
            yearWeek,
            scheduledDate,
            topic,
            targetKeyword: `${region} ${procedure}`,
            funnelStage: funnel,
            procedure,
            contentType,
            status: 'PLANNED',
            priority: week <= 12 ? 'HIGH' : 'MEDIUM',
          },
        });
        created++;
      } catch (err) {
        // skip duplicates
      }
    }

    const lastDate = new Date(startOfWeek);
    lastDate.setDate(startOfWeek.getDate() + 55 * 7);

    return {
      created,
      weekRange: `${startOfWeek.toISOString().split('T')[0]} ~ ${lastDate.toISOString().split('T')[0]}`,
    };
  }

  private getISOWeek(date: Date): number {
    const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
    const dayNum = d.getUTCDay() || 7;
    d.setUTCDate(d.getUTCDate() + 4 - dayNum);
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    return Math.ceil((((d as any) - (yearStart as any)) / 86400000 + 1) / 7);
  }

  private isValidUrl(url: string): boolean {
    try {
      const u = new URL(url);
      return ['http:', 'https:'].includes(u.protocol) && u.hostname.length > 3;
    } catch {
      return false;
    }
  }

  private extractDomain(url: string): string {
    try {
      return new URL(url).hostname.replace(/^www\./, '');
    } catch {
      return '';
    }
  }

  private chunkArray<T>(arr: T[], size: number): T[][] {
    const chunks: T[][] = [];
    for (let i = 0; i < arr.length; i += size) {
      chunks.push(arr.slice(i, i + size));
    }
    return chunks;
  }
}
