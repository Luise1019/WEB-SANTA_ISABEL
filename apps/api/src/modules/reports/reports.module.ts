import { Module } from '@nestjs/common';

import { ReportsController, ProjectReportsController } from './reports.controller';
import { ReportsService } from './reports.service';

@Module({
  providers: [ReportsService],
  controllers: [ReportsController, ProjectReportsController],
  exports: [ReportsService],
})
export class ReportsModule {}
