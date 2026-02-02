import { Controller, Get, Post, Delete, Body, Param, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { CompetitorsService } from './competitors.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@ApiTags('경쟁사 분석')
@Controller('competitors')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class CompetitorsController {
  constructor(private competitorsService: CompetitorsService) {}

  @Post(':hospitalId')
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

  @Post(':hospitalId/auto-detect')
  @ApiOperation({ summary: '경쟁사 자동 탐지' })
  async autoDetect(@Param('hospitalId') hospitalId: string) {
    return this.competitorsService.autoDetectCompetitors(hospitalId);
  }

  @Get(':hospitalId/comparison')
  @ApiOperation({ summary: '경쟁사 비교 분석' })
  async getComparison(@Param('hospitalId') hospitalId: string) {
    return this.competitorsService.getComparison(hospitalId);
  }
}
