import { Controller, Get, Post, Query, Param, Logger, UnauthorizedException, BadRequestException } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiQuery, ApiParam } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { Public } from '../auth/decorators/public.decorator';
import { WeightService } from '../scores/weight.service';
import { WeightCalibrationService } from '../scores/weight-calibration.service';
import { WeightScope } from '@prisma/client';

/**
 * 관리자용 ABHS 가중치 관리 API
 *
 * 인증: ?secret=<ADMIN_SECRET> 쿼리 파라미터 (AdminController 패턴과 동일)
 * Throttle: 1분에 30회
 *
 * 엔드포인트:
 *   GET  /admin/weights/active                  → 현재 활성 가중치 덤프
 *   GET  /admin/weights/runs                    → 캘리브레이션 RUN 히스토리
 *   GET  /admin/weights/runs/:runId             → 특정 RUN 상세
 *   POST /admin/weights/runs/:runId/activate    → 특정 RUN 활성화
 *   POST /admin/weights/rollback                → 직전 RUN으로 롤백 (or DEFAULT)
 *   POST /admin/weights/calibrate-now           → 즉시 캘리브레이션 트리거
 */
@ApiTags('관리자-가중치')
@Controller('admin/weights')
@Throttle({ default: { limit: 30, ttl: 60000 } })
export class WeightsController {
  private readonly logger = new Logger(WeightsController.name);

  constructor(
    private weightService: WeightService,
    private weightCalibrationService: WeightCalibrationService,
  ) {}

  /**
   * 현재 활성 가중치 덤프 (3축 + 활성 RUN 메타)
   * GET /api/admin/weights/active?secret=xxx&scope=GLOBAL&scopeKey=GLOBAL
   */
  @Public()
  @Get('active')
  @ApiOperation({ summary: '현재 활성 가중치 덤프 (3축 + 활성 RUN 메타)' })
  @ApiQuery({ name: 'scope', required: false, enum: ['GLOBAL', 'SPECIALTY', 'HOSPITAL'] })
  @ApiQuery({ name: 'scopeKey', required: false, description: 'SPECIALTY면 진료과 코드, HOSPITAL이면 hospitalId' })
  async getActiveWeights(
    @Query('secret') secret: string,
    @Query('scope') scope?: string,
    @Query('scopeKey') scopeKey?: string,
  ) {
    this.validateSecret(secret);
    const s = this.parseScope(scope);
    const sk = scopeKey || (s === 'GLOBAL' ? 'GLOBAL' : '');
    if (s !== 'GLOBAL' && !sk) {
      throw new BadRequestException(`scope=${s}일 땐 scopeKey가 필요합니다.`);
    }

    const [weights, activeRun] = await Promise.all([
      this.weightService.dumpActiveWeights(s, sk),
      this.weightService.getActiveRun(s, sk),
    ]);

    return {
      scope: s,
      scopeKey: sk,
      activeRun: activeRun
        ? {
            id: activeRun.id,
            triggeredBy: activeRun.triggeredBy,
            activatedAt: activeRun.activatedAt,
            activatedBy: activeRun.activatedBy,
            dataRangeDays: activeRun.dataRangeDays,
            responsesAnalyzed: activeRun.responsesAnalyzed,
            hospitalsAnalyzed: activeRun.hospitalsAnalyzed,
            createdAt: activeRun.createdAt,
          }
        : null,
      weights,
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * 캘리브레이션 RUN 히스토리
   * GET /api/admin/weights/runs?secret=xxx&limit=20
   */
  @Public()
  @Get('runs')
  @ApiOperation({ summary: '캘리브레이션 RUN 히스토리 (최신순)' })
  @ApiQuery({ name: 'scope', required: false, enum: ['GLOBAL', 'SPECIALTY', 'HOSPITAL'] })
  @ApiQuery({ name: 'scopeKey', required: false })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  async getRunHistory(
    @Query('secret') secret: string,
    @Query('scope') scope?: string,
    @Query('scopeKey') scopeKey?: string,
    @Query('limit') limit?: string,
  ) {
    this.validateSecret(secret);
    const s = this.parseScope(scope);
    const sk = scopeKey || (s === 'GLOBAL' ? 'GLOBAL' : '');
    const lim = Math.min(parseInt(limit || '20', 10), 100);

    const runs = await this.weightService.getRunHistory(s, sk, lim);

    return {
      scope: s,
      scopeKey: sk,
      count: runs.length,
      runs: runs.map(r => ({
        id: r.id,
        isActive: r.isActive,
        triggeredBy: r.triggeredBy,
        status: r.status,
        responsesAnalyzed: r.responsesAnalyzed,
        hospitalsAnalyzed: r.hospitalsAnalyzed,
        dataRangeDays: r.dataRangeDays,
        createdAt: r.createdAt,
        activatedAt: r.activatedAt,
        activatedBy: r.activatedBy,
      })),
    };
  }

  /**
   * 단일 RUN 상세
   * GET /api/admin/weights/runs/:runId?secret=xxx
   */
  @Public()
  @Get('runs/:runId')
  @ApiOperation({ summary: '특정 RUN 상세 (가중치 diff, 인사이트, 점수 영향)' })
  @ApiParam({ name: 'runId', description: 'CalibrationRun ID' })
  async getRunDetail(
    @Query('secret') secret: string,
    @Param('runId') runId: string,
  ) {
    this.validateSecret(secret);
    const detail = await this.weightService.getRunDetail(runId);
    if (!detail) throw new BadRequestException(`RUN을 찾을 수 없습니다: ${runId}`);
    return detail;
  }

  /**
   * 특정 RUN 활성화 (운영 반영)
   * POST /api/admin/weights/runs/:runId/activate?secret=xxx
   */
  @Public()
  @Post('runs/:runId/activate')
  @ApiOperation({ summary: '특정 RUN을 운영에 활성화 (이전 활성 RUN은 자동 비활성)' })
  @ApiParam({ name: 'runId', description: 'CalibrationRun ID' })
  async activateRun(
    @Query('secret') secret: string,
    @Param('runId') runId: string,
    @Query('by') activatedBy?: string,
  ) {
    this.validateSecret(secret);
    this.logger.log(`[Admin] RUN 활성화 요청: ${runId} by ${activatedBy || 'ADMIN'}`);

    await this.weightService.activateRun(runId, activatedBy || 'ADMIN');

    const detail = await this.weightService.getRunDetail(runId);
    return {
      success: true,
      runId,
      activatedBy: activatedBy || 'ADMIN',
      activatedAt: new Date().toISOString(),
      activeProfileCount: detail?.profileCount ?? 0,
    };
  }

  /**
   * 가중치 롤백 — 직전 활성 RUN (없으면 DEFAULT)
   * POST /api/admin/weights/rollback?secret=xxx&scope=GLOBAL&scopeKey=GLOBAL
   */
  @Public()
  @Post('rollback')
  @ApiOperation({ summary: '직전 RUN으로 롤백 (이전 RUN 없으면 DEFAULT로 복귀)' })
  @ApiQuery({ name: 'scope', required: false, enum: ['GLOBAL', 'SPECIALTY', 'HOSPITAL'] })
  @ApiQuery({ name: 'scopeKey', required: false })
  async rollback(
    @Query('secret') secret: string,
    @Query('scope') scope?: string,
    @Query('scopeKey') scopeKey?: string,
  ) {
    this.validateSecret(secret);
    const s = this.parseScope(scope);
    const sk = scopeKey || (s === 'GLOBAL' ? 'GLOBAL' : '');
    if (s !== 'GLOBAL' && !sk) {
      throw new BadRequestException(`scope=${s}일 땐 scopeKey가 필요합니다.`);
    }
    this.logger.log(`[Admin] 가중치 롤백 요청: scope=${s}, scopeKey=${sk}`);

    const result = await this.weightService.rollback(s, sk);
    return {
      success: true,
      scope: s,
      scopeKey: sk,
      rolledBackTo: result.rolledBackTo,
      message: result.rolledBackTo
        ? `이전 RUN(${result.rolledBackTo})으로 복귀했습니다.`
        : '이전 RUN이 없어 DEFAULT 프로파일로 복귀했습니다.',
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * 즉시 캘리브레이션 트리거 (주간 Cron 우회)
   * POST /api/admin/weights/calibrate-now?secret=xxx&activate=false
   *
   * 기본은 save=true / activate=false (안전)
   * ?activate=true 명시 시에만 즉시 운영 반영
   */
  @Public()
  @Post('calibrate-now')
  @ApiOperation({
    summary: '즉시 캘리브레이션 트리거 (주간 Cron 우회)',
    description: '기본: save=true / activate=false. activate=true 명시 시에만 즉시 운영 반영.',
  })
  @ApiQuery({ name: 'activate', required: false, type: Boolean, description: 'true면 저장 후 즉시 활성화 (기본 false)' })
  @ApiQuery({ name: 'dryRun', required: false, type: Boolean, description: 'true면 저장도 안 함 (분석만)' })
  async calibrateNow(
    @Query('secret') secret: string,
    @Query('activate') activate?: string,
    @Query('dryRun') dryRun?: string,
    @Query('by') triggeredBy?: string,
  ) {
    this.validateSecret(secret);

    const isDryRun = dryRun === 'true';
    const shouldActivate = activate === 'true';
    const save = !isDryRun;

    this.logger.log(
      `[Admin] 즉시 캘리브레이션 요청: dryRun=${isDryRun}, save=${save}, activate=${shouldActivate}`,
    );

    const result = await this.weightCalibrationService.runCalibration({
      save,
      activate: shouldActivate,
      triggeredBy: triggeredBy || 'ADMIN:manual',
    });

    return {
      success: true,
      mode: isDryRun ? 'DRY_RUN' : shouldActivate ? 'SAVE+ACTIVATE' : 'SAVE_ONLY',
      dataScope: result.dataScope,
      saved: result.saved,
      insights: result.insights,
      platformWeights: {
        current: result.platformWeights.current,
        calibrated: result.platformWeights.calibrated,
      },
      depthScores: {
        current: result.depthScores.current,
        calibrated: result.depthScores.calibrated,
      },
      intentMultipliers: {
        current: result.intentMultipliers.current,
        calibrated: result.intentMultipliers.calibrated,
      },
      topDeltaHospitals: result.abhsScoreComparison.slice(0, 10),
      timestamp: new Date().toISOString(),
    };
  }

  // ============ Helpers ============

  private validateSecret(secret: string) {
    const validSecret = process.env.ADMIN_SECRET || 'pf-admin-2026';
    if (secret !== validSecret) {
      throw new UnauthorizedException('Unauthorized');
    }
  }

  private parseScope(scope?: string): WeightScope {
    const upper = (scope || 'GLOBAL').toUpperCase();
    if (upper !== 'GLOBAL' && upper !== 'SPECIALTY' && upper !== 'HOSPITAL') {
      throw new BadRequestException(`Invalid scope: ${scope}. Must be GLOBAL | SPECIALTY | HOSPITAL`);
    }
    return upper as WeightScope;
  }
}
