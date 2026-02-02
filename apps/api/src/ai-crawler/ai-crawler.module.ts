import { Module } from '@nestjs/common';
import { AICrawlerController } from './ai-crawler.controller';
import { AICrawlerService } from './ai-crawler.service';

@Module({
  controllers: [AICrawlerController],
  providers: [AICrawlerService],
  exports: [AICrawlerService],
})
export class AICrawlerModule {}
