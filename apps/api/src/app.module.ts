import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaModule } from './common/prisma/prisma.module';
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

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
    // Rate Limiting 설정
    ThrottlerModule.forRoot([
      {
        name: 'short',
        ttl: 1000, // 1초
        limit: 10, // 1초에 10요청
      },
      {
        name: 'medium',
        ttl: 10000, // 10초
        limit: 50, // 10초에 50요청
      },
      {
        name: 'long',
        ttl: 60000, // 1분
        limit: 200, // 1분에 200요청
      },
    ]),
    ScheduleModule.forRoot(),
    PrismaModule,
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
