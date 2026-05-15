import { z } from 'zod';

// We use z.string() for monetary fields in API inputs so that the TypeScript type
// stays as `string` — consumers pass plain numeric strings, the service creates Decimal.
const numericString = () =>
  z
    .string()
    .refine((v) => !isNaN(Number(v)) && Number(v) >= 0, { message: 'Debe ser un número ≥ 0' });

export const ResourceTypeSchema = z.enum(['MANO_OBRA', 'MATERIAL', 'EQUIPO', 'SUBCONTRATO']);
export type ResourceType = z.infer<typeof ResourceTypeSchema>;

export const CostTypeSchema = z.enum(['MANO_OBRA', 'MATERIAL', 'EQUIPO', 'FUNGIBLE', 'OTRO']);
export type CostType = z.infer<typeof CostTypeSchema>;

// ── Chapter / Subchapter ─────────────────────────────────────
export const ChapterInputSchema = z.object({
  code: z.string().min(1).max(20),
  name: z.string().min(2).max(200),
});
export type ChapterInput = z.infer<typeof ChapterInputSchema>;

// ── Resources ────────────────────────────────────────────────
export const ResourceInputSchema = z.object({
  type: ResourceTypeSchema,
  code: z.string().min(1).max(50),
  name: z.string().min(2).max(200),
  unit: z.string().min(1).max(20),
  unitCost: numericString(),
});
export type ResourceInput = z.infer<typeof ResourceInputSchema>;

// ── APU ──────────────────────────────────────────────────────
export const APUComponentInputSchema = z.object({
  resourceId: z.string().uuid(),
  quantity: numericString(),
  wasteFactor: numericString().default('0'),
  performance: numericString().optional(),
});
export type APUComponentInput = z.infer<typeof APUComponentInputSchema>;

export const APUInputSchema = z.object({
  code: z.string().min(1).max(50),
  name: z.string().min(2).max(200),
  unit: z.string().min(1).max(20),
  isLibrary: z.boolean().default(false),
  components: z.array(APUComponentInputSchema).default([]),
});
export type APUInput = z.infer<typeof APUInputSchema>;

// ── Budget Item ───────────────────────────────────────────────
export const BudgetItemInputSchema = z.object({
  apuId: z.string().uuid().nullable().optional(),
  code: z.string().min(1).max(50),
  description: z.string().min(2).max(500),
  unit: z.string().min(1).max(20),
  quantity: numericString(),
  unitCost: numericString(),
  costType: CostTypeSchema.optional().default('MATERIAL'),
  customCategory: z.string().max(100).optional().nullable(),
});
export type BudgetItemInput = z.infer<typeof BudgetItemInputSchema>;

// ── AIU Config ────────────────────────────────────────────────
export const AIUConfigInputSchema = z.object({
  administracionPct: numericString().default('0'),
  imprevistosPct: numericString().default('0'),
  utilidadPct: numericString().default('0'),
  ivaUtilidadPct: numericString().default('19'),
  appliesToIndirect: z.boolean().default(false),
});
export type AIUConfigInput = z.infer<typeof AIUConfigInputSchema>;
