import { Module } from '@nestjs/common';
import { GrowthDiagnosisController } from './growth-diagnosis.controller';
import { GrowthDiagnosisService } from './growth-diagnosis.service';
import { PrismaModule } from '../common/prisma/prisma.module';
import { AppCacheModule } from '../common/cache/cache.module';

/**
 * 성장 진단 모듈
 * DB 마이그레이션 없이 기존 컬럼만으로 8개 원인 분해 지표를 계산한다.
 */
@Module({
  imports: [PrismaModule, AppCacheModule],
  controllers: [GrowthDiagnosisController],
  providers: [GrowthDiagnosisService],
  exports: [GrowthDiagnosisService],
})
export class GrowthDiagnosisModule {}
