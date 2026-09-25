import { BadRequestException, Controller, Get, Param, Query, UseGuards, UseInterceptors } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { AIPlatform } from '@prisma/client';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { HospitalOwnershipGuard } from '../common/guards/hospital-ownership.guard';
import { HttpCacheInterceptor, CacheTTL } from '../common/cache/http-cache.interceptor';
import { withHeavySlot } from '../common/heavy-slot';
import { WebsiteAnalysisService } from './website-analysis.service';

function integerQuery(value: string | undefined, fallback: number, min: number, max: number, name: string) {
  if (value === undefined) return fallback;
  if (!/^\d+$/.test(value)) throw new BadRequestException(`${name}은 정수여야 합니다.`);
  const number = Number(value);
  if (!Number.isSafeInteger(number) || number < min || number > max) {
    throw new BadRequestException(`${name}은 ${min}~${max} 사이여야 합니다.`);
  }
  return number;
}

@ApiTags('홈페이지 페이지별 AI 인용')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, HospitalOwnershipGuard)
@Controller('ai-crawler/website-analysis')
export class WebsiteAnalysisController {
  constructor(private readonly websiteAnalysis: WebsiteAnalysisService) {}

  @Get(':hospitalId')
  @UseInterceptors(HttpCacheInterceptor)
  @CacheTTL(300)
  @ApiOperation({ summary: '저장된 AI 답변에서 홈페이지의 페이지별 실제 인용 집계' })
  @ApiQuery({ name: 'days', required: false, description: '최근 N일, 기본 30일·최대 90일' })
  @ApiQuery({ name: 'platform', required: false, description: 'AIPlatform 또는 ALL' })
  @ApiQuery({ name: 'domain', required: false, description: '조회할 도메인; 생략 시 병원 홈페이지' })
  @ApiQuery({ name: 'page', required: false, description: '페이지 목록 1부터 시작' })
  @ApiQuery({ name: 'pageSize', required: false, description: '페이지 목록 기본 25, 최대 100' })
  async getAnalysis(
    @Param('hospitalId') hospitalId: string,
    @Query('days') days?: string,
    @Query('platform') platform?: string,
    @Query('domain') domain?: string,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ) {
    const selectedPlatform = platform || 'ALL';
    if (selectedPlatform !== 'ALL' &&
      !Object.values(AIPlatform).includes(selectedPlatform as AIPlatform)) {
      throw new BadRequestException('지원하지 않는 AI 플랫폼입니다.');
    }
    return withHeavySlot(() => this.websiteAnalysis.getAnalysis(hospitalId, {
      days: integerQuery(days, 30, 1, 90, 'days'),
      platform: selectedPlatform as AIPlatform | 'ALL',
      domain,
      page: integerQuery(page, 1, 1, 100_000, 'page'),
      pageSize: integerQuery(pageSize, 25, 1, 100, 'pageSize'),
    }));
  }
}
