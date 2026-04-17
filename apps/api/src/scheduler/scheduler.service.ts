import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';
import { AICrawlerService } from '../ai-crawler/ai-crawler.service';
import { PlanGuard } from '../common/guards/plan.guard';
import { SPECIALTY_PROCEDURES, SPECIALTY_NAMES } from '../query-templates/query-templates.service';
import {
  generateMatrixCandidates,
  selectDailyPrompts,
  applyPerformanceBoost,
  getMatrixStats,
  MatrixCandidate,
  PerformanceData,
  IntentType,
} from './daily-prompt-matrix';

@Injectable()
export class SchedulerService {
  private readonly logger = new Logger(SchedulerService.name);

  constructor(
    private prisma: PrismaService,
    private aiCrawlerService: AICrawlerService,
  ) {}

  /**
   * 모든 활성 병원에 대해 크롤링 실행
   * 하루 1회 실행: 오전 9시 (KST)
   * Render Cron Job에서 호출됨
   */
  async runDailyCrawling(options?: {
    session?: 'morning' | 'afternoon' | 'evening';
    includeCompetitors?: boolean;
    includeContentGap?: boolean;
  }): Promise<{
    totalHospitals: number;
    successCount: number;
    failCount: number;
    session: string;
    results: any[];
  }> {
    const session = options?.session || this.getCurrentSession();
    const includeCompetitors = options?.includeCompetitors ?? (session === 'evening');
    const includeContentGap = options?.includeContentGap ?? (session === 'evening');
    
    this.logger.log(`=== 자동 크롤링 시작 (세션: ${session}) ===`);
    this.logger.log(`옵션: 경쟁사분석=${includeCompetitors}, ContentGap=${includeContentGap}`);
    
    // 활성 구독 상태인 병원들 조회 (TRIAL 포함)
    const hospitals = await this.prisma.hospital.findMany({
      where: {
        subscriptionStatus: { in: ['ACTIVE', 'TRIAL'] },
      },
      include: {
        prompts: {
          where: { isActive: true },
        },
        competitors: {
          where: { isActive: true },
        },
      },
    });

    this.logger.log(`크롤링 대상 병원: ${hospitals.length}개`);

    const results: any[] = [];
    let successCount = 0;
    let failCount = 0;

    for (const hospital of hospitals) {
      if (hospital.prompts.length === 0) {
        this.logger.log(`[${hospital.name}] 활성 프롬프트 없음 - 스킵`);
        continue;
      }

      try {
        this.logger.log(`[${hospital.name}] 크롤링 시작 (프롬프트 ${hospital.prompts.length}개)`);
        
        // 크롤링 작업 생성
        const crawlJob = await this.prisma.crawlJob.create({
          data: {
            hospitalId: hospital.id,
            status: 'RUNNING',
            totalPrompts: hospital.prompts.length,
            startedAt: new Date(),
          },
        });

        let completed = 0;
        let failed = 0;

        // 플랜별 플랫폼 제한 적용
        const planLimits = PlanGuard.PLAN_LIMITS[hospital.planType] || PlanGuard.PLAN_LIMITS.FREE;
        const sessionPlatforms = this.getPlatformsForSession(session);
        // 플랜 허용 플랫폼과 세션 플랫폼의 교집합
        const platforms = sessionPlatforms.filter((p: string) => planLimits.platforms.includes(p));
        
        this.logger.log(`[${hospital.name}] 플랜: ${hospital.planType}, 플랫폼: ${platforms.join(', ')}`);

        // 월간 크롤링 횟수 체크
        if (planLimits.crawlsPerMonth !== -1) {
          const now = new Date();
          const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
          const crawlCount = await this.prisma.crawlJob.count({
            where: {
              hospitalId: hospital.id,
              startedAt: { gte: monthStart },
              status: { in: ['COMPLETED', 'RUNNING'] },
            },
          });
          if (crawlCount >= planLimits.crawlsPerMonth) {
            this.logger.log(`[${hospital.name}] 월간 크롤링 한도 초과 (${crawlCount}/${planLimits.crawlsPerMonth}) - 스킵`);
            continue;
          }
        }

        for (const prompt of hospital.prompts) {
          try {
            const crawlResults = await this.aiCrawlerService.queryAllPlatforms(
              prompt.id,
              hospital.id,
              hospital.name,
              prompt.promptText,
              platforms,
            );
            
            if (crawlResults.length > 0) {
              completed++;
            } else {
              failed++;
            }
          } catch (error) {
            failed++;
            this.logger.error(`[${hospital.name}] 프롬프트 실패: ${error.message}`);
          }
        }

        // crawlJob 업데이트
        await this.prisma.crawlJob.update({
          where: { id: crawlJob.id },
          data: { completed, failed },
        });

        // 작업 완료 처리
        await this.prisma.crawlJob.update({
          where: { id: crawlJob.id },
          data: {
            status: failed === hospital.prompts.length ? 'FAILED' : 'COMPLETED',
            completedAt: new Date(),
          },
        });

        // 점수 계산
        const score = await this.aiCrawlerService.calculateDailyScore(hospital.id);

        const hospitalResult: any = {
          hospitalId: hospital.id,
          hospitalName: hospital.name,
          promptCount: hospital.prompts.length,
          completed,
          failed,
          score,
          session,
        };

        // 저녁 세션에서 경쟁사 AEO 측정 (플랜 체크)
        if (includeCompetitors && hospital.competitors.length > 0 && planLimits.competitorAEO) {
          const maxCompetitors = planLimits.maxCompetitors === -1 ? 5 : Math.min(planLimits.maxCompetitors, 5);
          this.logger.log(`[${hospital.name}] 경쟁사 AEO 측정 시작 (${hospital.competitors.length}개)`);
          const competitorResults = [];
          
          for (const competitor of hospital.competitors.slice(0, maxCompetitors)) {
            try {
              const competitorScore = await this.aiCrawlerService.measureCompetitorAEO(
                hospital.id,
                competitor.id,
                competitor.competitorName,
              );
              competitorResults.push({
                name: competitor.competitorName,
                ...competitorScore,
              });
            } catch (error) {
              this.logger.error(`[경쟁사] ${competitor.competitorName} 측정 실패: ${error.message}`);
            }
            
            await new Promise(resolve => setTimeout(resolve, 5000));
          }
          
          hospitalResult.competitorScores = competitorResults;
        }

        // 저녁 세션에서 Content Gap 분석 (플랜 체크)
        if (includeContentGap && planLimits.contentGap) {
          try {
            const gaps = await this.aiCrawlerService.generateContentGapGuide(hospital.id);
            hospitalResult.contentGaps = gaps.length;
            this.logger.log(`[${hospital.name}] Content Gap ${gaps.length}개 발견`);
          } catch (error) {
            this.logger.error(`[Content Gap] 분석 실패: ${error.message}`);
          }
        }

        results.push(hospitalResult);
        successCount++;
        this.logger.log(`[${hospital.name}] 크롤링 완료 - 점수: ${score}`);

      } catch (error) {
        failCount++;
        this.logger.error(`[${hospital.name}] 크롤링 실패: ${error.message}`);
        results.push({
          hospitalId: hospital.id,
          hospitalName: hospital.name,
          error: error.message,
        });
      }

      await new Promise(resolve => setTimeout(resolve, 10000));
    }

    this.logger.log(`=== 크롤링 완료 (${session}): 성공 ${successCount}, 실패 ${failCount} ===`);

    return {
      totalHospitals: hospitals.length,
      successCount,
      failCount,
      session,
      results,
    };
  }

  private getCurrentSession(): 'morning' | 'afternoon' | 'evening' {
    const kstHour = new Date().getUTCHours() + 9;
    const adjustedHour = kstHour >= 24 ? kstHour - 24 : kstHour;
    
    if (adjustedHour < 12) return 'morning';
    if (adjustedHour < 17) return 'afternoon';
    return 'evening';
  }

  private getPlatformsForSession(session: string): any[] {
    const basePlatforms: any[] = ['CHATGPT', 'CLAUDE', 'PERPLEXITY', 'GEMINI'];
    
    switch (session) {
      case 'morning':
        return basePlatforms;
      case 'afternoon':
        return ['CHATGPT', 'GEMINI'];
      case 'evening':
        return basePlatforms;
      default:
        return basePlatforms;
    }
  }

  // ==================== V3: Daily Prompt Matrix Engine ====================

  /**
   * 매일 자동 프롬프트 생성 (5×5 병원 범용 매트릭스)
   * 
   * V3 전략:
   * 1. 5축 매트릭스로 수백 개 후보 생성 (의도×시술×톤×시즌×지역)
   * 2. ABHS 성과 데이터 기반 가중치 부스팅
   * 3. 다양성 보장 선택 (의도별 최소 1개 + 톤 다양성)
   * 4. 기존 질문과 Jaccard 유사도 0.85 이상 중복 제거
   * 5. 모든 진료과(13개) 범용 대응
   */
  async runDailyPromptRefresh(): Promise<{
    totalHospitals: number;
    refreshed: number;
    results: Array<{
      hospitalId: string;
      hospitalName: string;
      added: number;
      replaced: number;
      matrixStats?: any;
    }>;
  }> {
    this.logger.log('=== Daily Prompt Matrix Refresh V3 시작 ===');

    const hospitals = await this.prisma.hospital.findMany({
      where: { subscriptionStatus: { in: ['ACTIVE', 'TRIAL'] } },
      include: {
        prompts: { where: { isActive: true }, select: { id: true, promptText: true, promptType: true } },
      },
    });

    const results: Array<{
      hospitalId: string;
      hospitalName: string;
      added: number;
      replaced: number;
      matrixStats?: any;
    }> = [];
    let refreshed = 0;

    for (const hospital of hospitals) {
      try {
        const result = await this.generateDailyPromptsV3(hospital);
        if (result.added > 0 || result.replaced > 0) {
          refreshed++;
        }
        results.push({
          hospitalId: hospital.id,
          hospitalName: hospital.name,
          ...result,
        });
      } catch (error) {
        this.logger.error(`[${hospital.name}] Daily Prompt V3 생성 실패: ${error.message}`);
        results.push({
          hospitalId: hospital.id,
          hospitalName: hospital.name,
          added: 0,
          replaced: 0,
        });
      }
    }

    this.logger.log(`=== Daily Prompt Matrix Refresh V3 완료: ${refreshed}/${hospitals.length} 병원 갱신 ===`);

    return { totalHospitals: hospitals.length, refreshed, results };
  }

  /**
   * 개별 병원 Daily Prompt V3 — 5×5 매트릭스 엔진
   */
  private async generateDailyPromptsV3(hospital: any): Promise<{
    added: number;
    replaced: number;
    matrixStats?: any;
  }> {
    const planLimits = (PlanGuard.PLAN_LIMITS as Record<string, any>)[hospital.planType] || PlanGuard.PLAN_LIMITS.FREE;
    const maxPrompts = planLimits.maxPrompts === -1 ? 100 : planLimits.maxPrompts;

    const existingTexts = new Set<string>(hospital.prompts.map((p: any) => p.promptText));
    const currentCount = hospital.prompts.length;
    const availableSlots = Math.max(0, maxPrompts - currentCount);
    const dailyTarget = Math.min(10, availableSlots);

    if (dailyTarget <= 0) {
      this.logger.log(`[${hospital.name}] 슬롯 없음 (${currentCount}/${maxPrompts})`);
      return { added: 0, replaced: 0 };
    }

    // ── Step 1: 5×5 매트릭스 후보 생성 ──
    const candidates = generateMatrixCandidates({
      name: hospital.name,
      specialtyType: hospital.specialtyType,
      regionSido: hospital.regionSido,
      regionSigungu: hospital.regionSigungu,
      regionDong: hospital.regionDong,
      coreTreatments: hospital.coreTreatments || [],
      keyProcedures: hospital.keyProcedures || [],
      targetRegions: hospital.targetRegions || [],
      hospitalStrengths: hospital.hospitalStrengths || [],
    });

    const stats = getMatrixStats(candidates);
    this.logger.log(`[${hospital.name}] 매트릭스 후보: ${stats.totalCandidates}개 (의도: ${JSON.stringify(stats.byIntent)}, 톤: ${JSON.stringify(stats.byTone)})`);

    // ── Step 2: ABHS 성과 데이터 수집 (최근 30일) ──
    let boostedCandidates: MatrixCandidate[];
    try {
      const performanceData = await this.getPerformanceData(hospital.id);
      boostedCandidates = applyPerformanceBoost(candidates, performanceData);
      this.logger.log(`[${hospital.name}] ABHS 부스트 적용 (고성과 의도: ${performanceData.topIntents.join(',')})`);
    } catch {
      boostedCandidates = candidates;
      this.logger.log(`[${hospital.name}] ABHS 데이터 없음 - 기본 가중치 사용`);
    }

    // ── Step 3: 다양성 보장 선택 ──
    const selected = selectDailyPrompts(boostedCandidates, existingTexts, dailyTarget, true);

    if (selected.length === 0) {
      this.logger.log(`[${hospital.name}] 유효 후보 없음 (모두 중복)`);
      return { added: 0, replaced: 0 };
    }

    // ── Step 4: DB 저장 ──
    await this.prisma.prompt.createMany({
      data: selected.map(s => ({
        hospitalId: hospital.id,
        promptText: s.text,
        promptType: 'AUTO_GENERATED' as const,
        specialtyCategory: s.procedure || hospital.specialtyType,
        regionKeywords: [hospital.regionSido, hospital.regionSigungu].filter(Boolean),
        isActive: true,
      })),
    });

    this.logger.log(`[${hospital.name}] Daily Prompt V3: ${selected.length}개 추가 (의도분포: ${this.summarizeIntents(selected)})`);

    return {
      added: selected.length,
      replaced: 0,
      matrixStats: {
        ...stats,
        selectedCount: selected.length,
        selectedIntents: this.summarizeIntents(selected),
      },
    };
  }

  /**
   * ABHS 성과 데이터 추출 (최근 30일)
   */
  private async getPerformanceData(hospitalId: string): Promise<PerformanceData> {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const responses = await this.prisma.aIResponse.findMany({
      where: {
        hospitalId,
        createdAt: { gte: thirtyDaysAgo },
      },
      select: {
        isMentioned: true,
        queryIntent: true,
        abhsContribution: true,
        prompt: { select: { promptText: true, specialtyCategory: true } },
      },
    });

    if (responses.length === 0) {
      return {
        topIntents: ['RESERVATION', 'REVIEW'],
        topProcedures: [],
        goldenPatterns: [],
        lowPerformanceIntents: ['INFORMATION'],
      };
    }

    // 의도별 SoV 계산
    const intentSoV: Record<string, { mentioned: number; total: number }> = {};
    const procedureSoV: Record<string, { mentioned: number; total: number }> = {};

    for (const r of responses) {
      const intent = r.queryIntent || 'INFORMATION';
      if (!intentSoV[intent]) intentSoV[intent] = { mentioned: 0, total: 0 };
      intentSoV[intent].total++;
      if (r.isMentioned) intentSoV[intent].mentioned++;

      const proc = r.prompt?.specialtyCategory;
      if (proc) {
        if (!procedureSoV[proc]) procedureSoV[proc] = { mentioned: 0, total: 0 };
        procedureSoV[proc].total++;
        if (r.isMentioned) procedureSoV[proc].mentioned++;
      }
    }

    // SoV 순 정렬
    const sortedIntents = Object.entries(intentSoV)
      .map(([intent, data]) => ({ intent, sov: data.total > 0 ? data.mentioned / data.total : 0 }))
      .sort((a, b) => b.sov - a.sov);

    const sortedProcedures = Object.entries(procedureSoV)
      .map(([proc, data]) => ({ proc, sov: data.total > 0 ? data.mentioned / data.total : 0 }))
      .sort((a, b) => b.sov - a.sov);

    // Golden Prompt 패턴 (ABHS 기여도 높은 상위 5개 프롬프트의 키워드)
    const goldenResponses = responses
      .filter(r => r.abhsContribution && r.abhsContribution > 0.5)
      .sort((a, b) => (b.abhsContribution || 0) - (a.abhsContribution || 0))
      .slice(0, 5);

    const goldenPatterns: string[] = [];
    for (const r of goldenResponses) {
      const text = r.prompt?.promptText || '';
      // 키워드 추출 (2~6글자 명사)
      const words = text.split(/\s+/).filter(w => w.length >= 2 && w.length <= 6);
      goldenPatterns.push(...words);
    }

    return {
      topIntents: sortedIntents.slice(0, 2).map(s => s.intent as IntentType),
      topProcedures: sortedProcedures.slice(0, 3).map(s => s.proc),
      goldenPatterns: [...new Set(goldenPatterns)].slice(0, 10),
      lowPerformanceIntents: sortedIntents
        .filter(s => s.sov < 0.3)
        .slice(0, 2)
        .map(s => s.intent as IntentType),
    };
  }

  /**
   * 선택된 프롬프트의 의도 분포 요약
   */
  private summarizeIntents(selected: MatrixCandidate[]): string {
    const counts: Record<string, number> = {};
    for (const s of selected) {
      counts[s.intent] = (counts[s.intent] || 0) + 1;
    }
    return Object.entries(counts).map(([k, v]) => `${k}:${v}`).join(', ');
  }

  // ==================== V2 Legacy: 하위 호환용 (deprecated) ====================

  /**
   * @deprecated V3 매트릭스 엔진으로 대체됨
   */
  private async generateDailyPrompts(hospital: any): Promise<{ added: number; replaced: number }> {
    // V3로 위임
    const result = await this.generateDailyPromptsV3(hospital);
    return { added: result.added, replaced: result.replaced };
  }

  private getSeasonalQuestions(month: number, region: string, specialty: string, treatments: string[]): string[] {
    const q: string[] = [];
    const t0 = treatments[0] || '';

    if (month >= 3 && month <= 5) {
      q.push(`봄에 ${t0 || specialty} 받기 좋은 시기야? ${region} 추천해줘`);
      q.push(`${region} ${specialty} 봄 시즌 이벤트 하는 곳 있어?`);
    } else if (month >= 6 && month <= 8) {
      q.push(`여름에 ${t0 || specialty} 받아도 괜찮을까? ${region} 추천해줘`);
      q.push(`여름 방학 때 ${t0 || '진료'} 받으려면 ${region} 어디가 좋아?`);
    } else if (month >= 9 && month <= 11) {
      q.push(`${region} ${specialty} 가을에 받기 좋은 ${t0 || '시술'} 추천해줘`);
    } else {
      q.push(`연말 전에 ${t0 || '진료'} 받으려면 ${region} 어디가 좋을까?`);
      q.push(`새해 첫 ${specialty} 진료, ${region}에서 추천`);
    }

    const dayOfWeek = new Date().getDay();
    if (dayOfWeek === 0 || dayOfWeek === 6) {
      q.push(`주말에 갈 수 있는 ${region} ${specialty} 알려줘`);
    }

    return q;
  }

  private textSimilarity(a: string, b: string): number {
    const setA = new Set(a.replace(/\s+/g, '').split(''));
    const setB = new Set(b.replace(/\s+/g, '').split(''));
    const intersection = new Set([...setA].filter(x => setB.has(x)));
    const union = new Set([...setA, ...setB]);
    return union.size > 0 ? intersection.size / union.size : 0;
  }
}
