import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../common/prisma/prisma.service';

export interface JwtPayload {
  sub: string;
  email: string;
  role: string;
  hospitalId?: string;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    private configService: ConfigService,
    private prisma: PrismaService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      // 보안: 프로덕션에서 JWT_SECRET 미설정 시 즉시 실패 (하드코딩 fallback은 개발환경만)
      secretOrKey:
        configService.get<string>('JWT_SECRET') ||
        (() => {
          if (process.env.NODE_ENV === 'production') {
            throw new Error('JWT_SECRET 환경변수가 설정되지 않았습니다.');
          }
          return 'patient-signal-dev-only-secret';
        })(),
    });
  }

  async validate(payload: JwtPayload) {
    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
      include: { hospital: true },
    });

    if (!user) {
      throw new UnauthorizedException('유효하지 않은 토큰입니다');
    }

    return {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      hospitalId: user.hospitalId,
      hospital: user.hospital,
    };
  }
}
