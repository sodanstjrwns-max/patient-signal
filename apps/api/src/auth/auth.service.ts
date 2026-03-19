import { Injectable, UnauthorizedException, ConflictException, Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../common/prisma/prisma.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { OAuth2Client } from 'google-auth-library';
import { EmailService } from '../email/email.service';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);
  private googleClient: OAuth2Client;

  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
    private configService: ConfigService,
    private emailService: EmailService,
  ) {
    // configService 또는 process.env에서 직접 읽기
    const clientId = this.configService.get('GOOGLE_CLIENT_ID') || process.env.GOOGLE_CLIENT_ID;
    const clientSecret = this.configService.get('GOOGLE_CLIENT_SECRET') || process.env.GOOGLE_CLIENT_SECRET;
    
    this.logger.log(`Google OAuth init: clientId=${clientId?.substring(0, 20)}..., hasSecret=${!!clientSecret}, secretLen=${clientSecret?.length}`);
    
    this.googleClient = new OAuth2Client(clientId, clientSecret);
  }

  async register(dto: RegisterDto) {
    // 이메일 중복 확인
    const existingUser = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });

    if (existingUser) {
      throw new ConflictException('이미 등록된 이메일입니다');
    }

    // 비밀번호 해싱
    const passwordHash = await bcrypt.hash(dto.password, 10);

    // 사용자 생성
    const user = await this.prisma.user.create({
      data: {
        email: dto.email,
        passwordHash,
        name: dto.name,
        phone: dto.phone,
        isPfMember: dto.isPfMember || false,
        role: 'OWNER', // 첫 가입자는 OWNER
      },
    });

    // 토큰 생성
    const tokens = await this.generateTokens(user.id, user.email, user.role);

    // 환영 이메일 발송 (비동기, 실패해도 회원가입은 성공)
    this.emailService.sendWelcomeEmail(user.email, user.name).catch((err) => {
      this.logger.error(`환영 이메일 발송 실패: ${err.message}`);
    });

    return {
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        isPfMember: user.isPfMember,
      },
      ...tokens,
    };
  }

  async login(dto: LoginDto) {
    // 사용자 조회
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email },
      include: { hospital: true },
    });

    if (!user) {
      throw new UnauthorizedException('이메일 또는 비밀번호가 올바르지 않습니다');
    }

    // 비밀번호 검증
    const isPasswordValid = await bcrypt.compare(dto.password, user.passwordHash);

    if (!isPasswordValid) {
      throw new UnauthorizedException('이메일 또는 비밀번호가 올바르지 않습니다');
    }

    // 토큰 생성
    const tokens = await this.generateTokens(user.id, user.email, user.role, user.hospitalId);

    return {
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        hospitalId: user.hospitalId,
        hospital: user.hospital,
        isPfMember: user.isPfMember,
      },
      ...tokens,
    };
  }

  async getProfile(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { hospital: true },
    });

    if (!user) {
      throw new UnauthorizedException('사용자를 찾을 수 없습니다');
    }

    return {
      id: user.id,
      email: user.email,
      name: user.name,
      phone: user.phone,
      role: user.role,
      hospitalId: user.hospitalId,
      hospital: user.hospital,
      isPfMember: user.isPfMember,
      createdAt: user.createdAt,
    };
  }

  private async generateTokens(
    userId: string,
    email: string,
    role: string,
    hospitalId?: string | null,
  ) {
    const payload = {
      sub: userId,
      email,
      role,
      hospitalId,
    };

    const accessToken = this.jwtService.sign(payload, {
      expiresIn: '1d', // 1일
    });

    const refreshToken = this.jwtService.sign(payload, {
      expiresIn: '7d', // 7일
    });

    return {
      accessToken,
      refreshToken,
    };
  }

  async refreshToken(refreshToken: string) {
    try {
      const payload = this.jwtService.verify(refreshToken);
      const user = await this.prisma.user.findUnique({
        where: { id: payload.sub },
      });

      if (!user) {
        throw new UnauthorizedException('유효하지 않은 토큰입니다');
      }

      return this.generateTokens(user.id, user.email, user.role, user.hospitalId);
    } catch (error) {
      throw new UnauthorizedException('유효하지 않은 토큰입니다');
    }
  }

  /**
   * Google OAuth 로그인
   */
  /**
   * 비밀번호 찾기 - 재설정 토큰 생성
   */
  async forgotPassword(email: string) {
    const user = await this.prisma.user.findUnique({
      where: { email },
    });

    // 보안: 사용자 존재 여부와 관계없이 동일한 응답
    if (!user) {
      return { message: '해당 이메일로 비밀번호 재설정 링크를 발송했습니다' };
    }

    // 재설정 토큰 생성 (1시간 유효)
    const resetToken = this.jwtService.sign(
      { sub: user.id, email: user.email, type: 'password-reset' },
      { expiresIn: '1h' },
    );

    // 이메일 발송
    const emailSent = await this.emailService.sendPasswordResetEmail(
      user.email,
      resetToken,
      user.name,
    );

    if (!emailSent) {
      this.logger.warn(`비밀번호 재설정 이메일 발송 실패: ${user.email}`);
    }

    return { message: '해당 이메일로 비밀번호 재설정 링크를 발송했습니다' };
  }

  /**
   * 비밀번호 재설정
   */
  async resetPassword(token: string, newPassword: string) {
    try {
      const payload = this.jwtService.verify(token);
      
      if (payload.type !== 'password-reset') {
        throw new UnauthorizedException('유효하지 않은 토큰입니다');
      }

      const passwordHash = await bcrypt.hash(newPassword, 10);
      
      await this.prisma.user.update({
        where: { id: payload.sub },
        data: { passwordHash },
      });

      return { message: '비밀번호가 성공적으로 변경되었습니다' };
    } catch (error) {
      throw new UnauthorizedException('유효하지 않거나 만료된 토큰입니다');
    }
  }

  /**
   * Google OAuth Callback 로그인 (Authorization Code 방식)
   * - google-auth-library의 OAuth2Client.getToken() 대신 직접 fetch 사용
   * - 디버깅 용이성 및 에러 메시지 정확성 향상
   */
  async googleCallbackLogin(code: string) {
    const clientId = this.configService.get('GOOGLE_CLIENT_ID') || process.env.GOOGLE_CLIENT_ID;
    const clientSecret = this.configService.get('GOOGLE_CLIENT_SECRET') || process.env.GOOGLE_CLIENT_SECRET;
    const redirectUri = 'https://patient-signal-1.onrender.com/api/auth/google/callback';

    this.logger.log(`Google callback: starting token exchange`);
    this.logger.log(`Google callback: clientId=${clientId?.substring(0, 20)}..., secretLen=${clientSecret?.length}, redirectUri=${redirectUri}`);

    try {
      // Step 1: Authorization Code → Token 교환 (직접 fetch)
      const tokenParams = new URLSearchParams({
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
        grant_type: 'authorization_code',
      });

      this.logger.log(`Google callback: sending token request to Google...`);

      const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: tokenParams.toString(),
      });

      const tokenData = await tokenResponse.json();

      if (!tokenResponse.ok) {
        this.logger.error(`Google token exchange failed: ${JSON.stringify(tokenData)}`);
        throw new Error(`Google token exchange failed: ${tokenData.error} - ${tokenData.error_description || 'no description'}`);
      }

      this.logger.log('Google callback: tokens received successfully');

      if (!tokenData.id_token) {
        throw new Error('No id_token received from Google');
      }

      // Step 2: ID 토큰 검증
      const ticket = await this.googleClient.verifyIdToken({
        idToken: tokenData.id_token,
        audience: clientId,
      });

      const payload = ticket.getPayload();
      if (!payload || !payload.email) {
        throw new UnauthorizedException('Google 인증에 실패했습니다: 이메일 정보 없음');
      }

      const { email, name } = payload;
      this.logger.log(`Google callback: verified email=${email}`);

      // Step 3: 기존 사용자 확인 또는 생성
      let user = await this.prisma.user.findUnique({
        where: { email },
        include: { hospital: true },
      });

      if (!user) {
        this.logger.log(`Google callback: creating new user for ${email}`);
        user = await this.prisma.user.create({
          data: {
            email,
            name: name || email.split('@')[0],
            passwordHash: '',
            role: 'OWNER',
            isPfMember: false,
          },
          include: { hospital: true },
        });
      }

      // Step 4: JWT 토큰 생성
      const jwtTokens = await this.generateTokens(
        user.id,
        user.email,
        user.role,
        user.hospitalId,
      );

      this.logger.log(`Google callback: login success for ${email}`);

      return {
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
          hospitalId: user.hospitalId,
          hospital: user.hospital,
          isPfMember: user.isPfMember,
        },
        ...jwtTokens,
      };
    } catch (error) {
      this.logger.error(`Google callback error: ${error?.message}`, error?.stack);
      throw error;
    }
  }

  /**
   * Google OAuth 로그인 (ID Token 방식)
   */
  async googleLogin(idToken: string) {
    try {
      // Google ID 토큰 검증
      const ticket = await this.googleClient.verifyIdToken({
        idToken,
        audience: this.configService.get('GOOGLE_CLIENT_ID'),
      });

      const payload = ticket.getPayload();
      if (!payload || !payload.email) {
        throw new UnauthorizedException('Google 인증에 실패했습니다');
      }

      const { email, name, picture, sub: googleId } = payload;

      // 기존 사용자 확인
      let user = await this.prisma.user.findUnique({
        where: { email },
        include: { hospital: true },
      });

      if (!user) {
        // 신규 사용자 생성 (비밀번호 없이)
        user = await this.prisma.user.create({
          data: {
            email,
            name: name || email.split('@')[0],
            passwordHash: '', // Google 로그인은 비밀번호 없음
            role: 'OWNER',
            isPfMember: false,
          },
          include: { hospital: true },
        });
      }

      // 토큰 생성
      const tokens = await this.generateTokens(
        user.id,
        user.email,
        user.role,
        user.hospitalId,
      );

      return {
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
          hospitalId: user.hospitalId,
          hospital: user.hospital,
          isPfMember: user.isPfMember,
        },
        ...tokens,
      };
    } catch (error) {
      console.error('Google login error:', error);
      throw new UnauthorizedException('Google 인증에 실패했습니다');
    }
  }
}
