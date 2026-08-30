import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Headers,
  Post,
  Query,
  Req,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { Public } from '../auth/decorators/public.decorator';
import { PsServiceKeyGuard } from './guards/ps-service-key.guard';
import { PsOpenApiService } from './ps-open-api.service';
import { HubProfileService } from '../hospitals/hub-profile.service';

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
  constructor(
    private readonly psOpenApiService: PsOpenApiService,
    private readonly hubProfileService: HubProfileService,
  ) {}

  /**
   * POST /api/v1/hub-events — 허브 → 시그널 push 캐시 무효화 웹훅
   * 허브가 병원 프로필 변경 시 호출. 해당 병원의 메모리 캐시를 지워
   * 다음 조회 때 신선한 프로필을 pull 하게 한다.
   * 인증: Authorization: Bearer {PS_SSO_SECRET} (허브 SSO 공유 시크릿 — 자체 검증)
   */
  @Public() // JWT 스킵 — 아래에서 PS_SSO_SECRET Bearer를 직접 검증
  @Post('hub-events')
  hubEvents(
    @Headers('authorization') authorization: string | undefined,
    @Body() body: { type?: string; ps_hospital_id?: string } | undefined,
  ) {
    const secret = process.env.PS_SSO_SECRET?.trim();
    const header = authorization || '';
    const token = header.startsWith('Bearer ') ? header.slice(7).trim() : '';
    if (!secret || !token || token !== secret) {
      throw new UnauthorizedException('유효하지 않은 인증입니다.');
    }
    const psId = typeof body?.ps_hospital_id === 'string' ? body.ps_hospital_id.trim() : '';
    if (!psId) throw new BadRequestException('ps_hospital_id가 필요합니다.');
    this.hubProfileService.invalidate(psId);
    return { ok: true };
  }

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
