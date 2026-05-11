import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';

@Injectable()
export class PublicApiService {
  private readonly logger = new Logger(PublicApiService.name);

  constructor(private prisma: PrismaService) {}

  // ==================== 1. AEO 상태 요약 ====================

  async getAeoStatus(hospitalId: string) {
    const hospital = await this.prisma.hospital.findUnique({
      where: { id: hospitalId },
      select: {
        id: true,
        name: true,
        specialtyType: true,
        regionSido: true,
        regionSigungu: true,
        regionDong: true,
        planType: true,
      },
    });

    if (!hospital) {
      throw new NotFoundException(`병원을 찾을 수 없습니다: ${hospitalId}`);
    }

    // 최신 daily_score
    const latestScore = await this.prisma.dailyScore.findFirst({
      where: { hospitalId },
      orderBy: { scoreDate: 'desc' },
    });

    // 전일 대비 변화
    const previousScore = await this.prisma.dailyScore.findFirst({
      where: {
        hospitalId,
        scoreDate: { lt: latestScore?.scoreDate || new Date() },
      },
      orderBy: { scoreDate: 'desc' },
    });

    // 7일 평균
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    const weekScores = await this.prisma.dailyScore.findMany({
      where: {
        hospitalId,
        scoreDate: { gte: sevenDaysAgo },
      },
      select: { overallScore: true },
    });
    const weekAvg = weekScores.length > 0
      ? Math.round(weekScores.reduce((sum, s) => sum + s.overallScore, 0) / weekScores.length)
      : null;

    // 30일 평균
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const monthScores = await this.prisma.dailyScore.findMany({
      where: {
        hospitalId,
        scoreDate: { gte: thirtyDaysAgo },
      },
      select: { overallScore: true },
    });
    const monthAvg = monthScores.length > 0
      ? Math.round(monthScores.reduce((sum, s) => sum + s.overallScore, 0) / monthScores.length)
      : null;

    // 전체 순위
    const ranking = await this.calculateRanking(hospitalId, latestScore?.scoreDate);

    return {
      hospital: {
        id: hospital.id,
        name: hospital.name,
        specialty: hospital.specialtyType,
        region: [hospital.regionSido, hospital.regionSigungu, hospital.regionDong]
          .filter(Boolean).join(' '),
        plan: hospital.planType,
      },
      score: {
        current: latestScore?.overallScore ?? null,
        date: latestScore?.scoreDate ?? null,
        change: latestScore && previousScore
          ? latestScore.overallScore - previousScore.overallScore
          : null,
        weekAverage: weekAvg,
        monthAverage: monthAvg,
      },
      ranking: ranking,
      platforms: latestScore?.platformScores ?? null,
      intents: latestScore?.intentScores ?? null,
      sov: {
        percent: latestScore?.sovPercent ?? null,
        avgSentiment: latestScore?.avgSentimentV2 ?? null,
        depthDistribution: latestScore?.depthDistribution ?? null,
      },
      badge: ranking ? this.getBadge(ranking.percentile) : null,
      updatedAt: latestScore?.createdAt ?? null,
    };
  }

  // ==================== 2. 점수 히스토리 ====================

  async getScoreHistory(hospitalId: string, days: number = 30) {
    await this.validateHospital(hospitalId);

    const since = new Date();
    since.setDate(since.getDate() - Math.min(days, 90)); // 최대 90일

    const scores = await this.prisma.dailyScore.findMany({
      where: {
        hospitalId,
        scoreDate: { gte: since },
      },
      select: {
        scoreDate: true,
        overallScore: true,
        mentionCount: true,
        positiveRatio: true,
        sovPercent: true,
        avgSentimentV2: true,
        platformScores: true,
      },
      orderBy: { scoreDate: 'asc' },
    });

    return {
      hospitalId,
      period: { from: since, to: new Date(), days: Math.min(days, 90) },
      dataPoints: scores.length,
      history: scores.map(s => ({
        date: s.scoreDate,
        score: s.overallScore,
        mentionCount: s.mentionCount,
        positiveRatio: Math.round((s.positiveRatio ?? 0) * 100),
        sov: s.sovPercent,
        sentiment: s.avgSentimentV2,
        platforms: s.platformScores,
      })),
    };
  }

  // ==================== 3. 플랫폼별 분석 ====================

  async getPlatformBreakdown(hospitalId: string) {
    await this.validateHospital(hospitalId);

    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const responses = await this.prisma.aIResponse.groupBy({
      by: ['aiPlatform'],
      where: {
        hospitalId,
        responseDate: { gte: thirtyDaysAgo },
      },
      _count: { id: true },
      _avg: { sentimentScore: true, confidenceScore: true },
    });

    const mentionedCounts = await this.prisma.aIResponse.groupBy({
      by: ['aiPlatform'],
      where: {
        hospitalId,
        responseDate: { gte: thirtyDaysAgo },
        isMentioned: true,
      },
      _count: { id: true },
      _avg: { mentionPosition: true },
    });

    const mentionMap = new Map(mentionedCounts.map(m => [m.aiPlatform, m]));

    const platforms = responses.map(r => {
      const mentioned = mentionMap.get(r.aiPlatform);
      const total = r._count.id;
      const mentionCount = mentioned?._count?.id ?? 0;

      return {
        platform: r.aiPlatform,
        totalResponses: total,
        mentionCount: mentionCount,
        mentionRate: total > 0 ? Math.round((mentionCount / total) * 100) : 0,
        avgPosition: mentioned?._avg?.mentionPosition
          ? Math.round(mentioned._avg.mentionPosition * 10) / 10
          : null,
        avgSentiment: r._avg.sentimentScore
          ? Math.round(r._avg.sentimentScore * 100) / 100
          : null,
        avgConfidence: r._avg.confidenceScore
          ? Math.round(r._avg.confidenceScore * 100)
          : null,
      };
    });

    return {
      hospitalId,
      period: '30d',
      platforms: platforms.sort((a, b) => b.mentionRate - a.mentionRate),
    };
  }

  // ==================== 4. 의도별 분석 ====================

  async getIntentBreakdown(hospitalId: string) {
    await this.validateHospital(hospitalId);

    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const intents = ['RESERVATION', 'COMPARISON', 'INFORMATION', 'REVIEW', 'FEAR'] as const;
    const result: Array<{
      intent: string;
      totalResponses: number;
      mentionCount: number;
      mentionRate: number;
      avgSentiment: number | null;
    }> = [];

    for (const intent of intents) {
      const total = await this.prisma.aIResponse.count({
        where: {
          hospitalId,
          responseDate: { gte: thirtyDaysAgo },
          queryIntent: intent,
        },
      });

      const mentioned = await this.prisma.aIResponse.count({
        where: {
          hospitalId,
          responseDate: { gte: thirtyDaysAgo },
          queryIntent: intent,
          isMentioned: true,
        },
      });

      const sentimentAgg = await this.prisma.aIResponse.aggregate({
        where: {
          hospitalId,
          responseDate: { gte: thirtyDaysAgo },
          queryIntent: intent,
          isMentioned: true,
          sentimentScoreV2: { not: null },
        },
        _avg: { sentimentScoreV2: true },
      });

      result.push({
        intent,
        totalResponses: total,
        mentionCount: mentioned,
        mentionRate: total > 0 ? Math.round((mentioned / total) * 100) : 0,
        avgSentiment: sentimentAgg._avg.sentimentScoreV2 ?? null,
      });
    }

    return {
      hospitalId,
      period: '30d',
      intents: result.sort((a, b) => b.mentionRate - a.mentionRate),
    };
  }

  // ==================== 5. 전체 병원 랭킹 ====================

  async getRankings(options: {
    limit?: number;
    offset?: number;
    specialty?: string;
    region?: string;
  }) {
    const limit = Math.min(options.limit || 20, 100);
    const offset = options.offset || 0;

    // 최신 날짜 조회
    const latestDate = await this.prisma.dailyScore.findFirst({
      orderBy: { scoreDate: 'desc' },
      select: { scoreDate: true },
    });

    if (!latestDate) {
      return { date: null, total: 0, rankings: [] };
    }

    // 해당 날짜의 모든 점수 + 병원 정보
    const where: any = { scoreDate: latestDate.scoreDate };

    // 필터 조건 빌드
    const hospitalWhere: any = {};
    if (options.specialty) {
      hospitalWhere.specialtyType = options.specialty;
    }
    if (options.region) {
      hospitalWhere.OR = [
        { regionSido: { contains: options.region } },
        { regionSigungu: { contains: options.region } },
      ];
    }

    if (Object.keys(hospitalWhere).length > 0) {
      where.hospital = hospitalWhere;
    }

    const [total, scores] = await Promise.all([
      this.prisma.dailyScore.count({ where }),
      this.prisma.dailyScore.findMany({
        where,
        include: {
          hospital: {
            select: {
              id: true,
              name: true,
              specialtyType: true,
              regionSido: true,
              regionSigungu: true,
              planType: true,
            },
          },
        },
        orderBy: { overallScore: 'desc' },
        skip: offset,
        take: limit,
      }),
    ]);

    const rankings = scores.map((s, idx) => {
      const rank = offset + idx + 1;
      const percentile = total > 0 ? Math.round((rank / total) * 100) : 100;

      return {
        rank,
        hospital: {
          id: s.hospital.id,
          name: s.hospital.name,
          specialty: s.hospital.specialtyType,
          region: `${s.hospital.regionSido} ${s.hospital.regionSigungu}`,
          plan: s.hospital.planType,
        },
        score: s.overallScore,
        sov: s.sovPercent,
        mentionCount: s.mentionCount,
        percentile,
        badge: this.getBadge(percentile),
        platforms: s.platformScores,
      };
    });

    return {
      date: latestDate.scoreDate,
      total,
      offset,
      limit,
      rankings,
    };
  }

  // ==================== 6. 경쟁사 비교 ====================

  async getCompetitorComparison(hospitalId: string) {
    await this.validateHospital(hospitalId);

    const competitors = await this.prisma.competitor.findMany({
      where: { hospitalId, isActive: true },
      select: {
        id: true,
        competitorName: true,
        competitorRegion: true,
        isAutoDetected: true,
      },
    });

    // 각 경쟁사의 최신 점수
    const competitorScores = await Promise.all(
      competitors.map(async (comp) => {
        const latestScore = await this.prisma.competitorScore.findFirst({
          where: { competitorId: comp.id },
          orderBy: { scoreDate: 'desc' },
        });

        return {
          id: comp.id,
          name: comp.competitorName,
          region: comp.competitorRegion,
          isAutoDetected: comp.isAutoDetected,
          score: latestScore?.overallScore ?? null,
          mentionCount: latestScore?.mentionCount ?? null,
          scoreDate: latestScore?.scoreDate ?? null,
        };
      })
    );

    // 우리 병원 점수
    const ourScore = await this.prisma.dailyScore.findFirst({
      where: { hospitalId },
      orderBy: { scoreDate: 'desc' },
      select: { overallScore: true, mentionCount: true, scoreDate: true },
    });

    // 30일간 경쟁사가 가장 많이 언급된 프롬프트
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const competitorMentions = await this.prisma.aIResponse.findMany({
      where: {
        hospitalId,
        responseDate: { gte: thirtyDaysAgo },
        isMentioned: false,
        competitorsMentioned: { isEmpty: false },
      },
      select: {
        competitorsMentioned: true,
      },
    });

    // 경쟁사별 언급 빈도 집계
    const mentionFreq: Record<string, number> = {};
    for (const resp of competitorMentions) {
      for (const name of resp.competitorsMentioned) {
        mentionFreq[name] = (mentionFreq[name] || 0) + 1;
      }
    }

    const topThreats = Object.entries(mentionFreq)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([name, count]) => ({ name, mentionCount: count }));

    return {
      hospitalId,
      ourScore: {
        score: ourScore?.overallScore ?? null,
        mentionCount: ourScore?.mentionCount ?? null,
        date: ourScore?.scoreDate ?? null,
      },
      registeredCompetitors: competitorScores.sort(
        (a, b) => (b.score ?? 0) - (a.score ?? 0)
      ),
      topThreats,
    };
  }

  // ==================== 헬퍼 메서드 ====================

  private async validateHospital(hospitalId: string) {
    const exists = await this.prisma.hospital.findUnique({
      where: { id: hospitalId },
      select: { id: true },
    });
    if (!exists) {
      throw new NotFoundException(`병원을 찾을 수 없습니다: ${hospitalId}`);
    }
  }

  private async calculateRanking(hospitalId: string, scoreDate?: Date | null) {
    if (!scoreDate) return null;

    const [total, higherCount] = await Promise.all([
      this.prisma.dailyScore.count({ where: { scoreDate } }),
      this.prisma.dailyScore.count({
        where: {
          scoreDate,
          overallScore: {
            gt: (await this.prisma.dailyScore.findFirst({
              where: { hospitalId, scoreDate },
              select: { overallScore: true },
            }))?.overallScore ?? 0,
          },
        },
      }),
    ]);

    const rank = higherCount + 1;
    const percentile = total > 0 ? Math.round((rank / total) * 100) : 100;

    return { rank, total, percentile };
  }

  private getBadge(percentile: number): string {
    if (percentile <= 1) return 'DIAMOND';
    if (percentile <= 5) return 'PLATINUM';
    if (percentile <= 15) return 'GOLD';
    if (percentile <= 30) return 'SILVER';
    if (percentile <= 50) return 'BRONZE';
    return 'STARTER';
  }
}
