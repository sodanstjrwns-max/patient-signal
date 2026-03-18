import { Controller, Post, Get, Param, Body, UseGuards, Query, Req } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { AICrawlerService } from './ai-crawler.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { PrismaService } from '../common/prisma/prisma.service';
import { PlanGuard } from '../common/guards/plan.guard';
import { PlanLimit } from '../common/decorators/plan-limit.decorator';

@ApiTags('AI 크롤러')
@Controller('ai-crawler')
@UseGuards(JwtAuthGuard, PlanGuard)
@ApiBearerAuth()
export class AICrawlerController {
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
      throw new Error('병원을 찾을 수 없습니다');
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
    if (!job) throw new Error('작업을 찾을 수 없습니다');
    return job;
  }

  @Get('responses/:hospitalId')
  @ApiOperation({ summary: 'AI 응답 목록 조회 (반복 인덱스, 웹검색 여부 포함)' })
  async getResponses(
    @Param('hospitalId') hospitalId: string,
    @Query('platform') platform?: string,
    @Query('limit') limit?: string,
  ) {
    const responses = await this.prisma.aIResponse.findMany({
      where: {
        hospitalId,
        ...(platform && { aiPlatform: platform as any }),
      },
      orderBy: { createdAt: 'desc' },
      take: parseInt(limit || '100'),
      include: {
        prompt: true,
      },
    });

    return responses;
  }

  // ==================== Phase 1: 인사이트 분석 API ====================

  @Get('insights/mention-analysis/:hospitalId')
  @ApiOperation({ summary: 'AI 추천 멘트 원문 분석 - 추천 키워드, 문맥 분류, 차별화 포인트' })
  async getMentionAnalysis(
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
      include: { prompt: true },
      orderBy: { createdAt: 'desc' },
    });

    const hospital = await this.prisma.hospital.findUnique({ where: { id: hospitalId } });
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
          };
        }),
    };
  }

  @Get('insights/trend/:hospitalId')
  @ApiOperation({ summary: 'AI 응답 트렌드 추적 - 주간/월간 변화' })
  async getResponseTrend(
    @Param('hospitalId') hospitalId: string,
    @Query('days') days?: string,
  ) {
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

    if (!competitor) throw new Error('경쟁사를 찾을 수 없습니다');

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
    console.log(`[Crawl] 시작: ${hospital.name}, 프롬프트 ${prompts.length}개, 플랫폼: ${platforms.join(', ')}`);

    for (const prompt of prompts) {
      try {
        console.log(`[Crawl] 프롬프트: ${prompt.promptText.substring(0, 30)}...`);
        const results = await this.aiCrawlerService.queryAllPlatforms(
          prompt.id,
          hospital.id,
          hospital.name,
          prompt.promptText,
          platforms,
        );
        console.log(`[Crawl] 결과: ${results.length}개 응답`);
        
        if (results.length > 0) {
          completed++;
        } else {
          failed++;
          errors.push(`${prompt.promptText.substring(0, 20)}: 응답 없음`);
        }
      } catch (error) {
        failed++;
        errors.push(`${prompt.promptText.substring(0, 20)}: ${error.message}`);
        console.error(`[Crawl] 에러: ${error.message}`);
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
    
    console.log(`[Crawl] 완료: completed=${completed}, failed=${failed}`);

    if (completed > 0) {
      await this.aiCrawlerService.calculateDailyScore(hospital.id);
    }
  }
}
