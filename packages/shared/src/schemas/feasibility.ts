import { z } from 'zod';

const numericString = () =>
  z
    .string()
    .refine((v) => !isNaN(Number(v)), { message: 'Debe ser un número' });

export const FeasibilityCostCategorySchema = z.enum([
  'LOTE',
  'URBANISMO',
  'DIRECTO',
  'INDIRECTO',
  'FINANCIERO',
  'VENTAS',
]);
export type FeasibilityCostCategory = z.infer<typeof FeasibilityCostCategorySchema>;

// ── Resumen ejecutivo (header del análisis) ──────────────────
export const FeasibilityAnalysisInputSchema = z.object({
  promoter: z.string().min(1).max(200).optional().nullable(),
  totalUnits: z.number().int().positive().optional().nullable(),
  builtAreaM2: numericString().optional().nullable(),
  saleableAreaM2: numericString().optional().nullable(),
  pricePerM2: numericString().optional().nullable(),
  totalSales: numericString().optional().nullable(),
  initialPaymentPct: numericString().optional().nullable(),
  breakEvenUnits: z.number().int().nonnegative().optional().nullable(),
  stratum: z.number().int().min(1).max(6).optional().nullable(),
  constructionSystem: z.string().max(200).optional().nullable(),
  discountRate: numericString().default('12'),
  notes: z.string().max(2000).optional().nullable(),
});
export type FeasibilityAnalysisInput = z.infer<typeof FeasibilityAnalysisInputSchema>;

// ── Ítem de costo (Lote/Urbanismo/etc., dual Fideicomiso↔Constructor) ──
export const FeasibilityCostItemInputSchema = z.object({
  category: FeasibilityCostCategorySchema,
  concept: z.string().min(1).max(200),
  fideicomisoValue: numericString().optional().nullable(),
  constructorValue: numericString().optional().nullable(),
  totalValue: numericString(),
  pctOfSales: numericString().optional().nullable(),
  order: z.number().int().nonnegative().default(0),
});
export type FeasibilityCostItemInput = z.infer<typeof FeasibilityCostItemInputSchema>;

// ── Mes de flujo de caja ──────────────────────────────────────
export const FeasibilityCashFlowInputSchema = z.object({
  year: z.number().int().min(2000).max(2100),
  month: z.number().int().min(1).max(12),
  initialBalance: numericString().default('0'),
  salesInitialPayment: numericString().default('0'),
  salesFinalPayment: numericString().default('0'),
  ownResources: numericString().default('0'),
  constructionCredit: numericString().default('0'),
  directCosts: numericString().default('0'),
  indirectCosts: numericString().default('0'),
  financialCosts: numericString().default('0'),
  finalBalance: numericString().default('0'),
});
export type FeasibilityCashFlowInput = z.infer<typeof FeasibilityCashFlowInputSchema>;

// ── Escenario de sensibilidad ────────────────────────────────
export const FeasibilityScenarioInputSchema = z.object({
  name: z.string().min(1).max(50),
  priceVariationPct: numericString().default('0'),
  costVariationPct: numericString().default('0'),
  salesVelocityVariationPct: numericString().default('0'),
});
export type FeasibilityScenarioInput = z.infer<typeof FeasibilityScenarioInputSchema>;

// ── Para preview/commit del importador Santa Isabel ──────────
export const SantaIsabelImportPreviewSchema = z.object({
  analysis: FeasibilityAnalysisInputSchema,
  costItems: z.array(FeasibilityCostItemInputSchema),
  cashFlow: z.array(FeasibilityCashFlowInputSchema),
  budget: z.object({
    chapters: z.array(
      z.object({
        code: z.string(),
        name: z.string(),
        subchapters: z.array(
          z.object({
            code: z.string(),
            name: z.string(),
            items: z.array(
              z.object({
                code: z.string(),
                description: z.string(),
                unit: z.string(),
                quantity: numericString(),
                unitCost: numericString(),
                costType: z.enum(['MANO_OBRA', 'MATERIAL', 'EQUIPO', 'FUNGIBLE', 'OTRO']).optional(),
              }),
            ),
          }),
        ),
      }),
    ),
    totalDirectCost: numericString(),
  }),
  warnings: z.array(z.string()).default([]),
});
export type SantaIsabelImportPreview = z.infer<typeof SantaIsabelImportPreviewSchema>;
