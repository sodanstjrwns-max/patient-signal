import { Controller, Post, Get, Headers, UnauthorizedException, Query, Param, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { HospitalOwnershipGuard } from '../common/guards/hospital-ownership.guard';
import { ApiTags, ApiOperation, ApiHeader, ApiQuery, ApiParam } from '@nestjs/swagger';
import { SchedulerService } from './scheduler.service';
import { CrawlQueueService } from './crawl-queue.service';
import { PrismaService } from '../common/prisma/prisma.service';
import { ActionTrackerService } from '../scores/action-tracker.service';
import { BenchmarkService } from '../scores/benchmark.service';
import {
  generateMatrixCandidates,
  selectDailyPrompts,
  getMatrixStats,
} from './daily-prompt-matrix';

@ApiTags('스케줄러')
@Controller('scheduler')
export class SchedulerController {
  constructor(
    private schedulerService: SchedulerService,
    private crawlQueue: CrawlQueueService,
    private prisma: PrismaService,
    private actionTracker: ActionTrackerService,
    private benchmarkService: BenchmarkService,
  ) {}

  /**
   * Cron Job 엔드포인트 - 자동 크롤링
   */
  @Post('daily-crawl')
  @ApiOperation({ 
    summary: '자동 크롤링 실행', 
    description: 'Cron Job에서 호출. session 파라미터로 시간대 지정 가능.' 
  })
  @ApiHeader({ name: 'x-cron-secret', description: 'Cron 시크릿 키' })
  @ApiQuery({ name: 'session', required: false, enum: ['morning', 'afternoon', 'evening'] })
  @ApiQuery({ name: 'includeCompetitors', required: false, type: Boolean })
  @ApiQuery({ name: 'includeContentGap', required: false, type: Boolean })
  async dailyCrawl(
    @Headers('x-cron-secret') cronSecret: string,
    @Query('session') session?: 'morning' | 'afternoon' | 'evening',
    @Query('includeCompetitors') includeCompetitors?: string,
    @Query('includeContentGap') includeContentGap?: string,
  ) {
    const expectedSecret = process.env.CRON_SECRET;
    
    if (!expectedSecret || cronSecret !== expectedSecret) {
      throw new UnauthorizedException('Invalid cron secret');
    }

    // 【B안 응급】fire-and-forget — Render Cron 요청은 즉시 200 OK 반환
    // 실제 크롤링은 백그라운드에서 계속 진행됨
    // → Render가 응답 못 받아서 재시도하는 무한 루프 차단
    const runId = `${session}-${Date.now()}`;
    this.schedulerService.runDailyCrawling({
      session,
      includeCompetitors: includeCompetitors === 'true',
      includeContentGap: includeContentGap === 'true',
    }).catch(err => {
      console.error(`[${runId}] background crawl failed:`, err.message);
    });

    return {
      success: true,
      runId,
      message: '크롤링을 백그라운드에서 시작했습니다. 결과는 로그/DB에서 확인하세요.',
      timestamp: new Date().toISOString(),
      session,
    };
  }

  /**
   * Daily Prompt Refresh V3 - 5×5 매트릭스 엔진
   * Cron: 매일 오전 8시 (KST) - 크롤링 전에 실행
   */
  @Post('daily-prompt-refresh')
  @ApiOperation({ summary: '일일 자동 프롬프트 생성 V3 (5×5 매트릭스 엔진)' })
  @ApiHeader({ name: 'x-cron-secret', description: 'Cron 시크릿 키' })
  async dailyPromptRefresh(
    @Headers('x-cron-secret') cronSecret: string,
  ) {
    const expectedSecret = process.env.CRON_SECRET;
    if (!expectedSecret || cronSecret !== expectedSecret) {
      throw new UnauthorizedException('Invalid cron secret');
    }

    const result = await this.schedulerService.runDailyPromptRefresh();
    return {
      success: true,
      timestamp: new Date().toISOString(),
      engine: 'v3-matrix',
      ...result,
    };
  }

  /**
   * 매트릭스 미리보기 (저장 없이)
   * 프론트엔드에서 어떤 후보가 생성되는지 확인용
   */
  @Get('matrix-preview/:hospitalId')
  @UseGuards(JwtAuthGuard, HospitalOwnershipGuard)
  @ApiOperation({ summary: '매트릭스 프롬프트 후보 미리보기 (저장 없이)' })
  @ApiParam({ name: 'hospitalId', description: '병원 ID' })
  async matrixPreview(@Param('hospitalId') hospitalId: string) {
    const hospital = await this.prisma.hospital.findUnique({
      where: { id: hospitalId },
      include: {
        prompts: { where: { isActive: true }, select: { promptText: true } },
      },
    });

    if (!hospital) {
      return { error: '병원을 찾을 수 없습니다' };
    }

    // 매트릭스 후보 생성
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

    // 기존 프롬프트와 비교해서 선택
    const existingTexts = new Set<string>(hospital.prompts.map(p => p.promptText));
    const selected = selectDailyPrompts(candidates, existingTexts, 10, true);

    return {
      hospital: {
        name: hospital.name,
        specialty: hospital.specialtyType,
        region: `${hospital.regionSido} ${hospital.regionSigungu}`,
        procedures: hospital.keyProcedures?.length ? hospital.keyProcedures : hospital.coreTreatments,
        strengths: hospital.hospitalStrengths,
      },
      matrix: {
        totalCandidates: stats.totalCandidates,
        byIntent: stats.byIntent,
        byTone: stats.byTone,
        bySeason: stats.bySeason,
        byProcedure: stats.byProcedure,
      },
      existingCount: hospital.prompts.length,
      todaySelection: selected.map(s => ({
        text: s.text,
        intent: s.intent,
        tone: s.tone,
        season: s.season,
        weight: Math.round(s.weight * 100) / 100,
        procedure: s.procedure,
      })),
      todayCount: selected.length,
    };
  }

  /**
   * Weekly Weight Calibration - ABHS 가중치 자동 재캘리브레이션
   * Cron: 매주 일요일 새벽 03:00 KST (= 토요일 18:00 UTC)
   *
   * 정책: save=true / activate=false
   *   → DB에 RUN 저장만, 운영 반영은 관리자가 수동 검토 후 별도 활성화
   *
   * Render Cron 등록 예:
   *   curl -X POST https://<api>/scheduler/weekly-weight-calibration \
   *        -H "x-cron-secret: $CRON_SECRET"
   */
  @Post('weekly-weight-calibration')
  @ApiOperation({
    summary: '주간 ABHS 가중치 자동 재캘리브레이션 (save only, no auto-activate)',
    description: 'Cron Job에서 호출. 실데이터 기반으로 가중치 재산정 후 DB에 저장하되 활성화는 하지 않음 (수동 검토 필요).',
  })
  @ApiHeader({ name: 'x-cron-secret', description: 'Cron 시크릿 키' })
  async weeklyWeightCalibration(
    @Headers('x-cron-secret') cronSecret: string,
  ) {
    const expectedSecret = process.env.CRON_SECRET;
    if (!expectedSecret || cronSecret !== expectedSecret) {
      throw new UnauthorizedException('Invalid cron secret');
    }

    const result = await this.schedulerService.runWeeklyWeightCalibration();
    return {
      timestamp: new Date().toISOString(),
      ...result,
    };
  }

  /**
   * 【A안】좀비 잡 수동 청소 엔드포인트
   * 30분 이상 RUNNING 상태로 멈춘 잡을 일괄 FAILED로 마킹
   *
   * 사용 예:
   *   curl -X POST https://<api>/scheduler/cleanup-zombies \
   *        -H "x-cron-secret: $CRON_SECRET"
   */
  @Post('cleanup-zombies')
  @ApiOperation({ summary: '좀비 잡 수동 청소 (30분+ RUNNING → FAILED)' })
  @ApiHeader({ name: 'x-cron-secret', description: 'Cron 시크릿 키' })
  async cleanupZombies(@Headers('x-cron-secret') cronSecret: string) {
    const expectedSecret = process.env.CRON_SECRET;
    if (!expectedSecret || cronSecret !== expectedSecret) {
      throw new UnauthorizedException('Invalid cron secret');
    }

    const threshold = new Date(Date.now() - 30 * 60 * 1000);
    const result = await this.prisma.crawlJob.updateMany({
      where: { status: 'RUNNING', startedAt: { lt: threshold } },
      data: { status: 'FAILED', completedAt: new Date() },
    });

    return {
      success: true,
      cleanedCount: result.count,
      thresholdMinutes: 30,
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * SoV 자기치유 — 매칭 누락(false-negative) 자동 탐지/복구
   * Cron 권장: 매일 daily-crawl 직후 1회 (dryRun=false)
   * 응급/점검 시 dryRun=true 로 탐지만 가능
   */
  @Post('self-heal-sov')
  @ApiOperation({
    summary: 'SoV 자기치유 (매칭 누락 자동 복구)',
    description: 'isMentioned=false인데 응답에 병원명이 등장하는 케이스를 탐지/복구. dryRun=true면 탐지만.',
  })
  @ApiHeader({ name: 'x-cron-secret', description: 'Cron 시크릿 키' })
  @ApiQuery({ name: 'dryRun', required: false, type: Boolean })
  async selfHealSov(
    @Headers('x-cron-secret') cronSecret: string,
    @Query('dryRun') dryRun?: string,
  ) {
    const expectedSecret = process.env.CRON_SECRET;
    if (!expectedSecret || cronSecret !== expectedSecret) {
      throw new UnauthorizedException('Invalid cron secret');
    }

    const result = await this.schedulerService.runSovSelfHeal({
      dryRun: dryRun === 'true',
    });

    return {
      success: true,
      dryRun: dryRun === 'true',
      ...result,
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * 【본질 강화 1+2】일일 임팩트 루프 집계
   * - 진행중 액션 성과 재측정 (베이스라인 대비 SoV 변화 → IMPROVED/FLAT/DECLINED)
   * - 진료과×단계별 실측 벤치마크 재집계 (p25/p50/p75)
   * Cron 권장: 매일 daily-crawl(evening) 직후 1회
   */
  @Post('daily-impact-loop')
  @ApiOperation({
    summary: '【임팩트 루프】액션 성과 재측정 + 실측 벤치마크 재집계',
    description: '매일 크롤링 완료 후 실행. 추적중인 개선 액션의 SoV 변화 측정 + 전체 병원 분포 기반 벤치마크 갱신',
  })
  @ApiHeader({ name: 'x-cron-secret', description: 'Cron 시크릿 키' })
  async dailyImpactLoop(@Headers('x-cron-secret') cronSecret: string) {
    const expectedSecret = process.env.CRON_SECRET;
    if (!expectedSecret || cronSecret !== expectedSecret) {
      throw new UnauthorizedException('Invalid cron secret');
    }

    const [outcomes, benchmarks] = await Promise.all([
      this.actionTracker.measureOutcomes(),
      this.benchmarkService.recomputeAll(),
    ]);

    return {
      success: true,
      actionOutcomes: {
        totalActions: outcomes.totalActions,
        measured: outcomes.measured,
      },
      benchmarks: {
        upserted: benchmarks.upserted,
        totalHospitals: benchmarks.totalHospitals,
      },
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * 【P1-4】크롤 큐 상태 조회 (운영 모니터링용)
   */
  @Get('queue-status')
  @ApiOperation({ summary: '크롤 큐 상태 (Bull/Redis) — 큐 모드일 때만 카운트 반환' })
  @ApiHeader({ name: 'x-cron-secret', description: 'Cron 시크릿 키' })
  async queueStatus(@Headers('x-cron-secret') cronSecret: string) {
    const expectedSecret = process.env.CRON_SECRET;
    if (!expectedSecret || cronSecret !== expectedSecret) {
      throw new UnauthorizedException('Invalid cron secret');
    }
    const stats = await this.crawlQueue.getStats();
    return {
      mode: stats.enabled ? 'queue (Redis)' : 'inline (fallback)',
      ...stats,
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * 상태 확인 엔드포인트 (공개)
   */
  @Get('status')
  @ApiOperation({ summary: '스케줄러 상태 확인' })
  async getStatus() {
    return {
      status: 'active',
      version: 'v3.0 - 5×5 병원 범용 매트릭스 엔진',
      platforms: ['ChatGPT', 'Claude', 'Perplexity', 'Gemini'],
      engine: {
        name: 'Daily Prompt Matrix V3',
        axes: [
          '축1: Intent (RESERVATION, COMPARISON, INFORMATION, REVIEW, FEAR)',
          '축2: Procedure (병원 핵심 시술 최대 5개)',
          '축3: Tone (구어체, 정중체, 비교형, 감성형, 전문형)',
          '축4: Season (월별 시즌, 요일, 명절, 개학)',
          '축5: Region (시군구, 동, 타겟지역, 약식)',
        ],
        features: [
          'ABHS 성과 기반 가중치 부스팅',
          'Jaccard 유사도 0.85 중복 제거',
          '의도×톤 다양성 보장 선택',
          '진료과별 증상 기반 템플릿',
          '강점/경쟁사 비교 보너스 템플릿',
          '13개 진료과 범용 대응',
        ],
      },
      cronSchedule: {
        promptRefresh: '매일 오전 8시 (KST) - 5×5 매트릭스 프롬프트 생성',
        dailyCrawlMorning: '매일 오전 9시 (KST) - morning 세션 ?session=morning',
        dailyCrawlAfternoon: '매일 오후 2시 (KST) - afternoon 세션 ?session=afternoon',
        dailyCrawlEvening: '매일 오후 7시 (KST) - evening 세션 ?session=evening (경쟁사 분석 포함)',
        zombieCleanup: 'POST /scheduler/cleanup-zombies (응급시 수동)',
        weeklyWeightCalibration: '매주 일요일 새벽 3시 (KST) - ABHS 가중치 자동 재캘리브레이션 (save only)',
      },
      supportedSpecialties: [
        'DENTAL (치과)', 'DERMATOLOGY (피부과)', 'PLASTIC_SURGERY (성형외과)',
        'ORTHOPEDICS (정형외과)', 'KOREAN_MEDICINE (한의원)', 'OPHTHALMOLOGY (안과)',
        'INTERNAL_MEDICINE (내과)', 'UROLOGY (비뇨기과)', 'ENT (이비인후과)',
        'PSYCHIATRY (정신건강의학과)', 'OBSTETRICS (산부인과)', 'PEDIATRICS (소아과)',
      ],
      lastCheck: new Date().toISOString(),
    };
  }
}
