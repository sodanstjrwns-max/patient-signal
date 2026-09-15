import { Module } from '@nestjs/common';
import { PrismaModule } from '../common/prisma/prisma.module';
import { LeadMagnetController } from './lead-magnet.controller';
import { LeadMagnetService } from './lead-magnet.service';

/**
 * Free-preview lead magnet for thepatientfunnel.com — our own list, our own
 * sending. Uses the global EmailService (Resend) and adds one daily cron that
 * touches only `lead_magnets`.
 */
@Module({
  imports: [PrismaModule],
  controllers: [LeadMagnetController],
  providers: [LeadMagnetService],
})
export class LeadMagnetModule {}
