import { Module } from '@nestjs/common';
import { LectureMetricsController } from './lecture-metrics.controller';
import { LectureMetricsService } from './lecture-metrics.service';
import { PrismaModule } from '../common/prisma/prisma.module';
import { AppCacheModule } from '../common/cache/cache.module';

/**
 * 성장 진단 모듈
 * DB 마이그레이션 없이 기존 컬럼만으로 8개 원인 분해 지표를 계산한다.
 */
@Module({
  imports: [PrismaModule, AppCacheModule],
  controllers: [LectureMetricsController],
  providers: [LectureMetricsService],
  exports: [LectureMetricsService],
})
export class LectureMetricsModule {}
