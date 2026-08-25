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
}
