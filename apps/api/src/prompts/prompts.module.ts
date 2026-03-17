import { Module } from '@nestjs/common';
import { PromptsController } from './prompts.controller';
import { PromptsService } from './prompts.service';
import { PlanGuard } from '../common/guards/plan.guard';

@Module({
  controllers: [PromptsController],
  providers: [PromptsService, PlanGuard],
  exports: [PromptsService],
})
export class PromptsModule {}
