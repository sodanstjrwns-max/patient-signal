import {
  Controller,
  Get,
  Post,
  Param,
  Body,
  Query,
  UseGuards,
  Request,
  Patch,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiParam, ApiQuery } from '@nestjs/swagger';
import { JwtAuthGuard as AuthGuard } from '../auth/guards/jwt-auth.guard';
import { CitationAnalyzerService } from './citation-analyzer.service';
import { Throttle } from '@nestjs/throttler';

/**
 * ═══════════════════════════════════════════════════════════
 *  AI 인용 역분석 + 56주 콘텐츠 캘린더 API
 * 
 *  엔드포인트:
 *  - POST /citation-analysis/:hospitalId/analyze       → 단일 키워드 역분석
 *  - POST /citation-analysis/:hospitalId/analyze-bulk   → 일괄 역분석 (PRO)
 *  - GET  /citation-analysis/:hospitalId/recent         → 최근 분석 이력
 *  - GET  /citation-analysis/:hospitalId/stats          → 인용 통계
 *  - POST /citation-analysis/:hospitalId/geo-prompt     → GEO 프롬프트 강화 지시어
 *  - POST /citation-analysis/:hospitalId/calendar       → 56주 캘린더 생성
 *  - GET  /citation-analysis/:hospitalId/calendar       → 캘린더 조회
 *  - POST /citation-analysis/:hospitalId/calendar/:week → 주차별 역분석
 *  - PATCH /citation-analysis/:hospitalId/calendar/:week → 캘린더 항목 수정
 * ═══════════════════════════════════════════════════════════
 */

@ApiTags('인용 역분석 & 콘텐츠 캘린더')
@Controller('citation-analysis')
@UseGuards(AuthGuard)
@ApiBearerAuth()
export class CitationAnalyzerController {
  constructor(private citationAnalyzerService: CitationAnalyzerService) {}

  // ================================================================
  // 인용 역분석 API
  // ================================================================

  /**
   * 단일 키워드에 대한 인용 역분석 실행
   * - 상위 인용 페이지 크롤링 → 패턴 분석 → 구체 SEO 지시어 생성
   */
  @Post(':hospitalId/analyze')
  @Throttle({ default: { limit: 5, ttl: 60000 } }) // 1분에 5회
  @ApiOperation({
    summary: 'AI 인용 역분석 실행',
    description: '특정 키워드에 대해 AI가 인용한 상위 페이지를 역분석하여 SEO 지시어를 생성합니다. 네이버 AI 브리핑 + 구글 AI Overview + ChatGPT/Perplexity 인용 최적화를 위한 구체적 액션 아이템을 제공합니다.',
  })
  @ApiParam({ name: 'hospitalId', description: '병원 ID' })
  async analyzeForQuery(
    @Param('hospitalId') hospitalId: string,
    @Request() req: any,
    @Body() body: {
      query: string;
      maxPages?: number;
      includeOurContent?: string;
    },
  ) {
    // 권한 검증
    if (req.user?.hospitalId !== hospitalId) {
      return { error: '접근 권한이 없습니다' };
    }

    if (!body.query || body.query.trim().length < 2) {
      return { error: '분석할 키워드를 입력해주세요 (2자 이상)' };
    }

    try {
      const result = await this.citationAnalyzerService.analyzeForQuery(
        hospitalId,
        body.query.trim(),
        {
          maxPages: body.maxPages || 5,
          includeOurContent: body.includeOurContent,
        },
      );

      return {
        success: true,
        data: result,
        meta: {
          analyzedAt: new Date().toISOString(),
          pagesAnalyzed: result.analyzedPages.length,
          directivesGenerated: result.directives.length,
          costEstimate: '약 ₩200~500',
        },
      };
    } catch (error) {
      return {
        success: false,
        error: error.message || '역분석 중 오류가 발생했습니다',
      };
    }
  }

  /**
   * 일괄 역분석 (상위 인용 키워드 자동 분석 + 캘린더 연동)
   */
  @Post(':hospitalId/analyze-bulk')
  @Throttle({ default: { limit: 2, ttl: 300000 } }) // 5분에 2회
  @ApiOperation({
    summary: '일괄 역분석 (PRO 전용)',
    description: '최근 30일간 인용 빈도 높은 키워드를 자동으로 분석하고, 56주 캘린더에 SEO 지시어를 주입합니다.',
  })
  @ApiParam({ name: 'hospitalId', description: '병원 ID' })
  async analyzeBulk(
    @Param('hospitalId') hospitalId: string,
    @Request() req: any,
    @Body() body: { limit?: number },
  ) {
    if (req.user?.hospitalId !== hospitalId) {
      return { error: '접근 권한이 없습니다' };
    }

    try {
      const result = await this.citationAnalyzerService.analyzeBulk(hospitalId, {
        limit: body.limit || 10,
      });

      return {
        success: true,
        data: result,
        message: `${result.totalAnalyzed}개 키워드 분석 완료, ${result.calendarUpdated}개 캘린더 항목 업데이트`,
      };
    } catch (error) {
      return {
        success: false,
        error: error.message || '일괄 분석 중 오류가 발생했습니다',
      };
    }
  }

  /**
   * 최근 역분석 이력 조회
   */
  @Get(':hospitalId/recent')
  @ApiOperation({ summary: '최근 역분석 이력 조회' })
  @ApiParam({ name: 'hospitalId', description: '병원 ID' })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  async getRecentAnalyses(
    @Param('hospitalId') hospitalId: string,
    @Request() req: any,
    @Query('limit') limit?: string,
  ) {
    if (req.user?.hospitalId !== hospitalId) {
      return { error: '접근 권한이 없습니다' };
    }

    const analyses = await this.citationAnalyzerService.getRecentAnalyses(
      hospitalId,
      limit ? parseInt(limit) : 10,
    );

    return { success: true, data: analyses };
  }

  /**
   * 인용 통계 (도메인별 인용 빈도, 네이버 인용률 등)
   */
  @Get(':hospitalId/stats')
  @ApiOperation({
    summary: '인용 출처 통계',
    description: '최근 30일간 AI 응답에서 인용된 출처 도메인별 통계. 네이버/구글/의료사이트 등 어디에서 인용되는지 파악.',
  })
  @ApiParam({ name: 'hospitalId', description: '병원 ID' })
  async getCitationStats(
    @Param('hospitalId') hospitalId: string,
    @Request() req: any,
  ) {
    if (req.user?.hospitalId !== hospitalId) {
      return { error: '접근 권한이 없습니다' };
    }

    const stats = await this.citationAnalyzerService.getCitationStats(hospitalId);

    return { success: true, data: stats };
  }

  /**
   * GEO 콘텐츠 생성 시 역분석 기반 프롬프트 강화 지시어 조회
   * - GeoContentService.generate()에서 additionalInstructions로 주입
   */
  @Post(':hospitalId/geo-prompt')
  @ApiOperation({
    summary: 'GEO 콘텐츠 프롬프트 강화 지시어 생성',
    description: '역분석 결과를 기반으로 GEO 콘텐츠 생성 시 프롬프트에 추가할 SEO 지시어를 생성합니다.',
  })
  @ApiParam({ name: 'hospitalId', description: '병원 ID' })
  async buildGeoPromptEnhancement(
    @Param('hospitalId') hospitalId: string,
    @Request() req: any,
    @Body() body: { targetKeyword: string },
  ) {
    if (req.user?.hospitalId !== hospitalId) {
      return { error: '접근 권한이 없습니다' };
    }

    if (!body.targetKeyword) {
      return { error: '타겟 키워드를 입력해주세요' };
    }

    try {
      const enhancement = await this.citationAnalyzerService.buildGeoPromptEnhancement(
        hospitalId,
        body.targetKeyword,
      );

      return {
        success: true,
        data: enhancement,
        usage: '이 additionalInstructions를 GEO 콘텐츠 생성 시 추가 지시사항으로 전달하세요.',
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
      };
    }
  }

  // ================================================================
  // 56주 콘텐츠 캘린더 API
  // ================================================================

  /**
   * 56주 콘텐츠 캘린더 생성
   * - AI가 병원 특성에 맞게 56주치 콘텐츠 계획 자동 생성
   */
  @Post(':hospitalId/calendar')
  @Throttle({ default: { limit: 3, ttl: 300000 } }) // 5분에 3회
  @ApiOperation({
    summary: '56주 콘텐츠 캘린더 생성',
    description: '병원의 핵심 시술, 지역, 퍼널 단계를 고려하여 56주치 콘텐츠 계획을 AI가 자동으로 생성합니다. 기존 캘린더는 덮어씁니다.',
  })
  @ApiParam({ name: 'hospitalId', description: '병원 ID' })
  async generateCalendar(
    @Param('hospitalId') hospitalId: string,
    @Request() req: any,
  ) {
    if (req.user?.hospitalId !== hospitalId) {
      return { error: '접근 권한이 없습니다' };
    }

    try {
      const result = await this.citationAnalyzerService.generateCalendar(hospitalId);

      return {
        success: true,
        data: result,
        message: `${result.created}주 콘텐츠 캘린더가 생성되었습니다 (${result.weekRange})`,
      };
    } catch (error) {
      return {
        success: false,
        error: error.message || '캘린더 생성 중 오류가 발생했습니다',
      };
    }
  }

  /**
   * 56주 캘린더 목록 조회
   */
  @Get(':hospitalId/calendar')
  @ApiOperation({ summary: '56주 콘텐츠 캘린더 조회' })
  @ApiParam({ name: 'hospitalId', description: '병원 ID' })
  @ApiQuery({ name: 'status', required: false, description: 'PLANNED, ANALYZED, GENERATING, PUBLISHED, SKIPPED' })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'offset', required: false, type: Number })
  async getCalendar(
    @Param('hospitalId') hospitalId: string,
    @Request() req: any,
    @Query('status') status?: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    if (req.user?.hospitalId !== hospitalId) {
      return { error: '접근 권한이 없습니다' };
    }

    const result = await this.citationAnalyzerService.getCalendar(hospitalId, {
      status,
      limit: limit ? parseInt(limit) : undefined,
      offset: offset ? parseInt(offset) : undefined,
    });

    return { success: true, data: result };
  }

  /**
   * 특정 주차에 대한 인용 역분석 실행 → SEO 지시어 캘린더에 주입
   */
  @Post(':hospitalId/calendar/:weekNumber/analyze')
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @ApiOperation({
    summary: '주차별 인용 역분석 실행',
    description: '캘린더의 특정 주차 주제에 대해 인용 역분석을 실행하고, SEO 지시어를 캘린더에 자동 주입합니다.',
  })
  @ApiParam({ name: 'hospitalId', description: '병원 ID' })
  @ApiParam({ name: 'weekNumber', description: '주차 번호 (1~56)' })
  async analyzeCalendarWeek(
    @Param('hospitalId') hospitalId: string,
    @Param('weekNumber') weekNumber: string,
    @Request() req: any,
  ) {
    if (req.user?.hospitalId !== hospitalId) {
      return { error: '접근 권한이 없습니다' };
    }

    const week = parseInt(weekNumber);
    if (isNaN(week) || week < 1 || week > 56) {
      return { error: '주차 번호는 1~56 사이여야 합니다' };
    }

    try {
      const result = await this.citationAnalyzerService.analyzeCalendarWeek(hospitalId, week);

      return {
        success: true,
        data: {
          calendarItem: result.calendarItem,
          analysis: {
            targetKeyword: result.analysis.targetKeyword,
            pagesAnalyzed: result.analysis.analyzedPages.length,
            directivesCount: result.analysis.directives.length,
            contentScore: result.analysis.contentScore,
            seoUpgrade: result.analysis.seoUpgrade,
            directives: result.analysis.directives,
            summary: result.analysis.summary,
          },
        },
        message: `${week}주차 역분석 완료. SEO 지시어가 캘린더에 주입되었습니다.`,
      };
    } catch (error) {
      return {
        success: false,
        error: error.message || '주차 분석 중 오류가 발생했습니다',
      };
    }
  }

  /**
   * 캘린더 항목 수동 수정
   */
  @Patch(':hospitalId/calendar/:weekNumber')
  @ApiOperation({ summary: '캘린더 항목 수정' })
  @ApiParam({ name: 'hospitalId', description: '병원 ID' })
  @ApiParam({ name: 'weekNumber', description: '주차 번호' })
  async updateCalendarItem(
    @Param('hospitalId') hospitalId: string,
    @Param('weekNumber') weekNumber: string,
    @Request() req: any,
    @Body() body: {
      topic?: string;
      targetKeyword?: string;
      funnelStage?: string;
      procedure?: string;
      contentType?: string;
      priority?: string;
      status?: string;
      notes?: string;
      geoContentId?: string;
    },
  ) {
    if (req.user?.hospitalId !== hospitalId) {
      return { error: '접근 권한이 없습니다' };
    }

    const week = parseInt(weekNumber);
    if (isNaN(week) || week < 1 || week > 56) {
      return { error: '주차 번호는 1~56 사이여야 합니다' };
    }

    try {
      const { PrismaClient } = require('@prisma/client');
      // Direct prisma access for flexibility
      const updated = await (this.citationAnalyzerService as any).prisma.contentCalendar.update({
        where: { hospitalId_weekNumber: { hospitalId, weekNumber: week } },
        data: {
          ...(body.topic && { topic: body.topic }),
          ...(body.targetKeyword && { targetKeyword: body.targetKeyword }),
          ...(body.funnelStage && { funnelStage: body.funnelStage }),
          ...(body.procedure && { procedure: body.procedure }),
          ...(body.contentType && { contentType: body.contentType }),
          ...(body.priority && { priority: body.priority }),
          ...(body.status && { status: body.status }),
          ...(body.notes !== undefined && { notes: body.notes }),
          ...(body.geoContentId && { geoContentId: body.geoContentId }),
        },
      });

      return { success: true, data: updated };
    } catch (error) {
      return {
        success: false,
        error: error.message || '캘린더 항목 수정 중 오류가 발생했습니다',
      };
    }
  }
}
