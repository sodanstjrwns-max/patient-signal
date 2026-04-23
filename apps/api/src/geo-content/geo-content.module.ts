import { Module } from '@nestjs/common';
import { GeoContentController } from './geo-content.controller';
import { GeoContentService } from './geo-content.service';
import { CitationAnalyzerService } from '../ai-crawler/citation-analyzer.service';

@Module({
  controllers: [GeoContentController],
  providers: [GeoContentService, CitationAnalyzerService],
  exports: [GeoContentService],
})
export class GeoContentModule {}
