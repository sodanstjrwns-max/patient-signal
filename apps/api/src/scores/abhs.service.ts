import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';
import { AIPlatform, RecommendationDepth, QueryIntent } from '@prisma/client';

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
 */

// 플랫폼별 가중치
const PLATFORM_WEIGHTS: Record<string, number> = {
  PERPLEXITY: 1.4,  // 소스 URL 품질
  CHATGPT: 1.3,     // 최대 사용자 기반
  GEMINI: 1.2,      // 구글 로컬 검색 연동
  CLAUDE: 1.0,      // 분석 중심
};

// 추천 깊이 점수
const DEPTH_SCORES: Record<string, number> = {
  R3: 4.0,  // 단독 추천
  R2: 3.0,  // 복수 추천 중 상위
  R1: 1.5,  // 단순 언급
  R0: 0.0,  // 부정적 / 미언급
};

// 질문 의도별 배율
const INTENT_MULTIPLIERS: Record<string, number> = {
  RESERVATION: 1.5,   // 예약 의도 (매출 직결)
  REVIEW: 1.3,         // 후기/리뷰 (신뢰도 핵심)
  FEAR: 1.2,           // 공포/걱정 (전환 기회)
  COMPARISON: 1.1,     // 비교 의도 (경쟁 분석)
  INFORMATION: 1.0,    // 정보 탐색 (기본값)
};

// 감성 점수 매핑 (V2: -2 ~ +2)
const SENTIMENT_V2_SCORES: Record<number, number> = {
  2: 2.0,   // 강한 긍정 (강력 추천)
  1: 1.0,   // 긍정
  0: 0.5,   // 중립 (0이 아닌 0.5로 설정 - 언급 자체에 가치 부여)
  [-1]: -1.0, // 부정
  [-2]: -2.0, // 강한 부정
};

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

  constructor(private prisma: PrismaService) {}

  /**
   * 병원의 ABHS 종합 점수 계산
   */
  async calculateABHS(hospitalId: string, days: number = 30): Promise<ABHSResult> {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    // ABHS 데이터가 있는 응답들 조회
    const responses = await this.prisma.aIResponse.findMany({
      where: {
        hospitalId,
        responseDate: { gte: startDate },
      },
      include: { prompt: true },
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

    for (const platform of platforms) {
      const platResponses = responses.filter(r => r.aiPlatform === platform);
      if (platResponses.length === 0) continue;

      const weight = PLATFORM_WEIGHTS[platform] || 1.0;
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
        
        const sentimentFactor = this.sentimentToFactor(sentV2);
        const depthScore = DEPTH_SCORES[depth] || 0;
        const intentMultiplier = INTENT_MULTIPLIERS[intent] || 1.0;

        // 개별 응답 ABHS 기여분 = SoV점수 × Sentiment × Depth × PlatformWeight × IntentMatch
        const contribution = (resp.isMentioned ? 1.0 : 0.0) * sentimentFactor * depthScore * weight * intentMultiplier;
        
        // 최대 가능 점수 (R3, sentiment +2, reservation intent)
        const maxContribution = 1.0 * 2.0 * 4.0 * weight * 1.5;

        platScore += contribution;
        platMaxScore += maxContribution;
        
        if (sentV2 !== null && sentV2 !== undefined) {
          sentimentSum += sentV2;
          sentimentCount++;
        }
        depthSum += DEPTH_SCORES[depth] || 0;
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
      
      intentScores[intent] = Math.round(intentSoV * 100 * this.sentimentToFactor(avgSent));
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
   */
  analyzeResponseForABHS(
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
  ): ABHSResponseAnalysis {
    // 1. 추천 깊이 추론
    const recommendationDepth = this.inferRecommendationDepthFromData(
      response.isMentioned,
      response.mentionPosition,
      response.totalRecommendations,
      response.sentimentLabel,
    );

    // 2. 질문 의도 분류
    const queryIntent = this.classifyQueryIntent(promptText);

    // 3. 플랫폼 가중치
    const platformWeight = PLATFORM_WEIGHTS[platform] || 1.0;

    // 4. 감성 V2 (기존 sentimentScore를 V2로 변환)
    const sentimentScoreV2 = this.legacySentimentToV2(
      response.sentimentScore,
      response.sentimentLabel as any,
    );

    // 5. ABHS 기여분 계산
    const sentimentFactor = this.sentimentToFactor(sentimentScoreV2);
    const depthScore = DEPTH_SCORES[recommendationDepth] || 0;
    const intentMultiplier = INTENT_MULTIPLIERS[queryIntent] || 1.0;
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
      include: { prompt: true },
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
   */
  private sentimentToFactor(sentV2: number): number {
    // -2 → 0, -1 → 0.25, 0 → 0.5, 1 → 1.0, 2 → 1.5
    switch (sentV2) {
      case -2: return 0;
      case -1: return 0.25;
      case 0: return 0.5;
      case 1: return 1.0;
      case 2: return 1.5;
      default: 
        // 연속값인 경우 선형 보간
        if (sentV2 < -2) return 0;
        if (sentV2 > 2) return 1.5;
        return Math.max(0, (sentV2 + 2) / 4 * 1.5);
    }
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
}
