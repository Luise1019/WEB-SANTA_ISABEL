import { Module } from '@nestjs/common';

import { BudgetModule } from '../budget/budget.module';
import { ChangesController } from './changes.controller';
import { ChangesService } from './changes.service';

@Module({
  imports: [BudgetModule],
  providers: [ChangesService],
  controllers: [ChangesController],
  exports: [ChangesService],
})
export class ChangesModule {}
