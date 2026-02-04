import { Injectable, UnauthorizedException, ConflictException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../common/prisma/prisma.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { OAuth2Client } from 'google-auth-library';

@Injectable()
export class AuthService {
  private googleClient: OAuth2Client;

  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
    private configService: ConfigService,
  ) {
    this.googleClient = new OAuth2Client(
      this.configService.get('GOOGLE_CLIENT_ID'),
      this.configService.get('GOOGLE_CLIENT_SECRET'),
    );
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

    // TODO: 실제 이메일 발송 구현 (SendGrid, Resend 등)
    // 현재는 콘솔에 로그만 출력
    const resetUrl = `${this.configService.get('FRONTEND_URL') || 'https://patient-signal-web-2bbe.vercel.app'}/reset-password?token=${resetToken}`;
    console.log('Password reset URL:', resetUrl);

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
   */
  async googleCallbackLogin(code: string) {
    try {
      // Authorization Code로 토큰 교환
      const { tokens } = await this.googleClient.getToken({
        code,
        redirect_uri: 'https://patient-signal.onrender.com/api/auth/google/callback',
      });

      // ID 토큰 검증
      const ticket = await this.googleClient.verifyIdToken({
        idToken: tokens.id_token!,
        audience: this.configService.get('GOOGLE_CLIENT_ID'),
      });

      const payload = ticket.getPayload();
      if (!payload || !payload.email) {
        throw new UnauthorizedException('Google 인증에 실패했습니다');
      }

      const { email, name } = payload;

      // 기존 사용자 확인 또는 생성
      let user = await this.prisma.user.findUnique({
        where: { email },
        include: { hospital: true },
      });

      if (!user) {
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

      // JWT 토큰 생성
      const jwtTokens = await this.generateTokens(
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
        ...jwtTokens,
      };
    } catch (error) {
      console.error('Google callback login error:', error);
      throw new UnauthorizedException('Google 인증에 실패했습니다');
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
