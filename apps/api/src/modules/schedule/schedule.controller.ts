import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ZodValidationPipe } from 'nestjs-zod';
import { DependencyInputSchema, type DependencyInput } from '@santaisabel/shared';

import { Audit } from '../audit/audit.decorator';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { ScheduleService } from './schedule.service';

type TaskBody = {
  code: string;
  name: string;
  kind?: 'SUMMARY' | 'TASK' | 'MILESTONE';
  parentId?: string | null;
  plannedStart: string;
  plannedEnd: string;
  durationDays: number;
  progress?: number;
};

@Controller('projects/:projectId/schedule')
@UseGuards(AuthGuard('jwt'), RolesGuard)
export class ScheduleController {
  constructor(private readonly schedule: ScheduleService) {}

  @Get('tasks')
  listTasks(@Param('projectId', ParseUUIDPipe) projectId: string) {
    return this.schedule.listTasks(projectId);
  }

  @Get('cpm')
  computeCPM(@Param('projectId', ParseUUIDPipe) projectId: string) {
    return this.schedule.computeCPM(projectId);
  }

  @Post('tasks')
  @Roles('GERENTE')
  @Audit({ action: 'CREATE', entityType: 'Task' })
  createTask(
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @Body() dto: TaskBody,
  ) {
    return this.schedule.createTask(projectId, dto);
  }

  @Patch('tasks/:taskId')
  @Roles('GERENTE')
  @Audit({ action: 'UPDATE', entityType: 'Task', entityIdParam: 'taskId' })
  updateTask(
    @Param('taskId', ParseUUIDPipe) taskId: string,
    @Body() dto: Partial<TaskBody>,
  ) {
    return this.schedule.updateTask(taskId, dto);
  }

  @Patch('tasks/:taskId/progress')
  @Roles('GERENTE')
  @Audit({ action: 'UPDATE', entityType: 'Task', entityIdParam: 'taskId' })
  updateProgress(
    @Param('taskId', ParseUUIDPipe) taskId: string,
    @Body() dto: { progress: number },
  ) {
    return this.schedule.updateProgress(taskId, dto.progress);
  }

  @Delete('tasks/:taskId')
  @Roles('GERENTE')
  @HttpCode(204)
  @Audit({ action: 'DELETE', entityType: 'Task', entityIdParam: 'taskId' })
  deleteTask(@Param('taskId', ParseUUIDPipe) taskId: string) {
    return this.schedule.deleteTask(taskId);
  }

  @Post('dependencies')
  @Roles('GERENTE')
  @Audit({ action: 'CREATE', entityType: 'Dependency' })
  createDependency(@Body(new ZodValidationPipe(DependencyInputSchema)) dto: DependencyInput) {
    return this.schedule.createDependency(dto);
  }

  @Delete('dependencies/:dependencyId')
  @Roles('GERENTE')
  @HttpCode(204)
  @Audit({ action: 'DELETE', entityType: 'Dependency', entityIdParam: 'dependencyId' })
  deleteDependency(@Param('dependencyId', ParseUUIDPipe) dependencyId: string) {
    return this.schedule.deleteDependency(dependencyId);
  }
}
