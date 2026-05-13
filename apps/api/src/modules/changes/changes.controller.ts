import { Controller, Get, Param, ParseUUIDPipe, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

import { ChangesService } from './changes.service';

@Controller('projects/:projectId/changes')
@UseGuards(AuthGuard('jwt'))
export class ChangesController {
  constructor(private readonly changes: ChangesService) {}

  @Get()
  list(@Param('projectId', ParseUUIDPipe) projectId: string) {
    return this.changes.list(projectId);
  }
}
