import { Module } from '@nestjs/common';
import { LectureMetricsController } from './lecture-metrics.controller';
import { LectureMetricsService } from './lecture-metrics.service';
import { PrismaModule } from '../common/prisma/prisma.module';
import { AppCacheModule } from '../common/cache/cache.module';

/**
 * 【Batch A】강의록 실행 지표 모듈
 * DB 마이그레이션 없이 기존 컬럼만으로 강의록 8항목을 계산한다.
 */
@Module({
  imports: [PrismaModule, AppCacheModule],
  controllers: [LectureMetricsController],
  providers: [LectureMetricsService],
  exports: [LectureMetricsService],
})
export class LectureMetricsModule {}
