import { Module } from '@nestjs/common';
import { GeoContentController } from './geo-content.controller';
import { GeoContentService } from './geo-content.service';

@Module({
  controllers: [GeoContentController],
  providers: [GeoContentService],
  exports: [GeoContentService],
})
export class GeoContentModule {}
