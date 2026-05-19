import { Module } from '@nestjs/common';

import { FeasibilityModule } from '../feasibility/feasibility.module';
import { ImportsController } from './imports.controller';
import { ImportsService } from './imports.service';
import { SantaIsabelController } from './santa-isabel/santa-isabel.controller';
import { SantaIsabelService } from './santa-isabel/santa-isabel.service';

@Module({
  imports: [FeasibilityModule],
  providers: [ImportsService, SantaIsabelService],
  controllers: [ImportsController, SantaIsabelController],
  exports: [ImportsService],
})
export class ImportsModule {}
