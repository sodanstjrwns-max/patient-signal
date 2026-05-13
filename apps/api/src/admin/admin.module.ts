import { Module } from '@nestjs/common';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';
import { WeightsController } from './weights.controller';
import { PrismaModule } from '../common/prisma/prisma.module';
import { ScoresModule } from '../scores/scores.module';

@Module({
  imports: [PrismaModule, ScoresModule],
  controllers: [AdminController, WeightsController],
  providers: [AdminService],
})
export class AdminModule {}
