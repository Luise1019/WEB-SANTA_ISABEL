import { z } from 'zod';

import { MoneySchema, PositiveMoneySchema } from '../types/money';

export const ResourceTypeSchema = z.enum(['MANO_OBRA', 'MATERIAL', 'EQUIPO', 'SUBCONTRATO']);
export type ResourceType = z.infer<typeof ResourceTypeSchema>;

export const ChapterInputSchema = z.object({
  projectId: z.string().uuid(),
  code: z.string().min(1).max(20),
  name: z.string().min(2).max(200),
  order: z.number().int().min(0).default(0),
});
export type ChapterInput = z.infer<typeof ChapterInputSchema>;

export const SubchapterInputSchema = z.object({
  chapterId: z.string().uuid(),
  code: z.string().min(1).max(30),
  name: z.string().min(2).max(200),
  order: z.number().int().min(0).default(0),
});
export type SubchapterInput = z.infer<typeof SubchapterInputSchema>;

export const ResourceInputSchema = z.object({
  type: ResourceTypeSchema,
  code: z.string().min(1).max(50),
  name: z.string().min(2).max(200),
  unit: z.string().min(1).max(20),
});
export type ResourceInput = z.infer<typeof ResourceInputSchema>;

export const ResourceRateInputSchema = z.object({
  resourceId: z.string().uuid(),
  effectiveDate: z.coerce.date(),
  unitCost: PositiveMoneySchema,
});
export type ResourceRateInput = z.infer<typeof ResourceRateInputSchema>;

export const APUComponentInputSchema = z.object({
  resourceId: z.string().uuid(),
  quantity: PositiveMoneySchema,
  wasteFactor: MoneySchema.default('0'),
  performance: PositiveMoneySchema.optional(),
});
export type APUComponentInput = z.infer<typeof APUComponentInputSchema>;

export const APUInputSchema = z.object({
  code: z.string().min(1).max(50),
  name: z.string().min(2).max(200),
  unit: z.string().min(1).max(20),
  isLibrary: z.boolean().default(false),
  components: z.array(APUComponentInputSchema).min(1),
});
export type APUInput = z.infer<typeof APUInputSchema>;

export const BudgetItemInputSchema = z.object({
  subchapterId: z.string().uuid(),
  apuId: z.string().uuid().nullable(),
  code: z.string().min(1).max(50),
  description: z.string().min(2).max(500),
  unit: z.string().min(1).max(20),
  quantity: PositiveMoneySchema,
  unitCost: PositiveMoneySchema,
  order: z.number().int().min(0).default(0),
});
export type BudgetItemInput = z.infer<typeof BudgetItemInputSchema>;

export const AIUConfigInputSchema = z.object({
  projectId: z.string().uuid(),
  administracionPct: PositiveMoneySchema,
  imprevistosPct: PositiveMoneySchema,
  utilidadPct: PositiveMoneySchema,
  ivaUtilidadPct: PositiveMoneySchema.default('19'),
  appliesToIndirect: z.boolean().default(false),
});
export type AIUConfigInput = z.infer<typeof AIUConfigInputSchema>;
