import { Controller, Get, Param, ParseUUIDPipe, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

import { BudgetService } from './budget.service';

@Controller('projects/:projectId/budget')
@UseGuards(AuthGuard('jwt'))
export class BudgetController {
  constructor(private readonly budget: BudgetService) {}

  @Get('chapters')
  listChapters(@Param('projectId', ParseUUIDPipe) projectId: string) {
    return this.budget.listChapters(projectId);
  }
}
