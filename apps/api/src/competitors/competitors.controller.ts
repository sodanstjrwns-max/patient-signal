import { Controller, Get, Post, Delete, Body, Param, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { CompetitorsService } from './competitors.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PlanGuard } from '../common/guards/plan.guard';
import { PlanLimit } from '../common/decorators/plan-limit.decorator';

@ApiTags('경쟁사 분석')
@Controller('competitors')
@UseGuards(JwtAuthGuard, PlanGuard)
@ApiBearerAuth()
export class CompetitorsController {
  constructor(private competitorsService: CompetitorsService) {}

  // ===== 구체적인 서브 경로를 먼저 선언 (NestJS 라우트 매칭 순서 중요) =====

  @Get(':hospitalId/inactive')
  @ApiOperation({ summary: '비활성(삭제된) 경쟁사 목록 조회' })
  async findInactive(@Param('hospitalId') hospitalId: string) {
    return this.competitorsService.findInactive(hospitalId);
  }

  @Get(':hospitalId/comparison')
  @PlanLimit({ minPlan: 'STANDARD' })
  @ApiOperation({ summary: '경쟁사 비교 분석' })
  async getComparison(@Param('hospitalId') hospitalId: string) {
    return this.competitorsService.getComparison(hospitalId);
  }

  @Post(':hospitalId/suggest')
  @PlanLimit({ minPlan: 'STANDARD' })
  @ApiOperation({ summary: 'AI 경쟁사 제안 - 크롤링 데이터 기반 위협도 분석' })
  async suggestCompetitors(@Param('hospitalId') hospitalId: string) {
    return this.competitorsService.suggestCompetitors(hospitalId);
  }

  @Post(':hospitalId/accept-suggestion')
  @PlanLimit({ feature: 'maxCompetitors', countField: 'competitors' })
  @ApiOperation({ summary: 'AI 제안 경쟁사 수락' })
  async acceptSuggestion(
    @Param('hospitalId') hospitalId: string,
    @Body() dto: { competitorName: string; competitorRegion?: string },
  ) {
    return this.competitorsService.acceptSuggestion(hospitalId, dto);
  }

  @Post(':hospitalId/restore-all')
  @ApiOperation({ summary: '비활성 경쟁사 전체 복구' })
  async restoreAll(@Param('hospitalId') hospitalId: string) {
    return this.competitorsService.restoreAll(hospitalId);
  }

  @Post(':hospitalId/restore/:competitorId')
  @ApiOperation({ summary: '특정 비활성 경쟁사 복구' })
  async restoreOne(
    @Param('hospitalId') hospitalId: string,
    @Param('competitorId') competitorId: string,
  ) {
    return this.competitorsService.restoreOne(competitorId, hospitalId);
  }

  // 하위 호환: 기존 auto-detect 엔드포인트 → suggest로 리다이렉트
  @Post(':hospitalId/auto-detect')
  @PlanLimit({ minPlan: 'STANDARD' })
  @ApiOperation({ summary: '경쟁사 AI 제안 (레거시 호환)', deprecated: true })
  async autoDetect(@Param('hospitalId') hospitalId: string) {
    return this.competitorsService.suggestCompetitors(hospitalId);
  }

  // ===== 와일드카드 경로는 마지막에 선언 =====

  @Post(':hospitalId')
  @PlanLimit({ feature: 'maxCompetitors', countField: 'competitors' })
  @ApiOperation({ summary: '경쟁사 추가' })
  async create(
    @Param('hospitalId') hospitalId: string,
    @Body() dto: { competitorName: string; competitorRegion?: string },
  ) {
    return this.competitorsService.create(hospitalId, dto);
  }

  @Get(':hospitalId')
  @ApiOperation({ summary: '경쟁사 목록 조회' })
  async findAll(@Param('hospitalId') hospitalId: string) {
    return this.competitorsService.findAll(hospitalId);
  }

  @Delete(':id/:hospitalId')
  @ApiOperation({ summary: '경쟁사 삭제' })
  async remove(
    @Param('id') id: string,
    @Param('hospitalId') hospitalId: string,
  ) {
    return this.competitorsService.remove(id, hospitalId);
  }
}
