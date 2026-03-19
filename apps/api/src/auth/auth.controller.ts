import { Controller, Post, Body, Get, Query, Res, UseGuards, HttpCode, HttpStatus } from '@nestjs/common';
import type { Response } from 'express';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { Throttle, SkipThrottle } from '@nestjs/throttler';
import { AuthService } from './auth.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { Public } from './decorators/public.decorator';
import { CurrentUser } from './decorators/current-user.decorator';
import { JwtAuthGuard } from './guards/jwt-auth.guard';

@ApiTags('인증')
@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  @Public()
  @Post('register')
  @Throttle({ default: { limit: 5, ttl: 60000 } }) // 1분에 5회 제한
  @ApiOperation({ summary: '회원가입', description: '새로운 사용자를 등록합니다' })
  @ApiResponse({ status: 201, description: '회원가입 성공' })
  @ApiResponse({ status: 409, description: '이미 등록된 이메일' })
  async register(@Body() dto: RegisterDto) {
    return this.authService.register(dto);
  }

  @Public()
  @Post('login')
  @Throttle({ default: { limit: 10, ttl: 60000 } }) // 1분에 10회 제한 (브루트포스 방지)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '로그인', description: '이메일과 비밀번호로 로그인합니다' })
  @ApiResponse({ status: 200, description: '로그인 성공' })
  @ApiResponse({ status: 401, description: '인증 실패' })
  async login(@Body() dto: LoginDto) {
    return this.authService.login(dto);
  }

  @UseGuards(JwtAuthGuard)
  @Get('profile')
  @ApiBearerAuth()
  @ApiOperation({ summary: '프로필 조회', description: '현재 로그인한 사용자 정보를 조회합니다' })
  @ApiResponse({ status: 200, description: '프로필 조회 성공' })
  @ApiResponse({ status: 401, description: '인증 필요' })
  async getProfile(@CurrentUser('id') userId: string) {
    return this.authService.getProfile(userId);
  }

  @Public()
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '토큰 갱신', description: 'Refresh 토큰으로 새 Access 토큰을 발급받습니다' })
  async refreshToken(@Body('refreshToken') refreshToken: string) {
    return this.authService.refreshToken(refreshToken);
  }

  @Public()
  @Post('google')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Google 로그인', description: 'Google ID 토큰으로 로그인합니다' })
  @ApiResponse({ status: 200, description: '로그인 성공' })
  @ApiResponse({ status: 401, description: 'Google 인증 실패' })
  async googleLogin(@Body('idToken') idToken: string) {
    return this.authService.googleLogin(idToken);
  }

  @Public()
  @SkipThrottle()
  @Get('google/debug')
  @ApiOperation({ summary: 'Google OAuth 디버깅', description: '현재 Google OAuth 설정 상태를 확인합니다' })
  async googleDebug() {
    const clientId = process.env.GOOGLE_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
    const frontendUrl = process.env.FRONTEND_URL;
    
    // 실제 Google token endpoint에 가짜 코드로 테스트 → client_id/secret 유효성 확인
    let tokenEndpointTest = 'not tested';
    try {
      const testParams = new URLSearchParams({
        code: 'test_invalid_code',
        client_id: clientId || '',
        client_secret: clientSecret || '',
        redirect_uri: 'https://patient-signal-1.onrender.com/api/auth/google/callback',
        grant_type: 'authorization_code',
      });
      const testRes = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: testParams.toString(),
      });
      const testData = await testRes.json();
      // invalid_grant = client credentials are OK, code is invalid (expected)
      // invalid_client = client credentials are WRONG
      tokenEndpointTest = `${testData.error}: ${testData.error_description || 'no description'}`;
    } catch (e) {
      tokenEndpointTest = `fetch error: ${e.message}`;
    }

    return {
      hasClientId: !!clientId,
      clientIdPreview: clientId ? clientId.substring(0, 20) + '...' : 'NOT SET',
      hasClientSecret: !!clientSecret,
      clientSecretPreview: clientSecret ? clientSecret.substring(0, 8) + '...' : 'NOT SET',
      clientSecretLength: clientSecret?.length || 0,
      frontendUrl: frontendUrl || 'NOT SET (using fallback: patient-signal-web-2bbe.vercel.app)',
      redirectUri: 'https://patient-signal-1.onrender.com/api/auth/google/callback',
      tokenEndpointTest,
      tokenEndpointTestNote: 'invalid_grant = credentials OK (expected with fake code), invalid_client = credentials WRONG',
      timestamp: new Date().toISOString(),
    };
  }

  @Public()
  @SkipThrottle() // Google 콜백은 Rate Limit 제외
  @Get('google/callback')
  @ApiOperation({ summary: 'Google OAuth 콜백', description: 'Google OAuth 인증 후 콜백 처리' })
  async googleCallback(
    @Query('code') code: string,
    @Query('error') error: string,
    @Res() res: Response,
  ) {
    const frontendUrl = process.env.FRONTEND_URL || 'https://patient-signal-web-2bbe.vercel.app';
    
    if (error) {
      return res.redirect(`${frontendUrl}/login?error=${encodeURIComponent(error)}`);
    }

    if (!code) {
      return res.redirect(`${frontendUrl}/login?error=missing_code`);
    }

    try {
      const result = await this.authService.googleCallbackLogin(code);
      
      // 프론트엔드로 토큰과 함께 리다이렉트
      const redirectUrl = result.user.hospitalId ? '/dashboard' : '/onboarding';
      const params = new URLSearchParams({
        accessToken: result.accessToken,
        refreshToken: result.refreshToken,
        user: JSON.stringify(result.user),
        redirect: redirectUrl,
      });
      
      return res.redirect(`${frontendUrl}/auth/callback?${params.toString()}`);
    } catch (err) {
      console.error('Google callback error:', err?.message || err);
      // 에러 메시지를 상세히 URL로 전달
      const errorMsg = err?.message || 'google_auth_failed';
      let errorCode = 'google_auth_failed';
      if (errorMsg.includes('invalid_client')) errorCode = 'invalid_client';
      else if (errorMsg.includes('invalid_grant')) errorCode = 'invalid_grant';
      else if (errorMsg.includes('redirect_uri_mismatch')) errorCode = 'redirect_uri_mismatch';
      else if (errorMsg.includes('token')) errorCode = 'token_exchange_failed';
      else if (errorMsg.includes('verified')) errorCode = 'email_not_verified';
      return res.redirect(`${frontendUrl}/login?error=${errorCode}&detail=${encodeURIComponent(errorMsg.substring(0, 300))}`);
    }
  }

  @Public()
  @Post('forgot-password')
  @Throttle({ default: { limit: 3, ttl: 60000 } }) // 1분에 3회 제한 (스팸 방지)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '비밀번호 찾기', description: '비밀번호 재설정 이메일을 발송합니다' })
  @ApiResponse({ status: 200, description: '이메일 발송 성공' })
  async forgotPassword(@Body('email') email: string) {
    return this.authService.forgotPassword(email);
  }

  @Public()
  @Post('reset-password')
  @Throttle({ default: { limit: 5, ttl: 60000 } }) // 1분에 5회 제한
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '비밀번호 재설정', description: '새 비밀번호로 변경합니다' })
  @ApiResponse({ status: 200, description: '비밀번호 변경 성공' })
  async resetPassword(
    @Body('token') token: string,
    @Body('password') password: string,
  ) {
    return this.authService.resetPassword(token, password);
  }
}
