import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  Query,
  UseGuards,
  Request,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiParam, ApiQuery } from '@nestjs/swagger';
import { GeoContentService } from './geo-content.service';
import { AuthGuard } from '../auth/auth.guard';

@ApiTags('GEO 콘텐츠')
@Controller('geo-content')
@UseGuards(AuthGuard)
@ApiBearerAuth()
export class GeoContentController {
  constructor(private geoContentService: GeoContentService) {}

  /**
   * GEO 콘텐츠 목록 조회
   */
  @Get()
  @ApiOperation({ summary: 'GEO 콘텐츠 목록 조회' })
  @ApiQuery({ name: 'status', required: false })
  @ApiQuery({ name: 'funnelStage', required: false })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'offset', required: false, type: Number })
  async findAll(
    @Request() req: any,
    @Query('status') status?: string,
    @Query('funnelStage') funnelStage?: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    const hospitalId = req.user?.hospitalId;
    if (!hospitalId) return { items: [], total: 0 };

    return this.geoContentService.findAll(hospitalId, {
      status,
      funnelStage,
      limit: limit ? parseInt(limit) : undefined,
      offset: offset ? parseInt(offset) : undefined,
    });
  }

  /**
   * GEO 콘텐츠 통계
   */
  @Get('stats')
  @ApiOperation({ summary: 'GEO 콘텐츠 대시보드 통계' })
  async getStats(@Request() req: any) {
    const hospitalId = req.user?.hospitalId;
    if (!hospitalId) return { total: 0, byStatus: {}, byFunnel: {}, recentContents: [] };

    return this.geoContentService.getStats(hospitalId);
  }

  /**
   * GEO 콘텐츠 상세 조회
   */
  @Get(':id')
  @ApiOperation({ summary: 'GEO 콘텐츠 상세 조회' })
  @ApiParam({ name: 'id', description: '콘텐츠 ID' })
  async findOne(@Param('id') id: string, @Request() req: any) {
    const hospitalId = req.user?.hospitalId;
    return this.geoContentService.findOne(id, hospitalId);
  }

  /**
   * AI GEO 콘텐츠 생성
   */
  @Post('generate')
  @ApiOperation({ summary: 'AI GEO 콘텐츠 생성' })
  async generate(
    @Request() req: any,
    @Body() body: {
      topic: string;
      funnelStage: string;
      contentTone?: string;
      targetKeywords?: string[];
      procedure?: string;
      relatedPromptIds?: string[];
      includeCardNews?: boolean;
      additionalInstructions?: string;
    },
  ) {
    const hospitalId = req.user?.hospitalId;
    if (!hospitalId) {
      return { error: '병원 등록이 필요합니다' };
    }

    return this.geoContentService.generate(hospitalId, body);
  }

  /**
   * GEO 콘텐츠 수정
   */
  @Patch(':id')
  @ApiOperation({ summary: 'GEO 콘텐츠 수정' })
  @ApiParam({ name: 'id', description: '콘텐츠 ID' })
  async update(
    @Param('id') id: string,
    @Request() req: any,
    @Body() body: any,
  ) {
    const hospitalId = req.user?.hospitalId;
    return this.geoContentService.update(id, hospitalId, body);
  }

  /**
   * GEO 콘텐츠 삭제
   */
  @Delete(':id')
  @ApiOperation({ summary: 'GEO 콘텐츠 삭제' })
  @ApiParam({ name: 'id', description: '콘텐츠 ID' })
  async delete(@Param('id') id: string, @Request() req: any) {
    const hospitalId = req.user?.hospitalId;
    return this.geoContentService.delete(id, hospitalId);
  }

  /**
   * 발행 추가/업데이트
   */
  @Post(':id/publish')
  @ApiOperation({ summary: '콘텐츠 발행 (플랫폼별)' })
  @ApiParam({ name: 'id', description: '콘텐츠 ID' })
  async publish(
    @Param('id') id: string,
    @Request() req: any,
    @Body() body: {
      platform: string;
      publishedUrl?: string;
      scheduledAt?: string;
    },
  ) {
    const hospitalId = req.user?.hospitalId;
    return this.geoContentService.addPublication(id, hospitalId, body.platform, body);
  }
}
