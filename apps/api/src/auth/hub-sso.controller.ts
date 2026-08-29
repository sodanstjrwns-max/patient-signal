import { Body, Controller, Get, HttpCode, HttpStatus, Post, Res } from '@nestjs/common';
import type { Response } from 'express';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { SkipThrottle, Throttle } from '@nestjs/throttler';
import { Public } from './decorators/public.decorator';
import { HubSsoService } from './hub-sso.service';

/**
 * Patient Hub SSO (hub.patientfunnel.kr)
 *
 * 흐름:
 *   1. GET /api/auth/hub → 허브 authorize로 302
 *      (redirect_uri = https://patientsignal.kr/auth/hub/callback)
 *   2. 허브가 프론트 콜백 페이지로 ?sso_token=<JWT> 전달
 *   3. 프론트가 POST /api/auth/hub/callback { ssoToken } → 검증 후
 *      시그널 정상 로그인과 동일한 accessToken/refreshToken 발급
 *
 * PS_SSO_SECRET 미설정 시: 시작 라우트는 로그인 화면으로 안내 리다이렉트,
 * 콜백 API는 503 (우아한 비활성).
 */
@ApiTags('인증')
@Controller('auth/hub')
export class HubSsoController {
  constructor(private hubSsoService: HubSsoService) {}

  @Public()
  @SkipThrottle()
  @Get()
  @ApiOperation({
    summary: 'Patient Hub SSO 시작',
    description: '허브 authorize 페이지로 리다이렉트합니다 (미설정 시 로그인 화면 안내)',
  })
  @ApiResponse({ status: 302, description: '허브 authorize로 리다이렉트' })
  hubStart(@Res() res: Response) {
    if (!this.hubSsoService.isConfigured()) {
      // 브라우저 내비게이션 라우트이므로 JSON 503 대신 로그인 화면으로 안내
      const frontendUrl = process.env.FRONTEND_URL || 'https://patientsignal.kr';
      return res.redirect(`${frontendUrl}/login?error=hub_sso_not_configured`);
    }
    return res.redirect(this.hubSsoService.buildAuthorizeUrl());
  }

  @Public()
  @Post('callback')
  @Throttle({ default: { limit: 10, ttl: 60000 } }) // 브루트포스 방지 (로그인과 동일)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Patient Hub SSO 콜백',
    description: '허브가 발급한 sso_token을 검증하고 시그널 토큰을 발급합니다',
  })
  @ApiResponse({ status: 200, description: 'SSO 로그인 성공' })
  @ApiResponse({ status: 401, description: 'SSO 토큰 검증 실패' })
  @ApiResponse({ status: 503, description: 'SSO 미설정 (PS_SSO_SECRET 없음)' })
  async hubCallback(@Body('ssoToken') ssoToken: string) {
    return this.hubSsoService.loginWithToken(ssoToken || '');
  }
}
