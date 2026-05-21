import { Module } from '@nestjs/common';
import { SourceCrawlerService } from './source-crawler.service';
import { SourceAnalyzerService } from './source-analyzer.service';
import { SourcePipelineService } from './source-pipeline.service';
import { SourceIntelController } from './source-intel.controller';

@Module({
  controllers: [SourceIntelController],
  providers: [SourceCrawlerService, SourceAnalyzerService, SourcePipelineService],
  exports: [SourcePipelineService, SourceAnalyzerService, SourceCrawlerService],
})
export class SourceIntelModule {}
