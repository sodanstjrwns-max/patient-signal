import { Module } from '@nestjs/common';
import { AICrawlerModule } from '../ai-crawler/ai-crawler.module';
import { PrismaModule } from '../common/prisma/prisma.module';
import { IntlCheckController } from './intl-check.controller';
import { IntlCheckService } from './intl-check.service';

/**
 * International AI Visibility Check — lead magnet for thepatientfunnel.com/en|jp/check.
 * Reuses AICrawlerService (platform strategies) and the global EmailService.
 * Adds no cron, no queue, and touches no Korean-customer table.
 */
@Module({
  imports: [PrismaModule, AICrawlerModule],
  controllers: [IntlCheckController],
  providers: [IntlCheckService],
})
export class IntlCheckModule {}
