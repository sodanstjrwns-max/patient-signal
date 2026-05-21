import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';

@Injectable()
export class ScoresService {
  constructor(private prisma: PrismaService) {}

  /**
   * 최신 점수 조회
   */
  async getLatestScore(hospitalId: string) {
    const score = await this.prisma.dailyScore.findFirst({
      where: { hospitalId },
      orderBy: { scoreDate: 'desc' },
    });

    if (!score) {
      return {
        overallScore: 0,
        specialtyScores: {},
        platformScores: {},
        mentionCount: 0,
        positiveRatio: 0,
      };
    }

    return score;
  }

  /**
   * 점수 히스토리 조회
   */
  async getScoreHistory(hospitalId: string, days: number = 30) {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const scores = await this.prisma.dailyScore.findMany({
      where: {
        hospitalId,
        scoreDate: { gte: startDate },
      },
      orderBy: { scoreDate: 'asc' },
    });

    return scores;
  }

  /**
   * 플랫폼별 분석 (상세) - 6대 AI 플랫폼
   */
  async getPlatformAnalysis(hospitalId: string) {
    const last30Days = new Date();
    last30Days.setDate(last30Days.getDate() - 30);
    
    const last7Days = new Date();
    last7Days.setDate(last7Days.getDate() - 7);

    const prev7Start = new Date(last7Days);
    prev7Start.setDate(prev7Start.getDate() - 7);

    // 【최적화 R2】DB에서 기간별로 분리 조회 (JS 필터링 → DB where절)
    const selectFields = {
      aiPlatform: true, isMentioned: true, mentionPosition: true,
      totalRecommendations: true, sentimentLabel: true, sentimentScore: true,
      responseDate: true, repeatIndex: true, isWebSearch: true, isVerified: true,
    } as const;

    const [allResponses, last7DaysResponses, prev7DaysResponses] = await Promise.all([
      this.prisma.aIResponse.findMany({
        where: { hospitalId, responseDate: { gte: last30Days } },
        select: selectFields,
      }),
      this.prisma.aIResponse.findMany({
        where: { hospitalId, responseDate: { gte: last7Days } },
        select: { aiPlatform: true, isMentioned: true },
      }),
      this.prisma.aIResponse.findMany({
        where: { hospitalId, responseDate: { gte: prev7Start, lt: last7Days } },
        select: { aiPlatform: true, isMentioned: true },
      }),
    ]);

    // 6대 AI 플랫폼 (Grok, CLOVA X 포함)
    const platforms = ['CHATGPT', 'PERPLEXITY', 'CLAUDE', 'GEMINI', 'GROK', 'CLOVA_X'] as const;
    const platformNames: Record<string, string> = {
      CHATGPT: 'ChatGPT',
      PERPLEXITY: 'Perplexity',
      CLAUDE: 'Claude',
      GEMINI: 'Gemini',
      GROK: 'Grok',
      CLOVA_X: 'CLOVA X',
    };

    // 항상 6개 플랫폼 모두 반환 (데이터 없으면 0으로 표시)
    return platforms.map(platform => {
      const platformResponses = allResponses.filter(r => r.aiPlatform === platform);
      const recentResponses = last7DaysResponses.filter(r => r.aiPlatform === platform);
      const prevResponses = prev7DaysResponses.filter(r => r.aiPlatform === platform);
      
      const totalQueries = platformResponses.length;
      const mentionedCount = platformResponses.filter(r => r.isMentioned).length;
      const positiveCount = platformResponses.filter(r => r.sentimentLabel === 'POSITIVE').length;
      const neutralCount = platformResponses.filter(r => r.sentimentLabel === 'NEUTRAL').length;
      const negativeCount = platformResponses.filter(r => r.sentimentLabel === 'NEGATIVE').length;
      
      // 【개선8】웹 검색 비율
      const webSearchCount = platformResponses.filter(r => r.isWebSearch).length;
      
      // 【개선10】검증 비율
      const verifiedCount = platformResponses.filter(r => r.isVerified).length;
      
      // 순위 통계
      const positionedResponses = platformResponses.filter(r => r.mentionPosition !== null);
      const avgPosition = positionedResponses.length > 0
        ? positionedResponses.reduce((sum, r) => sum + (r.mentionPosition || 0), 0) / positionedResponses.length
        : null;
      const top3Count = positionedResponses.filter(r => r.mentionPosition && r.mentionPosition <= 3).length;
      
      // 가시성 점수 계산
      const mentionRate = totalQueries > 0 ? mentionedCount / totalQueries : 0;
      const positionScore = positionedResponses.length > 0 
        ? positionedResponses.reduce((sum, r) => {
            const pos = r.mentionPosition || 10;
            if (pos === 1) return sum + 100;
            if (pos === 2) return sum + 80;
            if (pos === 3) return sum + 60;
            if (pos <= 5) return sum + 40;
            return sum + 20;
          }, 0) / positionedResponses.length
        : 0;
      const sentimentScore = totalQueries > 0 
        ? (positiveCount * 100 + neutralCount * 50) / totalQueries
        : 0;
      
      // 【고도화 #2】플랫폼별 가시성 점수 리밸런싱
      // 인용은 Perplexity만 유리하므로 감성 비중을 올리고 인용 제거
      const visibilityScore = Math.round(
        mentionRate * 100 * 0.45 +   // 언급률 45% (핵심 지표)
        positionScore * 0.30 +       // 포지션 30%
        sentimentScore * 0.25        // 감성 25% (인용 제거 후 재분배)
      );

      // 트렌드 계산
      const recentMentionRate = recentResponses.length > 0 
        ? recentResponses.filter(r => r.isMentioned).length / recentResponses.length
        : 0;
      const prevMentionRate = prevResponses.length > 0 
        ? prevResponses.filter(r => r.isMentioned).length / prevResponses.length
        : 0;
      const trend = recentMentionRate - prevMentionRate;
      
      // 【개선1】반복 측정 일관성 분석
      const repeatAnalysis = this.analyzeRepeatConsistency(platformResponses);
      
      return {
        platform,
        platformName: platformNames[platform] || platform,
        visibilityScore,
        totalQueries,
        mentionedCount,
        mentionRate: totalQueries > 0 ? Math.round(mentionRate * 100) : 0,
        sentiment: {
          positive: positiveCount,
          neutral: neutralCount,
          negative: negativeCount,
          positiveRate: totalQueries > 0 ? Math.round((positiveCount / totalQueries) * 100) : 0,
        },
        ranking: {
          avgPosition: avgPosition ? Math.round(avgPosition * 10) / 10 : null,
          top3Count,
          top3Rate: positionedResponses.length > 0 
            ? Math.round((top3Count / positionedResponses.length) * 100) 
            : 0,
        },
        trend: {
          direction: trend > 0.05 ? 'UP' : trend < -0.05 ? 'DOWN' : 'STABLE',
          change: Math.round(trend * 100),
        },
        // 【신규】추가 메트릭
        webSearchRate: totalQueries > 0 ? Math.round((webSearchCount / totalQueries) * 100) : 0,
        verificationRate: totalQueries > 0 ? Math.round((verifiedCount / totalQueries) * 100) : 0,
        repeatConsistency: repeatAnalysis,
        hasData: totalQueries > 0,  // 데이터 유무 표시
      };
    }); // 항상 6개 플랫폼 모두 반환 (데이터 없으면 visibilityScore=0)
  }

  /**
   * 【개선1】반복 측정 일관성 분석
   */
  private analyzeRepeatConsistency(responses: any[]): {
    averageConsistency: number;
    totalMeasurements: number;
  } {
    // repeatIndex가 있는 응답들을 그룹핑
    const groups = new Map<string, boolean[]>();
    
    for (const r of responses) {
      const dateKey = new Date(r.responseDate).toISOString().split('T')[0];
      const key = `${dateKey}`;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(r.isMentioned);
    }
    
    let totalConsistency = 0;
    let groupCount = 0;
    
    for (const [, mentions] of groups) {
      if (mentions.length >= 2) {
        const allSame = mentions.every(v => v === mentions[0]);
        totalConsistency += allSame ? 100 : 
          (Math.max(
            mentions.filter(Boolean).length,
            mentions.filter(v => !v).length
          ) / mentions.length) * 100;
        groupCount++;
      }
    }
    
    return {
      averageConsistency: groupCount > 0 ? Math.round(totalConsistency / groupCount) : 0,
      totalMeasurements: responses.length,
    };
  }

  /**
   * 진료과목별 분석
   */
  async getSpecialtyAnalysis(hospitalId: string) {
    const last30Days = new Date();
    last30Days.setDate(last30Days.getDate() - 30);

    // 【최적화 R3】include 전체 → select 최소화 (responseText 제외)
    const prompts = await this.prisma.prompt.findMany({
      where: { hospitalId },
      include: {
        aiResponses: {
          where: { responseDate: { gte: last30Days } },
          select: { isMentioned: true, sentimentLabel: true },
        },
      },
    });

    const categoryStats: Record<string, { total: number; mentioned: number; positive: number }> = {};

    for (const prompt of prompts) {
      const category = prompt.specialtyCategory || '기타';
      if (!categoryStats[category]) {
        categoryStats[category] = { total: 0, mentioned: 0, positive: 0 };
      }

      for (const response of prompt.aiResponses) {
        categoryStats[category].total++;
        if (response.isMentioned) categoryStats[category].mentioned++;
        if (response.sentimentLabel === 'POSITIVE') categoryStats[category].positive++;
      }
    }

    return Object.entries(categoryStats).map(([category, stats]) => ({
      category,
      totalQueries: stats.total,
      mentionRate: stats.total > 0 ? Math.round((stats.mentioned / stats.total) * 100) : 0,
      positiveRate: stats.total > 0 ? Math.round((stats.positive / stats.total) * 100) : 0,
      score: stats.total > 0 
        ? Math.round(((stats.mentioned / stats.total) * 0.6 + (stats.positive / stats.total) * 0.4) * 100)
        : 0,
    }));
  }

  /**
   * 주간 하이라이트 - 【개선5】Content Gap 포함
   */
  async getWeeklyHighlights(hospitalId: string) {
    const lastWeek = new Date();
    lastWeek.setDate(lastWeek.getDate() - 7);

    const twoWeeksAgo = new Date();
    twoWeeksAgo.setDate(twoWeeksAgo.getDate() - 14);

    // 【최적화 R3】4개 독립 쿼리를 Promise.all로 병렬화
    const [thisWeekScore, lastWeekScore, newMentions, competitorMentions] = await Promise.all([
      this.prisma.dailyScore.findFirst({
        where: { hospitalId, scoreDate: { gte: lastWeek } },
        orderBy: { scoreDate: 'desc' },
      }),
      this.prisma.dailyScore.findFirst({
        where: { hospitalId, scoreDate: { gte: twoWeeksAgo, lt: lastWeek } },
        orderBy: { scoreDate: 'desc' },
      }),
      this.prisma.aIResponse.count({
        where: { hospitalId, isMentioned: true, responseDate: { gte: lastWeek } },
      }),
      this.prisma.aIResponse.findMany({
        where: { hospitalId, responseDate: { gte: lastWeek }, competitorsMentioned: { isEmpty: false } },
        select: { competitorsMentioned: true },
      }),
    ]);

    const competitorCounts: Record<string, number> = {};
    for (const r of competitorMentions) {
      for (const c of r.competitorsMentioned) {
        competitorCounts[c] = (competitorCounts[c] || 0) + 1;
      }
    }

    const topCompetitors = Object.entries(competitorCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5);

    const scoreChange = (thisWeekScore?.overallScore ?? 0) - (lastWeekScore?.overallScore ?? 0);

    // 【개선5】Content Gap 요약
    const recentGaps = await this.prisma.contentGap.findMany({
      where: {
        hospitalId,
        createdAt: { gte: lastWeek },
      },
      orderBy: { priorityScore: 'desc' },
      take: 5,
    });

    return {
      currentScore: thisWeekScore?.overallScore ?? 0,
      scoreChange,
      scoreTrend: scoreChange > 0 ? 'UP' : scoreChange < 0 ? 'DOWN' : 'STABLE',
      newMentions,
      topCompetitors: topCompetitors.map(([name, count]) => ({ name, count })),
      contentGaps: recentGaps.map(gap => ({
        topic: gap.topic,
        priority: gap.priorityScore,
        competitors: (gap as any).competitorNames || [],
        hasAiGuide: !!(gap as any).aiGeneratedGuide,
      })),
      insights: this.generateInsights({
        scoreChange,
        newMentions,
        currentScore: thisWeekScore?.overallScore ?? 0,
        contentGapCount: recentGaps.length,
      }),
    };
  }

  /**
   * 인사이트 생성 - 【개선5】Content Gap 인사이트 추가
   */
  private generateInsights(data: { 
    scoreChange: number; 
    newMentions: number; 
    currentScore: number;
    contentGapCount?: number;
  }) {
    const insights: string[] = [];

    if (data.scoreChange > 5) {
      insights.push('🎉 이번 주 AI 가시성 점수가 크게 상승했습니다!');
    } else if (data.scoreChange < -5) {
      insights.push('⚠️ 이번 주 AI 가시성 점수가 하락했습니다. 콘텐츠 개선을 고려해보세요.');
    }

    if (data.currentScore >= 80) {
      insights.push('✨ 현재 AI 가시성이 매우 우수합니다!');
    } else if (data.currentScore < 40) {
      insights.push('📝 AI 가시성 개선이 필요합니다. Content Gap 분석을 확인해보세요.');
    }

    if (data.newMentions > 10) {
      insights.push(`📈 이번 주 ${data.newMentions}회 AI에서 언급되었습니다.`);
    }

    if (data.contentGapCount && data.contentGapCount > 0) {
      insights.push(`🔍 ${data.contentGapCount}개의 콘텐츠 갭이 발견되었습니다. AI 개선 가이드를 확인해보세요.`);
    }

    if (insights.length === 0) {
      insights.push('📊 안정적인 AI 가시성을 유지하고 있습니다.');
    }

    return insights;
  }

  /**
   * 인용 소스 분석
   */
  async getCitationAnalysis(hospitalId: string) {
    const last30Days = new Date();
    last30Days.setDate(last30Days.getDate() - 30);

    const responses = await this.prisma.aIResponse.findMany({
      where: {
        hospitalId,
        responseDate: { gte: last30Days },
        citedSources: { isEmpty: false },
      },
      select: { citedSources: true },
    });

    const domainCounts: Record<string, number> = {};
    for (const r of responses) {
      for (const url of r.citedSources) {
        try {
          const domain = new URL(url).hostname;
          domainCounts[domain] = (domainCounts[domain] || 0) + 1;
        } catch { /* invalid URL - skip */ }
      }
    }

    return Object.entries(domainCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 20)
      .map(([domain, count]) => ({ domain, count }));
  }

  /**
   * 【개선4】프롬프트별 성과 히트맵 데이터
   */
  async getPromptHeatmap(hospitalId: string) {
    const last30Days = new Date();
    last30Days.setDate(last30Days.getDate() - 30);

    const prompts = await this.prisma.prompt.findMany({
      where: { hospitalId, isActive: true },
      include: {
        aiResponses: {
          where: { responseDate: { gte: last30Days } },
          select: {
            aiPlatform: true,
            isMentioned: true,
            mentionPosition: true,
            sentimentLabel: true,
          },
        },
      },
    });

    const platforms = ['CHATGPT', 'CLAUDE', 'PERPLEXITY', 'GEMINI', 'GROK', 'CLOVA_X'];

    return prompts.map(prompt => {
      const heatmapRow: Record<string, any> = {
        promptId: prompt.id,
        promptText: prompt.promptText.substring(0, 50),
        category: prompt.specialtyCategory || '기타',
      };

      for (const platform of platforms) {
        const platResponses = prompt.aiResponses.filter(r => r.aiPlatform === platform);
        const mentioned = platResponses.filter(r => r.isMentioned).length;
        const total = platResponses.length;
        
        heatmapRow[platform.toLowerCase()] = {
          mentionRate: total > 0 ? Math.round((mentioned / total) * 100) : null,
          avgPosition: this.calcAvgPosition(platResponses),
          sentiment: this.calcDominantSentiment(platResponses),
          // 히트맵 색상 결정 (0=빨강, 50=노랑, 100=초록)
          colorScore: total > 0 ? Math.round((mentioned / total) * 100) : null,
        };
      }

      return heatmapRow;
    });
  }

  private calcAvgPosition(responses: any[]): number | null {
    const positioned = responses.filter(r => r.mentionPosition !== null);
    if (positioned.length === 0) return null;
    return Math.round(
      (positioned.reduce((sum, r) => sum + r.mentionPosition, 0) / positioned.length) * 10
    ) / 10;
  }

  private calcDominantSentiment(responses: any[]): string {
    const counts: Record<string, number> = { POSITIVE: 0, NEUTRAL: 0, NEGATIVE: 0 };
    for (const r of responses) {
      if (r.sentimentLabel && counts[r.sentimentLabel] !== undefined) counts[r.sentimentLabel]++;
    }
    const max = Math.max(counts.POSITIVE, counts.NEUTRAL, counts.NEGATIVE);
    if (max === 0) return 'NONE';
    if (counts.POSITIVE === max) return 'POSITIVE';
    if (counts.NEGATIVE === max) return 'NEGATIVE';
    return 'NEUTRAL';
  }

  // ==================== 전체 순위 / 상위 % / 등급 뱃지 ====================

  /**
   * 전체 병원 중 순위, 상위 %, 등급 뱃지 계산
   * - 최신 overallScore 기준으로 전체 병원 순위 매김
   * - 상위 %와 등급 뱃지(Diamond/Platinum/Gold/Silver/Bronze) 반환
   */
  async getRanking(hospitalId: string) {
    // 1. 모든 병원의 최신 점수를 가져오기 (각 병원별 가장 최근 DailyScore)
    const allHospitals = await this.prisma.hospital.findMany({
      where: { subscriptionStatus: 'ACTIVE' },
      select: {
        id: true,
        name: true,
        specialtyType: true,
        regionSido: true,
        regionSigungu: true,
        planType: true,
      },
    });

    if (allHospitals.length === 0) {
      return this.buildRankingResponse(hospitalId, null, 0, 0, []);
    }

    // 2. 각 병원의 최신 점수를 한 번에 가져오기
    //    서브쿼리로 각 병원별 최신 날짜를 찾고, 그 점수를 조회
    const latestScores = await this.prisma.$queryRaw<
      Array<{ hospital_id: string; overall_score: number; score_date: Date }>
    >`
      SELECT ds.hospital_id, ds.overall_score, ds.score_date
      FROM daily_scores ds
      INNER JOIN (
        SELECT hospital_id, MAX(score_date) as max_date
        FROM daily_scores
        GROUP BY hospital_id
      ) latest ON ds.hospital_id = latest.hospital_id AND ds.score_date = latest.max_date
      ORDER BY ds.overall_score DESC
    `;

    // 3. 병원 ID → 점수 매핑
    const scoreMap = new Map<string, number>();
    for (const row of latestScores) {
      scoreMap.set(row.hospital_id, row.overall_score);
    }

    // 4. 전체 병원 리스트에 점수를 붙여서 정렬 (점수 없는 병원은 0점 처리)
    const rankedList = allHospitals
      .map(h => ({
        hospitalId: h.id,
        name: h.name,
        score: scoreMap.get(h.id) ?? 0,
      }))
      .sort((a, b) => b.score - a.score);

    // 5. 순위 계산 (동점 처리: 같은 점수면 같은 순위)
    const rankings: Array<{ hospitalId: string; name: string; score: number; rank: number }> = [];
    let currentRank = 1;
    for (let i = 0; i < rankedList.length; i++) {
      if (i > 0 && rankedList[i].score < rankedList[i - 1].score) {
        currentRank = i + 1;
      }
      rankings.push({ ...rankedList[i], rank: currentRank });
    }

    // 6. 내 병원 찾기
    const myRanking = rankings.find(r => r.hospitalId === hospitalId);
    const totalHospitals = rankings.length;

    if (!myRanking) {
      return this.buildRankingResponse(hospitalId, null, 0, totalHospitals, rankings);
    }

    // 7. 이전 점수로 순위 변동 계산
    const previousScores = await this.prisma.$queryRaw<
      Array<{ hospital_id: string; overall_score: number }>
    >`
      SELECT ds.hospital_id, ds.overall_score
      FROM daily_scores ds
      INNER JOIN (
        SELECT hospital_id, MAX(score_date) as max_date
        FROM daily_scores
        WHERE score_date < (
          SELECT MAX(score_date) FROM daily_scores WHERE hospital_id = ${hospitalId}
        )
        GROUP BY hospital_id
      ) prev ON ds.hospital_id = prev.hospital_id AND ds.score_date = prev.max_date
      ORDER BY ds.overall_score DESC
    `;

    let previousRank: number | null = null;
    if (previousScores.length > 0) {
      const prevSorted = previousScores.sort((a, b) => b.overall_score - a.overall_score);
      let prevCurrentRank = 1;
      for (let i = 0; i < prevSorted.length; i++) {
        if (i > 0 && prevSorted[i].overall_score < prevSorted[i - 1].overall_score) {
          prevCurrentRank = i + 1;
        }
        if (prevSorted[i].hospital_id === hospitalId) {
          previousRank = prevCurrentRank;
          break;
        }
      }
    }

    return this.buildRankingResponse(hospitalId, myRanking, totalHospitals, totalHospitals, rankings, previousRank);
  }

  /**
   * 등급 뱃지 결정
   */
  private getBadge(topPercent: number): {
    tier: string;
    label: string;
    emoji: string;
    color: string;
    description: string;
  } {
    if (topPercent <= 1) {
      return { tier: 'DIAMOND', label: 'Diamond', emoji: '💎', color: '#B9F2FF', description: '상위 1% — AI 가시성의 정점' };
    }
    if (topPercent <= 5) {
      return { tier: 'PLATINUM', label: 'Platinum', emoji: '👑', color: '#E5E4E2', description: '상위 5% — 최상위 AI 가시성' };
    }
    if (topPercent <= 15) {
      return { tier: 'GOLD', label: 'Gold', emoji: '🥇', color: '#FFD700', description: '상위 15% — 우수한 AI 가시성' };
    }
    if (topPercent <= 30) {
      return { tier: 'SILVER', label: 'Silver', emoji: '🥈', color: '#C0C0C0', description: '상위 30% — 양호한 AI 가시성' };
    }
    if (topPercent <= 50) {
      return { tier: 'BRONZE', label: 'Bronze', emoji: '🥉', color: '#CD7F32', description: '상위 50% — 성장 가능성 높음' };
    }
    return { tier: 'STARTER', label: 'Starter', emoji: '🌱', color: '#90EE90', description: 'AI 가시성 개선 여정을 시작하세요' };
  }

  /**
   * 랭킹 응답 빌더
   */
  private buildRankingResponse(
    hospitalId: string,
    myRanking: { hospitalId: string; name: string; score: number; rank: number } | null,
    totalHospitals: number,
    _total: number,
    rankings: Array<{ hospitalId: string; name: string; score: number; rank: number }>,
    previousRank?: number | null,
  ) {
    const myRank = myRanking?.rank ?? null;
    const myScore = myRanking?.score ?? 0;
    const topPercent = myRank && totalHospitals > 0
      ? Math.max(1, Math.round((myRank / totalHospitals) * 100))
      : 100;

    const badge = this.getBadge(topPercent);

    // 순위 변동
    let rankChange: number | null = null;
    let rankTrend: 'UP' | 'DOWN' | 'STABLE' | 'NEW' = 'NEW';
    if (previousRank !== undefined && previousRank !== null && myRank !== null) {
      rankChange = previousRank - myRank; // 양수 = 순위 상승
      rankTrend = rankChange > 0 ? 'UP' : rankChange < 0 ? 'DOWN' : 'STABLE';
    }

    // 상위/하위 근접 병원 (익명화)
    const myIndex = rankings.findIndex(r => r.hospitalId === hospitalId);
    const neighbors: { above: { score: number; gap: number } | null; below: { score: number; gap: number } | null } = {
      above: null,
      below: null,
    };

    if (myIndex > 0) {
      const aboveScore = rankings[myIndex - 1].score;
      neighbors.above = { score: aboveScore, gap: aboveScore - myScore };
    }
    if (myIndex >= 0 && myIndex < rankings.length - 1) {
      const belowScore = rankings[myIndex + 1].score;
      neighbors.below = { score: belowScore, gap: myScore - belowScore };
    }

    return {
      hospitalId,
      rank: myRank,
      totalHospitals,
      topPercent,
      score: myScore,
      badge,
      rankChange,
      rankTrend,
      neighbors,
      // 스코어 분포 (히스토그램용)
      distribution: this.buildDistribution(rankings),
    };
  }

  /**
   * 점수 분포 계산 (10점 단위 히스토그램)
   */
  private buildDistribution(rankings: Array<{ score: number }>) {
    const buckets = Array.from({ length: 10 }, (_, i) => ({
      range: `${i * 10}-${i * 10 + 9}`,
      min: i * 10,
      max: i * 10 + 9,
      count: 0,
    }));

    for (const r of rankings) {
      const idx = Math.min(Math.floor(r.score / 10), 9);
      buckets[idx].count++;
    }

    return buckets;
  }

  // ==================== V2: 소스 힌트 / Content Gap / Opportunity ====================

  /**
   * sourceHints 데이터에서 인용 출처 상세 목록 추출
   */
  async getSourceHints(hospitalId: string) {
    const last30Days = new Date();
    last30Days.setDate(last30Days.getDate() - 30);

    const responses = await this.prisma.aIResponse.findMany({
      where: {
        hospitalId,
        createdAt: { gte: last30Days },
        sourceHints: { not: undefined },
      },
      select: {
        sourceHints: true,
        aiPlatform: true,
        isMentioned: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    const sources: Array<{ url: string; title?: string; type?: string; platform?: string }> = [];
    for (const r of responses) {
      const hints = r.sourceHints as any;
      if (hints?.sources && Array.isArray(hints.sources)) {
        for (const s of hints.sources) {
          if (s.url) {
            sources.push({
              url: s.url,
              title: s.title,
              type: s.type,
              platform: r.aiPlatform,
            });
          }
        }
      }
    }

    return { sources, total: sources.length };
  }

  /**
   * Content Gap 목록 조회
   */
  async getContentGaps(hospitalId: string) {
    return this.prisma.contentGap.findMany({
      where: { hospitalId },
      orderBy: [{ priorityScore: 'desc' }, { createdAt: 'desc' }],
      take: 50,
    });
  }

  /**
   * Opportunity 분석 - 경쟁사는 추천되지만 우리 병원은 미언급인 패턴 감지
   */
  async getOpportunityAnalysis(hospitalId: string) {
    const last30Days = new Date();
    last30Days.setDate(last30Days.getDate() - 30);

    // 1. 우리 병원이 미언급된 응답 중 경쟁사가 언급된 것들
    const missedResponses = await this.prisma.aIResponse.findMany({
      where: {
        hospitalId,
        isMentioned: false,
        createdAt: { gte: last30Days },
        competitorsMentioned: { isEmpty: false },
      },
      include: {
        prompt: {
          select: { promptText: true, specialtyCategory: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    // 2. 프롬프트별 기회 집계
    const opportunityMap = new Map<string, {
      promptText: string;
      category: string;
      competitors: Map<string, number>;
      platforms: Set<string>;
      latestDate: Date;
      count: number;
      intent: string;
    }>();

    for (const r of missedResponses) {
      const key = r.prompt?.promptText || r.promptId;
      const existing = opportunityMap.get(key);
      
      if (existing) {
        existing.count++;
        existing.platforms.add(r.aiPlatform);
        for (const comp of r.competitorsMentioned) {
          existing.competitors.set(comp, (existing.competitors.get(comp) || 0) + 1);
        }
        if (r.createdAt > existing.latestDate) existing.latestDate = r.createdAt;
      } else {
        const competitors = new Map<string, number>();
        for (const comp of r.competitorsMentioned) {
          competitors.set(comp, 1);
        }
        opportunityMap.set(key, {
          promptText: r.prompt?.promptText || '알 수 없는 질문',
          category: r.prompt?.specialtyCategory || '',
          competitors,
          platforms: new Set([r.aiPlatform]),
          latestDate: r.createdAt,
          count: 1,
          intent: r.queryIntent || 'INFORMATION',
        });
      }
    }

    // 3. 긴급도 판단 및 정렬
    const opportunities = Array.from(opportunityMap.values()).map(opp => {
      const competitorsList = Array.from(opp.competitors.entries())
        .sort((a, b) => b[1] - a[1])
        .map(([name]) => name);

      // 긴급도: 경쟁사 3개 이상 + 다수 플랫폼 = high
      let urgency: 'high' | 'medium' | 'low' = 'low';
      if (opp.competitors.size >= 3 && opp.platforms.size >= 3) urgency = 'high';
      else if (opp.competitors.size >= 2 || opp.platforms.size >= 2) urgency = 'medium';

      // 개선 제안 자동 생성
      const topCompetitor = competitorsList[0] || '경쟁사';
      const suggestedAction = urgency === 'high'
        ? `"${opp.promptText}" 관련 블로그 포스트 또는 웹사이트 콘텐츠를 작성하세요. ${topCompetitor} 등 ${competitorsList.length}개 경쟁사가 이미 AI에서 추천되고 있습니다.`
        : urgency === 'medium'
        ? `해당 주제의 네이버 플레이스 정보와 블로그 콘텐츠를 보강하면 AI 노출 개선이 가능합니다.`
        : `관련 키워드의 온라인 콘텐츠를 점진적으로 확대해보세요.`;

      return {
        promptText: opp.promptText,
        category: opp.category,
        competitorsMentioned: competitorsList,
        competitorCount: opp.competitors.size,
        platforms: Array.from(opp.platforms),
        urgency,
        suggestedAction,
        intent: opp.intent,
        lastDetectedAt: opp.latestDate.toISOString(),
        missCount: opp.count,
      };
    }).sort((a, b) => {
      const urgencyOrder = { high: 0, medium: 1, low: 2 };
      return urgencyOrder[a.urgency] - urgencyOrder[b.urgency] || b.missCount - a.missCount;
    });

    return {
      opportunities,
      summary: {
        totalOpportunities: opportunities.length,
        highUrgency: opportunities.filter(o => o.urgency === 'high').length,
        mediumUrgency: opportunities.filter(o => o.urgency === 'medium').length,
        lowUrgency: opportunities.filter(o => o.urgency === 'low').length,
        topCompetitor: opportunities.length > 0 ? opportunities[0].competitorsMentioned[0] : null,
      },
    };
  }
}
