import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';

interface CompetitorSuggestion {
  name: string;
  mentionCount: number;
  coMentionCount: number;      // 우리 병원과 같은 응답에 등장한 횟수
  soloMentionCount: number;    // 우리 병원 없이 단독 언급된 횟수
  avgPosition: number | null;  // 평균 추천 순위
  platforms: string[];         // 언급된 플랫폼 목록
  threatLevel: 'HIGH' | 'MEDIUM' | 'LOW';  // 위협도
  threatScore: number;         // 위협 점수 (0~100)
  reason: string;              // 제안 이유
}

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
   * AI 기반 경쟁사 제안 (고도화 버전)
   * - 단순 언급 횟수 → 위협도 분석, 동시 언급 패턴, 플랫폼 분포 등
   * - 바로 추가하지 않고 제안 목록을 반환 → 원장이 수락/거절
   */
  async suggestCompetitors(hospitalId: string): Promise<{
    suggestions: CompetitorSuggestion[];
    analysisInfo: {
      totalResponsesAnalyzed: number;
      periodDays: number;
      myMentionRate: number;
    };
  }> {
    const hospital = await this.prisma.hospital.findUnique({
      where: { id: hospitalId },
      select: { name: true, regionSido: true, regionSigungu: true },
    });

    if (!hospital) {
      throw new NotFoundException('병원을 찾을 수 없습니다');
    }

    // 최근 30일 AI 응답 분석
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const recentResponses = await this.prisma.aIResponse.findMany({
      where: {
        hospitalId,
        responseDate: { gte: thirtyDaysAgo },
      },
      orderBy: { responseDate: 'desc' },
      select: {
        competitorsMentioned: true,
        isMentioned: true,
        mentionPosition: true,
        totalRecommendations: true,
        aiPlatform: true,
        sentimentScoreV2: true,
        recommendationDepth: true,
      },
    });

    const totalResponses = recentResponses.length;
    if (totalResponses === 0) {
      return {
        suggestions: [],
        analysisInfo: {
          totalResponsesAnalyzed: 0,
          periodDays: 30,
          myMentionRate: 0,
        },
      };
    }

    // 내 병원 언급률
    const myMentionCount = recentResponses.filter((r) => r.isMentioned).length;
    const myMentionRate = Math.round((myMentionCount / totalResponses) * 100);

    // ===== 경쟁사별 상세 분석 =====
    const competitorAnalysis: Record<string, {
      mentionCount: number;
      coMentionCount: number;       // 우리 병원과 동시 언급
      soloMentionCount: number;     // 우리 병원 없이 단독 언급 (= 우리가 밀린 경우)
      positions: number[];          // 언급 순위들
      platforms: Set<string>;       // 언급된 플랫폼
      beatUsCount: number;          // 우리보다 높은 순위로 추천된 횟수
      recentMentions: number;       // 최근 7일 언급 (트렌드)
    }> = {};

    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    for (const response of recentResponses) {
      for (const compName of response.competitorsMentioned) {
        // 자기 자신 필터링
        if (compName === hospital.name) continue;

        if (!competitorAnalysis[compName]) {
          competitorAnalysis[compName] = {
            mentionCount: 0,
            coMentionCount: 0,
            soloMentionCount: 0,
            positions: [],
            platforms: new Set(),
            beatUsCount: 0,
            recentMentions: 0,
          };
        }

        const analysis = competitorAnalysis[compName];
        analysis.mentionCount++;
        analysis.platforms.add(response.aiPlatform);

        // 동시 언급 vs 단독 언급 분석
        if (response.isMentioned) {
          analysis.coMentionCount++;
        } else {
          analysis.soloMentionCount++; // 우리는 안 나오는데 경쟁사만 나옴 = 위협
        }

        // 순위 분석 - 경쟁사가 우리보다 높은 순위인지
        if (response.mentionPosition && response.totalRecommendations) {
          // 경쟁사의 대략적인 위치 추정 (competitorsMentioned 순서)
          const compIdx = response.competitorsMentioned.indexOf(compName);
          if (compIdx >= 0) {
            analysis.positions.push(compIdx + 1);
            if (response.isMentioned && response.mentionPosition > compIdx + 1) {
              analysis.beatUsCount++;
            }
          }
        }

        // 최근 7일 트렌드
        // (responseDate 접근 불가 여기서, 하지만 정렬되어 있으므로 인덱스로 대략 추정)
      }
    }

    // 기존 등록된 경쟁사 목록
    const existingCompetitors = await this.prisma.competitor.findMany({
      where: { hospitalId },
      select: { competitorName: true, isActive: true },
    });
    const existingNames = new Set(
      existingCompetitors.map((c) => c.competitorName),
    );

    // ===== 위협도 점수 계산 + 제안 생성 =====
    const suggestions: CompetitorSuggestion[] = Object.entries(competitorAnalysis)
      .filter(([name]) => !existingNames.has(name))
      .map(([name, data]) => {
        // 위협 점수 계산 (0~100)
        let threatScore = 0;

        // 1. 전체 언급 빈도 (최대 30점)
        const mentionFreq = data.mentionCount / totalResponses;
        threatScore += Math.min(mentionFreq * 100, 30);

        // 2. 단독 언급 비율 - 우리 없이 경쟁사만 나오면 위협 (최대 30점)
        if (data.mentionCount > 0) {
          const soloRatio = data.soloMentionCount / data.mentionCount;
          threatScore += soloRatio * 30;
        }

        // 3. 플랫폼 다양성 - 여러 AI에서 언급되면 더 위협 (최대 20점)
        const platformScore = Math.min(data.platforms.size * 5, 20);
        threatScore += platformScore;

        // 4. 순위 우위 - 우리보다 높은 순위 비율 (최대 20점)
        if (data.beatUsCount > 0 && data.coMentionCount > 0) {
          threatScore += (data.beatUsCount / data.coMentionCount) * 20;
        }

        threatScore = Math.round(Math.min(threatScore, 100));

        // 위협 레벨 결정
        let threatLevel: 'HIGH' | 'MEDIUM' | 'LOW';
        if (threatScore >= 60) threatLevel = 'HIGH';
        else if (threatScore >= 30) threatLevel = 'MEDIUM';
        else threatLevel = 'LOW';

        // 제안 이유 생성
        const reason = this.generateSuggestionReason(name, data, totalResponses, myMentionRate);

        // 평균 순위
        const avgPosition = data.positions.length > 0
          ? Math.round((data.positions.reduce((a, b) => a + b, 0) / data.positions.length) * 10) / 10
          : null;

        return {
          name,
          mentionCount: data.mentionCount,
          coMentionCount: data.coMentionCount,
          soloMentionCount: data.soloMentionCount,
          avgPosition,
          platforms: Array.from(data.platforms),
          threatLevel,
          threatScore,
          reason,
        };
      })
      // 최소 2회 이상 언급된 것만 제안
      .filter((s) => s.mentionCount >= 2)
      // 위협 점수순 정렬
      .sort((a, b) => b.threatScore - a.threatScore)
      // 최대 10개
      .slice(0, 10);

    return {
      suggestions,
      analysisInfo: {
        totalResponsesAnalyzed: totalResponses,
        periodDays: 30,
        myMentionRate,
      },
    };
  }

  /**
   * 제안된 경쟁사 수락 (선택적으로 추가)
   */
  async acceptSuggestion(
    hospitalId: string,
    dto: { competitorName: string; competitorRegion?: string },
  ) {
    // 이미 존재하는지 체크
    const existing = await this.prisma.competitor.findFirst({
      where: {
        hospitalId,
        competitorName: dto.competitorName,
      },
    });

    if (existing) {
      // 비활성이었으면 재활성화
      if (!existing.isActive) {
        return this.prisma.competitor.update({
          where: { id: existing.id },
          data: { isActive: true },
        });
      }
      return existing;
    }

    return this.prisma.competitor.create({
      data: {
        hospitalId,
        competitorName: dto.competitorName,
        competitorRegion: dto.competitorRegion,
        isAutoDetected: true,  // AI 제안으로 추가됨
        isActive: true,
      },
    });
  }

  /**
   * 제안 이유 텍스트 생성
   */
  private generateSuggestionReason(
    name: string,
    data: {
      mentionCount: number;
      coMentionCount: number;
      soloMentionCount: number;
      platforms: Set<string>;
      beatUsCount: number;
    },
    totalResponses: number,
    myMentionRate: number,
  ): string {
    const reasons: string[] = [];

    // 핵심 수치
    const mentionPercent = Math.round((data.mentionCount / totalResponses) * 100);

    if (data.soloMentionCount > data.coMentionCount) {
      reasons.push(
        `AI 응답의 ${mentionPercent}%에서 등장하며, 우리 병원 대신 추천되는 비율이 높습니다`,
      );
    } else if (data.coMentionCount > 0) {
      reasons.push(
        `AI 응답의 ${mentionPercent}%에서 우리 병원과 함께 비교 대상으로 언급됩니다`,
      );
    } else {
      reasons.push(`최근 30일간 ${data.mentionCount}회 언급되었습니다`);
    }

    if (data.platforms.size >= 3) {
      reasons.push(
        `${data.platforms.size}개 AI 플랫폼에서 고르게 노출되고 있습니다`,
      );
    }

    if (data.beatUsCount > 0) {
      reasons.push(`${data.beatUsCount}회 우리 병원보다 높은 순위로 추천되었습니다`);
    }

    return reasons.join('. ');
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
