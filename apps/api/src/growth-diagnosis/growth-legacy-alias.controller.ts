import { Controller, Get, Param, Query, UseGuards, UseInterceptors } from '@nestjs/common';
import { ApiExcludeController } from '@nestjs/swagger';
import { HttpCacheInterceptor, CacheTTL } from '../common/cache/http-cache.interceptor';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { HospitalOwnershipGuard } from '../common/guards/hospital-ownership.guard';
import { GrowthDiagnosisService } from './growth-diagnosis.service';

/**
 * 구 경로 하위호환 별칭 — /api/lecture-metrics/*
 *
 * 배경: 경로를 /api/growth/* 로 옮겼지만 웹(Vercel)과 API(Render)는
 *       배포 시점이 다르다. 웹이 먼저 붙으면 신 경로를 부르고,
 *       API가 먼저 붙으면 구 웹이 구 경로를 부른다.
 *       어느 쪽이 먼저 붙어도 화면이 깨지지 않도록 양쪽을 잠시 함께 받는다.
 *
 * 제거 조건: 웹·API 양쪽 배포가 안정화된 뒤 이 파일과 모듈 등록을 삭제.
 *            Swagger에는 노출하지 않는다(@ApiExcludeController).
 */
@ApiExcludeController()
@Controller('lecture-metrics')
@UseGuards(JwtAuthGuard, HospitalOwnershipGuard)
@UseInterceptors(HttpCacheInterceptor)
@CacheTTL(600)
export class GrowthLegacyAliasController {
  constructor(private readonly service: GrowthDiagnosisService) {}

  private parseDays(days?: string): number {
    const n = parseInt(days ?? '30', 10);
    if (!Number.isFinite(n)) return 30;
    return Math.min(Math.max(n, 1), 365);
  }

  @Get(':hospitalId/summary')
  async summary(@Param('hospitalId') id: string, @Query('days') d?: string) {
    return this.service.getGrowthSummary(id, this.parseDays(d));
  }

  @Get(':hospitalId/citation-efficiency')
  async citationEfficiency(@Param('hospitalId') id: string, @Query('days') d?: string) {
    return this.service.getCitationEfficiency(id, this.parseDays(d));
  }

  @Get(':hospitalId/portfolio')
  async portfolio(@Param('hospitalId') id: string, @Query('days') d?: string) {
    return this.service.getPortfolioMap(id, this.parseDays(d));
  }

  @Get(':hospitalId/region-leverage')
  async regionLeverage(@Param('hospitalId') id: string, @Query('days') d?: string) {
    return this.service.getRegionLeverage(id, this.parseDays(d));
  }

  @Get(':hospitalId/director-branding')
  async directorBranding(@Param('hospitalId') id: string, @Query('days') d?: string) {
    return this.service.getDirectorBranding(id, this.parseDays(d));
  }

  @Get(':hospitalId/aeo-geo-split')
  async aeoGeoSplit(@Param('hospitalId') id: string, @Query('days') d?: string) {
    return this.service.getAeoGeoSplit(id, this.parseDays(d));
  }

  @Get(':hospitalId/language-scoreboard')
  async languageScoreboard(@Param('hospitalId') id: string, @Query('days') d?: string) {
    return this.service.getLanguageScoreboard(id, this.parseDays(d));
  }

  @Get(':hospitalId/difficulty')
  async difficulty(@Param('hospitalId') id: string, @Query('days') d?: string) {
    return this.service.getDifficultyBreakdown(id, this.parseDays(d));
  }

  @Get(':hospitalId/negative-alerts')
  async negativeAlerts(@Param('hospitalId') id: string, @Query('days') d?: string) {
    return this.service.getNegativeAlerts(id, this.parseDays(d));
  }
}
