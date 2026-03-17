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
   * 플랫폼별 분석 (상세) - 찐 AI 4개 플랫폼
   */
  async getPlatformAnalysis(hospitalId: string) {
    const last30Days = new Date();
    last30Days.setDate(last30Days.getDate() - 30);
    
    const last7Days = new Date();
    last7Days.setDate(last7Days.getDate() - 7);

    const allResponses = await this.prisma.aIResponse.findMany({
      where: {
        hospitalId,
        responseDate: { gte: last30Days },
      },
      select: {
        aiPlatform: true,
        isMentioned: true,
        mentionPosition: true,
        totalRecommendations: true,
        sentimentLabel: true,
        sentimentScore: true,
        responseDate: true,
        repeatIndex: true,    // 【개선1】반복 인덱스
        isWebSearch: true,    // 【개선8】웹 검색 여부
        isVerified: true,     // 【개선10】검증 여부
      },
    });

    const last7DaysResponses = allResponses.filter(
      r => new Date(r.responseDate) >= last7Days
    );
    const prev7DaysResponses = allResponses.filter(
      r => {
        const date = new Date(r.responseDate);
        const prev7Start = new Date(last7Days);
        prev7Start.setDate(prev7Start.getDate() - 7);
        return date >= prev7Start && date < last7Days;
      }
    );

    // 찐 AI 4개 플랫폼만
    const platforms = ['CHATGPT', 'PERPLEXITY', 'CLAUDE', 'GEMINI'] as const;
    const platformNames: Record<string, string> = {
      CHATGPT: 'ChatGPT',
      PERPLEXITY: 'Perplexity',
      CLAUDE: 'Claude',
      GEMINI: 'Gemini',
    };

    // 항상 4개 플랫폼 모두 반환 (데이터 없으면 0으로 표시)
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
      
      const visibilityScore = Math.round(
        mentionRate * 100 * 0.4 + 
        positionScore * 0.3 + 
        sentimentScore * 0.3
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
    }); // 항상 4개 플랫폼 모두 반환 (데이터 없으면 visibilityScore=0)
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

    const prompts = await this.prisma.prompt.findMany({
      where: { hospitalId },
      include: {
        aiResponses: {
          where: { responseDate: { gte: last30Days } },
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

    const thisWeekScore = await this.prisma.dailyScore.findFirst({
      where: {
        hospitalId,
        scoreDate: { gte: lastWeek },
      },
      orderBy: { scoreDate: 'desc' },
    });

    const lastWeekScore = await this.prisma.dailyScore.findFirst({
      where: {
        hospitalId,
        scoreDate: {
          gte: twoWeeksAgo,
          lt: lastWeek,
        },
      },
      orderBy: { scoreDate: 'desc' },
    });

    const newMentions = await this.prisma.aIResponse.count({
      where: {
        hospitalId,
        isMentioned: true,
        responseDate: { gte: lastWeek },
      },
    });

    const competitorMentions = await this.prisma.aIResponse.findMany({
      where: {
        hospitalId,
        responseDate: { gte: lastWeek },
        competitorsMentioned: { isEmpty: false },
      },
      select: { competitorsMentioned: true },
    });

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
        } catch {}
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

    const platforms = ['CHATGPT', 'CLAUDE', 'PERPLEXITY', 'GEMINI'];

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
}
