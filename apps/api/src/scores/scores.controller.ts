import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { ScoresService } from './scores.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@ApiTags('점수 및 통계')
@Controller('scores')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class ScoresController {
  constructor(private scoresService: ScoresService) {}

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
  @ApiOperation({ summary: '플랫폼별 분석' })
  async getPlatformAnalysis(@Param('hospitalId') hospitalId: string) {
    return this.scoresService.getPlatformAnalysis(hospitalId);
  }

  @Get(':hospitalId/specialties')
  @ApiOperation({ summary: '진료과목별 분석' })
  async getSpecialtyAnalysis(@Param('hospitalId') hospitalId: string) {
    return this.scoresService.getSpecialtyAnalysis(hospitalId);
  }

  @Get(':hospitalId/weekly')
  @ApiOperation({ summary: '주간 하이라이트' })
  async getWeeklyHighlights(@Param('hospitalId') hospitalId: string) {
    return this.scoresService.getWeeklyHighlights(hospitalId);
  }

  @Get(':hospitalId/citations')
  @ApiOperation({ summary: '인용 소스 분석' })
  async getCitationAnalysis(@Param('hospitalId') hospitalId: string) {
    return this.scoresService.getCitationAnalysis(hospitalId);
  }
}
