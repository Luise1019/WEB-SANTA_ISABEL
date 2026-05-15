import { Module } from '@nestjs/common';

import { CpmService } from './cpm.service';
import { ScheduleController } from './schedule.controller';
import { ScheduleService } from './schedule.service';

@Module({
  providers: [ScheduleService, CpmService],
  controllers: [ScheduleController],
  exports: [ScheduleService],
})
export class ScheduleModule {}
