import Decimal from 'decimal.js';
import { describe, expect, it } from 'vitest';

import { MoneySchema, PositiveMoneySchema, formatCOP, sumMoney } from './money';

describe('Money types', () => {
  it('MoneySchema acepta number, string y Decimal', () => {
    expect(MoneySchema.parse(100).toString()).toBe('100');
    expect(MoneySchema.parse('1500.55').toString()).toBe('1500.55');
    expect(MoneySchema.parse(new Decimal('99.99')).toString()).toBe('99.99');
  });

  it('PositiveMoneySchema rechaza negativos', () => {
    expect(() => PositiveMoneySchema.parse(-1)).toThrow();
    expect(PositiveMoneySchema.parse(0).toString()).toBe('0');
  });

  it('formatCOP formatea sin decimales por defecto', () => {
    const formatted = formatCOP(1_500_000);
    expect(formatted).toMatch(/\$/);
    expect(formatted).toMatch(/1\.500\.000/);
  });

  it('sumMoney acumula sin perder precisión', () => {
    const total = sumMoney(['0.1', '0.2', '0.3']);
    expect(total.toString()).toBe('0.6');
  });
});
