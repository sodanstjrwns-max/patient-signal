import { Controller, Get, Query, Req, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiHeader, ApiQuery } from '@nestjs/swagger';
import { PublicApiService } from './public-api.service';
import { ApiKeyGuard } from './guards/api-key.guard';

@ApiTags('Public API v1 (외부 연동)')
@Controller('public/v1')
@UseGuards(ApiKeyGuard)
@ApiHeader({
  name: 'X-API-Key',
  description: 'Patient Signal API Key (병원별 발급)',
  required: true,
})
export class PublicApiController {
  constructor(private publicApiService: PublicApiService) {}

  // ==================== 1. AEO 상태 요약 ====================

  @Get('my/aeo-status')
  @ApiOperation({
    summary: '내 병원 AEO 상태 요약',
    description: '현재 점수, 순위, 뱃지, 플랫폼별/의도별 스냅샷, SoV 등 핵심 지표를 한 번에 조회합니다.',
  })
  async getAeoStatus(@Req() req: any) {
    return this.publicApiService.getAeoStatus(req.apiKeyHospitalId);
  }

  // ==================== 2. 점수 히스토리 ====================

  @Get('my/score-history')
  @ApiOperation({
    summary: '점수 히스토리',
    description: '일별 점수 추이를 조회합니다. 최대 90일.',
  })
  @ApiQuery({ name: 'days', required: false, description: '조회 기간 (기본 30, 최대 90)' })
  async getScoreHistory(
    @Req() req: any,
    @Query('days') days?: string,
  ) {
    return this.publicApiService.getScoreHistory(req.apiKeyHospitalId, parseInt(days || '30'));
  }

  // ==================== 3. 플랫폼별 분석 ====================

  @Get('my/platform-breakdown')
  @ApiOperation({
    summary: '플랫폼별 분석',
    description: 'ChatGPT, Claude, Gemini, Perplexity 각각의 언급률/순위/감성 분석 결과.',
  })
  async getPlatformBreakdown(@Req() req: any) {
    return this.publicApiService.getPlatformBreakdown(req.apiKeyHospitalId);
  }

  // ==================== 4. 의도별 분석 ====================

  @Get('my/intent-breakdown')
  @ApiOperation({
    summary: '질문 의도별 분석',
    description: 'RESERVATION, COMPARISON, INFORMATION, REVIEW, FEAR 각 의도별 성과 분석.',
  })
  async getIntentBreakdown(@Req() req: any) {
    return this.publicApiService.getIntentBreakdown(req.apiKeyHospitalId);
  }

  // ==================== 5. 전체 랭킹 ====================

  @Get('rankings')
  @ApiOperation({
    summary: '전체 병원 랭킹',
    description: '전체 병원 AEO 점수 순위. 진료과/지역 필터 가능.',
  })
  @ApiQuery({ name: 'limit', required: false, description: '조회 수 (기본 20, 최대 100)' })
  @ApiQuery({ name: 'offset', required: false, description: '오프셋 (페이지네이션)' })
  @ApiQuery({ name: 'specialty', required: false, description: '진료과 필터 (예: DENTAL)' })
  @ApiQuery({ name: 'region', required: false, description: '지역 필터 (예: 서울, 천안)' })
  async getRankings(
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
    @Query('specialty') specialty?: string,
    @Query('region') region?: string,
  ) {
    return this.publicApiService.getRankings({
      limit: limit ? parseInt(limit) : undefined,
      offset: offset ? parseInt(offset) : undefined,
      specialty,
      region,
    });
  }

  // ==================== 6. 경쟁사 비교 ====================

  @Get('my/competitors')
  @ApiOperation({
    summary: '경쟁사 비교 분석',
    description: '등록된 경쟁사와의 점수 비교, 우리가 미언급될 때 언급된 경쟁사 빈도 분석.',
  })
  async getCompetitorComparison(@Req() req: any) {
    return this.publicApiService.getCompetitorComparison(req.apiKeyHospitalId);
  }
}
