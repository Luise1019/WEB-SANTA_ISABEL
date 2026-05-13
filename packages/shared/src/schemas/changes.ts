import { z } from 'zod';

import { MoneySchema } from '../types/money';

export const ChangeOrderStatusSchema = z.enum([
  'BORRADOR',
  'EN_REVISION',
  'APROBADA',
  'RECHAZADA',
  'APLICADA',
]);
export type ChangeOrderStatus = z.infer<typeof ChangeOrderStatusSchema>;

export const ChangeOrderInputSchema = z.object({
  projectId: z.string().uuid(),
  code: z.string().min(1).max(30),
  title: z.string().min(2).max(200),
  justification: z.string().min(10).max(5000),
  estimatedCostImpact: MoneySchema,
  estimatedScheduleImpactDays: z.number().int().default(0),
});
export type ChangeOrderInput = z.infer<typeof ChangeOrderInputSchema>;

export const ChangeOrderImpactInputSchema = z.object({
  changeOrderId: z.string().uuid(),
  budgetItemId: z.string().uuid().nullable(),
  chapterId: z.string().uuid().nullable(),
  newQuantity: MoneySchema.nullable(),
  newUnitCost: MoneySchema.nullable(),
  notes: z.string().max(1000).optional(),
});
export type ChangeOrderImpactInput = z.infer<typeof ChangeOrderImpactInputSchema>;
