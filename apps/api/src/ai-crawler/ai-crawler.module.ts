import { Module } from '@nestjs/common';
import { AICrawlerController } from './ai-crawler.controller';
import { AICrawlerService } from './ai-crawler.service';
import { CitationAnalyzerController } from './citation-analyzer.controller';
import { CitationAnalyzerService } from './citation-analyzer.service';
import { PromptResponsesController } from './prompt-responses.controller';
import { WebsiteAnalysisController } from './website-analysis.controller';
import { WebsiteAnalysisService } from './website-analysis.service';
import { PlanGuard } from '../common/guards/plan.guard';

@Module({
  controllers: [AICrawlerController, CitationAnalyzerController, PromptResponsesController, WebsiteAnalysisController],
  providers: [AICrawlerService, CitationAnalyzerService, WebsiteAnalysisService, PlanGuard],
  exports: [AICrawlerService, CitationAnalyzerService],
})
export class AICrawlerModule {}
