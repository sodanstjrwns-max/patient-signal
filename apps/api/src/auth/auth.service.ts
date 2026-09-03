import { Injectable, UnauthorizedException, ConflictException, Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../common/prisma/prisma.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { EmailService } from '../email/email.service';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
    private configService: ConfigService,
    private emailService: EmailService,
  ) {
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

    // 로그인 활동 기록
    await this.prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date(), loginCount: { increment: 1 } },
    });

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

  // 허브 SSO(HubSsoService)에서도 동일한 토큰을 발급하도록 public
  async generateTokens(
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

}
