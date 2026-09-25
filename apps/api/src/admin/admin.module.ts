import { Module } from '@nestjs/common';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';
import { WeightsController } from './weights.controller';
import { PrismaModule } from '../common/prisma/prisma.module';
import { ScoresModule } from '../scores/scores.module';
import { SchedulerModule } from '../scheduler/scheduler.module';
import { PsOpenApiModule } from '../ps-open-api/ps-open-api.module';
import { NaverSourceAnalysisService } from './naver-source-analysis.service';

@Module({
  imports: [PrismaModule, ScoresModule, SchedulerModule, PsOpenApiModule],
  controllers: [AdminController, WeightsController],
  providers: [AdminService, NaverSourceAnalysisService],
  exports: [AdminService],
})
export class AdminModule {}
