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
   * 플랫폼별 분석 (상세)
   */
  async getPlatformAnalysis(hospitalId: string) {
    const last30Days = new Date();
    last30Days.setDate(last30Days.getDate() - 30);
    
    const last7Days = new Date();
    last7Days.setDate(last7Days.getDate() - 7);

    // 모든 응답 가져오기 (30일)
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
      },
    });

    // 7일 전 응답 (트렌드 계산용)
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

    // 플랫폼별 집계
    const platforms = ['CHATGPT', 'PERPLEXITY', 'CLAUDE', 'GEMINI'] as const;
    const platformNames: Record<string, string> = {
      CHATGPT: 'ChatGPT',
      PERPLEXITY: 'Perplexity',
      CLAUDE: 'Claude',
      GEMINI: 'Gemini',
    };

    return platforms.map(platform => {
      const platformResponses = allResponses.filter(r => r.aiPlatform === platform);
      const recentResponses = last7DaysResponses.filter(r => r.aiPlatform === platform);
      const prevResponses = prev7DaysResponses.filter(r => r.aiPlatform === platform);
      
      const totalQueries = platformResponses.length;
      const mentionedCount = platformResponses.filter(r => r.isMentioned).length;
      const positiveCount = platformResponses.filter(r => r.sentimentLabel === 'POSITIVE').length;
      const neutralCount = platformResponses.filter(r => r.sentimentLabel === 'NEUTRAL').length;
      const negativeCount = platformResponses.filter(r => r.sentimentLabel === 'NEGATIVE').length;
      
      // 순위 통계
      const positionedResponses = platformResponses.filter(r => r.mentionPosition !== null);
      const avgPosition = positionedResponses.length > 0
        ? positionedResponses.reduce((sum, r) => sum + (r.mentionPosition || 0), 0) / positionedResponses.length
        : null;
      const top3Count = positionedResponses.filter(r => r.mentionPosition && r.mentionPosition <= 3).length;
      
      // 가시성 점수 계산 (100점 만점)
      // 언급률 40% + 순위 점수 30% + 감성 점수 30%
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
      
      return {
        platform,
        platformName: platformNames[platform],
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
      };
    });
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

    // 카테고리별 집계
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
      mentionRate: stats.total > 0 ? (stats.mentioned / stats.total) * 100 : 0,
      positiveRate: stats.total > 0 ? (stats.positive / stats.total) * 100 : 0,
      score: stats.total > 0 
        ? Math.round(((stats.mentioned / stats.total) * 0.6 + (stats.positive / stats.total) * 0.4) * 100)
        : 0,
    }));
  }

  /**
   * 주간 하이라이트
   */
  async getWeeklyHighlights(hospitalId: string) {
    const lastWeek = new Date();
    lastWeek.setDate(lastWeek.getDate() - 7);

    const twoWeeksAgo = new Date();
    twoWeeksAgo.setDate(twoWeeksAgo.getDate() - 14);

    // 이번 주 데이터
    const thisWeekScore = await this.prisma.dailyScore.findFirst({
      where: {
        hospitalId,
        scoreDate: { gte: lastWeek },
      },
      orderBy: { scoreDate: 'desc' },
    });

    // 지난 주 데이터
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

    // 새로운 언급
    const newMentions = await this.prisma.aIResponse.count({
      where: {
        hospitalId,
        isMentioned: true,
        responseDate: { gte: lastWeek },
      },
    });

    // 경쟁사 동향
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

    // 점수 변화 계산
    const scoreChange = (thisWeekScore?.overallScore ?? 0) - (lastWeekScore?.overallScore ?? 0);

    return {
      currentScore: thisWeekScore?.overallScore ?? 0,
      scoreChange,
      scoreTrend: scoreChange > 0 ? 'UP' : scoreChange < 0 ? 'DOWN' : 'STABLE',
      newMentions,
      topCompetitors: topCompetitors.map(([name, count]) => ({ name, count })),
      insights: this.generateInsights({
        scoreChange,
        newMentions,
        currentScore: thisWeekScore?.overallScore ?? 0,
      }),
    };
  }

  /**
   * 인사이트 생성
   */
  private generateInsights(data: { scoreChange: number; newMentions: number; currentScore: number }) {
    const insights: string[] = [];

    if (data.scoreChange > 5) {
      insights.push('🎉 이번 주 AI 가시성 점수가 크게 상승했습니다!');
    } else if (data.scoreChange < -5) {
      insights.push('⚠️ 이번 주 AI 가시성 점수가 하락했습니다. 콘텐츠 개선을 고려해보세요.');
    }

    if (data.currentScore >= 80) {
      insights.push('✨ 현재 AI 가시성이 매우 우수합니다!');
    } else if (data.currentScore < 40) {
      insights.push('📝 AI 가시성 개선이 필요합니다. 콘텐츠 갭 분석을 확인해보세요.');
    }

    if (data.newMentions > 10) {
      insights.push(`📈 이번 주 ${data.newMentions}회 AI에서 언급되었습니다.`);
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

    // 도메인별 집계
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
}
