import { Controller, Get, Param, ParseUUIDPipe, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

import { SalesService } from './sales.service';

@Controller('projects/:projectId/sales')
@UseGuards(AuthGuard('jwt'))
export class SalesController {
  constructor(private readonly sales: SalesService) {}

  @Get('units')
  listUnits(@Param('projectId', ParseUUIDPipe) projectId: string) {
    return this.sales.listUnits(projectId);
  }
}
