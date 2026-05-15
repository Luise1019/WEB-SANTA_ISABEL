import { Injectable, NotFoundException } from '@nestjs/common';
import Decimal from 'decimal.js';
import type { DependencyInput } from '@santaisabel/shared';

import { PrismaService } from '../prisma/prisma.service';
import { CpmService, type CpmTask } from './cpm.service';

type TaskCreateInput = {
  code: string;
  name: string;
  kind?: 'SUMMARY' | 'TASK' | 'MILESTONE';
  parentId?: string | null;
  plannedStart: string | Date;
  plannedEnd: string | Date;
  durationDays: number;
  progress?: number;
  order?: number;
};

type TaskUpdateInput = Partial<TaskCreateInput>;

@Injectable()
export class ScheduleService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cpm: CpmService,
  ) {}

  // ─── Tasks ────────────────────────────────────────────────────
  async listTasks(projectId: string) {
    return this.prisma.task.findMany({
      where: { projectId },
      include: {
        predecessors: true,
        successors: true,
        assignments: { include: { resource: true } },
      },
      orderBy: { order: 'asc' },
    });
  }

  async createTask(projectId: string, input: TaskCreateInput) {
    const count = await this.prisma.task.count({ where: { projectId } });
    return this.prisma.task.create({
      data: {
        projectId,
        parentId: input.parentId ?? null,
        code: input.code,
        name: input.name,
        kind: (input.kind ?? 'TASK') as 'SUMMARY' | 'TASK' | 'MILESTONE',
        plannedStart: new Date(input.plannedStart),
        plannedEnd: new Date(input.plannedEnd),
        durationDays: input.durationDays,
        progress: new Decimal(input.progress ?? 0),
        order: input.order ?? count,
      },
    });
  }

  async updateTask(taskId: string, input: TaskUpdateInput) {
    const task = await this.prisma.task.findUnique({ where: { id: taskId } });
    if (!task) throw new NotFoundException(`Tarea ${taskId} no existe`);
    return this.prisma.task.update({
      where: { id: taskId },
      data: {
        ...(input.code !== undefined ? { code: input.code } : {}),
        ...(input.name !== undefined ? { name: input.name } : {}),
        ...(input.kind !== undefined ? { kind: input.kind } : {}),
        ...(input.durationDays !== undefined ? { durationDays: input.durationDays } : {}),
        ...(input.progress !== undefined ? { progress: new Decimal(input.progress) } : {}),
        ...(input.plannedStart !== undefined ? { plannedStart: new Date(input.plannedStart) } : {}),
        ...(input.plannedEnd !== undefined ? { plannedEnd: new Date(input.plannedEnd) } : {}),
        ...(input.parentId !== undefined ? { parentId: input.parentId } : {}),
      },
    });
  }

  async deleteTask(taskId: string) {
    const task = await this.prisma.task.findUnique({ where: { id: taskId } });
    if (!task) throw new NotFoundException(`Tarea ${taskId} no existe`);
    await this.prisma.task.delete({ where: { id: taskId } });
  }

  // ─── Dependencies ─────────────────────────────────────────────
  async createDependency(input: DependencyInput) {
    return this.prisma.dependency.create({
      data: {
        predecessorId: input.predecessorId,
        successorId: input.successorId,
        type: (input.type ?? 'FS') as 'FS' | 'SS' | 'FF' | 'SF',
        lagDays: input.lagDays ?? 0,
      },
    });
  }

  async deleteDependency(dependencyId: string) {
    await this.prisma.dependency.delete({ where: { id: dependencyId } });
  }

  // ─── Progress update ──────────────────────────────────────────
  async updateProgress(taskId: string, progress: number) {
    const task = await this.prisma.task.findUnique({ where: { id: taskId } });
    if (!task) throw new NotFoundException(`Tarea ${taskId} no existe`);
    return this.prisma.task.update({
      where: { id: taskId },
      data: { progress: new Decimal(Math.max(0, Math.min(100, progress))) },
    });
  }

  // ─── CPM ──────────────────────────────────────────────────────
  async computeCPM(projectId: string) {
    const tasks = await this.listTasks(projectId);

    const cpmInput: CpmTask[] = tasks.map((t) => ({
      id: t.id,
      duration: t.durationDays,
      predecessors: t.predecessors.map((d) => ({
        predecessorId: d.predecessorId,
        type: d.type as 'FS' | 'SS' | 'FF' | 'SF',
        lag: d.lagDays,
      })),
      successors: t.successors.map((d) => ({
        successorId: d.successorId,
        type: d.type as 'FS' | 'SS' | 'FF' | 'SF',
        lag: d.lagDays,
      })),
    }));

    const cpmResults = this.cpm.compute(cpmInput);

    // Persist critical path flags (fire & forget in background if DB available)
    const updates = tasks.map((t) => {
      const cpm = cpmResults.get(t.id);
      if (!cpm) return null;
      return this.prisma.task
        .update({
          where: { id: t.id },
          data: {
            isCritical: cpm.isCritical,
            totalFloat: cpm.totalFloat,
          },
        })
        .catch(() => null); // silently ignore DB errors
    });
    void Promise.allSettled(updates.filter(Boolean));

    return tasks.map((t) => ({
      ...t,
      cpm: cpmResults.get(t.id) ?? null,
    }));
  }
}
