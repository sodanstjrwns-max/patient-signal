import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaModule } from './common/prisma/prisma.module';
import { AppCacheModule } from './common/cache/cache.module';
import { AuthModule } from './auth/auth.module';
import { HospitalsModule } from './hospitals/hospitals.module';
import { PromptsModule } from './prompts/prompts.module';
import { AICrawlerModule } from './ai-crawler/ai-crawler.module';
import { CompetitorsModule } from './competitors/competitors.module';
import { ScoresModule } from './scores/scores.module';
import { SchedulerModule } from './scheduler/scheduler.module';
import { PaymentsModule } from './payments/payments.module';
import { SubscriptionsModule } from './subscriptions/subscriptions.module';
import { EmailModule } from './email/email.module';
import { QueryTemplatesModule } from './query-templates/query-templates.module';
import { CouponsModule } from './coupons/coupons.module';
import { AdminModule } from './admin/admin.module';
import { GeoContentModule } from './geo-content/geo-content.module';
import { PublicApiModule } from './public-api/public-api.module';
import { SourceIntelModule } from './source-intel/source-intel.module';
import { GrowthDiagnosisModule } from './growth-diagnosis/growth-diagnosis.module';
import { PsOpenApiModule } from './ps-open-api/ps-open-api.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
    // Rate Limiting 설정
    ThrottlerModule.forRoot([
      // ⚠️ 대시보드는 진입 시 1초 안에 조회 API를 ~14발 동시 발사한다 (react-query 병렬).
      //    short=10이면 로그인 유저가 대시보드만 열어도 11번째부터 429 → 전 카드 "불러오지 못함".
      //    (비로그인은 인증 가드 401이 먼저라 외부 재현 불가 — 유저만 밟는 지뢰였음, 2026-08-25 장애)
      {
        name: 'short',
        ttl: 1000, // 1초
        limit: 30, // 1초에 30요청 (대시보드 초기 로드 14발 + 재시도 여유)
      },
      {
        name: 'medium',
        ttl: 10000, // 10초
        limit: 100, // 10초에 100요청
      },
      {
        name: 'long',
        ttl: 60000, // 1분
        limit: 300, // 1분에 300요청 (봇/크롤러 방어선은 유지)
      },
    ]),
    ScheduleModule.forRoot(),
    PrismaModule,
    AppCacheModule,
    AuthModule,
    HospitalsModule,
    PromptsModule,
    AICrawlerModule,
    CompetitorsModule,
    ScoresModule,
    SchedulerModule,
    PaymentsModule,
    SubscriptionsModule,
    EmailModule,
    QueryTemplatesModule,
    CouponsModule,
    AdminModule,
    GeoContentModule,
    PublicApiModule,
    SourceIntelModule,
    GrowthDiagnosisModule,
    PsOpenApiModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    // 전역 Rate Limiter 가드
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class AppModule {}
