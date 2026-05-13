import { Controller, Get, Param, ParseUUIDPipe, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

import { CashflowService } from './cashflow.service';

@Controller('projects/:projectId/cashflow')
@UseGuards(AuthGuard('jwt'))
export class CashflowController {
  constructor(private readonly cashflow: CashflowService) {}

  @Get('entries')
  listEntries(@Param('projectId', ParseUUIDPipe) projectId: string) {
    return this.cashflow.listEntries(projectId);
  }
}
