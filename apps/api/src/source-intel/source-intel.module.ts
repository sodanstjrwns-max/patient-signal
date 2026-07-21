import { Module } from '@nestjs/common';
import { SourceCrawlerService } from './source-crawler.service';
import { SourceAnalyzerService } from './source-analyzer.service';
import { SourcePipelineService } from './source-pipeline.service';
import { NewChannelsService } from './new-channels.service';
import { SourceIntelController } from './source-intel.controller';

@Module({
  controllers: [SourceIntelController],
  providers: [SourceCrawlerService, SourceAnalyzerService, SourcePipelineService, NewChannelsService],
  exports: [SourcePipelineService, SourceAnalyzerService, SourceCrawlerService, NewChannelsService],
})
export class SourceIntelModule {}
