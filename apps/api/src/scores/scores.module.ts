import { Module } from '@nestjs/common';
import { ScoresController } from './scores.controller';
import { ScoresService } from './scores.service';
import { ABHSService } from './abhs.service';

@Module({
  controllers: [ScoresController],
  providers: [ScoresService, ABHSService],
  exports: [ScoresService, ABHSService],
})
export class ScoresModule {}
