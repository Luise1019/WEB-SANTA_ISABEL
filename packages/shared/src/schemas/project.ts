import { z } from 'zod';

import { MoneySchema } from '../types/money';

export const HousingTypeSchema = z.enum(['VIS', 'VIP', 'NO_VIS', 'COMERCIAL', 'MIXTO']);
export type HousingType = z.infer<typeof HousingTypeSchema>;

export const ProjectStatusSchema = z.enum([
  'PREFACTIBILIDAD',
  'FACTIBILIDAD',
  'EJECUCION',
  'CIERRE',
  'ARCHIVADO',
]);
export type ProjectStatus = z.infer<typeof ProjectStatusSchema>;

export const ProjectInputSchema = z.object({
  code: z.string().min(2).max(30),
  name: z.string().min(2).max(200),
  housingType: HousingTypeSchema,
  status: ProjectStatusSchema.default('PREFACTIBILIDAD'),
  city: z.string().min(2).max(120),
  department: z.string().min(2).max(120),
  startDate: z.coerce.date(),
  expectedEndDate: z.coerce.date(),
  totalAreaM2: MoneySchema.optional(),
  saleableAreaM2: MoneySchema.optional(),
  description: z.string().max(2000).optional(),
});
export type ProjectInput = z.infer<typeof ProjectInputSchema>;
