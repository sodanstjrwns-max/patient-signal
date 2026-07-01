import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { JwtStrategy } from './strategies/jwt.strategy';
import { JwtAuthGuard } from './guards/jwt-auth.guard';

@Module({
  imports: [
    PassportModule.register({ defaultStrategy: 'jwt' }),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      useFactory: async (configService: ConfigService) => ({
        // 보안: 프로덕션에서 JWT_SECRET 미설정 시 즉시 실패 (하드코딩 fallback은 개발환경만)
        secret:
          configService.get<string>('JWT_SECRET') ||
          (() => {
            if (process.env.NODE_ENV === 'production') {
              throw new Error('JWT_SECRET 환경변수가 설정되지 않았습니다.');
            }
            return 'patient-signal-dev-only-secret';
          })(),
        signOptions: {
          expiresIn: '1d',
        },
      }),
      inject: [ConfigService],
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService, JwtStrategy, JwtAuthGuard],
  exports: [AuthService, JwtStrategy, JwtAuthGuard],
})
export class AuthModule {}
