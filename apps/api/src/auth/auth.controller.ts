import { Controller, Post, Body, Get, Query, Res, UseGuards, HttpCode, HttpStatus } from '@nestjs/common';
import type { Response } from 'express';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
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
  @ApiOperation({ summary: '회원가입', description: '새로운 사용자를 등록합니다' })
  @ApiResponse({ status: 201, description: '회원가입 성공' })
  @ApiResponse({ status: 409, description: '이미 등록된 이메일' })
  async register(@Body() dto: RegisterDto) {
    return this.authService.register(dto);
  }

  @Public()
  @Post('login')
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
  @Get('google/callback')
  @ApiOperation({ summary: 'Google OAuth 콜백', description: 'Google OAuth 인증 후 콜백 처리' })
  async googleCallback(
    @Query('code') code: string,
    @Query('error') error: string,
    @Res() res: Response,
  ) {
    const frontendUrl = 'https://patient-signal-web-2bbe.vercel.app';
    
    if (error) {
      return res.redirect(`${frontendUrl}/login?error=${encodeURIComponent(error)}`);
    }

    try {
      const result = await this.authService.googleCallbackLogin(code);
      
      // 프론트엔드로 토큰과 함께 리다이렉트
      const redirectUrl = result.user.hospitalId ? '/dashboard' : '/onboarding';
      const params = new URLSearchParams({
        accessToken: result.accessToken,
        refreshToken: result.refreshToken,
        user: JSON.stringify(result.user),
      });
      
      return res.redirect(`${frontendUrl}/auth/callback?${params.toString()}&redirect=${redirectUrl}`);
    } catch (err) {
      console.error('Google callback error:', err);
      return res.redirect(`${frontendUrl}/login?error=google_auth_failed`);
    }
  }

  @Public()
  @Post('forgot-password')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '비밀번호 찾기', description: '비밀번호 재설정 이메일을 발송합니다' })
  @ApiResponse({ status: 200, description: '이메일 발송 성공' })
  async forgotPassword(@Body('email') email: string) {
    return this.authService.forgotPassword(email);
  }

  @Public()
  @Post('reset-password')
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
