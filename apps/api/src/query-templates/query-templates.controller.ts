import { Controller, Get, Post, Body, Param, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { QueryTemplatesService } from './query-templates.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@ApiTags('쿼리 템플릿 & 진료과 프리셋')
@Controller('query-templates')
export class QueryTemplatesController {
  constructor(private queryTemplatesService: QueryTemplatesService) {}

  // ==================== 공개 API (인증 불필요) ====================

  @Get('specialties')
  @ApiOperation({ summary: '전체 진료과 목록 조회', description: '7개 진료과 + 인기 시술 목록' })
  async getAllSpecialties() {
    return this.queryTemplatesService.getAllSpecialties();
  }

  @Get('specialties/:type/procedures')
  @ApiOperation({ summary: '진료과별 시술 목록', description: '프리셋 시술 DB 조회' })
  async getSpecialtyProcedures(@Param('type') type: string) {
    return this.queryTemplatesService.getSpecialtyPresets(type);
  }

  @Post('preview')
  @ApiOperation({ summary: '쿼리 미리보기 (저장 없이)', description: '14개(주간)/34개(월간) 생성될 쿼리 미리보기' })
  async previewQueries(
    @Body() body: {
      region: string;
      specialtyType: string;
      procedures: string[];
      includeMonthly?: boolean;
    },
  ) {
    return this.queryTemplatesService.previewQueries(
      body.region,
      body.specialtyType,
      body.procedures,
      body.includeMonthly ?? false,
    );
  }

  // ==================== 인증 필요 API ====================

  @Post('generate/:hospitalId')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: '병원 맞춤 쿼리 자동 생성',
    description: '병원의 진료과/지역/핵심시술 기반으로 14개(주간) 또는 34개(월간) 쿼리 자동 생성',
  })
  async generateQueries(
    @Param('hospitalId') hospitalId: string,
    @Query('includeMonthly') includeMonthly?: string,
  ) {
    return this.queryTemplatesService.generateQueriesForHospital(
      hospitalId,
      includeMonthly === 'true',
    );
  }

  @Get('suggest/:hospitalId')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: '병원 맞춤 질문 제안',
    description: '핵심 진료/지역/진료과/병원 강점 기반 질문 후보 제안 (이미 등록된 질문 제외)',
  })
  async suggestQuestions(@Param('hospitalId') hospitalId: string) {
    return this.queryTemplatesService.suggestQuestionsForHospital(hospitalId);
  }

  // ==================== 시스템 관리 API ====================

  @Post('seed/presets')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: '프리셋 시술 DB 시드', description: '7개 진료과 시술 데이터 초기화' })
  async seedPresets() {
    return this.queryTemplatesService.seedSpecialtyPresets();
  }

  @Post('seed/templates')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: '쿼리 템플릿 DB 시드', description: '14+20 쿼리 템플릿 초기화' })
  async seedTemplates() {
    return this.queryTemplatesService.seedQueryTemplates();
  }
}
