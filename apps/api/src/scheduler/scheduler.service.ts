import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';
import { AICrawlerService } from '../ai-crawler/ai-crawler.service';
import { WeightCalibrationService } from '../scores/weight-calibration.service';
import { PlanGuard } from '../common/guards/plan.guard';
import { CrawlQueueService, CrawlJobData } from './crawl-queue.service';
import { CacheService } from '../common/cache/cache.service';
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
export class SchedulerService implements OnModuleInit {
  private readonly logger = new Logger(SchedulerService.name);

  constructor(
    private prisma: PrismaService,
    private aiCrawlerService: AICrawlerService,
    private weightCalibrationService: WeightCalibrationService,
    private crawlQueue: CrawlQueueService,
    private cacheService: CacheService,
  ) {}

  /**
   * 【P1-4】Bull 큐 워커 등록
   * REDIS_URL이 있으면 이 프로세스가 큐 잡을 concurrency만큼 병렬 처리
   */
  onModuleInit(): void {
    this.crawlQueue.setProcessor((data: CrawlJobData) =>
      this.crawlSingleHospital(data.hospitalId, {
        session: data.session,
        includeCompetitors: data.includeCompetitors,
        includeContentGap: data.includeContentGap,
      }),
    );
  }

  // ==================== Weekly ABHS Weight Auto-Recalibration ====================

  /**
   * 주간 자동 가중치 재캘리브레이션
   * Cron: 매주 일요일 새벽 03:00 KST (= 토요일 18:00 UTC)
   *
   * 정책:
   *  - save=true (DB에 RUN 저장, 비활성 상태)
   *  - activate=false (운영 반영은 관리자가 수동 검토 후)
   *  - 데이터 누적될수록 가중치 정밀도 ↑
   *
   * 활성화: npx ts-node scripts/abhs-weight-activate.ts <runId>
   */
  async runWeeklyWeightCalibration(): Promise<{
    success: boolean;
    runId?: string;
    profilesUpserted?: number;
    activated?: boolean;
    insights: string[];
    dataScope: { totalResponses: number; rangeDays: number; activeHospitals: number };
    bigDeltaCount: number;
    error?: string;
  }> {
    this.logger.log('=== [Weekly Cron] ABHS 가중치 자동 재캘리브레이션 시작 ===');
    try {
      const result = await this.weightCalibrationService.runCalibration({
        save: true,
        activate: false, // 안전 정책: 자동 활성화 금지, 수동 검토 후 활성화
        triggeredBy: 'CRON:weekly',
      });

      const bigDeltaCount = result.abhsScoreComparison.filter(h => Math.abs(h.delta) >= 5).length;

      this.logger.log(
        `=== [Weekly Cron] 완료: RUN=${result.saved?.runId}, ` +
        `데이터=${result.dataScope.totalResponses}건/${result.dataScope.activeHospitals}병원, ` +
        `±5 이상 변동 ${bigDeltaCount}개 병원, insights=${result.insights.length}건 ===`,
      );

      return {
        success: true,
        runId: result.saved?.runId,
        profilesUpserted: result.saved?.profilesUpserted,
        activated: result.saved?.activated,
        insights: result.insights,
        dataScope: result.dataScope,
        bigDeltaCount,
      };
    } catch (error: any) {
      this.logger.error(`[Weekly Cron] 캘리브레이션 실패: ${error.message}`, error.stack);
      return {
        success: false,
        insights: [],
        dataScope: { totalResponses: 0, rangeDays: 0, activeHospitals: 0 },
        bigDeltaCount: 0,
        error: error.message,
      };
    }
  }

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

    // ============================================================
    // 【A안 #1】실행 시작 전 좀비 잡 자동 청소
    // 30분 이상 RUNNING 상태로 멈춰 있는 잡 = Render Cron 타임아웃으로 죽은 잡
    // → 다음 실행 시 자동으로 FAILED로 마킹하여 누적 방지
    // ============================================================
    const zombieThreshold = new Date(Date.now() - 30 * 60 * 1000);
    const zombieResult = await this.prisma.crawlJob.updateMany({
      where: {
        status: 'RUNNING',
        startedAt: { lt: zombieThreshold },
      },
      data: { status: 'FAILED', completedAt: new Date() },
    });
    if (zombieResult.count > 0) {
      this.logger.warn(`🧟 좀비 잡 자동 정리: ${zombieResult.count}건 RUNNING→FAILED`);
    }

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

    // ============================================================
    // 【A안 #2】오늘 아직 점수가 안 나온 병원을 먼저 처리 (공정성)
    // Render Cron이 30분에 강제 종료되더라도 매번 다른 병원이 누락되도록
    // → "오늘치 DailyScore가 없는 병원" 우선 + 그 안에서는 createdAt 오름차순
    // ============================================================
    const todayKST = new Date();
    todayKST.setUTCHours(0, 0, 0, 0); // UTC 자정 = KST 09:00 직전
    const scoredToday = await this.prisma.dailyScore.findMany({
      where: { scoreDate: { gte: todayKST } },
      select: { hospitalId: true },
    });
    const scoredTodaySet = new Set(scoredToday.map(s => s.hospitalId));

    // ============================================================
    // 【STARVATION FIX】각 병원의 "마지막 크롤 시각"을 기준으로 정렬
    // 기존: createdAt 오름차순 → 항상 같은 ~13개 오래된 병원만 처리되고
    //       나머지 70여 곳은 영원히 차례가 안 옴 (굶주림/starvation)
    // 변경: least-recently-crawled (가장 오래 안 돌아간 병원) 우선
    //       → 매 사이클마다 굶주린 병원이 자동으로 앞으로 와서 공정하게 순환
    // ============================================================
    const lastCrawlRows = await this.prisma.crawlJob.groupBy({
      by: ['hospitalId'],
      _max: { startedAt: true },
    });
    const lastCrawlMap = new Map<string, number>();
    for (const row of lastCrawlRows) {
      const t = row._max.startedAt ? row._max.startedAt.getTime() : 0;
      lastCrawlMap.set(row.hospitalId, t);
    }
    // 한 번도 크롤된 적 없는 병원 = 0 (epoch) → 최우선

    // ============================================================
    // 【STARVATION FIX v2】동률(같은 날 마지막 크롤) 병원들 사이에서
    // 매 사이클마다 무작위로 순서를 섞어 "항상 같은 앞쪽 병원만 처리되고
    // 뒤쪽은 영원히 굶는" 문제를 해소. lastCrawl이 같은 날짜로 묶인
    // 38곳+가 createdAt 고정 정렬이라 매번 동일 순서 → 뒤쪽 starvation 발생.
    // 날짜 단위로 버킷팅 후 버킷 내부는 매 실행마다 셔플.
    // ============================================================

    // 【긴급 구제】3일 이상 크롤이 안 된 "굶주린" 병원은 무조건 최우선으로 끌어올림
    // (5/31 이후 스케줄러 starvation으로 23일째 방치된 으뜸치과 등 즉시 구제)
    const STARVED_MS = 3 * 24 * 60 * 60 * 1000;
    const nowMs = Date.now();
    const isStarved = (id: string) => {
      const last = lastCrawlMap.get(id);
      return last === undefined || nowMs - last > STARVED_MS;
    };

    hospitals.sort((a, b) => {
      // 0순위: 굶주린 병원(3일+ 미크롤) 최우선 구제
      const aStarved = isStarved(a.id) ? 0 : 1;
      const bStarved = isStarved(b.id) ? 0 : 1;
      if (aStarved !== bStarved) return aStarved - bStarved;
      // 1순위: 오늘 아직 점수 안 난 병원 먼저 (당일 공정성)
      // → 3세션(9/14/19시)이 누적되며 '오늘 안 돈 병원'을 계속 우선 처리
      //   하루 안에 전 병원 1회 커버를 목표
      const aDone = scoredTodaySet.has(a.id) ? 1 : 0;
      const bDone = scoredTodaySet.has(b.id) ? 1 : 0;
      if (aDone !== bDone) return aDone - bDone;
      // 2순위: 가장 오래 크롤 안 된 병원 먼저 (least-recently-crawled, 정밀 시각)
      // ⚠️ 일(day) 버킷팅 + 셔플은 동률 병원을 무작위로 섞어 일부만 처리되는
      //    'starvation 재발' 부작용이 있었음 → 가장 오래 굶은 순서를 '정확히' 지킴
      const aLast = lastCrawlMap.get(a.id) ?? 0;
      const bLast = lastCrawlMap.get(b.id) ?? 0;
      if (aLast !== bLast) return aLast - bLast;
      // 3순위: 완전 동률(둘 다 한 번도 안 됨)일 때만 가입 순서로 안정 정렬
      return a.createdAt.getTime() - b.createdAt.getTime();
    });

    const remaining = hospitals.filter(h => !scoredTodaySet.has(h.id)).length;
    this.logger.log(`크롤링 대상 병원: ${hospitals.length}개 (오늘 아직 ${remaining}곳 미처리)`);

    // ============================================================
    // 【용량 FIX】daily-crawl은 fire-and-forget(HTTP는 즉시 200, 크롤은 백그라운드)
    // 이라 Render의 30분 HTTP 타임아웃과 무관하게 백그라운드는 계속 돈다.
    // 기존 24분 예산은 세션당 ~10곳만 처리 → 93곳 중 60곳이 매일 누락되던 주범.
    // 예산을 50분으로 확대해 세션당 처리량을 대폭 늘림(3세션이면 하루 전 병원 커버).
    // 다음 세션(5시간 뒤)과 겹치지 않도록 50분으로 안전 설정.
    // ============================================================
    const RUN_BUDGET_MS = 50 * 60 * 1000;
    const runStartedAt = Date.now();

    const results: any[] = [];
    let successCount = 0;
    let failCount = 0;
    let skippedByBudget = 0;

    // ============================================================
    // 【확장성 FIX — 병원 단위 병렬화】
    // 기존: 병원을 1곳씩 순차 처리 + 병원마다 10초 딜레이
    //   → 93곳×10초=15분이 순수 대기로 낭비, 200곳+에선 감당 불가
    // 변경: 병원을 HOSPITAL_CONCURRENCY개씩 동시 처리 + 불필요 딜레이 제거
    //   aliasCache가 병원명 키 기반이라 병렬 충돌 없음(검증 완료)
    //   프롬프트 레벨은 이미 3개 병렬이므로, 병원 4개 동시 = 실효 처리량 약 3~4배
    //   → 200곳+도 세션 예산 내 매일 1회 커버 가능
    // ============================================================
    // 【스케일】env로 동시성 제어 — 수백 병원 규모에선 워커 인스턴스를 늘리거나
    // HOSPITAL_CONCURRENCY 상향 (AI API rate limit 여유 확인 후)
    const HOSPITAL_CONCURRENCY = Math.max(
      1,
      parseInt(process.env.HOSPITAL_CONCURRENCY || '4', 10) || 4,
    );

    const processOneHospital = async (hospital: typeof hospitals[number]) => {
      try {
        const hospitalResult = await this.crawlSingleHospital(hospital, {
          session,
          includeCompetitors,
          includeContentGap,
        });
        if (hospitalResult?.skipped) {
          return; // 월간 한도 등으로 스킵된 병원은 성공/실패 집계 제외
        }
        results.push(hospitalResult);
        successCount++;
      } catch (error) {
        failCount++;
        this.logger.error(`[${hospital.name}] 크롤링 실패: ${error.message}`);
        results.push({
          hospitalId: hospital.id,
          hospitalName: hospital.name,
          error: error.message,
        });
      }
    };

    // 활성 프롬프트 없는 병원은 미리 제외
    const crawlTargets = hospitals.filter((h) => {
      if (h.prompts.length === 0) {
        this.logger.log(`[${h.name}] 활성 프롬프트 없음 - 스킵`);
        return false;
      }
      return true;
    });

    // ============================================================
    // 【P1-4】Bull 큐 모드 — REDIS_URL이 설정되어 있으면
    // 병원별 잡을 큐에 등록하고 즉시 반환. 워커가 백그라운드에서 처리.
    //  - 재시작/배포 중에도 잡 유실 없음 (Redis 영속)
    //  - jobId 고정으로 같은 세션 중복 실행 방지
    //  - REDIS_URL 없으면 아래 인라인 배치 루프로 fallback (기존 동작 100% 유지)
    // ============================================================
    if (this.crawlQueue.isEnabled()) {
      const jobs: CrawlJobData[] = crawlTargets.map((h) => ({
        hospitalId: h.id,
        hospitalName: h.name,
        session,
        includeCompetitors,
        includeContentGap,
      }));
      const queued = await this.crawlQueue.enqueueHospitalCrawls(jobs);
      this.logger.log(
        `=== [큐 모드] 크롤 잡 ${queued}/${crawlTargets.length}건 등록 (세션: ${session}) — 워커가 백그라운드 처리 ===`,
      );
      return {
        totalHospitals: hospitals.length,
        successCount: 0,
        failCount: 0,
        session,
        results: [],
        mode: 'queue',
        queuedJobs: queued,
        zombieCleanup: zombieResult.count,
      } as any;
    }

    // 병원을 HOSPITAL_CONCURRENCY개씩 묶어 배치 병렬 처리
    for (let i = 0; i < crawlTargets.length; i += HOSPITAL_CONCURRENCY) {
      // 예산 초과 체크 — 남은 병원은 다음 세션으로 (좀비 생성 방지)
      if (Date.now() - runStartedAt > RUN_BUDGET_MS) {
        skippedByBudget += crawlTargets.length - i;
        break;
      }
      const batch = crawlTargets.slice(i, i + HOSPITAL_CONCURRENCY);
      await Promise.allSettled(batch.map((h) => processOneHospital(h)));
      // 배치 간 짧은 rate-limit 완충 (AI API 보호)
      if (i + HOSPITAL_CONCURRENCY < crawlTargets.length) {
        await new Promise((resolve) => setTimeout(resolve, 2000));
      }
    }

    this.logger.log(
      `=== 크롤링 완료 (${session}): 성공 ${successCount}, 실패 ${failCount}, ` +
      `예산초과스킵 ${skippedByBudget} / 좀비정리 ${zombieResult.count} ===`
    );

    return {
      totalHospitals: hospitals.length,
      successCount,
      failCount,
      session,
      results,
      zombieCleanup: zombieResult.count,
      skippedByBudget,
    } as any;
  }

  /**
   * 【P1-4】병원 1곳 크롤링 — 재사용 가능한 단위 메서드
   *
   * 호출 경로 2가지:
   *  1) 인라인 모드: runDailyCrawling의 배치 루프에서 hospital 객체째 전달
   *  2) 큐 모드: Bull 워커가 hospitalId(string)로 호출 → DB에서 재조회
   *
   * 기존 processOneHospital 클로저의 전체 로직 (crawlJob 라이프사이클,
   * 플랜 한도, 세션 플랫폼 교집합, alias, 프롬프트 청크, 점수 계산,
   * 저녁 경쟁사 AEO + Content Gap) 을 그대로 유지.
   */
  async crawlSingleHospital(
    hospitalOrId: string | any,
    options: {
      session: 'morning' | 'afternoon' | 'evening';
      includeCompetitors: boolean;
      includeContentGap: boolean;
    },
  ): Promise<any> {
    const { session, includeCompetitors, includeContentGap } = options;

    // 큐 모드에서는 hospitalId만 넘어오므로 관계 포함 재조회
    const hospital =
      typeof hospitalOrId === 'string'
        ? await this.prisma.hospital.findUnique({
            where: { id: hospitalOrId },
            include: {
              prompts: { where: { isActive: true } },
              competitors: { where: { isActive: true } },
            },
          })
        : hospitalOrId;

    if (!hospital) {
      throw new Error(`병원을 찾을 수 없습니다: ${hospitalOrId}`);
    }
    if (!hospital.prompts || hospital.prompts.length === 0) {
      this.logger.log(`[${hospital.name}] 활성 프롬프트 없음 - 스킵`);
      return { hospitalId: hospital.id, hospitalName: hospital.name, skipped: true, reason: 'no-prompts' };
    }

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

    // 【안정성】이하 전 과정에서 예외 발생 시 crawlJob이 RUNNING 고아로 남지 않도록 보호
    // (좀비 청소가 30분 후 잡아주긴 하지만, 그동안 월간 크롤 한도를 잘못 소모함)
    try {

    let completed = 0;
    let failed = 0;

    // 플랜별 플랫폼 제한 적용
    const planLimits =
      (PlanGuard.PLAN_LIMITS as any)[hospital.planType] || PlanGuard.PLAN_LIMITS.FREE;
    const sessionPlatforms = this.getPlatformsForSession(session);
    // 플랜 허용 플랫폼과 세션 플랫폼의 교집합
    const platforms = sessionPlatforms.filter((p: string) => planLimits.platforms.includes(p));

    this.logger.log(`[${hospital.name}] 플랜: ${hospital.planType}, 플랫폼: ${platforms.join(', ')}`);

    // 【키 실종 방지】플랜에 포함된 플랫폼이 API 키 부재로 스킵되면
    // 조용히 넘기지 않고 crawlJob.errorMessage에 기록 + 경고 로그
    // (2026-07-02 XAI_API_KEY 누락 → Grok 6일 무경고 중단 사고 재발 방지)
    const unavailable = this.aiCrawlerService.getUnavailablePlatforms(platforms as any[]);
    let platformWarning: string | null = null;
    if (unavailable.length > 0) {
      platformWarning =
        `키 누락으로 제외된 플랫폼: ` +
        unavailable.map(u => `${u.platform}(${u.reason})`).join(', ');
      this.logger.warn(`⚠️ [${hospital.name}] ${platformWarning} — 플랜(${hospital.planType})에 포함된 플랫폼인데 크롤에서 빠집니다!`);
      await this.prisma.crawlJob.update({
        where: { id: crawlJob.id },
        data: { errorMessage: `[WARN] ${platformWarning}` },
      });
    }

    // 별칭(alias)을 크롤러에 세팅 → 매칭 시 포함
    if ((hospital as any).nameAliases && (hospital as any).nameAliases.length > 0) {
      this.aiCrawlerService.setHospitalAliases(hospital.name, (hospital as any).nameAliases);
    }

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
      // 방금 만든 crawlJob도 RUNNING으로 집계되므로 > 비교
      if (crawlCount > planLimits.crawlsPerMonth) {
        this.logger.log(`[${hospital.name}] 월간 크롤링 한도 초과 (${crawlCount}/${planLimits.crawlsPerMonth}) - 스킵`);
        await this.prisma.crawlJob.update({
          where: { id: crawlJob.id },
          data: { status: 'FAILED', completedAt: new Date() },
        });
        return { hospitalId: hospital.id, hospitalName: hospital.name, skipped: true, reason: 'monthly-limit' };
      }
    }

    // ============================================================
    // 【B안】플랜별 1회 크롤링당 프롬프트 상한 적용
    //  - FREE: 3개 / STARTER: 5개 / STANDARD: 10개 / PRO·ENTERPRISE: 무제한
    // ============================================================
    const promptsPerCrawl = (planLimits as any).promptsPerCrawl;
    const sortedPrompts = [...hospital.prompts].sort((a: any, b: any) => a.id.localeCompare(b.id));
    const effectivePrompts =
      promptsPerCrawl && promptsPerCrawl !== -1 && sortedPrompts.length > promptsPerCrawl
        ? sortedPrompts.slice(0, promptsPerCrawl)
        : sortedPrompts;

    if (effectivePrompts.length < hospital.prompts.length) {
      this.logger.log(
        `[${hospital.name}] 플랜(${hospital.planType}) 프롬프트 상한 적용: ` +
        `${hospital.prompts.length}개 → ${effectivePrompts.length}개 (cap=${promptsPerCrawl})`,
      );
    }

    // crawlJob.totalPrompts를 실제 처리할 개수로 보정 (배치 통계 정확도 ↑)
    if (effectivePrompts.length !== hospital.prompts.length) {
      await this.prisma.crawlJob.update({
        where: { id: crawlJob.id },
        data: { totalPrompts: effectivePrompts.length },
      });
    }

    // 【P3-1】크롤링 병렬화 (프롬프트 3개씩 동시 처리, rate-limit 대응)
    const CONCURRENT_PROMPTS = 3;
    const promptChunks: typeof effectivePrompts[] = [];
    for (let i = 0; i < effectivePrompts.length; i += CONCURRENT_PROMPTS) {
      promptChunks.push(effectivePrompts.slice(i, i + CONCURRENT_PROMPTS));
    }

    for (const chunk of promptChunks) {
      const chunkResults = await Promise.allSettled(
        chunk.map(async (prompt: any) => {
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

    // crawlJob 업데이트 + 완료 처리 (【B안】 effectivePrompts.length 기준으로 실패 판정)
    await this.prisma.crawlJob.update({
      where: { id: crawlJob.id },
      data: {
        completed,
        failed,
        status: failed === effectivePrompts.length ? 'FAILED' : 'COMPLETED',
        completedAt: new Date(),
      },
    });

    // 점수 계산 — 실패해도 크롤 결과는 이미 저장됨 (다음 크롤/수동 재계산 가능)
    const score = await this.aiCrawlerService.calculateDailyScore(hospital.id).catch((err) => {
      this.logger.error(`[${hospital.name}] 점수 계산 실패 (크롤 결과는 저장됨): ${err.message}`);
      return null;
    });

    const hospitalResult: any = {
      hospitalId: hospital.id,
      hospitalName: hospital.name,
      promptCount: effectivePrompts.length,           // 【B안】실제 처리한 개수
      promptCountTotal: hospital.prompts.length,      // 【B안】병원이 설정한 전체 개수
      completed,
      failed,
      score,
      session,
    };

    // 저녁 세션에서 경쟁사 AEO 측정 (플랜 체크)
    if (includeCompetitors && hospital.competitors?.length > 0 && planLimits.competitorAEO) {
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

    // 【P1-7】크롤 완료 → 해당 병원의 캐시된 점수/응답 무효화 (신선 데이터 즉시 반영)
    await this.cacheService.invalidateHospital(hospital.id).catch(() => undefined);

    this.logger.log(`[${hospital.name}] 크롤링 완료 - 점수: ${score}`);
    return hospitalResult;

    } catch (error) {
      // 예상치 못한 예외 → 아직 RUNNING이면 FAILED 마킹 (이미 COMPLETED면 건드리지 않음)
      await this.prisma.crawlJob.updateMany({
        where: { id: crawlJob.id, status: 'RUNNING' },
        data: { status: 'FAILED', completedAt: new Date() },
      }).catch(() => undefined);
      throw error;
    }
  }

  private getCurrentSession(): 'morning' | 'afternoon' | 'evening' {
    const kstHour = new Date().getUTCHours() + 9;
    const adjustedHour = kstHour >= 24 ? kstHour - 24 : kstHour;
    
    if (adjustedHour < 12) return 'morning';
    if (adjustedHour < 17) return 'afternoon';
    return 'evening';
  }

  private getPlatformsForSession(session: string): any[] {
    // 【2026.05】6대 플랫폼 — GROK(xAI) + CLOVA_X(Naver) 추가
    // 가용성은 AICrawlerService.isPlatformAvailable()이 env 키 유무로 판정
    const basePlatforms: any[] = [
      'CHATGPT', 'CLAUDE', 'PERPLEXITY', 'GEMINI', 'GROK', 'CLOVA_X',
    ];

    switch (session) {
      case 'morning':
        return basePlatforms;
      case 'afternoon':
        // 비용 절감을 위해 일부 세션은 핵심 4종만 (GROK/CLOVA_X는 비교적 비쌈 + 한국 시장 토종)
        return ['CHATGPT', 'GEMINI', 'GROK', 'CLOVA_X'];
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

  // ==================== SoV 자기치유 (재발 방지) ====================

  /**
   * SoV self-heal — "isMentioned=false 인데 사실은 응답에 병원명이 등장하는"
   * false-negative를 탐지하고, dryRun=false면 자동 복구한다.
   *
   * 매칭 누락(예: 정원한의원 한방 패턴, 바른얼굴 별칭 어순)으로 SoV가
   * 실제보다 낮게/0%로 표시되는 사고의 재발을 막기 위한 안전망.
   *
   * Cron 권장: 매일 daily-crawl 직후 1회 (dryRun=false)
   * - 현행 매칭 로직(checkMentionForBackfill)을 그대로 재사용 → 로직 일관성 보장
   * - true→false 강등은 하지 않음. false→true 복구만 수행 (보수적)
   */
  async runSovSelfHeal(options?: { dryRun?: boolean }): Promise<{
    scannedHospitals: number;
    flaggedHospitals: number;
    fixedResponses: number;
    recalculatedScores: number;
    details: Array<{ hospital: string; falseNegatives: number; example: string | null }>;
  }> {
    const dryRun = options?.dryRun ?? true;
    this.logger.log(`=== [SoV Self-Heal] 시작 (${dryRun ? 'DRY-RUN' : 'APPLY'}) ===`);

    const hospitals = await this.prisma.hospital.findMany({
      where: { subscriptionStatus: { in: ['ACTIVE', 'TRIAL'] } },
      select: { id: true, name: true, nameAliases: true },
    });

    let flaggedHospitals = 0;
    let fixedResponses = 0;
    let recalculatedScores = 0;
    const details: Array<{ hospital: string; falseNegatives: number; example: string | null }> = [];

    for (const h of hospitals) {
      const aliases = ((h as any).nameAliases as string[]) || [];
      const responses = await this.prisma.aIResponse.findMany({
        where: { hospitalId: h.id, isMentioned: false },
        select: { id: true, responseText: true, responseDate: true },
      });
      if (responses.length === 0) continue;

      const falseNegatives: Array<{ id: string; matched: string | null; responseDate: Date }> = [];
      for (const r of responses) {
        const res = this.aiCrawlerService.checkMentionForBackfill(r.responseText, h.name, aliases);
        if (res.isMentioned) {
          falseNegatives.push({ id: r.id, matched: res.matchedVariant, responseDate: r.responseDate });
        }
      }
      if (falseNegatives.length === 0) continue;

      flaggedHospitals++;
      const example = falseNegatives[0].matched;
      details.push({ hospital: h.name, falseNegatives: falseNegatives.length, example });
      this.logger.warn(`[SoV Self-Heal] ${h.name}: 매칭누락 ${falseNegatives.length}건 (예: "${example}")`);

      if (!dryRun) {
        // 1) AIResponse 복구
        const ids = falseNegatives.map(f => f.id);
        const upd = await this.prisma.aIResponse.updateMany({
          where: { id: { in: ids } },
          data: { isMentioned: true },
        });
        fixedResponses += upd.count;

        // 2) 영향 날짜의 DailyScore 재계산 (sovPercent / mentionCount)
        const days = new Set(falseNegatives.map(f => f.responseDate.toISOString().slice(0, 10)));
        for (const day of days) {
          const dayStart = new Date(day + 'T00:00:00.000Z');
          const dayEnd = new Date(day + 'T23:59:59.999Z');
          const dayResponses = await this.prisma.aIResponse.findMany({
            where: { hospitalId: h.id, responseDate: { gte: dayStart, lte: dayEnd } },
            select: { isMentioned: true },
          });
          const total = dayResponses.length;
          const mentioned = dayResponses.filter(x => x.isMentioned).length;
          const sov = total > 0 ? (mentioned / total) * 100 : 0;
          const ds = await this.prisma.dailyScore.findFirst({
            where: { hospitalId: h.id, scoreDate: { gte: dayStart, lte: dayEnd } },
          });
          if (ds) {
            await this.prisma.dailyScore.update({
              where: { id: ds.id },
              data: { sovPercent: sov, mentionCount: mentioned },
            });
            recalculatedScores++;
          }
        }
      }
    }

    this.logger.log(
      `=== [SoV Self-Heal] 완료: 병원 ${hospitals.length}곳 스캔, ` +
      `매칭누락 ${flaggedHospitals}곳, 복구 응답 ${fixedResponses}건, DailyScore ${recalculatedScores}건 ===`,
    );

    return {
      scannedHospitals: hospitals.length,
      flaggedHospitals,
      fixedResponses,
      recalculatedScores,
      details,
    };
  }
}
