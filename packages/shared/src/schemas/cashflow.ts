import { z } from 'zod';

import { MoneySchema, PositiveMoneySchema } from '../types/money';

export const CashFlowKindSchema = z.enum(['INGRESO', 'EGRESO']);
export type CashFlowKind = z.infer<typeof CashFlowKindSchema>;

export const CashFlowCategorySchema = z.enum([
  'VENTA_CUOTA_INICIAL',
  'VENTA_SALDO',
  'DESEMBOLSO_CREDITO',
  'APORTE_SOCIO',
  'EGRESO_CAPITULO',
  'INTERES_CREDITO',
  'AMORTIZACION_CREDITO',
  'IMPUESTOS',
  'OTRO',
]);
export type CashFlowCategory = z.infer<typeof CashFlowCategorySchema>;

export const CashFlowEntryInputSchema = z.object({
  projectId: z.string().uuid(),
  date: z.coerce.date(),
  kind: CashFlowKindSchema,
  category: CashFlowCategorySchema,
  description: z.string().min(2).max(500),
  amount: PositiveMoneySchema,
  chapterId: z.string().uuid().nullable().optional(),
  budgetItemId: z.string().uuid().nullable().optional(),
  saleId: z.string().uuid().nullable().optional(),
  loanFacilityId: z.string().uuid().nullable().optional(),
});
export type CashFlowEntryInput = z.infer<typeof CashFlowEntryInputSchema>;

export const CashTransactionInputSchema = z.object({
  projectId: z.string().uuid(),
  date: z.coerce.date(),
  kind: CashFlowKindSchema,
  description: z.string().min(2).max(500),
  amount: PositiveMoneySchema,
  accountId: z.string().uuid(),
  reconciliationId: z.string().uuid().nullable().optional(),
});
export type CashTransactionInput = z.infer<typeof CashTransactionInputSchema>;

export const LoanFacilityInputSchema = z.object({
  projectId: z.string().uuid(),
  bank: z.string().min(2).max(120),
  amount: PositiveMoneySchema,
  interestRateAnnual: PositiveMoneySchema,
  startDate: z.coerce.date(),
  termMonths: z.number().int().min(1).max(360),
  graceMonths: z.number().int().min(0).default(0),
});
export type LoanFacilityInput = z.infer<typeof LoanFacilityInputSchema>;
