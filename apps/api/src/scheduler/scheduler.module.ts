import { Module } from '@nestjs/common';
import { SchedulerController } from './scheduler.controller';
import { SchedulerService } from './scheduler.service';
import { CrawlQueueService } from './crawl-queue.service';
import { AICrawlerModule } from '../ai-crawler/ai-crawler.module';
import { ScoresModule } from '../scores/scores.module';
import { CompetitorsModule } from '../competitors/competitors.module';
import { TempUpgradeService } from './temp-upgrade.service';

@Module({
  imports: [AICrawlerModule, ScoresModule, CompetitorsModule],
  controllers: [SchedulerController],
  providers: [SchedulerService, CrawlQueueService, TempUpgradeService],
  exports: [SchedulerService, CrawlQueueService, TempUpgradeService],
})
export class SchedulerModule {}
