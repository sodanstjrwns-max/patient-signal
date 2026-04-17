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

        // 【P3-1】크롤링 병렬화 (프롬프트 3개씩 동시 처리, rate-limit 대응)
        const CONCURRENT_PROMPTS = 3;
        const promptChunks: typeof hospital.prompts[] = [];
        for (let i = 0; i < hospital.prompts.length; i += CONCURRENT_PROMPTS) {
          promptChunks.push(hospital.prompts.slice(i, i + CONCURRENT_PROMPTS));
        }

        for (const chunk of promptChunks) {
          const chunkResults = await Promise.allSettled(
            chunk.map(async (prompt) => {
              // 【Area 2】플랫폼별 맞춤 프롬프트 적용 (platformSpecific 필드 확인)
              const effectivePlatforms = (prompt as any).platformSpecific
                ? platforms.filter((p: string) => p === (prompt as any).platformSpecific)
                : platforms;

              const crawlResults = await this.aiCrawlerService.queryAllPlatforms(
                prompt.id,
                hospital.id,
                hospital.name,
                prompt.promptText,
                effectivePlatforms,
              );
              return crawlResults;
            }),
          );

          for (const settled of chunkResults) {
            if (settled.status === 'fulfilled' && settled.value.length > 0) {
              completed++;
            } else {
              failed++;
              if (settled.status === 'rejected') {
                this.logger.error(`[${hospital.name}] 프롬프트 실패: ${settled.reason?.message || 'unknown'}`);
              }
            }
          }
          
          // 청크 간 rate-limit 방지 딜레이
          if (promptChunks.indexOf(chunk) < promptChunks.length - 1) {
            await new Promise(resolve => setTimeout(resolve, 2000));
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

  // ==================== 【Area 1】A/B 실험 프레임워크 ====================

  /**
   * 매일 생성된 10개 프롬프트 중 2개를 실험 그룹으로 태깅
   * 7일 후 성과 비교하여 승리 패턴 자동 학습
   */
  async tagExperimentPrompts(hospitalId: string): Promise<{
    tagged: number;
    experimentType: string;
  }> {
    // 오늘 생성된 AUTO_GENERATED 프롬프트 조회
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const todayPrompts = await this.prisma.prompt.findMany({
      where: {
        hospitalId,
        promptType: 'AUTO_GENERATED',
        experimentGroup: null,
        createdAt: { gte: today },
      },
      orderBy: { createdAt: 'desc' },
    });

    if (todayPrompts.length < 4) return { tagged: 0, experimentType: 'none' };

    // 10개 중 2개를 실험군으로 태깅 (랜덤 선택)
    const experimentTypes = ['EXPERIMENT_TONE', 'EXPERIMENT_REGION', 'EXPERIMENT_INTENT'];
    const selectedType = experimentTypes[Math.floor(Math.random() * experimentTypes.length)];

    // 나머지는 CONTROL
    const controlIds = todayPrompts.slice(0, todayPrompts.length - 2).map(p => p.id);
    const experimentIds = todayPrompts.slice(-2).map(p => p.id);

    await this.prisma.prompt.updateMany({
      where: { id: { in: controlIds } },
      data: { experimentGroup: 'CONTROL' as any },
    });

    await this.prisma.prompt.updateMany({
      where: { id: { in: experimentIds } },
      data: { experimentGroup: selectedType as any },
    });

    this.logger.log(`[A/B 실험] ${hospitalId}: ${controlIds.length}개 CONTROL, ${experimentIds.length}개 ${selectedType}`);

    return { tagged: todayPrompts.length, experimentType: selectedType };
  }

  /**
   * 7일 경과된 실험 프롬프트 성과 비교
   */
  async evaluateExperiments(hospitalId: string): Promise<{
    evaluated: number;
    winners: Array<{ promptId: string; group: string; mentionRate: number }>;
    losers: Array<{ promptId: string; group: string; mentionRate: number }>;
  }> {
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    // 7일 전 생성된 실험 프롬프트
    const experimentPrompts = await this.prisma.prompt.findMany({
      where: {
        hospitalId,
        experimentGroup: { not: null },
        createdAt: { lte: sevenDaysAgo },
      },
      include: {
        aiResponses: {
          where: { createdAt: { gte: sevenDaysAgo } },
          select: { isMentioned: true },
        },
      },
    });

    if (experimentPrompts.length === 0) return { evaluated: 0, winners: [], losers: [] };

    const results = experimentPrompts.map(p => {
      const total = p.aiResponses.length;
      const mentioned = p.aiResponses.filter(r => r.isMentioned).length;
      return {
        promptId: p.id,
        group: p.experimentGroup as string,
        mentionRate: total > 0 ? Math.round((mentioned / total) * 100) : 0,
      };
    });

    // CONTROL vs EXPERIMENT 비교
    const controlAvg = results.filter(r => r.group === 'CONTROL');
    const experimentAvg = results.filter(r => r.group !== 'CONTROL');

    const controlMR = controlAvg.length > 0
      ? controlAvg.reduce((sum, r) => sum + r.mentionRate, 0) / controlAvg.length
      : 0;
    const experimentMR = experimentAvg.length > 0
      ? experimentAvg.reduce((sum, r) => sum + r.mentionRate, 0) / experimentAvg.length
      : 0;

    this.logger.log(`[A/B 결과] ${hospitalId}: CONTROL avg=${controlMR.toFixed(1)}%, EXPERIMENT avg=${experimentMR.toFixed(1)}%`);

    // 상위 30% = winners, 하위 30% = losers
    const sorted = [...results].sort((a, b) => b.mentionRate - a.mentionRate);
    const winnerCount = Math.max(1, Math.floor(sorted.length * 0.3));
    const loserCount = Math.max(1, Math.floor(sorted.length * 0.3));

    return {
      evaluated: results.length,
      winners: sorted.slice(0, winnerCount),
      losers: sorted.slice(-loserCount),
    };
  }

  // ==================== 【Area 1】Golden Prompt 자동 탐지 + 복제 ====================

  /**
   * SoV 80%+ 프롬프트를 Golden Prompt로 마킹하고 변형 3~5개 자동 생성
   */
  async detectAndReplicateGoldenPrompts(hospitalId: string): Promise<{
    newGoldenCount: number;
    variantsCreated: number;
    goldenPrompts: Array<{ promptId: string; promptText: string; mentionRate: number }>;
  }> {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    // 최근 30일 성과 데이터로 SoV 80%+ 프롬프트 탐지
    const prompts = await this.prisma.prompt.findMany({
      where: { hospitalId, isActive: true, isGoldenPrompt: false },
      include: {
        aiResponses: {
          where: { createdAt: { gte: thirtyDaysAgo } },
          select: { isMentioned: true },
        },
      },
    });

    const goldenCandidates = prompts.filter(p => {
      if (p.aiResponses.length < 4) return false; // 최소 4회 측정
      const mentionRate = p.aiResponses.filter(r => r.isMentioned).length / p.aiResponses.length;
      return mentionRate >= 0.8;
    });

    let variantsCreated = 0;
    const goldenPrompts: Array<{ promptId: string; promptText: string; mentionRate: number }> = [];

    for (const golden of goldenCandidates) {
      const mentionRate = Math.round(
        (golden.aiResponses.filter(r => r.isMentioned).length / golden.aiResponses.length) * 100
      );

      // Golden으로 마킹
      await this.prisma.prompt.update({
        where: { id: golden.id },
        data: { isGoldenPrompt: true, goldenDetectedAt: new Date() },
      });

      goldenPrompts.push({ promptId: golden.id, promptText: golden.promptText, mentionRate });

      // 변형 3개 자동 생성
      const variants = [
        golden.promptText.replace(/추천해줘/, '비교해줘'),
        golden.promptText.replace(/추천해줘/, '알려줘').replace(/어디야\?/, '어디가 좋을까?'),
        golden.promptText + ' 실제 후기 기반으로.',
      ].filter(v => v !== golden.promptText);

      if (variants.length > 0) {
        const planLimits = (PlanGuard.PLAN_LIMITS as Record<string, any>)[
          (await this.prisma.hospital.findUnique({ where: { id: hospitalId }, select: { planType: true } }))?.planType || 'FREE'
        ] || PlanGuard.PLAN_LIMITS.FREE;
        const maxPrompts = planLimits.maxPrompts === -1 ? 100 : planLimits.maxPrompts;
        const currentCount = await this.prisma.prompt.count({ where: { hospitalId, isActive: true } });

        const slotsAvailable = Math.max(0, maxPrompts - currentCount);
        const toCreate = variants.slice(0, Math.min(3, slotsAvailable));

        if (toCreate.length > 0) {
          await this.prisma.prompt.createMany({
            data: toCreate.map(v => ({
              hospitalId,
              promptText: v,
              promptType: 'AUTO_GENERATED' as const,
              specialtyCategory: golden.specialtyCategory,
              regionKeywords: golden.regionKeywords,
              isActive: true,
              experimentParentId: golden.id,
            })),
          });
          variantsCreated += toCreate.length;
        }
      }
    }

    this.logger.log(`[Golden Prompt] ${hospitalId}: ${goldenCandidates.length}개 골든 감지, ${variantsCreated}개 변형 생성`);

    return { newGoldenCount: goldenCandidates.length, variantsCreated, goldenPrompts };
  }

  // ==================== 【Area 5】주간 AI 코치 알림 생성 ====================

  /**
   * 매주 월요일 자동 3가지 실행 과제 생성
   */
  async generateWeeklyCoachActions(hospitalId: string): Promise<any> {
    const lastWeek = new Date();
    lastWeek.setDate(lastWeek.getDate() - 7);
    const weekStart = new Date();
    weekStart.setHours(0, 0, 0, 0);

    // 이번 주 이미 생성된 액션이 있는지 확인
    const existing = await this.prisma.weeklyCoachAction.findFirst({
      where: { hospitalId, weekStartDate: weekStart },
    });
    if (existing) return existing;

    // 최근 7일 데이터 수집
    const [latestScore, contentGaps, goldenPrompts, lowPerformance] = await Promise.all([
      this.prisma.dailyScore.findFirst({
        where: { hospitalId },
        orderBy: { scoreDate: 'desc' },
      }),
      this.prisma.contentGap.findMany({
        where: { hospitalId, status: 'PENDING', createdAt: { gte: lastWeek } },
        orderBy: { priorityScore: 'desc' },
        take: 3,
      }),
      this.prisma.prompt.findMany({
        where: { hospitalId, isGoldenPrompt: true, isActive: true },
        take: 3,
      }),
      this.prisma.prompt.findMany({
        where: { hospitalId, isActive: true },
        include: {
          aiResponses: {
            where: { createdAt: { gte: lastWeek } },
            select: { isMentioned: true, aiPlatform: true },
          },
        },
      }),
    ]);

    // 3가지 액션 생성
    const actions: any[] = [];

    // 액션 1: Content Gap 기반
    if (contentGaps.length > 0) {
      const gap = contentGaps[0];
      actions.push({
        title: `"${gap.topic.substring(0, 30)}..." 콘텐츠 작성`,
        description: `이 주제에서 경쟁사(${(gap.competitorNames || []).slice(0, 2).join(', ')})가 AI 추천을 받고 있습니다. 블로그 콘텐츠를 작성하면 SoV 상승 기회!`,
        type: 'generate_geo',
        priority: 'high',
        relatedId: gap.id,
      });
    }

    // 액션 2: Golden Prompt 변형
    if (goldenPrompts.length > 0) {
      actions.push({
        title: `골든 프롬프트 "${goldenPrompts[0].promptText.substring(0, 25)}..." 변형 생성`,
        description: `이 프롬프트가 80%+ SoV를 달성했습니다. 변형을 만들어 더 넓은 커버리지를 확보하세요.`,
        type: 'create_prompt_variants',
        priority: 'medium',
        relatedId: goldenPrompts[0].id,
      });
    }

    // 액션 3: 저성과 플랫폼 개선
    const platformPerf = new Map<string, { mentioned: number; total: number }>();
    for (const p of lowPerformance) {
      for (const r of p.aiResponses) {
        if (!platformPerf.has(r.aiPlatform)) platformPerf.set(r.aiPlatform, { mentioned: 0, total: 0 });
        const perf = platformPerf.get(r.aiPlatform)!;
        perf.total++;
        if (r.isMentioned) perf.mentioned++;
      }
    }
    const lowestPlatform = Array.from(platformPerf.entries())
      .map(([platform, data]) => ({ platform, rate: data.total > 0 ? data.mentioned / data.total : 0 }))
      .sort((a, b) => a.rate - b.rate)[0];

    if (lowestPlatform && lowestPlatform.rate < 0.3) {
      actions.push({
        title: `${lowestPlatform.platform} 가시성 개선 (현재 ${Math.round(lowestPlatform.rate * 100)}%)`,
        description: `${lowestPlatform.platform}에서 가시성이 낮습니다. 해당 플랫폼에 최적화된 프롬프트를 추가해보세요.`,
        type: 'platform_optimization',
        priority: 'medium',
        relatedId: lowestPlatform.platform,
      });
    }

    // 기본 액션 (부족하면 채우기)
    if (actions.length < 3) {
      actions.push({
        title: '대시보드에서 최신 성과 확인하기',
        description: `현재 종합 점수: ${latestScore?.overallScore ?? 0}점. 주간 트렌드를 확인하고 개선 포인트를 찾아보세요.`,
        type: 'check_dashboard',
        priority: 'low',
        relatedId: null,
      });
    }

    // DB 저장
    const coachAction = await this.prisma.weeklyCoachAction.create({
      data: {
        hospitalId,
        weekStartDate: weekStart,
        actions: actions.slice(0, 3),
      },
    });

    this.logger.log(`[주간 코치] ${hospitalId}: ${actions.length}개 액션 생성`);
    return coachAction;
  }

  // ==================== 【Area 4】경쟁사 샘플링 벤치마크 ====================

  /**
   * 비용 최적화: 주 1회 전체 + 일 1회 상위 3개만 샘플링
   * API 비용 ~70% 절감
   */
  async runSampledCompetitorBenchmark(
    hospitalId: string,
    mode: 'full' | 'sample' = 'sample',
  ): Promise<{ measured: number; results: any[] }> {
    const competitors = await this.prisma.competitor.findMany({
      where: { hospitalId, isActive: true },
      include: {
        competitorScores: {
          orderBy: { scoreDate: 'desc' },
          take: 1,
        },
      },
    });

    if (competitors.length === 0) {
      return { measured: 0, results: [] };
    }

    let targetCompetitors = competitors;

    if (mode === 'sample') {
      // 샘플 모드: 상위 3개만 (최근 점수 기준)
      targetCompetitors = competitors
        .sort((a, b) => {
          const scoreA = a.competitorScores[0]?.overallScore ?? 0;
          const scoreB = b.competitorScores[0]?.overallScore ?? 0;
          return scoreB - scoreA;
        })
        .slice(0, 3);

      this.logger.log(`[경쟁사 샘플링] ${hospitalId}: ${competitors.length}개 중 상위 3개만 측정`);
    }

    const results: any[] = [];
    for (const competitor of targetCompetitors) {
      try {
        const score = await this.aiCrawlerService.measureCompetitorAEO(
          hospitalId,
          competitor.id,
          competitor.competitorName,
        );
        results.push({ name: competitor.competitorName, ...score });
      } catch (err) {
        this.logger.error(`[경쟁사 벤치마크] ${competitor.competitorName} 실패: ${err.message}`);
      }
      await new Promise(resolve => setTimeout(resolve, 5000));
    }

    return { measured: results.length, results };
  }
}
