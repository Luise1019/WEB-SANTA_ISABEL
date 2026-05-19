import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseIntPipe,
  ParseUUIDPipe,
  Patch,
  Post,
  Res,
  UseGuards,
} from '@nestjs/common';
import type { Response } from 'express';
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
  actualStart?: string | null;
  actualEnd?: string | null;
};

type MilestoneBody = {
  code: string;
  name: string;
  plannedDate: string;
  isContractual?: boolean;
};

@Controller('projects/:projectId/schedule')
@UseGuards(AuthGuard('jwt'), RolesGuard)
export class ScheduleController {
  constructor(private readonly schedule: ScheduleService) {}

  // ─── Tasks ────────────────────────────────────────────────────
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

  // ─── Dependencies ─────────────────────────────────────────────
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

  // ─── Seed Santa Isabel ────────────────────────────────────────
  @Post('seed-santa-isabel')
  @Roles('GERENTE')
  @Audit({ action: 'CREATE', entityType: 'Task' })
  seedSantaIsabel(@Param('projectId', ParseUUIDPipe) projectId: string) {
    return this.schedule.seedSantaIsabelSchedule(projectId);
  }

  @Delete('clear')
  @Roles('GERENTE')
  @HttpCode(200)
  clearSchedule(@Param('projectId', ParseUUIDPipe) projectId: string) {
    return this.schedule.clearSchedule(projectId);
  }

  // ─── Milestones ───────────────────────────────────────────────
  @Get('milestones')
  listMilestones(@Param('projectId', ParseUUIDPipe) projectId: string) {
    return this.schedule.listMilestones(projectId);
  }

  @Post('milestones')
  @Roles('GERENTE')
  @Audit({ action: 'CREATE', entityType: 'Milestone' })
  createMilestone(
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @Body() dto: MilestoneBody,
  ) {
    return this.schedule.createMilestone(projectId, dto);
  }

  @Patch('milestones/:milestoneId')
  @Roles('GERENTE')
  updateMilestone(
    @Param('milestoneId', ParseUUIDPipe) milestoneId: string,
    @Body() dto: Partial<MilestoneBody & { actualDate: string | null }>,
  ) {
    return this.schedule.updateMilestone(milestoneId, dto);
  }

  @Delete('milestones/:milestoneId')
  @Roles('GERENTE')
  @HttpCode(204)
  deleteMilestone(@Param('milestoneId', ParseUUIDPipe) milestoneId: string) {
    return this.schedule.deleteMilestone(milestoneId);
  }

  // ─── Baselines ────────────────────────────────────────────────
  @Get('baselines')
  listBaselines(@Param('projectId', ParseUUIDPipe) projectId: string) {
    return this.schedule.listBaselines(projectId);
  }

  @Post('baselines')
  @Roles('GERENTE')
  @Audit({ action: 'CREATE', entityType: 'ScheduleBaseline' })
  createBaseline(
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @Body() dto: { label: string },
  ) {
    return this.schedule.createBaseline(projectId, dto.label);
  }

  @Get('baselines/:version')
  getBaseline(
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @Param('version', ParseIntPipe) version: number,
  ) {
    return this.schedule.getBaseline(projectId, version);
  }

  // ─── Export ───────────────────────────────────────────────────
  @Get('export/excel')
  async exportExcel(
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @Res() res: Response,
  ) {
    const buffer = await this.schedule.exportToExcel(projectId);
    res.set({
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="cronograma-santa-isabel.xlsx"`,
      'Content-Length': buffer.length,
    });
    res.send(buffer);
  }
}
