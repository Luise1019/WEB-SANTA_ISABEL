import { Controller, Get, Param, ParseUUIDPipe, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

import { ScheduleService } from './schedule.service';

@Controller('projects/:projectId/schedule')
@UseGuards(AuthGuard('jwt'))
export class ScheduleController {
  constructor(private readonly schedule: ScheduleService) {}

  @Get('tasks')
  listTasks(@Param('projectId', ParseUUIDPipe) projectId: string) {
    return this.schedule.listTasks(projectId);
  }
}
