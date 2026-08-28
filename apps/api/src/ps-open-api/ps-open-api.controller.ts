import { Controller, Get, Query, Req, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { Public } from '../auth/decorators/public.decorator';
import { PsServiceKeyGuard } from './guards/ps-service-key.guard';
import { PsOpenApiService } from './ps-open-api.service';

/**
 * 【PS-통합】Patient Series Open API v1
 *
 * 소비자: Patient Sync(회의 안건), Patient Hub(대시보드)
 * 인증: Authorization: Bearer {PS_SERVICE_KEY} + X-PS-Hospital-Id
 *
 * 글로벌 프리픽스 'api' 적용 → 최종 경로: GET /api/v1/signals
 */
@ApiTags('PS Open API')
@Controller('v1')
@Throttle({ default: { limit: 60, ttl: 60000 } }) // 서비스 간 폴링용: 1분 60회
export class PsOpenApiController {
  constructor(private readonly psOpenApiService: PsOpenApiService) {}

  /**
   * GET /api/v1/signals?since={ISO8601, 선택}
   * §1 규격: { service: "signal", signals: [...] }
   */
  @Public() // JWT 스킵 — PsServiceKeyGuard가 Bearer 검증
  @UseGuards(PsServiceKeyGuard)
  @Get('signals')
  async getSignals(@Req() req: any, @Query('since') since?: string) {
    const { localHospitalId } = req.psHospital;
    return this.psOpenApiService.getSignals(localHospitalId, since);
  }

  /**
   * GET /api/v1/ops/crawl-coverage?q={병원명 일부, 2자 이상 필수}
   * 운영용: 이름이 일치하는 병원들의 최근 14일 크롤 커버리지 집계 (비식별 — 이름·건수·날짜만).
   * 용도: PS_HOSPITAL_MAP이 가리킬 "크롤이 가장 활발한 테넌트" 선정 근거.
   * 인증은 동일 가드 — X-PS-Hospital-Id는 형식상 필요(매핑된 아무 값), 응답은 그와 무관.
   */
  @Public()
  @UseGuards(PsServiceKeyGuard)
  @Get('ops/crawl-coverage')
  async crawlCoverage(@Query('q') q?: string) {
    return this.psOpenApiService.getCrawlCoverage(q);
  }
}
