import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';
import { AIPlatform, RecommendationDepth, QueryIntent } from '@prisma/client';
import { WeightService, FALLBACK_WEIGHTS } from './weight.service';

/**
 * ABHS (AI-Based Hospital Score) 초고도화 평가 프레임워크
 * 
 * 5개 측정축:
 * 1. Voice Share (SoV) - 언급 점유율
 * 2. Sentiment Score - AI 감성 분류 (-2 ~ +2)
 * 3. Recommendation Depth - 추천 깊이 (R0~R3)
 * 4. Platform Weight - 플랫폼 가중치
 * 5. Query Intent Match - 질문 의도 매칭
 * 
 * ABHS = Σ(SoV × Sentiment × RecommendationDepth × PlatformWeight × IntentMatch) → 0~100 정규화
 *
 * [Phase A 변경] 가중치는 더 이상 코드 상수가 아니라 WeightService를 통해 DB에서 동적 로딩됨.
 * 우선순위: HOSPITAL > SPECIALTY > GLOBAL > FALLBACK_WEIGHTS (코드 안전망)
 */

export interface ABHSResult {
  abhsScore: number;                    // 종합 ABHS 점수 (0~100)
  sovPercent: number;                   // Voice Share %
  avgSentimentV2: number;              // 평균 감성 점수
  platformContributions: Record<string, PlatformContribution>;
  intentScores: Record<string, number>; // 의도별 점수
  depthDistribution: Record<string, number>; // R0~R3 분포
  rawScore: number;                    // 정규화 전 원시 점수
  maxPossibleScore: number;            // 최대 가능 점수
  competitiveShare?: number;           // 경쟁사 대비 점유율
}

export interface PlatformContribution {
  weight: number;
  rawScore: number;
  contribution: number;       // 이 플랫폼의 ABHS 기여분
  sovPercent: number;
  avgSentiment: number;
  avgDepth: string;
  responseCount: number;
}

export interface ABHSResponseAnalysis {
  sentimentScoreV2: number;            // -2 ~ +2
  recommendationDepth: RecommendationDepth;
  queryIntent: QueryIntent;
  platformWeight: number;
  abhsContribution: number;
  citedUrl: string | null;
}

@Injectable()
export class ABHSService {
  private readonly logger = new Logger(ABHSService.name);

  constructor(
    private prisma: PrismaService,
    private weightService: WeightService,
  ) {}

  /**
   * 병원의 ABHS 종합 점수 계산
   *
   * 가중치 로딩 우선순위: HOSPITAL > SPECIALTY > GLOBAL > FALLBACK
   * - hospitalId로 HOSPITAL 스코프 먼저 시도
   * - 병원의 specialty가 있으면 SPECIALTY 스코프로 보충
   * - 그래도 없는 키는 GLOBAL/FALLBACK으로 보충
   */
  async calculateABHS(hospitalId: string, days: number = 30): Promise<ABHSResult> {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    // 가중치 번들 로딩 (병원/진료과 컨텍스트 포함)
    const hospital = await this.prisma.hospital.findUnique({
      where: { id: hospitalId },
      select: { specialtyType: true },
    });
    const weights = await this.weightService.getWeightBundle({
      hospitalId,
      specialtyCategory: hospital?.specialtyType,
    });

    // ABHS 데이터가 있는 응답들 조회 (select로 필요한 필드만)
    const responses = await this.prisma.aIResponse.findMany({
      where: {
        hospitalId,
        responseDate: { gte: startDate },
      },
      select: {
        id: true,
        aiPlatform: true,
        isMentioned: true,
        mentionPosition: true,
        totalRecommendations: true,
        sentimentScore: true,
        sentimentLabel: true,
        citedSources: true,
        competitorsMentioned: true,
        responseText: true,
        responseDate: true,
        sentimentScoreV2: true,
        recommendationDepth: true,
        queryIntent: true,
        platformWeight: true,
        abhsContribution: true,
        citedUrl: true,
        prompt: { select: { id: true, promptText: true, specialtyCategory: true } },
      },
    });

    if (responses.length === 0) {
      return this.emptyResult();
    }

    // 1. Voice Share (SoV) 계산
    const totalResponses = responses.length;
    const mentionedResponses = responses.filter(r => r.isMentioned);
    const sovPercent = (mentionedResponses.length / totalResponses) * 100;

    // 2. 플랫폼별 기여도 계산
    const platformContributions: Record<string, PlatformContribution> = {};
    const platforms = ['CHATGPT', 'PERPLEXITY', 'CLAUDE', 'GEMINI'] as const;

    let totalWeightedScore = 0;
    let totalMaxScore = 0;

    // 동적 max 값 계산 (현재 활성 가중치 기준)
    const maxDepthScore = Math.max(...Object.values(weights.depth), 0.0001);
    const maxIntentMult = Math.max(...Object.values(weights.intent), 0.0001);
    const maxSentimentFactor = Math.max(...Object.values(weights.sentiment), 1.5);

    for (const platform of platforms) {
      const platResponses = responses.filter(r => r.aiPlatform === platform);
      if (platResponses.length === 0) continue;

      const weight = weights.platform[platform] ?? FALLBACK_WEIGHTS.PLATFORM[platform] ?? 1.0;
      const platMentioned = platResponses.filter(r => r.isMentioned);
      const platSoV = platResponses.length > 0 ? platMentioned.length / platResponses.length : 0;

      // 각 응답의 ABHS 기여분 계산
      let platScore = 0;
      let platMaxScore = 0;
      let sentimentSum = 0;
      let depthSum = 0;
      let sentimentCount = 0;

      for (const resp of platResponses) {
        const sentV2 = (resp as any).sentimentScoreV2 ?? this.legacySentimentToV2(resp.sentimentScore, resp.sentimentLabel);
        const depth = (resp as any).recommendationDepth ?? this.inferRecommendationDepth(resp);
        const intent = (resp as any).queryIntent ?? 'INFORMATION';
        
        const sentimentFactor = this.sentimentToFactor(sentV2, weights.sentiment);
        const depthScore = weights.depth[depth] ?? FALLBACK_WEIGHTS.DEPTH[depth] ?? 0;
        const intentMultiplier = weights.intent[intent] ?? FALLBACK_WEIGHTS.INTENT[intent] ?? 1.0;

        // 개별 응답 ABHS 기여분 = SoV점수 × Sentiment × Depth × PlatformWeight × IntentMatch
        const contribution = (resp.isMentioned ? 1.0 : 0.0) * sentimentFactor * depthScore * weight * intentMultiplier;
        
        // 최대 가능 점수 (동적: 현재 가중치 세트의 max 값 사용)
        const maxContribution = 1.0 * maxSentimentFactor * maxDepthScore * weight * maxIntentMult;

        platScore += contribution;
        platMaxScore += maxContribution;
        
        if (sentV2 !== null && sentV2 !== undefined) {
          sentimentSum += sentV2;
          sentimentCount++;
        }
        depthSum += depthScore;
      }

      totalWeightedScore += platScore;
      totalMaxScore += platMaxScore;

      const avgSentiment = sentimentCount > 0 ? sentimentSum / sentimentCount : 0;
      const avgDepthScore = platResponses.length > 0 ? depthSum / platResponses.length : 0;
      const avgDepth = avgDepthScore >= 3.5 ? 'R3' : avgDepthScore >= 2.5 ? 'R2' : avgDepthScore >= 1.0 ? 'R1' : 'R0';

      platformContributions[platform] = {
        weight,
        rawScore: platScore,
        contribution: platMaxScore > 0 ? (platScore / platMaxScore) * 100 : 0,
        sovPercent: platSoV * 100,
        avgSentiment,
        avgDepth,
        responseCount: platResponses.length,
      };
    }

    // 3. 의도별 점수 계산
    const intentScores: Record<string, number> = {};
    const intents = ['RESERVATION', 'COMPARISON', 'INFORMATION', 'REVIEW', 'FEAR'] as const;

    for (const intent of intents) {
      const intentResponses = responses.filter(r => (r as any).queryIntent === intent);
      if (intentResponses.length === 0) {
        intentScores[intent] = 0;
        continue;
      }
      const intentMentioned = intentResponses.filter(r => r.isMentioned);
      const intentSoV = intentMentioned.length / intentResponses.length;
      
      // 의도별 평균 감성
      const intentSentiments = intentResponses
        .filter(r => (r as any).sentimentScoreV2 != null)
        .map(r => (r as any).sentimentScoreV2);
      const avgSent = intentSentiments.length > 0 
        ? intentSentiments.reduce((a: number, b: number) => a + b, 0) / intentSentiments.length 
        : 0;
      
      intentScores[intent] = Math.round(intentSoV * 100 * this.sentimentToFactor(avgSent, weights.sentiment));
    }

    // 4. Depth 분포 계산
    const depthDistribution: Record<string, number> = { R0: 0, R1: 0, R2: 0, R3: 0 };
    for (const resp of mentionedResponses) {
      const depth = (resp as any).recommendationDepth ?? this.inferRecommendationDepth(resp);
      depthDistribution[depth] = (depthDistribution[depth] || 0) + 1;
    }

    // 5. 평균 감성 V2
    const sentimentV2Values = responses
      .filter(r => (r as any).sentimentScoreV2 != null)
      .map(r => (r as any).sentimentScoreV2);
    const avgSentimentV2 = sentimentV2Values.length > 0
      ? sentimentV2Values.reduce((a: number, b: number) => a + b, 0) / sentimentV2Values.length
      : 0;

    // 6. ABHS 종합 점수 정규화 (0~100)
    const abhsScore = totalMaxScore > 0 
      ? Math.max(0, Math.min(100, Math.round((totalWeightedScore / totalMaxScore) * 100)))
      : 0;

    return {
      abhsScore,
      sovPercent: Math.round(sovPercent * 10) / 10,
      avgSentimentV2: Math.round(avgSentimentV2 * 100) / 100,
      platformContributions,
      intentScores,
      depthDistribution,
      rawScore: Math.round(totalWeightedScore * 100) / 100,
      maxPossibleScore: Math.round(totalMaxScore * 100) / 100,
    };
  }

  /**
   * 경쟁사 대비 Weighted Competitive Share 계산
   */
  async calculateCompetitiveShare(hospitalId: string): Promise<{
    myABHS: number;
    competitorShares: Array<{
      name: string;
      abhsEstimate: number;
      sharePercent: number;
    }>;
    mySharePercent: number;
  }> {
    const myABHS = await this.calculateABHS(hospitalId);

    // 등록된 경쟁사 조회
    const competitors = await this.prisma.competitor.findMany({
      where: { hospitalId, isActive: true },
      include: {
        competitorScores: {
          orderBy: { scoreDate: 'desc' },
          take: 1,
        },
      },
    });

    const allScores: Array<{ name: string; score: number }> = [
      { name: 'MY_HOSPITAL', score: myABHS.abhsScore },
    ];

    const competitorShares = competitors.map(c => {
      const latestScore = c.competitorScores[0]?.overallScore ?? 0;
      allScores.push({ name: c.competitorName, score: latestScore });
      return {
        name: c.competitorName,
        abhsEstimate: latestScore,
        sharePercent: 0,
      };
    });

    const totalScore = allScores.reduce((sum, s) => sum + s.score, 0);

    if (totalScore > 0) {
      for (const cs of competitorShares) {
        cs.sharePercent = Math.round((cs.abhsEstimate / totalScore) * 10000) / 100;
      }
    }

    const mySharePercent = totalScore > 0 
      ? Math.round((myABHS.abhsScore / totalScore) * 10000) / 100
      : 0;

    return {
      myABHS: myABHS.abhsScore,
      competitorShares,
      mySharePercent,
    };
  }

  /**
   * 단일 AI 응답에 대한 ABHS 분석 수행
   * (크롤링 후 각 응답에 대해 호출)
   *
   * [Phase A] 가중치를 DB에서 동적 로딩. hospitalId가 주어지면 병원별 가중치 우선 적용.
   */
  async analyzeResponseForABHS(
    response: {
      isMentioned: boolean;
      mentionPosition: number | null;
      totalRecommendations: number | null;
      sentimentScore: number | null;
      sentimentLabel: string | null;
      citedSources: string[];
    },
    platform: AIPlatform,
    promptText: string,
    context?: { hospitalId?: string; specialtyCategory?: string },
  ): Promise<ABHSResponseAnalysis> {
    // 0. 가중치 번들 로딩 (DB → 캐시 → fallback)
    const weights = await this.weightService.getWeightBundle(context || {});

    // 1. 추천 깊이 추론
    const recommendationDepth = this.inferRecommendationDepthFromData(
      response.isMentioned,
      response.mentionPosition,
      response.totalRecommendations,
      response.sentimentLabel,
    );

    // 2. 질문 의도 분류
    const queryIntent = this.classifyQueryIntent(promptText);

    // 3. 플랫폼 가중치 (DB 우선)
    const platformWeight = weights.platform[platform] ?? FALLBACK_WEIGHTS.PLATFORM[platform] ?? 1.0;

    // 4. 감성 V2 (기존 sentimentScore를 V2로 변환)
    const sentimentScoreV2 = this.legacySentimentToV2(
      response.sentimentScore,
      response.sentimentLabel as any,
    );

    // 5. ABHS 기여분 계산 (DB 가중치 사용)
    const sentimentFactor = this.sentimentToFactor(sentimentScoreV2, weights.sentiment);
    const depthScore = weights.depth[recommendationDepth] ?? FALLBACK_WEIGHTS.DEPTH[recommendationDepth] ?? 0;
    const intentMultiplier = weights.intent[queryIntent] ?? FALLBACK_WEIGHTS.INTENT[queryIntent] ?? 1.0;
    const abhsContribution = (response.isMentioned ? 1.0 : 0.0) * sentimentFactor * depthScore * platformWeight * intentMultiplier;

    // 6. 대표 인용 URL
    const citedUrl = response.citedSources?.[0] || null;

    return {
      sentimentScoreV2,
      recommendationDepth: recommendationDepth as RecommendationDepth,
      queryIntent: queryIntent as QueryIntent,
      platformWeight,
      abhsContribution,
      citedUrl,
    };
  }

  /**
   * 자동 액션 인텔리전스 생성
   */
  async generateActionIntelligence(hospitalId: string): Promise<Array<{
    type: string;
    severity: 'critical' | 'warning' | 'info';
    platform: string;
    intent: string;
    message: string;
    suggestedAction: string;
  }>> {
    const last7Days = new Date();
    last7Days.setDate(last7Days.getDate() - 7);

    const recentResponses = await this.prisma.aIResponse.findMany({
      where: {
        hospitalId,
        responseDate: { gte: last7Days },
      },
      select: {
        id: true,
        aiPlatform: true,
        isMentioned: true,
        sentimentScore: true,
        sentimentLabel: true,
        sentimentScoreV2: true,
        queryIntent: true,
        prompt: { select: { promptText: true } },
      },
    });

    const actions: Array<{
      type: string;
      severity: 'critical' | 'warning' | 'info';
      platform: string;
      intent: string;
      message: string;
      suggestedAction: string;
    }> = [];

    // 1. 부정적 언급 감지
    const negativeResponses = recentResponses.filter(r => {
      const sentV2 = (r as any).sentimentScoreV2;
      return sentV2 != null ? sentV2 <= -1 : r.sentimentLabel === 'NEGATIVE';
    });

    for (const neg of negativeResponses) {
      const platformName = neg.aiPlatform;
      const intent = (neg as any).queryIntent || 'INFORMATION';
      actions.push({
        type: 'NEGATIVE_MENTION',
        severity: ((neg as any).sentimentScoreV2 ?? -1) <= -2 ? 'critical' : 'warning',
        platform: platformName,
        intent,
        message: `${platformName}에서 부정적 언급 발견: "${neg.prompt?.promptText?.substring(0, 40) || ''}..."`,
        suggestedAction: intent === 'REVIEW' 
          ? '해당 리뷰 관련 키워드로 긍정 콘텐츠 제작을 권장합니다.'
          : '해당 질문 유형에 대한 블로그/콘텐츠 마케팅을 강화하세요.',
      });
    }

    // 2. 특정 플랫폼에서 SoV 급락 감지
    const platforms = ['CHATGPT', 'PERPLEXITY', 'CLAUDE', 'GEMINI'] as const;
    for (const platform of platforms) {
      const platResponses = recentResponses.filter(r => r.aiPlatform === platform);
      if (platResponses.length < 3) continue;
      
      const mentionRate = platResponses.filter(r => r.isMentioned).length / platResponses.length;
      if (mentionRate < 0.2) {
        actions.push({
          type: 'LOW_SOV',
          severity: mentionRate === 0 ? 'critical' : 'warning',
          platform,
          intent: 'ALL',
          message: `${platform} 플랫폼에서 Voice Share가 매우 낮습니다 (${Math.round(mentionRate * 100)}%)`,
          suggestedAction: `${platform} 검색에 최적화된 콘텐츠 전략을 수립하세요. 특히 해당 플랫폼이 선호하는 데이터 소스를 확인하세요.`,
        });
      }
    }

    // 3. 예약 의도 질문에서 미언급 감지
    const reservationResponses = recentResponses.filter(r => (r as any).queryIntent === 'RESERVATION');
    if (reservationResponses.length > 0) {
      const reservationMissed = reservationResponses.filter(r => !r.isMentioned);
      if (reservationMissed.length > reservationResponses.length * 0.5) {
        actions.push({
          type: 'MISSED_RESERVATION_INTENT',
          severity: 'critical',
          platform: 'ALL',
          intent: 'RESERVATION',
          message: `예약 의도 질문에서 ${Math.round((reservationMissed.length / reservationResponses.length) * 100)}% 미언급`,
          suggestedAction: '네이버 플레이스, 구글 마이비즈니스 정보를 최신 상태로 유지하고, 예약 관련 키워드 콘텐츠를 강화하세요.',
        });
      }
    }

    return actions.sort((a, b) => {
      const severityOrder = { critical: 0, warning: 1, info: 2 };
      return severityOrder[a.severity] - severityOrder[b.severity];
    });
  }

  // ==================== Helper Methods ====================

  /**
   * 기존 sentimentScore(-1~1) + label을 V2(-2~+2)로 변환
   */
  private legacySentimentToV2(score: number | null, label: string | null): number {
    if (score == null && label == null) return 0;
    
    if (score != null) {
      // -1~1 → -2~+2 매핑
      if (score >= 0.7) return 2;
      if (score >= 0.2) return 1;
      if (score >= -0.2) return 0;
      if (score >= -0.7) return -1;
      return -2;
    }

    switch (label) {
      case 'POSITIVE': return 1;
      case 'NEUTRAL': return 0;
      case 'NEGATIVE': return -1;
      default: return 0;
    }
  }

  /**
   * 감성 점수를 ABHS 계산용 팩터로 변환
   * sentimentWeights가 주어지면 DB의 캘리브레이션된 값을 우선 사용,
   * 없으면 FALLBACK_WEIGHTS.SENTIMENT 사용.
   */
  private sentimentToFactor(sentV2: number, sentimentWeights?: Record<string, number>): number {
    const weights = sentimentWeights ?? FALLBACK_WEIGHTS.SENTIMENT;

    // 정수값이면 직접 lookup
    if (Number.isInteger(sentV2)) {
      const v = weights[String(sentV2)];
      if (v !== undefined) return v;
    }

    // 연속값인 경우 양 끝점 기준 선형 보간 (캘리브레이션된 -2와 +2 값 사용)
    const minFactor = weights['-2'] ?? 0;
    const maxFactor = weights['2'] ?? 1.5;
    if (sentV2 <= -2) return minFactor;
    if (sentV2 >= 2) return maxFactor;
    return Math.max(0, minFactor + ((sentV2 + 2) / 4) * (maxFactor - minFactor));
  }

  /**
   * 기존 응답 데이터에서 추천 깊이 추론
   */
  private inferRecommendationDepth(response: any): string {
    return this.inferRecommendationDepthFromData(
      response.isMentioned,
      response.mentionPosition,
      response.totalRecommendations,
      response.sentimentLabel,
    );
  }

  private inferRecommendationDepthFromData(
    isMentioned: boolean,
    mentionPosition: number | null,
    totalRecommendations: number | null,
    sentimentLabel: string | null,
  ): string {
    if (!isMentioned) {
      return sentimentLabel === 'NEGATIVE' ? 'R0' : 'R0';
    }

    // 단독 추천 (1위이고 전체 1개) → R3
    if (mentionPosition === 1 && (totalRecommendations === 1 || totalRecommendations == null)) {
      return 'R3';
    }

    // 복수 추천 중 상위 (1~2위) → R2
    if (mentionPosition != null && mentionPosition <= 2 && totalRecommendations != null && totalRecommendations > 1) {
      return 'R2';
    }

    // 단순 언급 → R1
    return 'R1';
  }

  /**
   * 질문 텍스트에서 의도 분류
   */
  private classifyQueryIntent(promptText: string): string {
    const text = promptText.toLowerCase();

    // 예약 의도
    const reservationKeywords = ['예약', '방문', '가고싶', '가려고', '어디가', '어디서', '추천해줘', '소개해줘', '갈만한', '가볼만한', '어떤 병원', '좋은 병원'];
    if (reservationKeywords.some(k => text.includes(k))) return 'RESERVATION';

    // 비교 의도
    const comparisonKeywords = ['비교', 'vs', '차이', '뭐가 나', '어디가 더', '가격 비교', '어떤 곳이 더', '비용 비교'];
    if (comparisonKeywords.some(k => text.includes(k))) return 'COMPARISON';

    // 후기/리뷰 의도
    const reviewKeywords = ['후기', '리뷰', '경험', '솔직', '실제', '만족', '불만', '다녀온'];
    if (reviewKeywords.some(k => text.includes(k))) return 'REVIEW';

    // 공포/걱정 의도
    const fearKeywords = ['아프', '무섭', '두려', '걱정', '부작용', '위험', '실패', '통증', '마취'];
    if (fearKeywords.some(k => text.includes(k))) return 'FEAR';

    // 정보 탐색 (기본)
    return 'INFORMATION';
  }

  private emptyResult(): ABHSResult {
    return {
      abhsScore: 0,
      sovPercent: 0,
      avgSentimentV2: 0,
      platformContributions: {},
      intentScores: {},
      depthDistribution: { R0: 0, R1: 0, R2: 0, R3: 0 },
      rawScore: 0,
      maxPossibleScore: 0,
    };
  }

  // ==================== V2: Golden Prompt 분석 ====================

  /**
   * Golden Prompt 분석 - ABHS 5축 기준으로 가장 성과 좋은 질문 패턴 식별
   * 
   * Golden Prompt = ABHS 기여분이 가장 높은 질문
   * - 높은 SoV (자주 언급됨)
   * - 높은 Sentiment (긍정적 추천)
   * - 높은 Depth (R3=단독추천 비율 높음)
   * - 예약 의도 매칭 (RESERVATION intent)
   * 
   * @returns 상위 10개 Golden Prompt + 각 축별 성과
   */
  async analyzeGoldenPrompts(hospitalId: string, days: number = 30): Promise<{
    goldenPrompts: Array<{
      promptText: string;
      goldenScore: number;
      sov: number;
      avgSentiment: number;
      r3Rate: number;
      topPlatform: string;
      totalResponses: number;
      mentionCount: number;
      intent: string;
    }>;
    insights: string[];
    overallPattern: string;
  }> {
    const dateFrom = new Date();
    dateFrom.setDate(dateFrom.getDate() - days);

    // Golden Score 계산용 가중치 로딩 (병원 컨텍스트 포함)
    const hospital = await this.prisma.hospital.findUnique({
      where: { id: hospitalId },
      select: { specialtyType: true },
    });
    const intentWeights = await this.weightService.getWeightsByKind('INTENT', {
      hospitalId,
      specialtyCategory: hospital?.specialtyType,
    });

    // 프롬프트별 응답 데이터 조회
    const prompts = await this.prisma.prompt.findMany({
      where: { hospitalId, isActive: true },
      include: {
        aiResponses: {
          where: { createdAt: { gte: dateFrom } },
          select: {
            isMentioned: true,
            sentimentScoreV2: true,
            recommendationDepth: true,
            queryIntent: true,
            aiPlatform: true,
            platformWeight: true,
            abhsContribution: true,
          },
        },
      },
    });

    const goldenPrompts = prompts
      .filter(p => p.aiResponses.length > 0)
      .map(p => {
        const responses = p.aiResponses;
        const total = responses.length;
        const mentioned = responses.filter(r => r.isMentioned);
        const mentionCount = mentioned.length;
        const sov = total > 0 ? (mentionCount / total) * 100 : 0;

        // 평균 감성
        const sentiments = mentioned.filter(r => r.sentimentScoreV2 !== null);
        const avgSentiment = sentiments.length > 0
          ? sentiments.reduce((sum, r) => sum + (r.sentimentScoreV2 || 0), 0) / sentiments.length
          : 0;

        // R3 비율
        const r3Count = mentioned.filter(r => r.recommendationDepth === 'R3').length;
        const r3Rate = mentionCount > 0 ? (r3Count / mentionCount) * 100 : 0;

        // 최고 성과 플랫폼
        const platformMentions: Record<string, number> = {};
        for (const r of mentioned) {
          platformMentions[r.aiPlatform] = (platformMentions[r.aiPlatform] || 0) + 1;
        }
        const topPlatform = Object.entries(platformMentions)
          .sort((a, b) => b[1] - a[1])[0]?.[0] || 'NONE';

        // Golden Score = SoV × (1 + avgSentiment/2) × (1 + r3Rate/100) × intentMultiplier (DB 가중치)
        const intent = responses[0]?.queryIntent || 'INFORMATION';
        const intentMult = intentWeights[intent] ?? FALLBACK_WEIGHTS.INTENT[intent] ?? 1.0;
        const goldenScore = sov * (1 + avgSentiment / 2) * (1 + r3Rate / 100) * intentMult;

        return {
          promptText: p.promptText,
          goldenScore: Math.round(goldenScore * 10) / 10,
          sov: Math.round(sov * 10) / 10,
          avgSentiment: Math.round(avgSentiment * 100) / 100,
          r3Rate: Math.round(r3Rate * 10) / 10,
          topPlatform,
          totalResponses: total,
          mentionCount,
          intent,
        };
      })
      .sort((a, b) => b.goldenScore - a.goldenScore)
      .slice(0, 10);

    // 인사이트 생성
    const insights: string[] = [];
    if (goldenPrompts.length > 0) {
      const top = goldenPrompts[0];
      insights.push(`🏆 최고 성과 질문: "${top.promptText.substring(0, 40)}..." (Golden Score: ${top.goldenScore})`);
      
      if (top.sov > 70) insights.push(`✅ Voice Share ${top.sov}%로 우수한 노출률`);
      if (top.r3Rate > 50) insights.push(`⭐ R3(단독추천) 비율 ${top.r3Rate}%로 AI가 적극 추천`);
      if (top.avgSentiment > 1) insights.push(`💚 매우 긍정적인 추천 톤 (${top.avgSentiment})`);

      // 패턴 분석
      const reservationPrompts = goldenPrompts.filter(p => p.intent === 'RESERVATION');
      if (reservationPrompts.length >= 3) {
        insights.push(`🎯 예약 의도 질문에서 특히 성과가 좋습니다 (${reservationPrompts.length}개/Top10)`);
      }
    }

    // 전체 패턴
    const avgSoV = goldenPrompts.length > 0
      ? goldenPrompts.reduce((s, p) => s + p.sov, 0) / goldenPrompts.length
      : 0;
    const overallPattern = avgSoV > 60
      ? '강한 AI 가시성 - Golden Prompt 패턴을 다른 질문에도 적용하세요'
      : avgSoV > 30
      ? '보통 AI 가시성 - 상위 질문 패턴을 분석하여 전체 질문 품질을 높이세요'
      : '약한 AI 가시성 - 블로그/웹사이트 콘텐츠 보강이 먼저 필요합니다';

    return { goldenPrompts, insights, overallPattern };
  }
}
