import { Controller, Get, Post, Patch, Body, Param, Query, UseGuards, UseInterceptors } from '@nestjs/common';
import { HttpCacheInterceptor, CacheTTL } from '../common/cache/http-cache.interceptor';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { ScoresService } from './scores.service';
import { ABHSService } from './abhs.service';
import { FunnelService } from './funnel.service';
import { ActionTrackerService } from './action-tracker.service';
import type { StartActionDto } from './action-tracker.service';
import { BenchmarkService } from './benchmark.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { HospitalOwnershipGuard } from '../common/guards/hospital-ownership.guard';
import { PrismaService } from '../common/prisma/prisma.service';

@ApiTags('점수 및 통계')
@Controller('scores')
@UseGuards(JwtAuthGuard, HospitalOwnershipGuard)
@UseInterceptors(HttpCacheInterceptor)
@CacheTTL(600) // 【P1-7】모든 GET 응답 10분 캐시 (하루 1회 크롤 후 갱신되는 데이터)
@ApiBearerAuth()
export class ScoresController {
  constructor(
    private scoresService: ScoresService,
    private abhsService: ABHSService,
    private funnelService: FunnelService,
    private actionTracker: ActionTrackerService,
    private benchmarkService: BenchmarkService,
    private prisma: PrismaService,
  ) {}

  @Get(':hospitalId/funnel')
  @ApiOperation({ summary: 'AI 환자 퍼널 진단 (Patient Funnel × AEO — 단계별 SoV + 누수 감지 + 신환 임팩트)' })
  async getFunnelDiagnosis(
    @Param('hospitalId') hospitalId: string,
    @Query('days') days?: string,
  ) {
    return this.funnelService.getFunnelDiagnosis(hospitalId, parseInt(days || '30'));
  }

  @Get(':hospitalId/latest')
  @ApiOperation({ summary: '최신 점수 조회' })
  async getLatestScore(@Param('hospitalId') hospitalId: string) {
    return this.scoresService.getLatestScore(hospitalId);
  }

  @Get(':hospitalId/history')
  @ApiOperation({ summary: '점수 히스토리 조회' })
  async getScoreHistory(
    @Param('hospitalId') hospitalId: string,
    @Query('days') days?: string,
  ) {
    return this.scoresService.getScoreHistory(hospitalId, parseInt(days || '30'));
  }

  @Get(':hospitalId/platforms')
  @ApiOperation({ summary: '플랫폼별 분석 (찐 AI 4개, 반복측정 일관성 포함)' })
  async getPlatformAnalysis(@Param('hospitalId') hospitalId: string) {
    return this.scoresService.getPlatformAnalysis(hospitalId);
  }

  @Get(':hospitalId/specialties')
  @ApiOperation({ summary: '진료과목별 분석' })
  async getSpecialtyAnalysis(@Param('hospitalId') hospitalId: string) {
    return this.scoresService.getSpecialtyAnalysis(hospitalId);
  }

  @Get(':hospitalId/weekly')
  @ApiOperation({ summary: '주간 하이라이트 (Content Gap 포함)' })
  async getWeeklyHighlights(@Param('hospitalId') hospitalId: string) {
    return this.scoresService.getWeeklyHighlights(hospitalId);
  }

  @Get(':hospitalId/citations')
  @ApiOperation({ summary: '인용 소스 분석' })
  async getCitationAnalysis(@Param('hospitalId') hospitalId: string) {
    return this.scoresService.getCitationAnalysis(hospitalId);
  }

  @Get(':hospitalId/source-hints')
  @ApiOperation({ summary: '소스 힌트 데이터 (인용 출처 상세)' })
  async getSourceHints(@Param('hospitalId') hospitalId: string) {
    return this.scoresService.getSourceHints(hospitalId);
  }

  @Get(':hospitalId/content-gaps')
  @ApiOperation({ summary: 'Content Gap 분석 목록' })
  async getContentGaps(@Param('hospitalId') hospitalId: string) {
    return this.scoresService.getContentGaps(hospitalId);
  }

  @Get(':hospitalId/opportunity-analysis')
  @ApiOperation({ summary: '기회 분석 - 경쟁사 추천 vs 우리 미언급 패턴' })
  async getOpportunityAnalysis(@Param('hospitalId') hospitalId: string) {
    return this.scoresService.getOpportunityAnalysis(hospitalId);
  }

  @Get(':hospitalId/prompt-heatmap')
  @ApiOperation({ 
    summary: '【개선4】프롬프트별 성과 히트맵',
    description: '각 프롬프트 × 플랫폼 조합의 언급률, 순위, 감성을 히트맵 형태로 제공' 
  })
  async getPromptHeatmap(@Param('hospitalId') hospitalId: string) {
    return this.scoresService.getPromptHeatmap(hospitalId);
  }

  // ==================== 전체 순위 / 상위 % / 등급 뱃지 ====================

  @Get(':hospitalId/ranking')
  @ApiOperation({ 
    summary: '전체 순위 + 상위 % + 등급 뱃지',
    description: '전체 병원 중 내 순위, 상위 퍼센트, Diamond~Starter 등급 뱃지, 순위 변동, 근접 경쟁자 점수 갭, 점수 분포' 
  })
  async getRanking(@Param('hospitalId') hospitalId: string) {
    return this.scoresService.getRanking(hospitalId);
  }

  // ==================== 초고도화: ABHS 엔드포인트 ====================

  @Get(':hospitalId/abhs')
  @ApiOperation({ 
    summary: '【초고도화】ABHS 종합 점수',
    description: 'AI-Based Hospital Score: SoV × Sentiment × Depth × PlatformWeight × IntentMatch → 0~100' 
  })
  async getABHSScore(
    @Param('hospitalId') hospitalId: string,
    @Query('days') days?: string,
  ) {
    return this.abhsService.calculateABHS(hospitalId, parseInt(days || '30'));
  }

  @Get(':hospitalId/abhs/competitive-share')
  @ApiOperation({ 
    summary: '【초고도화】경쟁사 대비 Weighted Competitive Share',
    description: '경쟁사 대비 ABHS 점유율 계산' 
  })
  async getCompetitiveShare(@Param('hospitalId') hospitalId: string) {
    return this.abhsService.calculateCompetitiveShare(hospitalId);
  }

  @Get(':hospitalId/abhs/actions')
  @ApiOperation({ 
    summary: '【초고도화】자동 액션 인텔리전스',
    description: '부정 언급 감지, SoV 급락 경고, 예약 의도 미언급 경고 등' 
  })
  async getActionIntelligence(@Param('hospitalId') hospitalId: string) {
    return this.abhsService.generateActionIntelligence(hospitalId);
  }

  // ==================== 【본질 강화 1】액션 임팩트 트래커 ====================

  @Get(':hospitalId/action-impacts')
  @ApiOperation({
    summary: '【임팩트 루프】액션 임팩트 목록',
    description: '추적 중/완료된 개선 액션들의 베이스라인 대비 SoV 변화 (측정→처방→실행→재측정 루프)',
  })
  async getActionImpacts(@Param('hospitalId') hospitalId: string) {
    return this.actionTracker.getActionImpacts(hospitalId);
  }

  @Post(':hospitalId/action-impacts')
  @ApiOperation({
    summary: '【임팩트 루프】액션 추적 시작',
    description: '플레이북 처방을 실행 시작 — 현재 퍼널 단계 지표를 베이스라인 스냅샷으로 동결',
  })
  async startActionTracking(
    @Param('hospitalId') hospitalId: string,
    @Body() dto: StartActionDto,
  ) {
    return this.actionTracker.startAction(hospitalId, dto);
  }

  @Patch(':hospitalId/action-impacts/:actionId')
  @ApiOperation({
    summary: '【임팩트 루프】액션 완료/중단',
    description: '완료 시 최종 성과를 재측정하여 동결',
  })
  async updateActionStatus(
    @Param('hospitalId') hospitalId: string,
    @Param('actionId') actionId: string,
    @Body() body: { status: 'COMPLETED' | 'DISMISSED' },
  ) {
    return this.actionTracker.updateActionStatus(hospitalId, actionId, body.status);
  }

  // ==================== 【본질 강화 2】실측 벤치마크 ====================

  @Get(':hospitalId/benchmarks')
  @ApiOperation({
    summary: '【데이터 해자】진료과 실측 벤치마크',
    description: '동일 진료과 전체 고객 병원의 퍼널 단계별 SoV 분포 (p25/p50/p75). 표본 부족 시 기본값 fallback',
  })
  async getBenchmarks(@Param('hospitalId') hospitalId: string) {
    const hospital = await this.prisma.hospital.findUnique({
      where: { id: hospitalId },
      select: { specialtyType: true },
    });
    if (!hospital) return { error: 'HOSPITAL_NOT_FOUND' };
    const benchmarks = await this.benchmarkService.resolveBenchmarks(hospital.specialtyType as string);
    return { specialtyType: hospital.specialtyType, benchmarks };
  }

  @Get(':hospitalId/abhs/golden-prompts')
  @ApiOperation({ 
    summary: '【V2】Golden Prompt 분석',
    description: 'ABHS 5축 기준으로 가장 성과 좋은 질문 패턴 식별. 상위 10개 Golden Prompt + 각 축별 성과' 
  })
  async getGoldenPrompts(
    @Param('hospitalId') hospitalId: string,
    @Query('days') days?: string,
  ) {
    return this.abhsService.analyzeGoldenPrompts(hospitalId, parseInt(days || '30'));
  }
}
