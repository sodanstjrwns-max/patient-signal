import { Module } from '@nestjs/common';
import { ScoresController } from './scores.controller';
import { ScoresService } from './scores.service';
import { ABHSService } from './abhs.service';
import { WeightService } from './weight.service';
import { WeightCalibrationService } from './weight-calibration.service';

@Module({
  controllers: [ScoresController],
  providers: [ScoresService, ABHSService, WeightService, WeightCalibrationService],
  exports: [ScoresService, ABHSService, WeightService, WeightCalibrationService],
})
export class ScoresModule {}
