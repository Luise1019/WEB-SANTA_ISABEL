import Decimal from 'decimal.js';
import { z } from 'zod';

Decimal.set({ precision: 20, rounding: Decimal.ROUND_HALF_EVEN });

export type Money = Decimal;

export const MoneySchema = z
  .union([z.number(), z.string(), z.instanceof(Decimal)])
  .transform((v) => new Decimal(v))
  .refine((v) => v.isFinite(), { message: 'Monto no finito' });

export const PositiveMoneySchema = MoneySchema.refine((v) => v.gte(0), {
  message: 'Monto debe ser ≥ 0',
});

export const CurrencyCodeSchema = z.enum(['COP', 'USD']);
export type CurrencyCode = z.infer<typeof CurrencyCodeSchema>;

export function formatCOP(value: Decimal | number | string, decimals = 0): string {
  const d = value instanceof Decimal ? value : new Decimal(value);
  return new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(d.toNumber());
}

export function formatNumberCO(value: Decimal | number | string, decimals = 2): string {
  const d = value instanceof Decimal ? value : new Decimal(value);
  return new Intl.NumberFormat('es-CO', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(d.toNumber());
}

export function sumMoney(values: Array<Decimal | number | string>): Decimal {
  return values.reduce<Decimal>(
    (acc, v) => acc.plus(v instanceof Decimal ? v : new Decimal(v)),
    new Decimal(0),
  );
}
