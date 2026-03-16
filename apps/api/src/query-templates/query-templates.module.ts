import { Module } from '@nestjs/common';
import { QueryTemplatesController } from './query-templates.controller';
import { QueryTemplatesService } from './query-templates.service';

@Module({
  controllers: [QueryTemplatesController],
  providers: [QueryTemplatesService],
  exports: [QueryTemplatesService],
})
export class QueryTemplatesModule {}
