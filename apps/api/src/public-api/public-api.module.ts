import { Module } from '@nestjs/common';
import { PublicApiController } from './public-api.controller';
import { PublicApiService } from './public-api.service';
import { ApiKeyGuard } from './guards/api-key.guard';
import { ApiKeyManagementController } from './api-key-management.controller';
import { ApiKeyManagementService } from './api-key-management.service';
import { PrismaModule } from '../common/prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [PublicApiController, ApiKeyManagementController],
  providers: [PublicApiService, ApiKeyManagementService, ApiKeyGuard],
  exports: [PublicApiService],
})
export class PublicApiModule {}
