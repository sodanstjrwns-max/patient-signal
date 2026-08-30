import { Module } from '@nestjs/common';
import { HospitalsController } from './hospitals.controller';
import { HospitalsService } from './hospitals.service';
import { HubProfileService } from './hub-profile.service';
import { SchedulerModule } from '../scheduler/scheduler.module';

@Module({
  imports: [SchedulerModule], // 【Day 0 아하모먼트】온보딩 직후 첫 즉시 크롤용
  controllers: [HospitalsController],
  providers: [HospitalsService, HubProfileService],
  exports: [HospitalsService],
})
export class HospitalsModule {}
