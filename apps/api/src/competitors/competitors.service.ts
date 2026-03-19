import { Injectable, NotFoundException, ConflictException, Logger } from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';

export interface CompetitorSuggestion {
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
  private readonly logger = new Logger(CompetitorsService.name);
  constructor(private prisma: PrismaService) {}

  // ===== 한국어 치과명 정규화 및 유사도 매칭 =====

  /**
   * 치과명 정규화 - 지역명 접두사, 공백, 접미사 통일
   * 예: "천안 우리가족 치과의원" → "우리가족치과"
   *     "우리가족치과의원" → "우리가족치과"
   */
  private normalizeDentalName(name: string): string {
    let normalized = name.trim();
    // 공백 제거
    normalized = normalized.replace(/\s+/g, '');
    // 지역명 접두사 제거 (시/군/구 이름 패턴)
    normalized = normalized.replace(
      /^(서울|부산|대구|인천|광주|대전|울산|세종|경기|강원|충북|충남|전북|전남|경북|경남|제주|천안|수원|성남|고양|용인|청주|전주|포항|창원|안양|안산|김포|화성|남양주|시흥|파주|의정부|양주|평택|광명|구리|군포|오산|이천|양평|하남|동탄|분당|일산|판교|위례|송도|검단)/,
      ''
    );
    // 접미사 통일: 치과의원/치과병원/치과 → 치과
    normalized = normalized.replace(/(치과)(의원|병원|클리닉)?$/, '치과');
    return normalized;
  }

  /**
   * 두 치과명이 동일한 곳인지 판별
   * - 정규화 후 완전 일치
   * - 한쪽이 다른 쪽을 포함 (짧은 쪽 기준 80% 이상)
   */
  private isSameDentalClinic(nameA: string, nameB: string): boolean {
    const normA = this.normalizeDentalName(nameA);
    const normB = this.normalizeDentalName(nameB);

    // 정규화 후 완전 일치
    if (normA === normB) return true;

    // 한쪽이 다른 쪽을 포함
    if (normA.includes(normB) || normB.includes(normA)) return true;

    // 치과 접미사 제거 후 핵심 이름 비교
    const coreA = normA.replace(/치과$/, '');
    const coreB = normB.replace(/치과$/, '');
    if (coreA.length >= 2 && coreB.length >= 2) {
      if (coreA === coreB) return true;
      if (coreA.includes(coreB) || coreB.includes(coreA)) return true;
    }

    return false;
  }

  /**
   * AI 응답의 경쟁사명과 등록된 경쟁사명을 퍼지 매칭
   * 여러 변형 이름의 언급 횟수를 합산
   */
  private countFuzzyMentions(
    competitorName: string,
    competitorRegion: string | null,
    mentionCounts: Record<string, number>,
  ): number {
    let total = 0;
    for (const [aiName, count] of Object.entries(mentionCounts)) {
      if (this.isSameDentalClinic(competitorName, aiName)) {
        total += count;
        continue;
      }
      // 지역+핵심 이름 조합 매칭
      if (competitorRegion) {
        const combined = competitorRegion + competitorName;
        if (this.isSameDentalClinic(combined, aiName)) {
          total += count;
        }
      }
    }
    return total;
  }

  /**
   * 경쟁사 추가 (중복 체크 포함)
   */
  async create(hospitalId: string, dto: { competitorName: string; competitorRegion?: string }) {
    // 기존 경쟁사 중복 체크 (정규화 기반)
    const existingCompetitors = await this.prisma.competitor.findMany({
      where: { hospitalId },
      select: { id: true, competitorName: true, isActive: true },
    });

    const duplicate = existingCompetitors.find(
      (c) => this.isSameDentalClinic(c.competitorName, dto.competitorName),
    );

    if (duplicate) {
      if (!duplicate.isActive) {
        // 비활성 상태면 재활성화
        return this.prisma.competitor.update({
          where: { id: duplicate.id },
          data: { isActive: true },
        });
      }
      throw new ConflictException(
        `이미 유사한 경쟁사가 등록되어 있습니다: ${duplicate.competitorName}`,
      );
    }

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

    // 기존 등록된 경쟁사 목록 (정규화 매칭으로 중복 필터링)
    const existingCompetitors = await this.prisma.competitor.findMany({
      where: { hospitalId },
      select: { competitorName: true, isActive: true },
    });

    // ===== 분석 전: AI 응답에서 나온 유사 이름들을 병합 =====
    // 예: "우리가족치과의원"과 "천안우리가족치과의원"을 하나로 합침
    const mergedAnalysis = this.mergeSimialarCompetitors(competitorAnalysis);

    // ===== 위협도 점수 계산 + 제안 생성 =====
    const suggestions: CompetitorSuggestion[] = Object.entries(mergedAnalysis)
      .filter(([name]) => {
        // 정규화 기반으로 이미 등록된 경쟁사 필터링
        return !existingCompetitors.some(
          (c) => this.isSameDentalClinic(c.competitorName, name),
        );
      })
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
   * 제안된 경쟁사 수락 (선택적으로 추가, 정규화 기반 중복 체크)
   */
  async acceptSuggestion(
    hospitalId: string,
    dto: { competitorName: string; competitorRegion?: string },
  ) {
    // 정규화 기반 중복 체크 (정확한 이름 + 유사 이름 모두)
    const allCompetitors = await this.prisma.competitor.findMany({
      where: { hospitalId },
      select: { id: true, competitorName: true, isActive: true },
    });

    const duplicate = allCompetitors.find(
      (c) => this.isSameDentalClinic(c.competitorName, dto.competitorName),
    );

    if (duplicate) {
      // 비활성이었으면 재활성화
      if (!duplicate.isActive) {
        return this.prisma.competitor.update({
          where: { id: duplicate.id },
          data: { isActive: true },
        });
      }
      return duplicate;
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
   * AI 응답에서 추출된 유사 경쟁사명 병합
   * 예: "우리가족치과의원" + "천안우리가족치과의원" → 대표명으로 통합
   */
  private mergeSimialarCompetitors(
    analysis: Record<string, {
      mentionCount: number;
      coMentionCount: number;
      soloMentionCount: number;
      positions: number[];
      platforms: Set<string>;
      beatUsCount: number;
      recentMentions: number;
    }>,
  ): Record<string, typeof analysis[string]> {
    const entries = Object.entries(analysis);
    const merged: Record<string, typeof analysis[string]> = {};
    const usedKeys = new Set<string>();

    for (let i = 0; i < entries.length; i++) {
      const [nameA, dataA] = entries[i];
      if (usedKeys.has(nameA)) continue;

      // 이 이름과 유사한 다른 이름들 찾기
      const group: [string, typeof dataA][] = [[nameA, dataA]];
      for (let j = i + 1; j < entries.length; j++) {
        const [nameB] = entries[j];
        if (usedKeys.has(nameB)) continue;
        if (this.isSameDentalClinic(nameA, nameB)) {
          group.push(entries[j] as [string, typeof dataA]);
          usedKeys.add(nameB);
        }
      }

      // 대표명 선정: 가장 많이 언급된 이름 사용
      const representativeName = group.sort((a, b) => b[1].mentionCount - a[1].mentionCount)[0][0];

      // 데이터 병합
      const mergedData = {
        mentionCount: 0,
        coMentionCount: 0,
        soloMentionCount: 0,
        positions: [] as number[],
        platforms: new Set<string>(),
        beatUsCount: 0,
        recentMentions: 0,
      };

      for (const [, data] of group) {
        mergedData.mentionCount += data.mentionCount;
        mergedData.coMentionCount += data.coMentionCount;
        mergedData.soloMentionCount += data.soloMentionCount;
        mergedData.positions.push(...data.positions);
        data.platforms.forEach((p) => mergedData.platforms.add(p));
        mergedData.beatUsCount += data.beatUsCount;
        mergedData.recentMentions += data.recentMentions;
      }

      merged[representativeName] = mergedData;
      usedKeys.add(nameA);

      if (group.length > 1) {
        this.logger.log(
          `[중복 병합] ${group.map(([n]) => n).join(' + ')} → ${representativeName} (총 ${mergedData.mentionCount}회)`,
        );
      }
    }

    return merged;
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

    // 경쟁사 점수가 없는 경우, AI 응답 데이터에서 간접 추정
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const aiResponses = await this.prisma.aIResponse.findMany({
      where: {
        hospitalId,
        responseDate: { gte: thirtyDaysAgo },
        competitorsMentioned: { isEmpty: false },
      },
      select: {
        competitorsMentioned: true,
        isMentioned: true,
      },
    });

    // 경쟁사별 언급 횟수 집계 (AI 응답에서 추출)
    const competitorMentionCounts: Record<string, number> = {};
    const totalResponses = aiResponses.length;
    for (const resp of aiResponses) {
      for (const name of resp.competitorsMentioned) {
        competitorMentionCounts[name] = (competitorMentionCounts[name] || 0) + 1;
      }
    }

    // 【최적화 R3】갭 분석 - select 최소화 (responseText 등 불필요 필드 제외)
    const gaps = await this.prisma.aIResponse.findMany({
      where: {
        hospitalId,
        isMentioned: false,
        competitorsMentioned: { isEmpty: false },
      },
      orderBy: { responseDate: 'desc' },
      take: 20,
      select: {
        promptId: true,
        competitorsMentioned: true,
        aiPlatform: true,
        prompt: { select: { promptText: true } },
      },
    });

    // 전체 AI 응답 수 (언급률 계산용)
    const allResponsesCount = await this.prisma.aIResponse.count({
      where: {
        hospitalId,
        responseDate: { gte: thirtyDaysAgo },
      },
    });

    return {
      myHospital: {
        name: hospital.name,
        score: myScore?.overallScore ?? 0,
        mentionCount: myScore?.mentionCount ?? 0,
      },
      competitors: competitors.map((c) => {
        const directScore = c.competitorScores[0]?.overallScore ?? 0;
        const directMentionCount = c.competitorScores[0]?.mentionCount ?? 0;
        
        // 직접 측정 점수가 없으면 AI 응답 데이터에서 간접 추정 (정규화 퍼지 매칭)
        let estimatedScore = directScore;
        let estimatedMentionCount = directMentionCount;
        
        if (directScore === 0 && totalResponses > 0) {
          const matchingCount = this.countFuzzyMentions(
            c.competitorName,
            c.competitorRegion,
            competitorMentionCounts,
          );
          
          if (matchingCount > 0) {
            estimatedMentionCount = matchingCount;
            // 언급률 기반 점수 (allResponsesCount 기준)
            const mentionRate = matchingCount / (allResponsesCount || totalResponses);
            estimatedScore = Math.min(100, Math.round(mentionRate * 100 * 1.5));
          }
        }
        
        return {
          id: c.id,
          name: c.competitorName,
          score: estimatedScore,
          mentionCount: estimatedMentionCount,
          isAutoDetected: c.isAutoDetected,
          isEstimated: directScore === 0 && estimatedScore > 0,
        };
      })
      // 점수 높은 순 정렬
      .sort((a, b) => b.score - a.score),
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
