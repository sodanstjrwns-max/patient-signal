import { Module } from '@nestjs/common';
import { AICrawlerController } from './ai-crawler.controller';
import { AICrawlerService } from './ai-crawler.service';
import { CitationAnalyzerController } from './citation-analyzer.controller';
import { CitationAnalyzerService } from './citation-analyzer.service';
import { PromptResponsesController } from './prompt-responses.controller';
import { PlanGuard } from '../common/guards/plan.guard';

@Module({
  controllers: [AICrawlerController, CitationAnalyzerController, PromptResponsesController],
  providers: [AICrawlerService, CitationAnalyzerService, PlanGuard],
  exports: [AICrawlerService, CitationAnalyzerService],
})
export class AICrawlerModule {}
