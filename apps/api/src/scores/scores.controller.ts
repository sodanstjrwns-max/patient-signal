import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { ScoresService } from './scores.service';
import { ABHSService } from './abhs.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@ApiTags('점수 및 통계')
@Controller('scores')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class ScoresController {
  constructor(
    private scoresService: ScoresService,
    private abhsService: ABHSService,
  ) {}

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

  @Get(':hospitalId/prompt-heatmap')
  @ApiOperation({ 
    summary: '【개선4】프롬프트별 성과 히트맵',
    description: '각 프롬프트 × 플랫폼 조합의 언급률, 순위, 감성을 히트맵 형태로 제공' 
  })
  async getPromptHeatmap(@Param('hospitalId') hospitalId: string) {
    return this.scoresService.getPromptHeatmap(hospitalId);
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
}
