import { Module } from '@nestjs/common';
import { PsOpenApiController } from './ps-open-api.controller';
import { PsOpenApiService } from './ps-open-api.service';
import { HospitalsModule } from '../hospitals/hospitals.module';

/**
 * 【PS-통합】Patient Series Open API v1 모듈
 * 시그널(AEO) → 싱크/허브로 신호를 공급하는 공급자 역할
 * + 허브 → 시그널 hub-events 수신 (프로필 캐시 무효화)
 */
@Module({
  imports: [HospitalsModule], // HubProfileService (hub-events 캐시 무효화)
  controllers: [PsOpenApiController],
  providers: [PsOpenApiService],
})
export class PsOpenApiModule {}
