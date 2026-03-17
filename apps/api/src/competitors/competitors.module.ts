import { Module } from '@nestjs/common';
import { CompetitorsController } from './competitors.controller';
import { CompetitorsService } from './competitors.service';
import { PlanGuard } from '../common/guards/plan.guard';

@Module({
  controllers: [CompetitorsController],
  providers: [CompetitorsService, PlanGuard],
  exports: [CompetitorsService],
})
export class CompetitorsModule {}
