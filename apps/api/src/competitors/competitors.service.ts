import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';

@Injectable()
export class CompetitorsService {
  constructor(private prisma: PrismaService) {}

  /**
   * 경쟁사 추가
   */
  async create(hospitalId: string, dto: { competitorName: string; competitorRegion?: string }) {
    return this.prisma.competitor.create({
      data: {
        hospitalId,
        competitorName: dto.competitorName,
        competitorRegion: dto.competitorRegion,
        isAutoDetected: false,
        isActive: true,
      },
    });
  }

  /**
   * 경쟁사 목록 조회
   */
  async findAll(hospitalId: string) {
    return this.prisma.competitor.findMany({
      where: { hospitalId, isActive: true },
      include: {
        competitorScores: {
          orderBy: { scoreDate: 'desc' },
          take: 7,
        },
      },
      orderBy: { createdAt: 'asc' },
    });
  }

  /**
   * 경쟁사 삭제 (비활성화)
   */
  async remove(id: string, hospitalId: string) {
    const competitor = await this.prisma.competitor.findUnique({
      where: { id },
    });

    if (!competitor || competitor.hospitalId !== hospitalId) {
      throw new NotFoundException('경쟁사를 찾을 수 없습니다');
    }

    await this.prisma.competitor.update({
      where: { id },
      data: { isActive: false },
    });

    return { success: true };
  }

  /**
   * AI 응답에서 자동으로 경쟁사 탐지
   */
  async autoDetectCompetitors(hospitalId: string) {
    // 최근 AI 응답에서 언급된 경쟁사들 집계
    const recentResponses = await this.prisma.aIResponse.findMany({
      where: { hospitalId },
      orderBy: { responseDate: 'desc' },
      take: 100,
      select: { competitorsMentioned: true },
    });

    // 경쟁사 언급 횟수 집계
    const competitorCounts: Record<string, number> = {};
    for (const response of recentResponses) {
      for (const competitor of response.competitorsMentioned) {
        competitorCounts[competitor] = (competitorCounts[competitor] || 0) + 1;
      }
    }

    // 기존 경쟁사 목록
    const existingCompetitors = await this.prisma.competitor.findMany({
      where: { hospitalId },
      select: { competitorName: true },
    });
    const existingNames = new Set(existingCompetitors.map((c) => c.competitorName));

    // 상위 10개 신규 경쟁사만 추가
    const sortedCompetitors = Object.entries(competitorCounts)
      .filter(([name]) => !existingNames.has(name))
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10);

    const newCompetitors = await this.prisma.competitor.createMany({
      data: sortedCompetitors.map(([name]) => ({
        hospitalId,
        competitorName: name,
        isAutoDetected: true,
        isActive: true,
      })),
    });

    return {
      detected: newCompetitors.count,
      competitors: sortedCompetitors.map(([name, count]) => ({ name, mentionCount: count })),
    };
  }

  /**
   * 경쟁사 비교 분석
   */
  async getComparison(hospitalId: string) {
    const hospital = await this.prisma.hospital.findUnique({
      where: { id: hospitalId },
    });

    if (!hospital) {
      throw new NotFoundException('병원을 찾을 수 없습니다');
    }

    // 내 병원 최근 점수
    const myScore = await this.prisma.dailyScore.findFirst({
      where: { hospitalId },
      orderBy: { scoreDate: 'desc' },
    });

    // 경쟁사 점수
    const competitors = await this.prisma.competitor.findMany({
      where: { hospitalId, isActive: true },
      include: {
        competitorScores: {
          orderBy: { scoreDate: 'desc' },
          take: 1,
        },
      },
    });

    // 갭 분석 - 경쟁사는 언급되는데 우리는 안 되는 질문
    const gaps = await this.prisma.aIResponse.findMany({
      where: {
        hospitalId,
        isMentioned: false,
        competitorsMentioned: { isEmpty: false },
      },
      orderBy: { responseDate: 'desc' },
      take: 20,
      include: { prompt: true },
    });

    return {
      myHospital: {
        name: hospital.name,
        score: myScore?.overallScore ?? 0,
        mentionCount: myScore?.mentionCount ?? 0,
      },
      competitors: competitors.map((c) => ({
        id: c.id,
        name: c.competitorName,
        score: c.competitorScores[0]?.overallScore ?? 0,
        mentionCount: c.competitorScores[0]?.mentionCount ?? 0,
        isAutoDetected: c.isAutoDetected,
      })),
      gaps: gaps.map((g) => ({
        promptId: g.promptId,
        promptText: g.prompt.promptText,
        competitorsMentioned: g.competitorsMentioned,
        platform: g.aiPlatform,
      })),
    };
  }

  /**
   * 경쟁사 점수 기록 (크롤링 시 호출)
   */
  async recordCompetitorScore(competitorId: string, score: number, mentionCount: number) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    return this.prisma.competitorScore.upsert({
      where: {
        competitorId_scoreDate: {
          competitorId,
          scoreDate: today,
        },
      },
      update: {
        overallScore: score,
        mentionCount,
      },
      create: {
        competitorId,
        scoreDate: today,
        overallScore: score,
        mentionCount,
      },
    });
  }
}
