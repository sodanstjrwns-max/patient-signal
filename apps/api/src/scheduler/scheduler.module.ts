import { Module } from '@nestjs/common';
import { SchedulerController } from './scheduler.controller';
import { SchedulerService } from './scheduler.service';
import { CrawlQueueService } from './crawl-queue.service';
import { AICrawlerModule } from '../ai-crawler/ai-crawler.module';
import { ScoresModule } from '../scores/scores.module';
import { CompetitorsModule } from '../competitors/competitors.module';
import { AdminModule } from '../admin/admin.module';

@Module({
  imports: [AICrawlerModule, ScoresModule, CompetitorsModule, AdminModule],
  controllers: [SchedulerController],
  providers: [SchedulerService, CrawlQueueService],
  exports: [SchedulerService, CrawlQueueService],
})
export class SchedulerModule {}
