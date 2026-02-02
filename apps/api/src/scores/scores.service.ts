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
   * 플랫폼별 분석
   */
  async getPlatformAnalysis(hospitalId: string) {
    const last30Days = new Date();
    last30Days.setDate(last30Days.getDate() - 30);

    const responses = await this.prisma.aIResponse.groupBy({
      by: ['aiPlatform'],
      where: {
        hospitalId,
        responseDate: { gte: last30Days },
      },
      _count: { id: true },
      _avg: { sentimentScore: true },
    });

    const mentionedByPlatform = await this.prisma.aIResponse.groupBy({
      by: ['aiPlatform'],
      where: {
        hospitalId,
        responseDate: { gte: last30Days },
        isMentioned: true,
      },
      _count: { id: true },
    });

    const mentionedMap = new Map(
      mentionedByPlatform.map((m) => [m.aiPlatform, m._count.id]),
    );

    return responses.map((r) => ({
      platform: r.aiPlatform,
      totalQueries: r._count.id,
      mentionedCount: mentionedMap.get(r.aiPlatform) || 0,
      mentionRate: ((mentionedMap.get(r.aiPlatform) || 0) / r._count.id) * 100,
      avgSentiment: r._avg.sentimentScore || 0,
    }));
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
