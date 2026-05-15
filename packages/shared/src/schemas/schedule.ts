import { z } from 'zod';

export const DependencyTypeSchema = z.enum(['FS', 'SS', 'FF', 'SF']);
export type DependencyType = z.infer<typeof DependencyTypeSchema>;

export const TaskKindSchema = z.enum(['SUMMARY', 'TASK', 'MILESTONE']);
export type TaskKind = z.infer<typeof TaskKindSchema>;

export const TaskInputSchema = z.object({
  code: z.string().min(1).max(50),
  name: z.string().min(2).max(200),
  kind: TaskKindSchema.default('TASK'),
  parentId: z.string().uuid().nullable().optional(),
  plannedStart: z.string(), // ISO date string
  plannedEnd: z.string(), // ISO date string
  durationDays: z.number().int().min(0),
  progress: z.number().min(0).max(100).default(0),
  order: z.number().int().min(0).optional(),
});
export type TaskInput = z.infer<typeof TaskInputSchema>;

export const TaskUpdateSchema = TaskInputSchema.partial();
export type TaskUpdate = z.infer<typeof TaskUpdateSchema>;

export const DependencyInputSchema = z.object({
  predecessorId: z.string().uuid(),
  successorId: z.string().uuid(),
  type: DependencyTypeSchema.default('FS'),
  lagDays: z.number().int().default(0),
});
export type DependencyInput = z.infer<typeof DependencyInputSchema>;
