import { Module } from '@nestjs/common';
import { AICrawlerController } from './ai-crawler.controller';
import { AICrawlerService } from './ai-crawler.service';
import { PlanGuard } from '../common/guards/plan.guard';

@Module({
  controllers: [AICrawlerController],
  providers: [AICrawlerService, PlanGuard],
  exports: [AICrawlerService],
})
export class AICrawlerModule {}
