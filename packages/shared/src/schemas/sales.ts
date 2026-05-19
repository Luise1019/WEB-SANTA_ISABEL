import { z } from 'zod';

import { MoneySchema, PositiveMoneySchema } from '../types/money';

export const UnitKindSchema = z.enum(['APARTAMENTO', 'CASA', 'OFICINA', 'LOCAL', 'PARQUEADERO', 'DEPOSITO', 'BODEGA']);
export type UnitKind = z.infer<typeof UnitKindSchema>;

export const UnitStatusSchema = z.enum([
  'DISPONIBLE',
  'RESERVADA',
  'NEGOCIANDO',
  'VENDIDA',
  'ESCRITURADA',
  'BLOQUEADA',
]);
export type UnitStatus = z.infer<typeof UnitStatusSchema>;

export const UnitInputSchema = z.object({
  projectId: z.string().uuid(),
  towerId: z.string().uuid().nullable(),
  code: z.string().min(1).max(30),
  kind: UnitKindSchema,
  floor: z.number().int().optional(),
  privateAreaM2: PositiveMoneySchema,
  commonAreaM2: PositiveMoneySchema.default('0'),
  saleableAreaM2: PositiveMoneySchema,
  listPrice: PositiveMoneySchema,
  status: UnitStatusSchema.default('DISPONIBLE'),
});
export type UnitInput = z.infer<typeof UnitInputSchema>;

export const SaleInputSchema = z.object({
  unitId: z.string().uuid(),
  buyerName: z.string().min(2).max(200),
  buyerDocument: z.string().min(5).max(30),
  salePrice: PositiveMoneySchema,
  reservationDate: z.coerce.date(),
  expectedScriptureDate: z.coerce.date().optional(),
});
export type SaleInput = z.infer<typeof SaleInputSchema>;

export const PriceListInputSchema = z.object({
  name: z.string().min(1).max(100),
  effectiveDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  notes: z.string().max(500).nullable().optional(),
  isBase: z.boolean().optional(),
});
export type PriceListInput = z.infer<typeof PriceListInputSchema>;

export const PriceListItemInputSchema = z.object({
  unitId: z.string().uuid(),
  price: z.string().regex(/^\d+(\.\d{1,2})?$/),
});
export type PriceListItemInput = z.infer<typeof PriceListItemInputSchema>;

export const PaymentScheduleItemInputSchema = z.object({
  saleId: z.string().uuid(),
  installmentNumber: z.number().int().min(1),
  dueDate: z.coerce.date(),
  amount: PositiveMoneySchema,
  description: z.string().max(200).optional(),
});
export type PaymentScheduleItemInput = z.infer<typeof PaymentScheduleItemInputSchema>;
