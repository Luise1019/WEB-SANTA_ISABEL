import { Module } from '@nestjs/common';

import { BudgetController, ResourceController } from './budget.controller';
import { BudgetService } from './budget.service';

@Module({
  providers: [BudgetService],
  controllers: [BudgetController, ResourceController],
  exports: [BudgetService],
})
export class BudgetModule {}
