import { Module } from '@nestjs/common';

import { CashflowController } from './cashflow.controller';
import { CashflowService } from './cashflow.service';

@Module({
  providers: [CashflowService],
  controllers: [CashflowController],
  exports: [CashflowService],
})
export class CashflowModule {}
