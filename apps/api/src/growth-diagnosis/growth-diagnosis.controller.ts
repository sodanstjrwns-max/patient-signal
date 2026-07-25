import { Controller, Get, Param, Query, UseGuards, UseInterceptors } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { HttpCacheInterceptor, CacheTTL } from '../common/cache/http-cache.interceptor';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { HospitalOwnershipGuard } from '../common/guards/hospital-ownership.guard';
import { GrowthDiagnosisService } from './growth-diagnosis.service';

/**
 * 성장 진단 API
 *
 * ⚠️ 가드 순서 고정: JwtAuthGuard → HospitalOwnershipGuard
 *    (Ownership 가드가 request.user를 요구하므로 반드시 뒤에 와야 함)
 */
@ApiTags('성장 진단')
@Controller('growth')
@UseGuards(JwtAuthGuard, HospitalOwnershipGuard)
@UseInterceptors(HttpCacheInterceptor)
@CacheTTL(600)
@ApiBearerAuth()
export class GrowthDiagnosisController {
  constructor(private readonly service: GrowthDiagnosisService) {}

  /** days 쿼리 안전 파싱 — 1~365 범위로 클램프 */
  private parseDays(days?: string): number {
    const n = parseInt(days ?? '30', 10);
    if (!Number.isFinite(n)) return 30;
    return Math.min(Math.max(n, 1), 365);
  }

  @Get(':hospitalId/summary')
  @ApiOperation({
    summary: '성장 진단 종합 (카드 8개 + 경고 + 인사이트)',
    description: '노출 원인을 분해한 8개 지표를 대시보드 카드 형태로 통합 반환',
  })
  @ApiQuery({ name: 'days', required: false, description: '집계 기간 (기본 30일, 최대 365)' })
  async summary(@Param('hospitalId') hospitalId: string, @Query('days') days?: string) {
    return this.service.getGrowthSummary(hospitalId, this.parseDays(days));
  }

  @Get(':hospitalId/citation-efficiency')
  @ApiOperation({
    summary: '문서당 인용 효율 — 역인과 오류 차단',
    description:
      '인용수 = 선호도 × 공급량 을 분해. 인용수 랭킹과 효율 랭킹의 순위차로 "물량이 많아 많이 인용된 채널"을 폭로한다.',
  })
  @ApiQuery({ name: 'days', required: false })
  async citationEfficiency(
    @Param('hospitalId') hospitalId: string,
    @Query('days') days?: string,
  ) {
    return this.service.getCitationEfficiency(hospitalId, this.parseDays(days));
  }

  @Get(':hospitalId/portfolio')
  @ApiOperation({
    summary: '채널 포트폴리오 4구역 배치 + 소모/축적 수명',
    description: '본진 / 고효율 저격수 / 물량 파도 / 하지마 4구역 비중과 채널 수명 분포',
  })
  @ApiQuery({ name: 'days', required: false })
  async portfolio(@Param('hospitalId') hospitalId: string, @Query('days') days?: string) {
    return this.service.getPortfolioMap(hospitalId, this.parseDays(days));
  }

  @Get(':hospitalId/region-leverage')
  @ApiOperation({
    summary: '지역 단위 배율표 (동 vs 시 vs 도)',
    description: '업계 실측 1.7배 / Gemini 3.0배 기준값 대비 자사 배율',
  })
  @ApiQuery({ name: 'days', required: false })
  async regionLeverage(@Param('hospitalId') hospitalId: string, @Query('days') days?: string) {
    return this.service.getRegionLeverage(hospitalId, this.parseDays(days));
  }

  @Get(':hospitalId/director-branding')
  @ApiOperation({
    summary: "원장 실명 브랜딩률 ('원장' 직함 25.8% vs 실명 0.7%)",
    description: 'AI 응답 원문에서 일반명사 언급률과 실명 언급률을 분리 측정',
  })
  @ApiQuery({ name: 'days', required: false })
  async directorBranding(@Param('hospitalId') hospitalId: string, @Query('days') days?: string) {
    return this.service.getDirectorBranding(hospitalId, this.parseDays(days));
  }

  @Get(':hospitalId/aeo-geo-split')
  @ApiOperation({
    summary: 'AEO(실시간 검색) vs GEO(사전학습 진입) 분리',
    description: 'isWebSearch로 분해. 검색 없이도 언급되면 모델이 우리를 학습한 것 = GEO 자산',
  })
  @ApiQuery({ name: 'days', required: false })
  async aeoGeoSplit(@Param('hospitalId') hospitalId: string, @Query('days') days?: string) {
    return this.service.getAeoGeoSplit(hospitalId, this.parseDays(days));
  }

  @Get(':hospitalId/language-scoreboard')
  @ApiOperation({
    summary: '언어별 성적표 (다국어 저경쟁 구간 검증)',
    description: '한국어 vs 영어/중국어/일본어 언급률 및 1위 점유율 비교',
  })
  @ApiQuery({ name: 'days', required: false })
  async languageScoreboard(
    @Param('hospitalId') hospitalId: string,
    @Query('days') days?: string,
  ) {
    return this.service.getLanguageScoreboard(hospitalId, this.parseDays(days));
  }

  @Get(':hospitalId/difficulty')
  @ApiOperation({
    summary: '질문 난이도별 SoV — 쉬운 질문의 착시 제거',
    description: '쉬움/보통/어려움 3구간 SoV + 착시 보정 SoV(구간 단순평균)',
  })
  @ApiQuery({ name: 'days', required: false })
  async difficulty(@Param('hospitalId') hospitalId: string, @Query('days') days?: string) {
    return this.service.getDifficultyBreakdown(hospitalId, this.parseDays(days));
  }

  @Get(':hospitalId/negative-alerts')
  @ApiOperation({
    summary: '부정 언급 조기경보 (비율 아닌 건수 감시 + 출처 역추적)',
    description: '부정 응답 건별 근거 문장 + 부정이 인용한 도메인 랭킹',
  })
  @ApiQuery({ name: 'days', required: false })
  async negativeAlerts(@Param('hospitalId') hospitalId: string, @Query('days') days?: string) {
    return this.service.getNegativeAlerts(hospitalId, this.parseDays(days));
  }
}
