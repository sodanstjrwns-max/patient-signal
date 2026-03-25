import { Controller, Post, Get, Param, Body, UseGuards, Query, Req, Logger, NotFoundException } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { AICrawlerService } from './ai-crawler.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { PrismaService } from '../common/prisma/prisma.service';
import { PlanGuard } from '../common/guards/plan.guard';
import { PlanLimit } from '../common/decorators/plan-limit.decorator';
import { LiveQueryCategory } from '@prisma/client';

const platformNames: Record<string, string> = {
  CHATGPT: 'ChatGPT',
  CLAUDE: 'Claude',
  PERPLEXITY: 'Perplexity',
  GEMINI: 'Gemini',
};

@ApiTags('AI 크롤러')
@Controller('ai-crawler')
@UseGuards(JwtAuthGuard, PlanGuard)
@ApiBearerAuth()
export class AICrawlerController {
  private readonly logger = new Logger(AICrawlerController.name);

  constructor(
    private aiCrawlerService: AICrawlerService,
    private prisma: PrismaService,
  ) {}

  @Get('status')
  @ApiOperation({ summary: 'API 상태 확인 (개선 사항 포함)', description: 'AI API 키 설정 및 개선 사항 상태를 확인합니다' })
  async getApiStatus() {
    return this.aiCrawlerService.getApiStatus();
  }

  @Get('test-openai')
  @ApiOperation({ summary: 'OpenAI 테스트' })
  async testOpenAI() {
    try {
      const result = await this.aiCrawlerService.testOpenAICall();
      return { success: true, result };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  @Get('test-gemini')
  @ApiOperation({ summary: 'Gemini 테스트' })
  async testGemini() {
    try {
      const result = await this.aiCrawlerService.testGeminiCall();
      return { success: true, result };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  @Get('test-claude')
  @ApiOperation({ summary: 'Claude 테스트' })
  async testClaude() {
    try {
      const result = await this.aiCrawlerService.testClaudeCall();
      return { success: true, result };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  @Get('test-perplexity')
  @ApiOperation({ summary: 'Perplexity 테스트' })
  async testPerplexity() {
    try {
      const result = await this.aiCrawlerService.testPerplexityCall();
      return { success: true, result };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  // ==================== 개선된 크롤링 엔드포인트 ====================

  @Post('crawl/:hospitalId')
  @PlanLimit({ feature: 'crawlsPerMonth' })
  @ApiOperation({ 
    summary: '수동 크롤링 실행 (temp=0, 웹검색, ABHS 분석)',
    description: '해당 병원의 활성 프롬프트에 대해 AI 크롤링을 실행합니다. 플랫폼당 1회 측정 + ABHS 통합 분석.' 
  })
  async triggerCrawl(
    @Param('hospitalId') hospitalId: string,
    @Req() req: any,
  ) {
    const hospital = await this.prisma.hospital.findUnique({
      where: { id: hospitalId },
    });

    if (!hospital) {
      throw new NotFoundException('병원을 찾을 수 없습니다');
    }

    const prompts = await this.prisma.prompt.findMany({
      where: { hospitalId, isActive: true },
    });

    const crawlJob = await this.prisma.crawlJob.create({
      data: {
        hospitalId,
        status: 'RUNNING',
        totalPrompts: prompts.length,
        startedAt: new Date(),
      },
    });

    // 플랫폼 제한: 플랜에 따라 허용된 플랫폼만 사용
    const allowedPlatforms = req.planLimits?.platforms || ['CHATGPT', 'PERPLEXITY'];

    // 비동기로 개선된 크롤링 실행
    this.executeCrawling(crawlJob.id, hospital, prompts, allowedPlatforms);

    return {
      jobId: crawlJob.id,
      totalPrompts: prompts.length,
      status: 'RUNNING',
      platforms: allowedPlatforms,
      planInfo: req.planInfo || null,
      message: '크롤링이 시작되었습니다',
      improvements: [
        'temperature=0 (재현성 확보)',
        '시스템 프롬프트 제거 (왜곡 방지)',
        '웹 검색 모드 활성화',
        'AI 감성 분석 + ABHS 통합 분석',
        '환각 필터링',
      ],
    };
  }

  @Get('job/:jobId')
  @ApiOperation({ summary: '크롤링 작업 상태 조회' })
  async getJobStatus(@Param('jobId') jobId: string) {
    const job = await this.prisma.crawlJob.findUnique({
      where: { id: jobId },
    });
    if (!job) throw new NotFoundException('작업을 찾을 수 없습니다');
    return job;
  }

  @Get('responses/:hospitalId')
  @ApiOperation({ summary: 'AI 응답 목록 조회 (페이지네이션, 필터링 지원)' })
  @ApiQuery({ name: 'platform', required: false })
  @ApiQuery({ name: 'limit', required: false })
  @ApiQuery({ name: 'offset', required: false })
  @ApiQuery({ name: 'mentioned', required: false, description: 'true/false - 언급 여부 필터' })
  async getResponses(
    @Param('hospitalId') hospitalId: string,
    @Query('platform') platform?: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
    @Query('mentioned') mentioned?: string,
  ) {
    try {
      this.logger.log(`[getResponses] hospitalId=${hospitalId}, platform=${platform}, limit=${limit}, offset=${offset}, mentioned=${mentioned}`);
      
      const take = Math.min(parseInt(limit || '50'), 100);
      const skip = parseInt(offset || '0') || 0;

      const where: any = { hospitalId };
      if (platform && platform !== 'undefined' && platform !== 'null') {
        where.aiPlatform = platform as any;
      }
      if (mentioned === 'true') where.isMentioned = true;
      if (mentioned === 'false') where.isMentioned = false;

      // 먼저 카운트만 빠르게 조회
      const total = await this.prisma.aIResponse.count({ where });
      this.logger.log(`[getResponses] 총 ${total}건 발견`);

      if (total === 0) {
        return { data: [], total: 0, hasMore: false };
      }

      const responses = await this.prisma.aIResponse.findMany({
        where,
        orderBy: { responseDate: 'desc' },
        take,
        skip,
        select: {
          id: true,
          aiPlatform: true,
          aiModelVersion: true,
          responseText: true,
          responseDate: true,
          isMentioned: true,
          mentionPosition: true,
          totalRecommendations: true,
          sentimentLabel: true,
          citedSources: true,
          competitorsMentioned: true,
          isWebSearch: true,
          recommendationDepth: true,
          createdAt: true,
          prompt: {
            select: {
              promptText: true,
            },
          },
        },
      });

      // responseText를 미리보기 길이로 제한 (메모리/전송량 최적화)
      const trimmedResponses = responses.map(r => ({
        ...r,
        responseText: r.responseText?.length > 800
          ? r.responseText.substring(0, 800) + '...'
          : r.responseText,
        responseTextFull: r.responseText?.length > 800, // 전체 텍스트 있음 표시
      }));

      this.logger.log(`[getResponses] ${trimmedResponses.length}건 반환 (skip=${skip}, take=${take})`);

      return {
        data: trimmedResponses,
        total,
        hasMore: skip + take < total,
      };
    } catch (error) {
      this.logger.error(`[getResponses] 조회 실패: ${error.message}`, error.stack);
      // 에러 시에도 빈 결과 반환 (프론트 크래시 방지)
      return { data: [], total: 0, hasMore: false, error: error.message };
    }
  }

  @Get('responses/:hospitalId/:responseId')
  @ApiOperation({ summary: '개별 AI 응답 상세 조회 (전체 텍스트 포함)' })
  async getResponseDetail(
    @Param('hospitalId') hospitalId: string,
    @Param('responseId') responseId: string,
  ) {
    const response = await this.prisma.aIResponse.findFirst({
      where: { id: responseId, hospitalId },
      select: {
        id: true,
        promptId: true,
        hospitalId: true,
        aiPlatform: true,
        aiModelVersion: true,
        responseText: true,
        responseDate: true,
        isMentioned: true,
        mentionPosition: true,
        totalRecommendations: true,
        sentimentScore: true,
        sentimentLabel: true,
        citedSources: true,
        competitorsMentioned: true,
        repeatIndex: true,
        isWebSearch: true,
        isVerified: true,
        verificationSource: true,
        sentimentScoreV2: true,
        recommendationDepth: true,
        queryIntent: true,
        platformWeight: true,
        abhsContribution: true,
        citedUrl: true,
        createdAt: true,
        prompt: { select: { id: true, promptText: true, specialtyCategory: true } },
      },
    });
    if (!response) {
      throw new NotFoundException('응답을 찾을 수 없습니다');
    }
    return response;
  }

  // ==================== Phase 1: 인사이트 분석 API ====================

  @Get('insights/mention-analysis/:hospitalId')
  @ApiOperation({ summary: 'AI 추천 멘트 원문 분석 - 추천 키워드, 문맥 분류, 차별화 포인트' })
  async getMentionAnalysis(
    @Param('hospitalId') hospitalId: string,
    @Query('days') days?: string,
  ) {
    try {
    const daysNum = parseInt(days || '30');
    const since = new Date();
    since.setDate(since.getDate() - daysNum);

    // 【최적화 R2】병렬 쿼리 + select절 최소화
    const [responses, hospital] = await Promise.all([
      this.prisma.aIResponse.findMany({
        where: {
          hospitalId,
          createdAt: { gte: since },
        },
        select: {
          responseText: true,
          aiPlatform: true,
          isMentioned: true,
          mentionPosition: true,
          sentimentLabel: true,
          competitorsMentioned: true,
          prompt: { select: { promptText: true } },
        },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.hospital.findUnique({ where: { id: hospitalId }, select: { name: true } }),
    ]);
    const hospitalName = hospital?.name || '';

    // --- 1. 추천 키워드 추출 ---
    const keywordMap: Record<string, number> = {};
    const contextKeywords: Record<string, string[]> = {
      '전문성': ['전문', '실력', '경험', '베테랑', '숙련', '전문의', '박사', '석사', '대학병원'],
      '시설/장비': ['시설', '장비', '최신', '첨단', '디지털', '3D', 'CT', '현미경', '클린', '위생'],
      '가격': ['가격', '비용', '합리적', '저렴', '가성비', '양심적', '부담', '할인'],
      '접근성': ['교통', '주차', '역세권', '야간', '주말', '일요일', '위치', '접근'],
      '후기/평판': ['후기', '평판', '소문', '입소문', '만족', '추천', '리뷰', '평가', '인기'],
      '친절/서비스': ['친절', '설명', '상담', '꼼꼼', '편안', '배려', '서비스', '대기'],
      '특수진료': ['수면', '무통', '소아', '어린이', '공포', '감염관리', '안전'],
    };

    // --- 2. 추천 문맥 분류 ---
    const contextStats = {
      primaryRecommend: 0,   // "1순위/가장/최고" 등으로 강력 추천
      listRecommend: 0,      // 여러 중 하나로 나열
      conditionalRecommend: 0, // "~라면" 조건부 추천
      notMentioned: 0,        // 언급 안됨
    };

    // --- 3. 플랫폼별 추천 방식 ---
    const platformContext: Record<string, { primary: number; list: number; conditional: number; notMentioned: number; total: number }> = {};

    // --- 4. 차별화 포인트 (경쟁사 대비) ---
    const ourAttributes: Record<string, number> = {};
    const competitorAttributes: Record<string, Record<string, number>> = {};

    for (const resp of responses) {
      const text = resp.responseText || '';
      const platform = resp.aiPlatform;
      
      if (!platformContext[platform]) {
        platformContext[platform] = { primary: 0, list: 0, conditional: 0, notMentioned: 0, total: 0 };
      }
      platformContext[platform].total++;

      if (resp.isMentioned) {
        // 추천 문맥 판단
        const lowerText = text.toLowerCase();
        const nameIdx = text.indexOf(hospitalName) !== -1 ? text.indexOf(hospitalName) : -1;
        
        // 1순위 추천 판단
        const primaryPatterns = ['1순위', '가장 추천', '최고', '1위', '가장 먼저', '대표적', '특히 추천', '첫 번째'];
        const nearbyText = nameIdx >= 0 ? text.substring(Math.max(0, nameIdx - 100), nameIdx + hospitalName.length + 100) : text;
        
        if (primaryPatterns.some(p => nearbyText.includes(p)) || (resp.mentionPosition === 1)) {
          contextStats.primaryRecommend++;
          platformContext[platform].primary++;
        } else if (text.includes('경우') || text.includes('라면') || text.includes('원한다면') || text.includes('찾는다면')) {
          contextStats.conditionalRecommend++;
          platformContext[platform].conditional++;
        } else {
          contextStats.listRecommend++;
          platformContext[platform].list++;
        }

        // 키워드 카운트
        for (const [category, keywords] of Object.entries(contextKeywords)) {
          for (const kw of keywords) {
            if (nearbyText.includes(kw)) {
              keywordMap[category] = (keywordMap[category] || 0) + 1;
              ourAttributes[category] = (ourAttributes[category] || 0) + 1;
              break; // 카테고리당 한번만
            }
          }
        }
      } else {
        contextStats.notMentioned++;
        platformContext[platform].notMentioned++;
      }

      // 경쟁사 속성 추출
      if (resp.competitorsMentioned && resp.competitorsMentioned.length > 0) {
        for (const comp of resp.competitorsMentioned) {
          if (!competitorAttributes[comp]) competitorAttributes[comp] = {};
          const compIdx = text.indexOf(comp);
          if (compIdx >= 0) {
            const compNearby = text.substring(Math.max(0, compIdx - 80), compIdx + comp.length + 80);
            for (const [category, keywords] of Object.entries(contextKeywords)) {
              for (const kw of keywords) {
                if (compNearby.includes(kw)) {
                  competitorAttributes[comp][category] = (competitorAttributes[comp][category] || 0) + 1;
                  break;
                }
              }
            }
          }
        }
      }
    }

    // 키워드 정렬
    const topKeywords = Object.entries(keywordMap)
      .sort(([, a], [, b]) => b - a)
      .map(([keyword, count]) => ({ keyword, count }));

    // 경쟁사 차별화 포인트 (상위 5개 경쟁사)
    const competitorComparison = Object.entries(competitorAttributes)
      .slice(0, 5)
      .map(([name, attrs]) => ({
        name,
        topAttributes: Object.entries(attrs).sort(([, a], [, b]) => b - a).slice(0, 3).map(([k, v]) => ({ keyword: k, count: v })),
      }));

    return {
      hospitalName,
      period: `최근 ${daysNum}일`,
      totalResponses: responses.length,
      mentionedResponses: responses.filter(r => r.isMentioned).length,
      recommendationKeywords: topKeywords,
      recommendationContext: contextStats,
      platformContext,
      ourStrengthProfile: ourAttributes,
      competitorComparison,
      // 【할루시네이션 감소】신뢰도 요약
      confidenceSummary: {
        avgConfidence: responses.length > 0
          ? 0.5 : 0,
        lowConfidenceCount: 0,
        highConfidenceCount: 0,
        totalWithConfidence: 0,
      },
      // 샘플 추천 멘트 (언급된 응답 중 대표 3개)
      sampleMentions: responses
        .filter(r => r.isMentioned && r.responseText)
        .slice(0, 5)
        .map(r => {
          const nameIdx = r.responseText.indexOf(hospitalName);
          const start = Math.max(0, nameIdx - 150);
          const end = Math.min(r.responseText.length, nameIdx + hospitalName.length + 150);
          return {
            platform: r.aiPlatform,
            question: r.prompt?.promptText || '',
            excerpt: nameIdx >= 0 ? '...' + r.responseText.substring(start, end) + '...' : r.responseText.substring(0, 300),
            position: r.mentionPosition,
            sentiment: r.sentimentLabel,
            confidenceScore: null,
            isLowConfidence: false,
          };
        }),
    };
    } catch (error) {
      this.logger.error(`[getMentionAnalysis] 실패: ${error.message}`, error.stack);
      return {
        totalResponses: 0,
        mentionRate: 0,
        mentionedResponses: 0,
        recommendationKeywords: [],
        recommendationContext: { primaryRecommend: 0, listRecommend: 0, conditionalRecommend: 0, notMentioned: 0 },
        platformContext: {},
        ourStrengthProfile: {},
        competitorComparison: [],
        confidenceSummary: { avgConfidence: 0, lowConfidenceCount: 0, highConfidenceCount: 0, totalWithConfidence: 0 },
        sampleMentions: [],
        error: error.message,
      };
    }
  }

  @Get('insights/trend/:hospitalId')
  @ApiOperation({ summary: 'AI 응답 트렌드 추적 - 주간/월간 변화' })
  async getResponseTrend(
    @Param('hospitalId') hospitalId: string,
    @Query('days') days?: string,
  ) {
    try {
    const daysNum = parseInt(days || '60');
    const since = new Date();
    since.setDate(since.getDate() - daysNum);

    const responses = await this.prisma.aIResponse.findMany({
      where: {
        hospitalId,
        createdAt: { gte: since },
      },
      select: {
        aiPlatform: true,
        isMentioned: true,
        sentimentLabel: true,
        mentionPosition: true,
        createdAt: true,
        responseDate: true,
      },
      orderBy: { createdAt: 'asc' },
    });

    // 일별 그룹화
    const dailyMap: Record<string, {
      date: string;
      total: number;
      mentioned: number;
      platforms: Record<string, { total: number; mentioned: number }>;
      sentiment: { positive: number; neutral: number; negative: number };
      avgPosition: number;
      positions: number[];
    }> = {};

    for (const r of responses) {
      const dateKey = (r.responseDate || r.createdAt).toISOString().split('T')[0];
      if (!dailyMap[dateKey]) {
        dailyMap[dateKey] = {
          date: dateKey,
          total: 0,
          mentioned: 0,
          platforms: {},
          sentiment: { positive: 0, neutral: 0, negative: 0 },
          avgPosition: 0,
          positions: [],
        };
      }
      const day = dailyMap[dateKey];
      day.total++;
      if (r.isMentioned) {
        day.mentioned++;
        if (r.mentionPosition) day.positions.push(r.mentionPosition);
      }
      
      // 플랫폼별
      if (!day.platforms[r.aiPlatform]) {
        day.platforms[r.aiPlatform] = { total: 0, mentioned: 0 };
      }
      day.platforms[r.aiPlatform].total++;
      if (r.isMentioned) day.platforms[r.aiPlatform].mentioned++;

      // 감성
      if (r.sentimentLabel === 'POSITIVE') day.sentiment.positive++;
      else if (r.sentimentLabel === 'NEGATIVE') day.sentiment.negative++;
      else day.sentiment.neutral++;
    }

    // 평균 포지션 계산
    const dailyData = Object.values(dailyMap)
      .sort((a, b) => a.date.localeCompare(b.date))
      .map(day => ({
        ...day,
        mentionRate: day.total > 0 ? Math.round((day.mentioned / day.total) * 100) : 0,
        avgPosition: day.positions.length > 0 ? +(day.positions.reduce((s, p) => s + p, 0) / day.positions.length).toFixed(1) : null,
        platforms: Object.fromEntries(
          Object.entries(day.platforms).map(([p, v]) => [p, {
            ...v,
            mentionRate: v.total > 0 ? Math.round((v.mentioned / v.total) * 100) : 0,
          }])
        ),
        positions: undefined, // 불필요 제거
      }));

    // 주간 집계
    const weeklyData: any[] = [];
    for (let i = 0; i < dailyData.length; i += 7) {
      const week = dailyData.slice(i, i + 7);
      const total = week.reduce((s, d) => s + d.total, 0);
      const mentioned = week.reduce((s, d) => s + d.mentioned, 0);
      weeklyData.push({
        weekStart: week[0]?.date,
        weekEnd: week[week.length - 1]?.date,
        total,
        mentioned,
        mentionRate: total > 0 ? Math.round((mentioned / total) * 100) : 0,
        sentiment: {
          positive: week.reduce((s, d) => s + d.sentiment.positive, 0),
          neutral: week.reduce((s, d) => s + d.sentiment.neutral, 0),
          negative: week.reduce((s, d) => s + d.sentiment.negative, 0),
        },
      });
    }

    // 플랫폼별 전체 트렌드
    const platformTrend: Record<string, { total: number; mentioned: number; mentionRate: number; trend: string }> = {};
    const platforms = ['CHATGPT', 'PERPLEXITY', 'CLAUDE', 'GEMINI'];
    for (const p of platforms) {
      const pResponses = responses.filter(r => r.aiPlatform === p);
      const total = pResponses.length;
      const mentioned = pResponses.filter(r => r.isMentioned).length;
      
      // 최근 절반 vs 이전 절반 비교로 트렌드 계산
      const mid = Math.floor(pResponses.length / 2);
      const firstHalf = pResponses.slice(0, mid);
      const secondHalf = pResponses.slice(mid);
      const firstRate = firstHalf.length > 0 ? firstHalf.filter(r => r.isMentioned).length / firstHalf.length : 0;
      const secondRate = secondHalf.length > 0 ? secondHalf.filter(r => r.isMentioned).length / secondHalf.length : 0;
      
      platformTrend[p] = {
        total,
        mentioned,
        mentionRate: total > 0 ? Math.round((mentioned / total) * 100) : 0,
        trend: secondRate > firstRate + 0.1 ? 'UP' : secondRate < firstRate - 0.1 ? 'DOWN' : 'STABLE',
      };
    }

    return {
      period: `최근 ${daysNum}일`,
      dailyData,
      weeklyData,
      platformTrend,
      summary: {
        totalResponses: responses.length,
        totalMentions: responses.filter(r => r.isMentioned).length,
        overallMentionRate: responses.length > 0 ? Math.round((responses.filter(r => r.isMentioned).length / responses.length) * 100) : 0,
      },
    };
    } catch (error) {
      this.logger.error(`[getResponseTrend] 실패: ${error.message}`, error.stack);
      return { dailyData: [], weeklyData: [], platformTrend: {}, summary: { totalResponses: 0, totalMentions: 0, overallMentionRate: 0 }, error: error.message };
    }
  }

  @Get('insights/sources/:hospitalId')
  @ApiOperation({ summary: 'AI 응답 출처 분석 - 출처별 빈도, 채널 분석' })
  async getSourceAnalysis(
    @Param('hospitalId') hospitalId: string,
    @Query('days') days?: string,
  ) {
    const daysNum = parseInt(days || '30');
    const since = new Date();
    since.setDate(since.getDate() - daysNum);

    const responses = await this.prisma.aIResponse.findMany({
      where: {
        hospitalId,
        createdAt: { gte: since },
      },
      select: {
        citedSources: true,
        citedUrl: true,
        aiPlatform: true,
        isMentioned: true,
      },
    });

    // 모든 출처 URL 수집
    const allUrls: string[] = [];
    for (const r of responses) {
      if (r.citedSources?.length > 0) {
        allUrls.push(...r.citedSources);
      }
      if (r.citedUrl) {
        allUrls.push(r.citedUrl);
      }
    }

    // 도메인별 분류
    const domainMap: Record<string, { count: number; urls: string[]; category: string }> = {};
    const categoryMap: Record<string, number> = {};

    const domainCategories: Record<string, string> = {
      'blog.naver.com': '네이버 블로그',
      'naver.com': '네이버',
      'map.naver.com': '네이버 지도',
      'm.place.naver.com': '네이버 플레이스',
      'place.naver.com': '네이버 플레이스',
      'kin.naver.com': '네이버 지식인',
      'youtube.com': '유튜브',
      'www.youtube.com': '유튜브',
      'm.youtube.com': '유튜브',
      'instagram.com': '인스타그램',
      'www.instagram.com': '인스타그램',
      'google.com': '구글',
      'www.google.com': '구글',
      'maps.google.com': '구글 맵',
      'kakao.com': '카카오',
      'map.kakao.com': '카카오맵',
      'tistory.com': '티스토리 블로그',
      'brunch.co.kr': '브런치',
      'modoo.at': '네이버 모두',
      'gangnam.com': '강남닷컴',
    };

    for (const url of allUrls) {
      try {
        const urlObj = new URL(url);
        let domain = urlObj.hostname.replace('www.', '');
        
        // 특수 도메인 매칭 (blog.naver.com 등)
        let category = '기타';
        for (const [pattern, cat] of Object.entries(domainCategories)) {
          if (url.includes(pattern)) {
            category = cat;
            domain = pattern;
            break;
          }
        }
        
        // 병원 공식 사이트 판별
        if (category === '기타') {
          if (domain.includes('치과') || domain.includes('dental') || domain.includes('clinic') || domain.includes('hospital')) {
            category = '병원 공식사이트';
          } else if (domain.endsWith('.tistory.com')) {
            category = '티스토리 블로그';
          } else {
            category = '기타 웹사이트';
          }
        }

        if (!domainMap[domain]) {
          domainMap[domain] = { count: 0, urls: [], category };
        }
        domainMap[domain].count++;
        if (domainMap[domain].urls.length < 3) domainMap[domain].urls.push(url);
        
        categoryMap[category] = (categoryMap[category] || 0) + 1;
      } catch {
        // invalid URL
      }
    }

    // 정렬
    const topDomains = Object.entries(domainMap)
      .sort(([, a], [, b]) => b.count - a.count)
      .slice(0, 15)
      .map(([domain, data]) => ({ domain, ...data }));

    const categories = Object.entries(categoryMap)
      .sort(([, a], [, b]) => b - a)
      .map(([category, count]) => ({
        category,
        count,
        percentage: allUrls.length > 0 ? Math.round((count / allUrls.length) * 100) : 0,
      }));

    // 플랫폼별 출처 수
    const platformSources: Record<string, { totalSources: number; responsesWithSources: number; total: number }> = {};
    for (const r of responses) {
      const p = r.aiPlatform;
      if (!platformSources[p]) platformSources[p] = { totalSources: 0, responsesWithSources: 0, total: 0 };
      platformSources[p].total++;
      const sourceCount = (r.citedSources?.length || 0) + (r.citedUrl ? 1 : 0);
      platformSources[p].totalSources += sourceCount;
      if (sourceCount > 0) platformSources[p].responsesWithSources++;
    }

    // 미활용 채널 분석
    const activeChannels = new Set(categories.map(c => c.category));
    const potentialChannels = ['네이버 블로그', '유튜브', '인스타그램', '네이버 플레이스', '병원 공식사이트', '구글', '네이버 지식인', '티스토리 블로그'];
    const missingChannels = potentialChannels.filter(c => !activeChannels.has(c));

    return {
      period: `최근 ${daysNum}일`,
      totalUrls: allUrls.length,
      totalResponsesWithSources: responses.filter(r => (r.citedSources?.length || 0) > 0 || r.citedUrl).length,
      categories,
      topDomains,
      platformSources,
      missingChannels: missingChannels.map(c => ({
        channel: c,
        recommendation: this.getChannelRecommendation(c),
      })),
    };
  }

  private getChannelRecommendation(channel: string): string {
    const recommendations: Record<string, string> = {
      '네이버 블로그': '정기적인 진료 사례 블로그 포스팅으로 AI 참조 확률 상승',
      '유튜브': '진료 과정/원장 인터뷰 영상으로 AI 검색 출처 다양화',
      '인스타그램': 'Before/After 콘텐츠로 시각적 신뢰도 구축',
      '네이버 플레이스': '네이버 플레이스 정보 최적화 → 위치 기반 AI 추천 강화',
      '병원 공식사이트': 'SEO 최적화된 공식 사이트로 AI 신뢰도 점수 상승',
      '구글': '구글 비즈니스 프로필 최적화 → ChatGPT/Gemini 참조 증가',
      '네이버 지식인': '전문 답변 활동으로 AI 학습 데이터에 병원 정보 축적',
      '티스토리 블로그': '전문적인 의료 콘텐츠 블로그로 검색 채널 다양화',
    };
    return recommendations[channel] || '해당 채널에 콘텐츠를 게시하면 AI 참조 가능성 증가';
  }

  // ==================== Phase 2-4: 경쟁사 포지셔닝 맵 ====================

  @Get('insights/positioning/:hospitalId')
  @ApiOperation({ summary: '경쟁사 포지셔닝 맵 - 레이더차트 5축 분석' })
  async getPositioningMap(
    @Param('hospitalId') hospitalId: string,
    @Query('days') days?: string,
  ) {
    try {
    const daysNum = parseInt(days || '30');
    const since = new Date();
    since.setDate(since.getDate() - daysNum);

    // 【최적화 R2】병렬 쿼리 + select절 최소화 (포지셔닝 맵)
    const [hospital, responses] = await Promise.all([
      this.prisma.hospital.findUnique({ where: { id: hospitalId }, select: { name: true } }),
      this.prisma.aIResponse.findMany({
        where: { hospitalId, createdAt: { gte: since } },
        select: {
          responseText: true,
          aiPlatform: true,
          isMentioned: true,
          competitorsMentioned: true,
          prompt: { select: { promptText: true } },
        },
      }),
    ]);
    const hospitalName = hospital?.name || '';

    // 5축 정의
    const axes = {
      expertise: { label: '전문성', keywords: ['전문', '실력', '경험', '베테랑', '숙련', '전문의', '박사', '석사', '대학병원', '전문', '노하우', '기술력'] },
      price: { label: '가격', keywords: ['가격', '비용', '합리적', '저렴', '가성비', '양심적', '부담', '할인', '경제적', '착한'] },
      accessibility: { label: '접근성', keywords: ['교통', '주차', '역세권', '야간', '주말', '일요일', '위치', '접근', '편리', '가까', '지하철'] },
      facility: { label: '시설/장비', keywords: ['시설', '장비', '최신', '첨단', '디지털', '3D', 'CT', '현미경', '클린', '위생', '인테리어', '깨끗'] },
      reputation: { label: '후기/평판', keywords: ['후기', '평판', '소문', '입소문', '만족', '추천', '리뷰', '평가', '인기', '유명', '신뢰'] },
    };

    // 포지션 분석 함수
    const analyzePosition = (name: string, texts: { text: string; nameIdx: number }[]) => {
      const scores: Record<string, number> = {};
      const counts: Record<string, number> = {};
      
      for (const [axis, config] of Object.entries(axes)) {
        let matchCount = 0;
        for (const { text, nameIdx } of texts) {
          const nearbyStart = Math.max(0, nameIdx - 200);
          const nearbyEnd = Math.min(text.length, nameIdx + name.length + 200);
          const nearby = text.substring(nearbyStart, nearbyEnd);
          
          for (const kw of config.keywords) {
            if (nearby.includes(kw)) {
              matchCount++;
              break;
            }
          }
        }
        counts[axis] = matchCount;
        // 정규화: 0-100 스케일 (최대 등장 비율 기준)
        scores[axis] = texts.length > 0 ? Math.round((matchCount / texts.length) * 100) : 0;
      }
      
      return { scores, counts };
    };

    // 우리 병원 포지션
    const ourTexts = responses
      .filter(r => r.isMentioned)
      .map(r => ({
        text: r.responseText,
        nameIdx: r.responseText.indexOf(hospitalName),
      }))
      .filter(t => t.nameIdx >= 0);

    const ourPosition = analyzePosition(hospitalName, ourTexts);

    // 경쟁사 포지션
    const competitorMap: Record<string, { text: string; nameIdx: number }[]> = {};
    for (const r of responses) {
      if (r.competitorsMentioned) {
        for (const comp of r.competitorsMentioned) {
          if (!competitorMap[comp]) competitorMap[comp] = [];
          const idx = r.responseText.indexOf(comp);
          if (idx >= 0) {
            competitorMap[comp].push({ text: r.responseText, nameIdx: idx });
          }
        }
      }
    }

    // 상위 5개 경쟁사
    const competitorPositions = Object.entries(competitorMap)
      .sort(([, a], [, b]) => b.length - a.length)
      .slice(0, 5)
      .map(([name, texts]) => ({
        name,
        mentionCount: texts.length,
        ...analyzePosition(name, texts),
      }));

    // 포지셔닝 인사이트 생성
    const insights: string[] = [];
    const ourTop = Object.entries(ourPosition.scores).sort(([, a], [, b]) => b - a);
    const ourWeak = Object.entries(ourPosition.scores).sort(([, a], [, b]) => a - b);
    
    if (ourTop.length > 0 && ourTop[0][1] > 0) {
      insights.push(`AI는 우리 병원의 '${axes[ourTop[0][0] as keyof typeof axes].label}'을(를) 가장 강하게 인식합니다`);
    }
    if (ourWeak.length > 0) {
      insights.push(`'${axes[ourWeak[0][0] as keyof typeof axes].label}' 영역 강화가 필요합니다`);
    }

    for (const comp of competitorPositions.slice(0, 3)) {
      const compTop = Object.entries(comp.scores).sort(([, a], [, b]) => b - a);
      if (compTop.length > 0 && compTop[0][1] > 0) {
        insights.push(`${comp.name}은(는) '${axes[compTop[0][0] as keyof typeof axes].label}'으로 포지셔닝됨`);
      }
    }

    return {
      hospitalName,
      period: `최근 ${daysNum}일`,
      axes: Object.fromEntries(Object.entries(axes).map(([k, v]) => [k, v.label])),
      ourPosition: {
        scores: ourPosition.scores,
        counts: ourPosition.counts,
        totalMentions: ourTexts.length,
      },
      competitors: competitorPositions,
      insights,
    };
    } catch (error) {
      this.logger.error(`[getPositioningMap] 실패: ${error.message}`, error.stack);
      return { hospitalName: '', period: '', axes: {}, ourPosition: { scores: {}, counts: {}, totalMentions: 0 }, competitors: [], insights: [], error: error.message };
    }
  }

  // ==================== Phase 2-5: 출처 품질 분석 (강화) ====================

  @Get('insights/source-quality/:hospitalId')
  @ApiOperation({ summary: '출처 품질 분석 - 채널별 영향력 및 품질 점수' })
  async getSourceQuality(
    @Param('hospitalId') hospitalId: string,
    @Query('days') days?: string,
  ) {
    const daysNum = parseInt(days || '30');
    const since = new Date();
    since.setDate(since.getDate() - daysNum);

    const responses = await this.prisma.aIResponse.findMany({
      where: { hospitalId, createdAt: { gte: since } },
      select: {
        citedSources: true,
        citedUrl: true,
        aiPlatform: true,
        isMentioned: true,
        sentimentLabel: true,
      },
    });

    // 채널 품질 점수 매핑
    const channelQuality: Record<string, { score: number; weight: string; description: string }> = {
      '병원 공식사이트': { score: 100, weight: '최상', description: 'AI가 가장 신뢰하는 공식 소스' },
      '네이버 플레이스': { score: 90, weight: '최상', description: '위치 기반 추천의 핵심 데이터' },
      '구글': { score: 85, weight: '상', description: 'ChatGPT/Gemini의 주요 참조 소스' },
      '네이버 블로그': { score: 75, weight: '상', description: '한국어 AI의 핵심 학습 데이터' },
      '유튜브': { score: 70, weight: '상', description: 'Gemini/Perplexity가 활발히 참조' },
      '네이버 지식인': { score: 65, weight: '중상', description: 'Q&A 형식으로 AI 학습에 적합' },
      '티스토리 블로그': { score: 60, weight: '중', description: '전문 콘텐츠 채널' },
      '인스타그램': { score: 50, weight: '중', description: '시각 콘텐츠 기반 신뢰도' },
      '카카오': { score: 55, weight: '중', description: '국내 플랫폼 참조' },
      '카카오맵': { score: 80, weight: '상', description: '위치 기반 데이터' },
      '브런치': { score: 65, weight: '중상', description: '전문 에세이 콘텐츠' },
      '기타 웹사이트': { score: 40, weight: '하', description: '비전문 소스' },
    };

    // 채널별 데이터 수집
    const channelData: Record<string, {
      count: number;
      mentionedCount: number;
      positiveCount: number;
      platforms: Set<string>;
    }> = {};

    for (const r of responses) {
      const allSources = [...(r.citedSources || []), ...(r.citedUrl ? [r.citedUrl] : [])];
      
      for (const url of allSources) {
        const channel = this.categorizeUrl(url);
        if (!channelData[channel]) {
          channelData[channel] = { count: 0, mentionedCount: 0, positiveCount: 0, platforms: new Set() };
        }
        channelData[channel].count++;
        channelData[channel].platforms.add(r.aiPlatform);
        if (r.isMentioned) channelData[channel].mentionedCount++;
        if (r.sentimentLabel === 'POSITIVE') channelData[channel].positiveCount++;
      }
    }

    // 채널 영향력 점수 계산
    const channelAnalysis = Object.entries(channelData)
      .sort(([, a], [, b]) => b.count - a.count)
      .map(([channel, data]) => {
        const quality = channelQuality[channel] || { score: 40, weight: '하', description: '' };
        const mentionCorrelation = data.count > 0 ? Math.round((data.mentionedCount / data.count) * 100) : 0;
        const positiveCorrelation = data.count > 0 ? Math.round((data.positiveCount / data.count) * 100) : 0;
        
        // 종합 영향력 = (품질 * 0.4) + (빈도 정규화 * 0.3) + (언급 상관관계 * 0.3)
        const maxCount = Math.max(...Object.values(channelData).map(d => d.count));
        const freqScore = maxCount > 0 ? Math.round((data.count / maxCount) * 100) : 0;
        const influenceScore = Math.round(quality.score * 0.4 + freqScore * 0.3 + mentionCorrelation * 0.3);

        return {
          channel,
          qualityScore: quality.score,
          qualityWeight: quality.weight,
          qualityDescription: quality.description,
          citedCount: data.count,
          mentionCorrelation,
          positiveCorrelation,
          influenceScore,
          platforms: Array.from(data.platforms),
        };
      });

    // 종합 출처 건강도 점수
    const totalSources = Object.values(channelData).reduce((s, d) => s + d.count, 0);
    const avgQuality = channelAnalysis.length > 0
      ? Math.round(channelAnalysis.reduce((s, c) => s + c.qualityScore * c.citedCount, 0) / totalSources)
      : 0;
    const channelDiversity = channelAnalysis.length;
    const healthScore = Math.round(avgQuality * 0.5 + Math.min(channelDiversity * 10, 50));

    return {
      period: `최근 ${daysNum}일`,
      healthScore,
      healthLabel: healthScore >= 70 ? '우수' : healthScore >= 50 ? '양호' : healthScore >= 30 ? '보통' : '개선 필요',
      avgQuality,
      channelDiversity,
      channels: channelAnalysis,
      recommendations: this.generateSourceRecommendations(channelAnalysis, channelQuality),
    };
  }

  private categorizeUrl(url: string): string {
    const patterns: [string, string][] = [
      ['blog.naver.com', '네이버 블로그'],
      ['m.place.naver.com', '네이버 플레이스'],
      ['place.naver.com', '네이버 플레이스'],
      ['map.naver.com', '네이버 지도'],
      ['kin.naver.com', '네이버 지식인'],
      ['naver.com', '네이버'],
      ['youtube.com', '유튜브'],
      ['instagram.com', '인스타그램'],
      ['maps.google.com', '구글'],
      ['google.com', '구글'],
      ['map.kakao.com', '카카오맵'],
      ['kakao.com', '카카오'],
      ['tistory.com', '티스토리 블로그'],
      ['brunch.co.kr', '브런치'],
      ['modoo.at', '네이버 모두'],
    ];

    for (const [pattern, category] of patterns) {
      if (url.includes(pattern)) return category;
    }

    try {
      const domain = new URL(url).hostname;
      if (domain.includes('치과') || domain.includes('dental') || domain.includes('clinic') || domain.includes('hospital')) {
        return '병원 공식사이트';
      }
    } catch { /* invalid URL - skip */ }

    return '기타 웹사이트';
  }

  private generateSourceRecommendations(
    channels: any[],
    qualityMap: Record<string, any>,
  ): { priority: string; channel: string; action: string; expectedImpact: string }[] {
    const recs: { priority: string; channel: string; action: string; expectedImpact: string }[] = [];

    // 공식 사이트 없으면 최우선
    if (!channels.find(c => c.channel === '병원 공식사이트')) {
      recs.push({
        priority: '🔴 긴급',
        channel: '병원 공식사이트',
        action: 'SEO 최적화된 공식 사이트 구축 또는 개선 (진료 안내, 의료진 소개, 후기 페이지)',
        expectedImpact: 'AI 신뢰도 대폭 상승 → 언급률 +20~30%p 예상',
      });
    }

    // 네이버 플레이스 없으면 우선
    if (!channels.find(c => c.channel === '네이버 플레이스')) {
      recs.push({
        priority: '🟠 높음',
        channel: '네이버 플레이스',
        action: '네이버 플레이스 정보 최적화 (사진, 영업시간, 메뉴, 후기 관리)',
        expectedImpact: '위치 기반 AI 추천 강화 → ChatGPT 언급률 +15%p 예상',
      });
    }

    // 블로그 적으면
    const blogChannel = channels.find(c => c.channel === '네이버 블로그');
    if (!blogChannel || blogChannel.citedCount < 3) {
      recs.push({
        priority: '🟡 보통',
        channel: '네이버 블로그',
        action: '주 2회 이상 진료 사례/전문 정보 블로그 포스팅',
        expectedImpact: 'Perplexity/Gemini 출처 참조 증가 → 언급률 +10%p 예상',
      });
    }

    // 유튜브 없으면
    if (!channels.find(c => c.channel === '유튜브')) {
      recs.push({
        priority: '🟡 보통',
        channel: '유튜브',
        action: '월 2회 이상 진료 과정 또는 원장님 Q&A 영상 업로드',
        expectedImpact: 'Gemini/Perplexity 참조 다양화 → AI 출처 신뢰도 상승',
      });
    }

    // 구글 없으면
    if (!channels.find(c => c.channel === '구글')) {
      recs.push({
        priority: '🟡 보통',
        channel: '구글 비즈니스 프로필',
        action: '구글 비즈니스 프로필 등록 및 리뷰 관리',
        expectedImpact: 'ChatGPT/Gemini 참조 강화 → 글로벌 AI 가시성 상승',
      });
    }

    return recs;
  }

  // ==================== Phase 2-6: 자동 액션 리포트 ====================

  @Get('insights/action-report/:hospitalId')
  @ApiOperation({ summary: '자동 액션 리포트 - AI 기반 주간 실행 계획 생성' })
  async getActionReport(
    @Param('hospitalId') hospitalId: string,
  ) {
    const since = new Date();
    since.setDate(since.getDate() - 30);

    // 【최적화 R2】병렬 쿼리 + select 최소화 (액션 리포트)
    const [hospital, responses] = await Promise.all([
      this.prisma.hospital.findUnique({ where: { id: hospitalId }, select: { name: true } }),
      this.prisma.aIResponse.findMany({
        where: { hospitalId, createdAt: { gte: since } },
        select: {
          promptId: true,
          aiPlatform: true,
          isMentioned: true,
          sentimentLabel: true,
          competitorsMentioned: true,
          citedSources: true,
          citedUrl: true,
          prompt: { select: { promptText: true } },
        },
      }),
    ]);
    if (!hospital) throw new NotFoundException('병원을 찾을 수 없습니다');

    // --- 데이터 수집 ---
    const totalResponses = responses.length;
    const mentionedResponses = responses.filter(r => r.isMentioned);
    const mentionRate = totalResponses > 0 ? Math.round((mentionedResponses.length / totalResponses) * 100) : 0;

    // 【최적화 R3】응답 데이터를 한 번만 순회하며 모든 통계 계산 (필터 중복 제거)
    const platformStats: Record<string, { total: number; mentioned: number; rate: number }> = {};
    const competitorFreq: Record<string, number> = {};
    const promptMap = new Map<string, { text: string; mentioned: string[]; notMentioned: string[] }>();
    const allSources: string[] = [];
    let positiveCount = 0;
    let negativeCount = 0;

    for (const r of responses) {
      // 플랫폼별 통계
      if (!platformStats[r.aiPlatform]) {
        platformStats[r.aiPlatform] = { total: 0, mentioned: 0, rate: 0 };
      }
      platformStats[r.aiPlatform].total++;
      if (r.isMentioned) platformStats[r.aiPlatform].mentioned++;

      // 경쟁사 빈도
      for (const comp of (r.competitorsMentioned || [])) {
        competitorFreq[comp] = (competitorFreq[comp] || 0) + 1;
      }

      // 프롬프트 갭
      const pId = r.promptId;
      if (!promptMap.has(pId)) {
        promptMap.set(pId, { text: r.prompt?.promptText || '', mentioned: [], notMentioned: [] });
      }
      if (r.isMentioned) {
        promptMap.get(pId)!.mentioned.push(r.aiPlatform);
      } else {
        promptMap.get(pId)!.notMentioned.push(r.aiPlatform);
      }

      // 출처 수집
      if (r.citedSources?.length > 0) allSources.push(...r.citedSources);
      if (r.citedUrl) allSources.push(r.citedUrl);

      // 감성
      if (r.sentimentLabel === 'POSITIVE') positiveCount++;
      else if (r.sentimentLabel === 'NEGATIVE') negativeCount++;
    }

    // 플랫폼별 rate 계산
    for (const p of Object.keys(platformStats)) {
      const s = platformStats[p];
      s.rate = s.total > 0 ? Math.round((s.mentioned / s.total) * 100) : 0;
    }

    // 가장 약한 플랫폼
    const weakestPlatform = Object.entries(platformStats)
      .filter(([, s]) => s.total > 0)
      .sort(([, a], [, b]) => a.rate - b.rate)[0];

    // 가장 강한 플랫폼
    const strongestPlatform = Object.entries(platformStats)
      .filter(([, s]) => s.total > 0)
      .sort(([, a], [, b]) => b.rate - a.rate)[0];

    const promptGaps: { question: string; platforms: string[] }[] = [];

    for (const [, data] of promptMap) {
      if (data.mentioned.length === 0 && data.notMentioned.length > 0) {
        promptGaps.push({ question: data.text, platforms: data.notMentioned });
      }
    }

    const topCompetitors = Object.entries(competitorFreq).sort(([, a], [, b]) => b - a).slice(0, 3);

    // 출처 현황 (위의 루프에서 수집 완료)
    const hasOfficialSite = allSources.some(s => {
      try { const d = new URL(s).hostname; return d.includes('치과') || d.includes('dental') || d.includes('clinic'); } catch { return false; }
    });
    const hasBlog = allSources.some(s => s.includes('blog.naver.com'));
    const hasYoutube = allSources.some(s => s.includes('youtube.com'));

    // 감성 분석 (위의 루프에서 수집 완료)
    const sentimentRate = totalResponses > 0 ? Math.round((positiveCount / totalResponses) * 100) : 0;

    // --- 액션 플랜 생성 (GPT 없이 룰 기반) ---
    const actions: {
      priority: number;
      category: string;
      title: string;
      description: string;
      expectedImpact: string;
      deadline: string;
    }[] = [];

    // 1. 가장 약한 플랫폼 공략
    if (weakestPlatform && weakestPlatform[1].rate < 30) {
      const pName = platformNames[weakestPlatform[0]] || weakestPlatform[0];
      actions.push({
        priority: 1,
        category: '플랫폼 공략',
        title: `${pName} 언급률 개선 (현재 ${weakestPlatform[1].rate}%)`,
        description: weakestPlatform[0] === 'CHATGPT' 
          ? '공식 웹사이트 SEO 최적화 + 구글 비즈니스 프로필 강화 → ChatGPT의 주요 참조 소스 확보'
          : weakestPlatform[0] === 'PERPLEXITY'
          ? '네이버 블로그/플레이스 콘텐츠 강화 → Perplexity의 한국어 검색 소스 확보'
          : weakestPlatform[0] === 'GEMINI'
          ? '유튜브 콘텐츠 + 구글 맵 최적화 → Gemini의 구글 생태계 참조 강화'
          : 'AI 플랫폼별 최적화된 콘텐츠 배포',
        expectedImpact: `${pName} 언급률 ${weakestPlatform[1].rate}% → 목표 ${Math.min(weakestPlatform[1].rate + 20, 80)}%`,
        deadline: '이번 주',
      });
    }

    // 2. Content Gap 해소
    if (promptGaps.length > 0) {
      const topGap = promptGaps[0];
      actions.push({
        priority: 2,
        category: '콘텐츠 갭',
        title: `AI가 전혀 언급하지 않는 질문 ${promptGaps.length}개 발견`,
        description: `대표 질문: "${topGap.question.substring(0, 50)}" — 이 질문 관련 블로그 포스팅 + 공식사이트 페이지 필요`,
        expectedImpact: `언급률 +${Math.min(promptGaps.length * 3, 20)}%p 예상`,
        deadline: '이번 주',
      });
    }

    // 3. 출처 다양화
    if (!hasOfficialSite) {
      actions.push({
        priority: 3,
        category: '출처 강화',
        title: '병원 공식 사이트가 AI 출처에 없음',
        description: 'SEO 최적화된 공식 사이트 구축/개선 → 진료 안내, 의료진 소개, 자주 묻는 질문 페이지 추가',
        expectedImpact: 'AI 신뢰도 대폭 상승, 1순위 추천 확률 증가',
        deadline: '2주 내',
      });
    }
    if (!hasBlog) {
      actions.push({
        priority: 4,
        category: '출처 강화',
        title: '네이버 블로그 콘텐츠 시작',
        description: `주 2회 진료 사례/팁 포스팅 시작 → "${hospital.name}" 키워드로 AI 참조 가능성 확보`,
        expectedImpact: 'Perplexity/Gemini 출처 참조 확률 상승',
        deadline: '이번 주 시작',
      });
    }
    if (!hasYoutube) {
      actions.push({
        priority: 5,
        category: '출처 강화',
        title: '유튜브 채널 시작',
        description: '월 2회 진료 과정/원장 Q&A 영상 → 영상 콘텐츠는 AI의 멀티모달 참조에 점점 더 중요',
        expectedImpact: 'Gemini/Perplexity 출처 다양화',
        deadline: '2주 내 시작',
      });
    }

    // 4. 경쟁사 대응
    if (topCompetitors.length > 0 && topCompetitors[0][1] > mentionedResponses.length) {
      actions.push({
        priority: 2,
        category: '경쟁사 대응',
        title: `${topCompetitors[0][0]}이(가) ${topCompetitors[0][1]}회 언급 — 우리(${mentionedResponses.length}회)보다 많음`,
        description: `차별화 키워드로 콘텐츠 강화: 이 경쟁사와 다른 우리만의 강점 어필`,
        expectedImpact: '경쟁사 대비 언급 비율 역전 가능',
        deadline: '이번 주',
      });
    }

    // 5. 감성 개선
    if (negativeCount > 0 && negativeCount / totalResponses > 0.1) {
      actions.push({
        priority: 3,
        category: '감성 관리',
        title: `부정적 언급 ${negativeCount}건 감지`,
        description: 'AI 응답 내 부정적 문맥 확인 후, 해당 이슈 관련 긍정적 콘텐츠 생산',
        expectedImpact: '부정 비율 감소 → 전체 감성 점수 개선',
        deadline: '이번 주',
      });
    }

    // 정렬
    actions.sort((a, b) => a.priority - b.priority);

    return {
      hospitalName: hospital.name,
      generatedAt: new Date().toISOString(),
      period: '최근 30일',
      summary: {
        overallMentionRate: mentionRate,
        totalResponses,
        mentionedCount: mentionedResponses.length,
        sentimentRate,
        strongestPlatform: strongestPlatform ? {
          name: platformNames[strongestPlatform[0]] || strongestPlatform[0],
          rate: strongestPlatform[1].rate,
        } : null,
        weakestPlatform: weakestPlatform ? {
          name: platformNames[weakestPlatform[0]] || weakestPlatform[0],
          rate: weakestPlatform[1].rate,
        } : null,
        contentGapCount: promptGaps.length,
        topCompetitor: topCompetitors.length > 0 ? { name: topCompetitors[0][0], count: topCompetitors[0][1] } : null,
      },
      actions,
      weeklyGoals: [
        `전체 언급률 ${mentionRate}% → ${Math.min(mentionRate + 10, 80)}% 달성`,
        weakestPlatform ? `${platformNames[weakestPlatform[0]]} 언급률 ${weakestPlatform[1].rate}% → ${Math.min(weakestPlatform[1].rate + 15, 60)}%` : null,
        promptGaps.length > 0 ? `Content Gap ${promptGaps.length}개 중 ${Math.min(3, promptGaps.length)}개 해소` : null,
      ].filter(Boolean),
    };
  }

  // ==================== 실시간 질문 (일일 사용량 제한 적용) ====================

  /**
   * 실시간 질문 사용량 조회 API
   */
  @Get('live-query/usage/:hospitalId')
  @ApiOperation({
    summary: '실시간 질문 사용량 조회',
    description: '오늘 사용한 실시간 질문 횟수와 플랜별 제한을 조회합니다',
  })
  async getLiveQueryUsage(@Param('hospitalId') hospitalId: string) {
    const hospital = await this.prisma.hospital.findUnique({
      where: { id: hospitalId },
      select: { id: true, planType: true },
    });

    if (!hospital) {
      throw new NotFoundException('병원을 찾을 수 없습니다');
    }

    const limits = PlanGuard.PLAN_LIMITS[hospital.planType] || PlanGuard.PLAN_LIMITS.FREE;
    const maxDaily = (limits as any).maxDailyLiveQueries ?? 3;

    // 오늘 사용량 조회
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const todayEnd = new Date();
    todayEnd.setHours(23, 59, 59, 999);

    const todayCount = await this.prisma.liveQueryUsage.count({
      where: {
        hospitalId,
        usedAt: { gte: todayStart, lte: todayEnd },
      },
    });

    // 최근 질문 시간 (쿨다운 체크용)
    const lastQuery = await this.prisma.liveQueryUsage.findFirst({
      where: { hospitalId },
      orderBy: { usedAt: 'desc' },
      select: { queryText: true, usedAt: true },
    });

    const isUnlimited = maxDaily === -1;

    return {
      planType: hospital.planType,
      usage: {
        used: todayCount,
        limit: maxDaily,
        remaining: isUnlimited ? -1 : Math.max(0, maxDaily - todayCount),
        isUnlimited,
      },
      cooldown: {
        lastQueryAt: lastQuery?.usedAt || null,
        cooldownSeconds: 300, // 5분
      },
    };
  }

  @Post('live-query/:hospitalId')
  @ApiOperation({ 
    summary: '실시간 AI 질문 (사용량 제한 적용)',
    description: '사용자가 원하는 질문을 선택한 AI 플랫폼에 실시간으로 물어보고 결과를 즉시 반환합니다. 플랜별 일일 사용량 제한과 5분 쿨다운이 적용됩니다.' 
  })
  async liveQuery(
    @Param('hospitalId') hospitalId: string,
    @Body() body: { question: string; platforms?: string[] },
    @Req() req: any,
  ) {
    const hospital = await this.prisma.hospital.findUnique({
      where: { id: hospitalId },
      select: { id: true, name: true, planType: true },
    });

    if (!hospital) {
      throw new NotFoundException('병원을 찾을 수 없습니다');
    }

    const { question, platforms } = body;
    if (!question || question.trim().length === 0) {
      return { success: false, error: '질문을 입력해주세요' };
    }

    // ── 1. 플랜별 일일 사용량 제한 체크 ──
    const limits = PlanGuard.PLAN_LIMITS[hospital.planType] || PlanGuard.PLAN_LIMITS.FREE;
    const maxDaily = (limits as any).maxDailyLiveQueries ?? 3;

    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const todayEnd = new Date();
    todayEnd.setHours(23, 59, 59, 999);

    const todayCount = await this.prisma.liveQueryUsage.count({
      where: {
        hospitalId,
        usedAt: { gte: todayStart, lte: todayEnd },
      },
    });

    if (maxDaily !== -1 && todayCount >= maxDaily) {
      const planNames: Record<string, string> = {
        FREE: '무료',
        STARTER: 'Starter',
        STANDARD: 'Standard',
        PRO: 'Pro',
        ENTERPRISE: 'Enterprise',
      };
      return {
        success: false,
        error: 'DAILY_LIMIT_REACHED',
        message: `오늘의 실시간 질문 횟수(${maxDaily}회)를 모두 사용했습니다.`,
        usage: {
          used: todayCount,
          limit: maxDaily,
          remaining: 0,
          planType: hospital.planType,
          planName: planNames[hospital.planType] || hospital.planType,
        },
        upgradeHint: hospital.planType !== 'ENTERPRISE'
          ? `플랜을 업그레이드하면 더 많은 질문이 가능해요!`
          : null,
      };
    }

    // ── 2. 쿨다운 체크 (같은 질문 5분 이내 재질문 방지) ──
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
    const recentSameQuery = await this.prisma.liveQueryUsage.findFirst({
      where: {
        hospitalId,
        queryText: question.trim(),
        usedAt: { gte: fiveMinutesAgo },
      },
    });

    if (recentSameQuery) {
      const cooldownRemaining = Math.ceil(
        (recentSameQuery.usedAt.getTime() + 5 * 60 * 1000 - Date.now()) / 1000,
      );
      return {
        success: false,
        error: 'COOLDOWN_ACTIVE',
        message: `같은 질문은 5분 후에 다시 할 수 있어요. (${Math.ceil(cooldownRemaining / 60)}분 ${cooldownRemaining % 60}초 남음)`,
        cooldownRemaining,
        usage: {
          used: todayCount,
          limit: maxDaily,
          remaining: maxDaily === -1 ? -1 : Math.max(0, maxDaily - todayCount),
        },
      };
    }

    // 플랫폼 선택 (기본: 전체)
    const selectedPlatforms = (platforms && platforms.length > 0) 
      ? platforms.filter((p: string) => ['CHATGPT', 'CLAUDE', 'PERPLEXITY', 'GEMINI'].includes(p))
      : ['CHATGPT', 'CLAUDE', 'PERPLEXITY', 'GEMINI'];

    this.logger.log(`[LiveQuery] 질문: "${question.substring(0, 50)}", 플랫폼: ${selectedPlatforms.join(', ')}, 사용량: ${todayCount + 1}/${maxDaily === -1 ? '∞' : maxDaily}`);

    // ── 3. 질문 카테고리 자동 분류 ──
    const { category, categoryTag } = this.classifyQueryCategory(question.trim());
    this.logger.log(`[LiveQuery] 카테고리: ${category} / 태그: ${categoryTag}`);

    // ── 4. 각 플랫폼에 병렬로 질의 ──
    const results = await Promise.allSettled(
      selectedPlatforms.map(async (platform: string) => {
        try {
          const result = await this.aiCrawlerService.queryPlatformPublic(
            platform as any,
            question.trim(),
            hospital.name,
          );
          return {
            platform,
            platformName: platformNames[platform] || platform,
            success: true,
            isMentioned: result.isMentioned,
            mentionPosition: result.mentionPosition,
            totalRecommendations: result.totalRecommendations,
            response: result.response,
            competitorsMentioned: result.competitorsMentioned,
            citedSources: result.citedSources,
            sentimentLabel: result.sentimentLabel || 'NEUTRAL',
            sourceHints: result.sourceHints || null,
          };
        } catch (error) {
          return {
            platform,
            platformName: platformNames[platform] || platform,
            success: false,
            error: error.message,
          };
        }
      }),
    );

    const responses = results.map(r => 
      r.status === 'fulfilled' ? r.value : { 
        platform: 'UNKNOWN', 
        platformName: 'Unknown', 
        success: false, 
        error: 'Request failed' 
      }
    );

    // 요약 통계
    const successCount = responses.filter(r => r.success).length;
    const mentionedCount = responses.filter(r => r.success && r.isMentioned).length;
    const mentionRate = successCount > 0 ? Math.round((mentionedCount / successCount) * 100) : 0;
    const newUsed = todayCount + 1;

    // ── 5. 사용량 + 결과 기록 (질의 후 결과까지 포함) ──
    await this.prisma.liveQueryUsage.create({
      data: {
        hospitalId,
        queryText: question.trim(),
        platforms: selectedPlatforms,
        platformCount: selectedPlatforms.length,
        category,
        categoryTag,
        successCount,
        mentionedCount,
        mentionRate,
      },
    });

    return {
      question: question.trim(),
      hospitalName: hospital.name,
      timestamp: new Date().toISOString(),
      totalPlatforms: selectedPlatforms.length,
      successCount,
      mentionedCount,
      mentionRate,
      category,
      categoryTag,
      responses,
      // 사용량 정보 함께 반환
      usage: {
        used: newUsed,
        limit: maxDaily,
        remaining: maxDaily === -1 ? -1 : Math.max(0, maxDaily - newUsed),
        isUnlimited: maxDaily === -1,
      },
    };
  }

  /**
   * 질문 텍스트 → 카테고리 자동 분류
   */
  private classifyQueryCategory(queryText: string): { category: LiveQueryCategory; categoryTag: string } {
    const text = queryText.toLowerCase();

    // 시술/진료 카테고리 (PROCEDURE) — 구체적 시술명
    const procedureKeywords: Record<string, string[]> = {
      '임플란트': ['임플란트', '임플', 'implant'],
      '교정': ['교정', '치아교정', '투명교정', '인비절라인', '브라켓'],
      '라미네이트': ['라미네이트', '심미보철', '비니어'],
      '미백': ['미백', '화이트닝', 'whitening', '치아미백'],
      '충치치료': ['충치', '레진', '인레이', '온레이', '크라운'],
      '스케일링': ['스케일링', '치석', '잇몸치료', '치주'],
      '발치': ['발치', '사랑니', '매복치'],
      '틀니': ['틀니', '의치'],
      '보톡스': ['보톡스', '보톨리늄', '필러'],
      '신경치료': ['신경치료', '근관치료'],
      '소아치과': ['소아', '아이', '어린이', '유치'],
    };
    for (const [tag, keywords] of Object.entries(procedureKeywords)) {
      if (keywords.some(kw => text.includes(kw))) {
        return { category: LiveQueryCategory.PROCEDURE, categoryTag: tag };
      }
    }

    // 감성/경험 카테고리 (EMOTION) — 환자 감정 기반
    const emotionKeywords: Record<string, string[]> = {
      '친절': ['친절', '친절한', '친절하게', '상냥', '따뜻'],
      '무통': ['무통', '안아프', '아프지않', '통증없', '무서운데', '무서워', '겁나', '두려운', '공포'],
      '편안': ['편안', '안심', '쾌적', '좋은분위기', '편한'],
      '꼼꼼': ['꼼꼼', '세심', '정확', '실력좋', '잘하는'],
      '빠른': ['빠른', '당일', '즉시', '빠르게', '원데이'],
    };
    for (const [tag, keywords] of Object.entries(emotionKeywords)) {
      if (keywords.some(kw => text.includes(kw))) {
        return { category: LiveQueryCategory.EMOTION, categoryTag: tag };
      }
    }

    // 비용/가격 카테고리 (COST)
    const costKeywords = ['가격', '비용', '저렴', '싼', '가성비', '합리적', '저렴한', '할인', '이벤트', '얼마'];
    if (costKeywords.some(kw => text.includes(kw))) {
      return { category: LiveQueryCategory.COST, categoryTag: '가격' };
    }

    // 후기/평판 카테고리 (REVIEW)
    const reviewKeywords = ['후기', '리뷰', '평판', '유명', '평점', '별점', '만족', '추천', '소문'];
    if (reviewKeywords.some(kw => text.includes(kw))) {
      return { category: LiveQueryCategory.REVIEW, categoryTag: '후기' };
    }

    // 비교 카테고리 (COMPARISON)
    const comparisonKeywords = ['vs', '비교', '차이', '뭐가 좋', '뭐가 나', '어디가 더', '어떤게'];
    if (comparisonKeywords.some(kw => text.includes(kw))) {
      return { category: LiveQueryCategory.COMPARISON, categoryTag: '비교' };
    }

    // 지역 기반 카테고리 (REGION) — 지역명이 포함되면
    const regionKeywords = [
      '강남', '서초', '잠실', '송파', '홍대', '신촌', '명동', '종로', '강동', '마포',
      '영등포', '광화문', '을지로', '건대', '성수', '이태원', '여의도', '목동', '양천',
      '부산', '대구', '인천', '광주', '대전', '수원', '분당', '판교', '일산', '근처', '역 근처', '주변',
    ];
    if (regionKeywords.some(kw => text.includes(kw))) {
      const matched = regionKeywords.find(kw => text.includes(kw)) || '지역';
      return { category: LiveQueryCategory.REGION, categoryTag: matched };
    }

    // 기본: GENERAL
    return { category: LiveQueryCategory.GENERAL, categoryTag: '일반' };
  }

  /**
   * 카테고리별 성과 분석 API
   */
  @Get('live-query/category-stats/:hospitalId')
  @ApiOperation({
    summary: '실시간 질문 카테고리별 성과 분석',
    description: '시술/감성/비용/지역/후기/비교 카테고리별로 AI 언급 성과를 분석합니다',
  })
  async getLiveQueryCategoryStats(
    @Param('hospitalId') hospitalId: string,
    @Query('days') days?: string,
  ) {
    const hospital = await this.prisma.hospital.findUnique({
      where: { id: hospitalId },
      select: { id: true, name: true },
    });
    if (!hospital) throw new NotFoundException('병원을 찾을 수 없습니다');

    const daysNum = parseInt(days || '30', 10);
    const since = new Date();
    since.setDate(since.getDate() - daysNum);

    // 전체 질문 기록 조회
    const queries = await this.prisma.liveQueryUsage.findMany({
      where: {
        hospitalId,
        usedAt: { gte: since },
      },
      orderBy: { usedAt: 'desc' },
    });

    if (queries.length === 0) {
      return {
        hospitalName: hospital.name,
        period: `최근 ${daysNum}일`,
        totalQueries: 0,
        categories: [],
        topTags: [],
        recentQueries: [],
      };
    }

    // 카테고리별 집계
    const categoryMap = new Map<string, {
      category: string;
      totalQueries: number;
      totalMentioned: number;
      avgMentionRate: number;
      tags: Map<string, { count: number; mentioned: number; mentionRate: number }>;
    }>();

    const categoryDisplayNames: Record<string, string> = {
      PROCEDURE: '시술/진료',
      EMOTION: '감성/경험',
      COST: '비용/가격',
      REGION: '지역 기반',
      REVIEW: '후기/평판',
      COMPARISON: '비교',
      GENERAL: '기타',
    };

    for (const q of queries) {
      const cat = q.category || 'GENERAL';
      if (!categoryMap.has(cat)) {
        categoryMap.set(cat, {
          category: cat,
          totalQueries: 0,
          totalMentioned: 0,
          avgMentionRate: 0,
          tags: new Map(),
        });
      }
      const data = categoryMap.get(cat)!;
      data.totalQueries++;
      data.totalMentioned += q.mentionedCount;

      // 태그별 집계
      const tag = q.categoryTag || '기타';
      if (!data.tags.has(tag)) {
        data.tags.set(tag, { count: 0, mentioned: 0, mentionRate: 0 });
      }
      const tagData = data.tags.get(tag)!;
      tagData.count++;
      if (q.mentionRate > 0) tagData.mentioned++;
    }

    // 평균 언급률 계산
    const categories = Array.from(categoryMap.values()).map(cat => {
      const rates = queries
        .filter(q => (q.category || 'GENERAL') === cat.category)
        .map(q => q.mentionRate);
      cat.avgMentionRate = rates.length > 0 ? Math.round(rates.reduce((a, b) => a + b, 0) / rates.length) : 0;

      // 태그별 평균 언급률
      const tagsArr = Array.from(cat.tags.entries()).map(([tag, data]) => {
        const tagRates = queries
          .filter(q => (q.category || 'GENERAL') === cat.category && (q.categoryTag || '기타') === tag)
          .map(q => q.mentionRate);
        return {
          tag,
          queryCount: data.count,
          mentionedCount: data.mentioned,
          avgMentionRate: tagRates.length > 0 ? Math.round(tagRates.reduce((a, b) => a + b, 0) / tagRates.length) : 0,
        };
      }).sort((a, b) => b.queryCount - a.queryCount);

      return {
        category: cat.category,
        categoryName: categoryDisplayNames[cat.category] || cat.category,
        totalQueries: cat.totalQueries,
        totalMentioned: cat.totalMentioned,
        avgMentionRate: cat.avgMentionRate,
        tags: tagsArr,
      };
    }).sort((a, b) => b.totalQueries - a.totalQueries);

    // 전체 태그 랭킹 (상위 성과/하위 성과)
    const allTags = categories.flatMap(c =>
      c.tags.map(t => ({
        category: c.category,
        categoryName: c.categoryName,
        tag: t.tag,
        queryCount: t.queryCount,
        avgMentionRate: t.avgMentionRate,
      }))
    ).filter(t => t.queryCount >= 1);

    const topTags = [...allTags].sort((a, b) => b.avgMentionRate - a.avgMentionRate).slice(0, 5);
    const weakTags = [...allTags].sort((a, b) => a.avgMentionRate - b.avgMentionRate).slice(0, 5);

    // 최근 질문 10개 (히스토리)
    const recentQueries = queries.slice(0, 10).map(q => ({
      question: q.queryText,
      category: q.category,
      categoryName: categoryDisplayNames[q.category || 'GENERAL'] || q.category,
      categoryTag: q.categoryTag,
      mentionRate: q.mentionRate,
      mentionedCount: q.mentionedCount,
      successCount: q.successCount,
      platforms: q.platforms,
      usedAt: q.usedAt,
    }));

    // 전체 통계
    const totalMentionRate = queries.length > 0
      ? Math.round(queries.reduce((sum, q) => sum + q.mentionRate, 0) / queries.length)
      : 0;

    return {
      hospitalName: hospital.name,
      period: `최근 ${daysNum}일`,
      totalQueries: queries.length,
      totalMentionRate,
      categories,
      topTags,     // 우리 병원이 강한 분야
      weakTags,    // 개선이 필요한 분야
      recentQueries,
    };
  }

  @Post('score/:hospitalId')
  @ApiOperation({ summary: '일일 점수 계산 (개선: 다수결 기반)' })
  async calculateScore(@Param('hospitalId') hospitalId: string) {
    const score = await this.aiCrawlerService.calculateDailyScore(hospitalId);
    return { hospitalId, score, date: new Date().toISOString() };
  }

  // ==================== 개선3: 경쟁사 AEO 측정 ====================

  @Post('competitor-aeo/:hospitalId/:competitorId')
  @PlanLimit({ feature: 'competitorAEO' })
  @ApiOperation({ 
    summary: '【개선3】경쟁사 AEO 점수 측정',
    description: '동일한 프롬프트로 경쟁사의 AI 가시성을 실제 측정합니다' 
  })
  async measureCompetitorAEO(
    @Param('hospitalId') hospitalId: string,
    @Param('competitorId') competitorId: string,
  ) {
    const competitor = await this.prisma.competitor.findUnique({
      where: { id: competitorId },
    });

    if (!competitor) throw new NotFoundException('경쟁사를 찾을 수 없습니다');

    const result = await this.aiCrawlerService.measureCompetitorAEO(
      hospitalId,
      competitorId,
      competitor.competitorName,
    );

    return {
      competitorName: competitor.competitorName,
      ...result,
    };
  }

  @Post('competitor-aeo-all/:hospitalId')
  @PlanLimit({ feature: 'competitorAEO' })
  @ApiOperation({ 
    summary: '【개선3】모든 경쟁사 AEO 일괄 측정',
    description: '등록된 모든 활성 경쟁사의 AEO 점수를 측정합니다' 
  })
  async measureAllCompetitorAEO(@Param('hospitalId') hospitalId: string) {
    const competitors = await this.prisma.competitor.findMany({
      where: { hospitalId, isActive: true },
    });

    const results = [];
    for (const competitor of competitors) {
      try {
        const result = await this.aiCrawlerService.measureCompetitorAEO(
          hospitalId,
          competitor.id,
          competitor.competitorName,
        );
        results.push({
          competitorId: competitor.id,
          competitorName: competitor.competitorName,
          ...result,
        });
      } catch (error) {
        results.push({
          competitorId: competitor.id,
          competitorName: competitor.competitorName,
          error: error.message,
        });
      }
      
      // 경쟁사 간 딜레이
      await new Promise(resolve => setTimeout(resolve, 5000));
    }

    return {
      hospitalId,
      totalCompetitors: competitors.length,
      results,
      timestamp: new Date().toISOString(),
    };
  }

  // ==================== 개선4: 프롬프트별 성과 분석 ====================

  @Get('prompt-performance/:hospitalId')
  @ApiOperation({ 
    summary: '【개선4】프롬프트별 성과 분석',
    description: '각 프롬프트의 플랫폼별 언급률, 순위, 감성, 경쟁사 등 상세 분석' 
  })
  async getPromptPerformance(@Param('hospitalId') hospitalId: string) {
    return this.aiCrawlerService.getPromptPerformance(hospitalId);
  }

  // ==================== 개선5: Content Gap 분석 ====================

  @Post('content-gap/:hospitalId')
  @PlanLimit({ feature: 'contentGap' })
  @ApiOperation({ 
    summary: '【개선5】Content Gap 분석 + AI 개선 가이드',
    description: 'AI가 경쟁사 대비 부족한 콘텐츠를 분석하고 개선 전략을 제안합니다' 
  })
  async analyzeContentGap(@Param('hospitalId') hospitalId: string) {
    const gaps = await this.aiCrawlerService.generateContentGapGuide(hospitalId);
    return {
      hospitalId,
      totalGaps: gaps.length,
      gaps,
      timestamp: new Date().toISOString(),
    };
  }

  // ==================== 개선5-2: 블로그 초안 생성 (Claude 4 Sonnet) ====================

  @Post('content-gap/:hospitalId/blog-draft/:gapId')
  @PlanLimit({ feature: 'contentGap' })
  @ApiOperation({ 
    summary: '【개선5-2】콘텐츠 갭 → 블로그 초안 자동 생성',
    description: 'Claude 4 Sonnet을 사용하여 콘텐츠 갭을 해소할 치과 전문 블로그 글을 자동 생성합니다. PRO 플랜 전용.' 
  })
  async generateBlogDraft(
    @Param('hospitalId') hospitalId: string,
    @Param('gapId') gapId: string,
  ) {
    const draft = await this.aiCrawlerService.generateBlogDraft(hospitalId, gapId);
    return {
      hospitalId,
      gapId,
      draft,
      timestamp: new Date().toISOString(),
    };
  }

  // ==================== 개선10: 환각 검증 ====================

  @Get('verify-hospital/:hospitalName')
  @ApiOperation({ 
    summary: '【개선10】병원 실존 여부 검증',
    description: '패턴 기반으로 병원명의 실존 여부를 검증합니다' 
  })
  async verifyHospital(
    @Param('hospitalName') hospitalName: string,
    @Query('region') region?: string,
  ) {
    return this.aiCrawlerService.verifyHospitalExists(hospitalName, region);
  }

  // ==================== 크롤링 실행 로직 ====================

  private async executeCrawling(
    jobId: string,
    hospital: any,
    prompts: any[],
    allowedPlatforms?: string[],
  ) {
    let completed = 0;
    let failed = 0;
    const errors: string[] = [];
    
    // 플랜에 따라 허용된 플랫폼만 사용
    const platforms: any[] = allowedPlatforms || ['CHATGPT', 'PERPLEXITY'];
    this.logger.log(`[Crawl] 시작: ${hospital.name}, 프롬프트 ${prompts.length}개, 플랫폼: ${platforms.join(', ')}`);

    for (const prompt of prompts) {
      try {
        this.logger.log(`[Crawl] 프롬프트: ${prompt.promptText.substring(0, 30)}...`);
        const results = await this.aiCrawlerService.queryAllPlatforms(
          prompt.id,
          hospital.id,
          hospital.name,
          prompt.promptText,
          platforms,
        );
        this.logger.log(`[Crawl] 결과: ${results.length}개 응답`);
        
        if (results.length > 0) {
          completed++;
        } else {
          failed++;
          errors.push(`${prompt.promptText.substring(0, 20)}: 응답 없음`);
        }
      } catch (error) {
        failed++;
        errors.push(`${prompt.promptText.substring(0, 20)}: ${error.message}`);
        this.logger.error(`[Crawl] 에러: ${error.message}`);
      }

      await this.prisma.crawlJob.update({
        where: { id: jobId },
        data: { completed, failed },
      });
    }

    const errorMessage = errors.length > 0 ? errors.join('; ') : null;
    await this.prisma.crawlJob.update({
      where: { id: jobId },
      data: {
        status: failed === prompts.length ? 'FAILED' : 'COMPLETED',
        completedAt: new Date(),
        errorMessage,
      },
    });
    
    this.logger.log(`[Crawl] 완료: completed=${completed}, failed=${failed}`);

    if (completed > 0) {
      await this.aiCrawlerService.calculateDailyScore(hospital.id);
    }
  }
}
