import { Injectable, NotFoundException, ConflictException, ForbiddenException, Logger } from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';
import { hospitalResponseStats, hospitalCompetitorMentions } from '../common/stats/response-daily';
import { CacheService } from '../common/cache/cache.service';
import { CreateCompetitorDto } from './dto/create-competitor.dto';
import { PlanGuard } from '../common/guards/plan.guard';

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
  constructor(private prisma: PrismaService, private cache: CacheService) {}

  // ===== 한국어 치과명 정규화 및 유사도 매칭 =====

  /**
   * 치과명 정규화 - 지역명 접두사, 공백, 접미사 통일
   * 예: "천안 우리가족 치과의원" → "우리가족치과"
   *     "우리가족치과의원" → "우리가족치과"
   */
  private normalizeDentalName(name: string): string {
    // 【P1-2】 방어: DB에 과거 유입된 null/빈값이나 비문자열이 들어와도 500 대신 빈 문자열 처리
    if (typeof name !== 'string') return '';
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
  async create(hospitalId: string, dto: CreateCompetitorDto) {
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
        const restored = await this.prisma.competitor.update({
          where: { id: duplicate.id },
          data: { isActive: true },
        });
        await this.cache.invalidateHospital(hospitalId);
        return restored;
      }
      throw new ConflictException(
        `이미 유사한 경쟁사가 등록되어 있습니다: ${duplicate.competitorName}`,
      );
    }

    const created = await this.prisma.competitor.create({
      data: {
        hospitalId,
        competitorName: dto.competitorName,
        competitorRegion: dto.competitorRegion,
        isAutoDetected: false,
        isActive: true,
      },
    });
    await this.cache.invalidateHospital(hospitalId);
    return created;
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
   * 우리 병원에서 실제 측정한 동일 AI 답변을 분모로 쓰는 등장률 순위.
   * 경쟁 병원명은 등록 후에만 검증/기록되므로 마지막 등록·복구 이후의
   * 공통 응답 창을 사용한다. 이 수치는 의료 품질이나 전체 지역 순위가 아니다.
   */
  async getAnswerRanking(hospitalId: string) {
    const [hospital, competitors] = await Promise.all([
      this.prisma.hospital.findUnique({
        where: { id: hospitalId },
        select: { id: true, name: true },
      }),
      this.prisma.competitor.findMany({
        where: { hospitalId, isActive: true },
        select: { id: true, competitorName: true, competitorRegion: true, createdAt: true, updatedAt: true },
      }),
    ]);

    if (!hospital) throw new NotFoundException('병원을 찾을 수 없습니다');

    const periodStart = new Date();
    periodStart.setUTCHours(0, 0, 0, 0);
    periodStart.setUTCDate(periodStart.getUTCDate() - 29);
    const latestActivation = competitors.reduce<Date | null>((latest, competitor) => {
      const activation = competitor.updatedAt > competitor.createdAt
        ? competitor.updatedAt : competitor.createdAt;
      return !latest || activation > latest ? activation : latest;
    }, null);
    const windowStart = latestActivation && latestActivation > periodStart
      ? latestActivation : periodStart;

    // 원문(responseText)과 LLM 원가는 절대 가져오지 않는다. 병원 소유 데이터만 조회한다.
    const responses = await this.prisma.aIResponse.findMany({
      where: {
        hospitalId,
        responseDate: { gte: periodStart },
        createdAt: { gte: windowStart },
        isVerified: true,
      },
      select: { isMentioned: true, competitorsMentioned: true },
    });

    const totalResponses = responses.length;
    const competitorKeys = competitors.map((competitor) => new Set([
      this.normalizeDentalName(competitor.competitorName).toLocaleLowerCase(),
      this.normalizeDentalName(`${competitor.competitorRegion || ''}${competitor.competitorName}`).toLocaleLowerCase(),
    ].filter((key) => key.length >= 2 && key !== '치과')));
    const competitorCounts = competitors.map(() => 0);
    let myMentionCount = 0;
    for (const response of responses) {
      if (response.isMentioned) myMentionCount++;
      const matched = new Set<number>();
      for (const name of response.competitorsMentioned || []) {
        const normalized = this.normalizeDentalName(name).toLocaleLowerCase();
        if (normalized.length < 2 || normalized === '치과') continue;

        // 표기가 정확히 일치하는 등록 병원을 우선한다. 지역 접두사 등 표기 변형은
        // 기존 경쟁사 비교의 유사명 규칙으로 보완하되, 여러 병원에 걸치면 추측하지 않는다.
        const exactIndex = competitorKeys.findIndex((keys) => keys.has(normalized));
        if (exactIndex >= 0) {
          matched.add(exactIndex);
          continue;
        }
        const fuzzy = competitors.map((competitor, index) => ({
          index,
          specificity: Math.max(0, ...Array.from(competitorKeys[index], (key) => key.length)),
          matches: this.isSameDentalClinic(competitor.competitorName, name)
            || (!!competitor.competitorRegion && this.isSameDentalClinic(`${competitor.competitorRegion}${competitor.competitorName}`, name)),
        })).filter((candidate) => candidate.matches);
        const specificity = Math.max(0, ...fuzzy.map((candidate) => candidate.specificity));
        const best = fuzzy.filter((candidate) => candidate.specificity === specificity);
        if (best.length === 1) matched.add(best[0].index);
      }
      matched.forEach((index) => { competitorCounts[index]++; });
    }
    const rate = (count: number) => totalResponses > 0
      ? Math.round((count / totalResponses) * 1000) / 10 : 0;
    const matchedCompetitors = competitors.map((competitor, index) => {
      // 별칭을 한 답변에서 여러 번 추출해도 해당 병원은 답변당 한 번만 센다.
      const mentionCount = competitorCounts[index];
      return {
        id: competitor.id,
        name: competitor.competitorName,
        mentionCount,
        mentionRate: rate(mentionCount),
        rank: null as number | null,
        addedAt: (competitor.updatedAt > competitor.createdAt
          ? competitor.updatedAt : competitor.createdAt).toISOString(),
      };
    });
    const myHospital = {
      id: hospital.id,
      name: hospital.name,
      mentionCount: myMentionCount,
      mentionRate: rate(myMentionCount),
      rank: null as number | null,
    };
    const all = [myHospital, ...matchedCompetitors];
    const hasEvidence = all.some((clinic) => clinic.mentionCount > 0);
    if (competitors.length > 0 && totalResponses > 0 && hasEvidence) {
      for (const clinic of all) {
        clinic.rank = 1 + all.filter((other) => other.mentionCount > clinic.mentionCount).length;
      }
    }
    matchedCompetitors.sort((a, b) =>
      b.mentionCount - a.mentionCount || a.name.localeCompare(b.name, 'ko'),
    );

    const status = competitors.length === 0 ? 'NO_COMPETITORS'
      : totalResponses === 0 ? 'NO_DATA'
      : !hasEvidence ? 'NO_MENTIONS'
      : totalResponses < 30 ? 'LOW_SAMPLE' : 'READY';

    return {
      periodDays: 30,
      windowStart: windowStart.toISOString(),
      totalResponses,
      minRecommendedResponses: 30,
      pendingMeasurement: status === 'NO_DATA' && !!latestActivation && latestActivation > periodStart,
      status,
      metric: 'ANSWER_MENTION_RATE',
      rank: myHospital.rank,
      totalClinics: all.length,
      myHospital,
      competitors: matchedCompetitors,
      note: '우리 병원 모니터 질문의 동일한 AI 답변에서 병원명이 등장한 비율입니다. 의료 품질이나 지역 전체 병원 순위가 아닙니다.',
    };
  }

  /**
   * 비활성(삭제된) 경쟁사 목록 조회
   */
  async findInactive(hospitalId: string) {
    return this.prisma.competitor.findMany({
      where: { hospitalId, isActive: false },
      orderBy: { createdAt: 'asc' },
    });
  }

  private async remainingCompetitorSlots(hospitalId: string): Promise<number> {
    const hospital = await this.prisma.hospital.findUnique({
      where: { id: hospitalId },
      select: {
        planType: true,
        _count: { select: { competitors: { where: { isActive: true } } } },
      },
    });
    if (!hospital) throw new NotFoundException('병원을 찾을 수 없습니다');
    const limit = PlanGuard.PLAN_LIMITS[hospital.planType].maxCompetitors;
    return limit === -1 ? -1 : Math.max(0, limit - hospital._count.competitors);
  }

  /**
   * 비활성 경쟁사 전체 복구
   */
  async restoreAll(hospitalId: string) {
    const remaining = await this.remainingCompetitorSlots(hospitalId);
    const inactive = await this.prisma.competitor.findMany({
      where: { hospitalId, isActive: false },
      select: { id: true },
      orderBy: { createdAt: 'asc' },
      ...(remaining === -1 ? {} : { take: remaining }),
    });
    if (inactive.length === 0) return { restored: 0 };
    const result = await this.prisma.competitor.updateMany({
      where: { hospitalId, isActive: false, id: { in: inactive.map((c) => c.id) } },
      data: { isActive: true },
    });
    await this.cache.invalidateHospital(hospitalId);
    this.logger.log(`[경쟁사 복구] hospitalId=${hospitalId}, 복구된 수: ${result.count}`);
    return { restored: result.count };
  }

  /**
   * 특정 비활성 경쟁사 복구
   */
  async restoreOne(competitorId: string, hospitalId: string) {
    const competitor = await this.prisma.competitor.findUnique({
      where: { id: competitorId },
    });
    if (!competitor || competitor.hospitalId !== hospitalId) {
      throw new NotFoundException('경쟁사를 찾을 수 없습니다');
    }
    if (competitor.isActive) return competitor;
    if (await this.remainingCompetitorSlots(hospitalId) === 0) {
      throw new ForbiddenException({ error: 'PLAN_LIMIT_REACHED', message: '현재 플랜의 경쟁 병원 한도에 도달했습니다.' });
    }
    const restored = await this.prisma.competitor.update({
      where: { id: competitorId },
      data: { isActive: true },
    });
    await this.cache.invalidateHospital(hospitalId);
    return restored;
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
    await this.cache.invalidateHospital(hospitalId);

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
    dto: CreateCompetitorDto,
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
        const restored = await this.prisma.competitor.update({
          where: { id: duplicate.id },
          data: { isActive: true },
        });
        await this.cache.invalidateHospital(hospitalId);
        return restored;
      }
      return duplicate;
    }

    const created = await this.prisma.competitor.create({
      data: {
        hospitalId,
        competitorName: dto.competitorName,
        competitorRegion: dto.competitorRegion,
        isAutoDetected: true,  // AI 제안으로 추가됨
        isActive: true,
      },
    });
    await this.cache.invalidateHospital(hospitalId);
    return created;
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
    // 【2026-09-15】원본 30일 스캔(대형 병원 6만 행 → 30초+) 대신 mention_daily/response_daily 집계 + 최근 2일 실시간
    const [competitorMentionCounts, stats30] = await Promise.all([
      hospitalCompetitorMentions(this.prisma, hospitalId, 30),
      hospitalResponseStats(this.prisma, hospitalId, 30),
    ]);
    const totalResponses = stats30.withCompetitors;

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
        archivedPromptText: true,
        competitorsMentioned: true,
        aiPlatform: true,
        prompt: { select: { promptText: true } },
      },
    });

    // 전체 AI 응답 수 (언급률 계산용)
    const allResponsesCount = stats30.total;

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
        promptText: g.prompt?.promptText ?? g.archivedPromptText ?? '(삭제된 질문)',
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


  // ===== 【2026-09-14】 mention_daily 일별 집계 (전국 등장률의 원천) =====
  /** 하루치 재집계: 그날 응답의 언급 병원명 × 질문 병원 × 플랫폼 건수 + 전체 응답 수('*'). 멱등(해당일 삭제 후 삽입). */
  async rebuildMentionDay(day: string): Promise<{ day: string; rows: number }> {
    const d = new Date(day + 'T00:00:00Z');
    const next = new Date(d); next.setUTCDate(next.getUTCDate() + 1);
    await this.prisma.$executeRaw`DELETE FROM mention_daily WHERE day = ${d}::date`;
    // 같은 키가 한 INSERT 안에 여러 번 나오면 ON CONFLICT DO UPDATE 가 실패하므로(“cannot affect row a second time”) SELECT 단계에서 미리 GROUP BY 한다.
    const r1: number = await this.prisma.$executeRaw`
      INSERT INTO mention_daily (day, hospital_id, name, platform, cnt)
      SELECT ${d}::date, x.hospital_id, x.name, x.platform, COUNT(*)::int
      FROM (
        SELECT r.hospital_id, unnest(r.competitors_mentioned) AS name, r.ai_platform::text AS platform
        FROM ai_responses r
        WHERE r.response_date >= ${d} AND r.response_date < ${next}
          AND r.competitors_mentioned IS NOT NULL AND array_length(r.competitors_mentioned, 1) > 0
      ) x
      GROUP BY x.hospital_id, x.name, x.platform
      ON CONFLICT (day, hospital_id, name, platform) DO UPDATE SET cnt = EXCLUDED.cnt`;
    const r2: number = await this.prisma.$executeRaw`
      INSERT INTO mention_daily (day, hospital_id, name, platform, cnt)
      SELECT ${d}::date, r.hospital_id, '*', r.ai_platform::text, COUNT(*)::int
      FROM ai_responses r WHERE r.response_date >= ${d} AND r.response_date < ${next}
      GROUP BY r.hospital_id, r.ai_platform
      ON CONFLICT (day, hospital_id, name, platform) DO UPDATE SET cnt = EXCLUDED.cnt`;
    // 【2026-09-15】response_daily — 대시보드 통계(언급률·감성)용 병원×플랫폼 일별 집계
    let r3 = 0;
    try {
      await this.prisma.$executeRaw`DELETE FROM response_daily WHERE day = ${d}::date`;
      r3 = await this.prisma.$executeRaw`
        INSERT INTO response_daily (day, hospital_id, platform, total, mentioned, with_comp, pos, neu, neg, ment_pos, ment_neg, ment_labeled)
        SELECT ${d}::date, r.hospital_id, r.ai_platform::text, COUNT(*)::int,
               COUNT(*) FILTER (WHERE r.is_mentioned)::int,
               COUNT(*) FILTER (WHERE array_length(r.competitors_mentioned, 1) > 0)::int,
               COUNT(*) FILTER (WHERE r.sentiment_label = 'POSITIVE')::int,
               COUNT(*) FILTER (WHERE r.sentiment_label = 'NEUTRAL')::int,
               COUNT(*) FILTER (WHERE r.sentiment_label = 'NEGATIVE')::int,
               COUNT(*) FILTER (WHERE r.is_mentioned AND r.sentiment_label = 'POSITIVE')::int,
               COUNT(*) FILTER (WHERE r.is_mentioned AND r.sentiment_label = 'NEGATIVE')::int,
               COUNT(*) FILTER (WHERE r.is_mentioned AND r.sentiment_label IS NOT NULL)::int
        FROM ai_responses r WHERE r.response_date >= ${d} AND r.response_date < ${next}
        GROUP BY r.hospital_id, r.ai_platform
        ON CONFLICT (day, hospital_id, platform) DO UPDATE SET
          total = EXCLUDED.total, mentioned = EXCLUDED.mentioned, with_comp = EXCLUDED.with_comp,
          pos = EXCLUDED.pos, neu = EXCLUDED.neu, neg = EXCLUDED.neg,
          ment_pos = EXCLUDED.ment_pos, ment_neg = EXCLUDED.ment_neg, ment_labeled = EXCLUDED.ment_labeled`;
    } catch (e) {
      this.logger.warn(`response_daily rebuild ${day} 실패(대시보드는 실시간 폴백): ${(e as Error).message}`);
    }
    return { day, rows: Number(r1) + Number(r2) + Number(r3) };
  }
  /** 최근 N일 재집계 (오래된 날부터). 크론은 2일(어제·오늘), 최초 1회는 120일 백필. */
  async rebuildMentionRange(days: number): Promise<{ days: number; rows: number; from: string; to: string; errors: string[] }> {
    const n = Math.max(1, Math.min(400, days));
    const today = new Date(); today.setUTCHours(0, 0, 0, 0);
    let rows = 0; let from = ''; const errors: string[] = [];
    for (let i = n - 1; i >= 0; i--) {
      const d = new Date(today); d.setUTCDate(d.getUTCDate() - i);
      const key = d.toISOString().slice(0, 10); if (!from) from = key;
      try { rows += (await this.rebuildMentionDay(key)).rows; } catch (e) { const msg = (e as Error).message; this.logger.warn(`mention_daily rebuild ${key} 실패: ${msg}`); if (errors.length < 3) errors.push(`${key}: ${msg.slice(0, 160)}`); }
    }
    return { days: n, rows, from, to: today.toISOString().slice(0, 10), errors };
  }


  /** 【2026-09-14】등장률 캐시 워밍 — 집계 갱신 직후 자주 보는 조합을 HTTP 캐시 키에 미리 채워 첫 화면도 즉시 뜨게 (키 형식은 HttpCacheInterceptor 와 동일) */
  async warmTrendingCache(): Promise<{ warmed: string[]; ms: number }> {
    const started = Date.now();
    const rows = await this.prisma.hospital.groupBy({ by: ['specialtyType'], where: { subscriptionStatus: 'ACTIVE' }, _count: { _all: true } }).catch(() => [] as any[]);
    const specialties = (rows as any[]).filter((r) => r._count._all >= 2).map((r) => String(r.specialtyType));
    const warmed: string[] = [];
    for (const sp of specialties) for (const days of [30, 90]) {
      try {
        const data = await this.getTrending({ specialty: sp, days, limit: 50, sort: 'rate' });
        const key = `ps:http:/api/competitors/trending?specialty=${sp}&days=${days}&limit=50&sort=rate`;
        await this.cache.set(key, data, 26 * 3600);
        warmed.push(`${sp}/${days}`);
      } catch (e) { this.logger.warn(`trending warm ${sp}/${days} 실패: ${(e as Error).message}`); }
    }
    return { warmed, ms: Date.now() - started };
  }

  // ===== 【2026-09-14】 요즘 AI가 좋아하는 병원 — 전국 언급 리더보드 =====
  /**
   * 모든 고객 병원의 AI 응답에 등장한 병원명(competitors_mentioned)을 진료과·기간 단위로 합산한다.
   * "내 경쟁사"가 아니어도 AI가 전국적으로 자주 추천하는 병원을 볼 수 있다.
   *  - 표기 정규화(공백·지역 접두·접미사)로 같은 병원을 합침
   *  - 접미사만 남는 일반명(치과의원·병원 등)은 제외
   *  - 직전 같은 기간과 비교해 증감, 우리 고객 병원이면 표시
   */
  async getTrending(opts: { specialty?: string; sido?: string; days: number; limit: number; sort?: string }) {
    const days = Math.max(7, Math.min(180, opts.days || 30));
    const limit = Math.max(10, Math.min(200, opts.limit || 50));
    const since = new Date(); since.setDate(since.getDate() - days);
    const prevSince = new Date(since); prevSince.setDate(prevSince.getDate() - days);
    const specialty = opts.specialty && /^[A-Z_]+$/.test(opts.specialty) ? opts.specialty : null;
    const sido = opts.sido ? String(opts.sido).trim().slice(0, 20) : null;

    // 병원명 × 질문한 병원 단위로 집계 → 질문량이 많은 병원(예: 프롬프트 300개짜리)이 순위를 지배하지 않게
    // "평균 등장률" = 각 질문 병원의 응답 중 이 병원명이 나온 비율을 구해 질문 병원 수로 평균 (질문 병원마다 가중치 동일)
    type Row = { name: string; hospital_id: string; mentions: number; top_platform: string | null; region_sido: string | null };
    type Tot = { hospital_id: string; total: number };
    // 읽기 경로: mention_daily 집계 테이블(매일 10:00 KST 갱신). 집계가 비어 있으면(백필 전) 원본 실시간 쿼리로 폴백.
    const aggQuery = (from: Date, to: Date | null) => this.prisma.$queryRaw<Row[]>`
      SELECT m.name, m.hospital_id, SUM(m.cnt)::int AS mentions,
             (array_agg(m.platform ORDER BY m.cnt DESC))[1] AS top_platform, MAX(h.region_sido) AS region_sido
      FROM mention_daily m JOIN hospitals h ON h.id = m.hospital_id
      WHERE m.day >= ${from}::date AND (${to}::date IS NULL OR m.day < ${to}::date) AND m.name <> '*'
        AND (${specialty}::text IS NULL OR h.specialty_type::text = ${specialty})
        AND (${sido}::text IS NULL OR h.region_sido = ${sido})
      GROUP BY m.name, m.hospital_id ORDER BY mentions DESC LIMIT 20000`;
    const aggTotals = (from: Date, to: Date | null) => this.prisma.$queryRaw<Tot[]>`
      SELECT m.hospital_id, SUM(m.cnt)::int AS total
      FROM mention_daily m JOIN hospitals h ON h.id = m.hospital_id
      WHERE m.day >= ${from}::date AND (${to}::date IS NULL OR m.day < ${to}::date) AND m.name = '*'
        AND (${specialty}::text IS NULL OR h.specialty_type::text = ${specialty})
        AND (${sido}::text IS NULL OR h.region_sido = ${sido})
      GROUP BY m.hospital_id`;
    const liveQuery = (from: Date, to: Date | null) => this.prisma.$queryRaw<Row[]>`
      WITH cur AS (
        SELECT unnest(r.competitors_mentioned) AS name, r.ai_platform::text AS ai_platform, h.region_sido, r.hospital_id
        FROM ai_responses r JOIN hospitals h ON h.id = r.hospital_id
        WHERE r.response_date >= ${from}
          AND (${to}::timestamp IS NULL OR r.response_date < ${to})
          AND (${specialty}::text IS NULL OR h.specialty_type::text = ${specialty})
          AND (${sido}::text IS NULL OR h.region_sido = ${sido})
          AND r.competitors_mentioned IS NOT NULL AND array_length(r.competitors_mentioned, 1) > 0
      )
      SELECT name, hospital_id, COUNT(*)::int AS mentions,
             MODE() WITHIN GROUP (ORDER BY ai_platform) AS top_platform, MAX(region_sido) AS region_sido
      FROM cur GROUP BY name, hospital_id ORDER BY mentions DESC LIMIT 20000`;
    const liveTotals = (from: Date, to: Date | null) => this.prisma.$queryRaw<Tot[]>`
      SELECT r.hospital_id, COUNT(*)::int AS total
      FROM ai_responses r JOIN hospitals h ON h.id = r.hospital_id
      WHERE r.response_date >= ${from}
        AND (${to}::timestamp IS NULL OR r.response_date < ${to})
        AND (${specialty}::text IS NULL OR h.specialty_type::text = ${specialty})
        AND (${sido}::text IS NULL OR h.region_sido = ${sido})
      GROUP BY r.hospital_id`;
    let source: 'aggregate' | 'live' = 'aggregate';
    let curTotPre = await aggTotals(since, null).catch(() => [] as Tot[]);
    let query = aggQuery, totals = aggTotals;
    if (!curTotPre.length) { source = 'live'; query = liveQuery; totals = liveTotals; }
    const [curRows, prevRows, curTot, prevTot, customers] = await Promise.all([
      query(since, null), query(prevSince, since), source === 'aggregate' ? Promise.resolve(curTotPre) : totals(since, null), totals(prevSince, since),
      this.prisma.hospital.findMany({ where: { subscriptionStatus: 'ACTIVE' }, select: { id: true, name: true, nameAliases: true, regionSido: true, regionSigungu: true } }),
    ]);

    const GENERIC = new Set(['치과', '치과의원', '치과병원', '병원', '의원', '한의원', '한방병원', '피부과', '성형외과', '정형외과', '안과', '내과', '이비인후과', '산부인과', '소아과', '클리닉', '센터', '대학병원', '종합병원']);
    // 진료 종류 자체가 이름인 것(소아치과·교정치과·임플란트치과 …)은 특정 병원이 아니라 카테고리 → 제외
    const CATEGORY_CORE = /^(소아|교정|치과교정|임플란트|구강외과|보철|치주|심미|통합|일반|네트워크|전문|동네|근처|주변|추천|유명|24시|야간|치과교정과|구강내과|턱관절|사랑니|소아청소년|미용|성형)(치과|한의원|병원|의원)?$/;
    const norm = (n: string) => {
      const x = this.normalizeDentalName(n).replace(/(의원|병원|클리닉|센터)$/, '');
      return x;
    };
    const isCategory = (raw: string) => CATEGORY_CORE.test(raw.replace(/\s+/g, '')) || CATEGORY_CORE.test(norm(raw));
    type Agg = { name: string; mentions: number; perHospital: Map<string, number>; platforms: Map<string, number>; sidos: Map<string, number>; variants: Set<string>; _top: number };
    const merge = (rows: Row[]) => {
      const m = new Map<string, Agg>();
      for (const r of rows) {
        const raw = String(r.name || '').trim();
        if (raw.length < 2) continue;
        const key = norm(raw);
        if (!key || key.length < 2 || GENERIC.has(raw.replace(/\s+/g, '')) || GENERIC.has(key) || isCategory(raw)) continue;
        let cur = m.get(key);
        if (!cur) { cur = { name: raw, mentions: 0, perHospital: new Map(), platforms: new Map(), sidos: new Map(), variants: new Set(), _top: 0 }; m.set(key, cur); }
        cur.mentions += r.mentions;
        cur.perHospital.set(r.hospital_id, (cur.perHospital.get(r.hospital_id) || 0) + r.mentions);
        if (r.top_platform) cur.platforms.set(r.top_platform, (cur.platforms.get(r.top_platform) || 0) + r.mentions);
        if (r.region_sido) cur.sidos.set(r.region_sido, (cur.sidos.get(r.region_sido) || 0) + r.mentions);
        cur.variants.add(raw);
        if (r.mentions > cur._top) { cur._top = r.mentions; cur.name = raw; }
      }
      return m;
    };
    const cur = merge(curRows), prev = merge(prevRows);
    // 표본 규칙: 응답이 MIN_TOTAL 건 미만인 질문 병원은 분모·분자에서 제외(2건짜리 병원의 1건 언급이 50%로 튀는 것 방지)
    const MIN_TOTAL = 30, MIN_MENTIONS = 5, MIN_ASKED = 2;
    const totCur = new Map(curTot.filter((t) => t.total >= MIN_TOTAL).map((t) => [t.hospital_id, t.total]));
    const totPrev = new Map(prevTot.filter((t) => t.total >= MIN_TOTAL).map((t) => [t.hospital_id, t.total]));
    for (const agg of [...cur.values(), ...prev.values()]) {
      for (const hid of [...agg.perHospital.keys()]) if (!totCur.has(hid) && !totPrev.has(hid)) agg.perHospital.delete(hid);
    }
    const askingCur = totCur.size || 1, askingPrev = totPrev.size || 1;
    const allCur = [...totCur.values()].reduce((a, b) => a + b, 0), allPrev = [...totPrev.values()].reduce((a, b) => a + b, 0);
    // 평균 등장률(%) = Σ_h (이 병원명이 나온 h의 응답 수 / h의 전체 응답 수) / 질문 병원 수
    const meanRate = (agg: Agg, tot: Map<string, number>, asking: number) => {
      let sum = 0; for (const [hid, n] of agg.perHospital) { const t = tot.get(hid) || 0; if (t > 0) sum += Math.min(1, n / t); }
      return (sum / asking) * 100;
    };
    const topOf = (mm: Map<string, number>) => { let best: string | null = null, bv = -1; for (const [k, v] of mm) if (v > bv) { bv = v; best = k; } return best; };
    const customerKeys = new Map<string, { id: string; name: string; sido: string; sigungu: string }>();
    for (const c of customers) for (const n of [c.name, ...(c.nameAliases || [])]) { const k = norm(n); if (k) customerKeys.set(k, { id: c.id, name: c.name, sido: c.regionSido, sigungu: c.regionSigungu }); }

    const totalMentions = [...cur.values()].reduce((a, b) => a + b.mentions, 0);
    // 정렬: rate(평균 등장률, 기본) · mentions(언급 수) · hospitals(물어본 병원 수)
    const sortKey = opts.sort === 'mentions' ? 'mentions' : opts.sort === 'hospitals' ? 'hospitals' : 'rate';
    const scored = [...cur.entries()]
      .filter(([, v]) => v.mentions >= MIN_MENTIONS && v.perHospital.size >= MIN_ASKED)
      .map(([key, v]) => ({ key, v, rate: meanRate(v, totCur, askingCur) }));
    scored.sort((a, b) => sortKey === 'rate' ? (b.rate - a.rate) || (b.v.mentions - a.v.mentions)
      : sortKey === 'hospitals' ? (b.v.perHospital.size - a.v.perHospital.size) || (b.v.mentions - a.v.mentions)
      : b.v.mentions - a.v.mentions);
    const list = scored.slice(0, limit).map(({ key, v, rate }, i) => {
      const p = prev.get(key);
      const prevRate = p ? meanRate(p, totPrev, askingPrev) : null;
      const customer = customerKeys.get(key);
      return {
        rank: i + 1, name: v.name, mentions: v.mentions,
        rate: Math.round(rate * 100) / 100,                                   // 평균 등장률 %
        share: allCur ? Math.round(v.mentions / allCur * 1000) / 10 : 0,     // 전체 응답 중 등장 비율 %
        prevMentions: p ? p.mentions : 0, prevRate: prevRate === null ? null : Math.round(prevRate * 100) / 100,
        deltaRate: prevRate === null ? null : Math.round((rate - prevRate) * 100) / 100,
        deltaPct: p && p.mentions > 0 ? Math.round((v.mentions - p.mentions) / p.mentions * 100) : (p ? 0 : null),
        askedBy: v.perHospital.size, platforms: v.platforms.size, topPlatform: topOf(v.platforms), topSido: topOf(v.sidos),
        variants: [...v.variants].slice(0, 4), isCustomer: !!customer, customerRegion: customer ? `${customer.sido} ${customer.sigungu}` : null,
      };
    });
    // 새로 뜬 병원: 직전 기간 없음 + 이번 기간 상위
    const risers = list.filter((x) => x.prevMentions === 0 && x.mentions >= 5).slice(0, 10);
    const askingHospitals = askingCur, responsesTotal = allCur;
    return {
      period: { days, since: since.toISOString().slice(0, 10), until: new Date().toISOString().slice(0, 10) },
      filters: { specialty, sido, sort: sortKey }, source, totalNames: cur.size, totalMentions, askingHospitals, responsesTotal,
      list, risers,
      method: '전 고객 병원의 AI 응답에서 언급된 병원명을 합산한 관찰 통계(표기 정규화·일반명 제외, 응답 30건 미만 병원과 언급 5건·2곳 미만 병원명 제외). 등장률 = 질문한 병원마다 "그 병원 응답 중 이 병원명이 나온 비율"을 구해 질문 병원 수로 평균 — 질문량이 많은 병원 하나가 순위를 좌우하지 않게 한 지표. 우리 고객은 배지로 표시.',
    };
  }

}
