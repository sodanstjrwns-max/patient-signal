import { Module } from '@nestjs/common';
import { PsOpenApiController } from './ps-open-api.controller';
import { PsOpenApiService } from './ps-open-api.service';

/**
 * 【PS-통합】Patient Series Open API v1 모듈
 * 시그널(AEO) → 싱크/허브로 신호를 공급하는 공급자 역할
 */
@Module({
  controllers: [PsOpenApiController],
  providers: [PsOpenApiService],
})
export class PsOpenApiModule {}
