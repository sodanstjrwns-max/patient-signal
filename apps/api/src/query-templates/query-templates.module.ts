import { Module } from '@nestjs/common';
import { QueryTemplatesController } from './query-templates.controller';
import { QueryTemplatesService } from './query-templates.service';
import { HospitalsModule } from '../hospitals/hospitals.module';

@Module({
  imports: [HospitalsModule], // HubProfileService: LLM 질문 제안 재료(타겟 환자층·페인포인트·미션)
  controllers: [QueryTemplatesController],
  providers: [QueryTemplatesService],
  exports: [QueryTemplatesService],
})
export class QueryTemplatesModule {}
