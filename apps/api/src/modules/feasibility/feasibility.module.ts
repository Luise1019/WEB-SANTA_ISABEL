import { Module } from '@nestjs/common';

import { FeasibilityController } from './feasibility.controller';
import { FeasibilityService } from './feasibility.service';

@Module({
  providers: [FeasibilityService],
  controllers: [FeasibilityController],
  exports: [FeasibilityService],
})
export class FeasibilityModule {}
