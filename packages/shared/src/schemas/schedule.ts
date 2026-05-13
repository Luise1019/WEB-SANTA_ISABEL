import { z } from 'zod';

import { MoneySchema, PositiveMoneySchema } from '../types/money';

export const DependencyTypeSchema = z.enum(['FS', 'SS', 'FF', 'SF']);
export type DependencyType = z.infer<typeof DependencyTypeSchema>;

export const TaskKindSchema = z.enum(['SUMMARY', 'TASK', 'MILESTONE']);
export type TaskKind = z.infer<typeof TaskKindSchema>;

export const TaskInputSchema = z.object({
  projectId: z.string().uuid(),
  parentId: z.string().uuid().nullable(),
  code: z.string().min(1).max(50),
  name: z.string().min(2).max(200),
  kind: TaskKindSchema.default('TASK'),
  plannedStart: z.coerce.date(),
  plannedEnd: z.coerce.date(),
  durationDays: z.number().int().min(0),
  progress: MoneySchema.default('0'),
  order: z.number().int().min(0).default(0),
});
export type TaskInput = z.infer<typeof TaskInputSchema>;

export const DependencyInputSchema = z.object({
  predecessorId: z.string().uuid(),
  successorId: z.string().uuid(),
  type: DependencyTypeSchema.default('FS'),
  lagDays: z.number().int().default(0),
});
export type DependencyInput = z.infer<typeof DependencyInputSchema>;

export const TaskAssignmentInputSchema = z.object({
  taskId: z.string().uuid(),
  resourceId: z.string().uuid(),
  units: PositiveMoneySchema.default('1'),
});
export type TaskAssignmentInput = z.infer<typeof TaskAssignmentInputSchema>;

export const TaskBudgetAllocationInputSchema = z.object({
  taskId: z.string().uuid(),
  budgetItemId: z.string().uuid(),
  percentage: PositiveMoneySchema,
});
export type TaskBudgetAllocationInput = z.infer<typeof TaskBudgetAllocationInputSchema>;
