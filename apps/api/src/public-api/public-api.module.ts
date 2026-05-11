import { Module } from '@nestjs/common';
import { PublicApiController } from './public-api.controller';
import { PublicApiService } from './public-api.service';
import { ApiKeyGuard } from './guards/api-key.guard';
import { PrismaModule } from '../common/prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [PublicApiController],
  providers: [PublicApiService, ApiKeyGuard],
  exports: [PublicApiService],
})
export class PublicApiModule {}
