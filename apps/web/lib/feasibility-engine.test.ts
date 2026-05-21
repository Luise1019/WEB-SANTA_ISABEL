import { describe, expect, it } from 'vitest';

import { calculate, ci, DEFAULT_INPUTS, fmtM, fmtMiles, fmtPct } from './feasibility-engine';

describe('feasibility-engine.calculate', () => {
  it('produce un balance ≈ 0 entre fuentes y usos con los inputs por defecto', () => {
    const r = calculate(DEFAULT_INPUTS);
    expect(Math.abs(r.balance)).toBeLessThan(1); // tolerancia 1 COP
  });

  it('totalUsos = suma de lote + urbanismo + directos + indirectos + financieros + ventas', () => {
    const r = calculate(DEFAULT_INPUTS);
    const suma =
      r.lote.total +
      r.urbanismo.total +
      r.directos.total +
      r.indirectos.subtotal.total +
      r.financieros.subtotal.total +
      r.ventasCostos.subtotal.total;
    expect(r.totalUsos.total).toBeCloseTo(suma, 0);
  });

  it('utilidad = totalSales - totalUsos.total', () => {
    const r = calculate(DEFAULT_INPUTS);
    expect(r.utilidad).toBeCloseTo(r.totalSales - r.totalUsos.total, 0);
  });

  it('utilidadPct = utilidad / ventas', () => {
    const r = calculate(DEFAULT_INPUTS);
    expect(r.utilidadPct).toBeCloseTo(r.utilidad / r.totalSales, 6);
  });

  it('roi = utilidad / totalUsos * 100', () => {
    const r = calculate(DEFAULT_INPUTS);
    expect(r.roi).toBeCloseTo((r.utilidad / r.totalUsos.total) * 100, 4);
  });

  it('m² vendibles = m² construidos * saleableFactorPct', () => {
    const r = calculate(DEFAULT_INPUTS);
    expect(r.saleableAreaM2).toBeCloseTo(DEFAULT_INPUTS.builtAreaM2 * DEFAULT_INPUTS.saleableFactorPct, 4);
  });

  it('precio por m² = ventas / m² vendibles', () => {
    const r = calculate(DEFAULT_INPUTS);
    expect(r.pricePerM2).toBeCloseTo(r.totalSales / r.saleableAreaM2, 2);
  });

  it('lote = ventas × lotePct', () => {
    const r = calculate(DEFAULT_INPUTS);
    expect(r.lote.total).toBeCloseTo(DEFAULT_INPUTS.totalSales * DEFAULT_INPUTS.lotePct, 0);
  });

  it('cuotasIniciales = ventas × initialPaymentPct', () => {
    const r = calculate(DEFAULT_INPUTS);
    expect(r.cuotasIniciales).toBeCloseTo(DEFAULT_INPUTS.totalSales * DEFAULT_INPUTS.initialPaymentPct, 0);
  });

  it('creditoConstructor = totalUsos × creditPct', () => {
    const r = calculate(DEFAULT_INPUTS);
    expect(r.creditoConstructor).toBeCloseTo(r.totalUsos.total * DEFAULT_INPUTS.creditPct, 0);
  });

  it('aportes socios = totalUsos - cuotas - crédito - otras fuentes (con piso en 0)', () => {
    const r = calculate(DEFAULT_INPUTS);
    const esperado = Math.max(
      0,
      r.totalUsos.total - r.cuotasIniciales - r.creditoConstructor - DEFAULT_INPUTS.otherSources,
    );
    expect(r.aportesSocios).toBeCloseTo(esperado, 0);
  });

  it('breakEvenUnits redondea al alza el costo total / precio unitario', () => {
    const r = calculate(DEFAULT_INPUTS);
    const esperado = Math.ceil(r.totalUsos.total / r.pricePerUnit);
    expect(r.breakEvenUnits).toBe(esperado);
  });

  it('si ventas = 0, todos los pctSales son 0 y no hay NaN', () => {
    const r = calculate({ ...DEFAULT_INPUTS, totalSales: 0 });
    expect(r.lote.pctSales).toBe(0);
    expect(r.directos.pctSales).toBe(0);
    expect(r.totalUsos.pctSales).toBe(0);
    expect(Number.isFinite(r.utilidad)).toBe(true);
  });

  it('si totalUnits = 0, breakEvenUnits es 0 sin división por cero', () => {
    const r = calculate({ ...DEFAULT_INPUTS, totalUnits: 0 });
    expect(r.breakEvenUnits).toBe(0);
    expect(r.pricePerUnit).toBe(0);
    expect(Number.isFinite(r.roi)).toBe(true);
  });

  it('si saleableFactor es 0, pricePerM2 = 0 sin NaN', () => {
    const r = calculate({ ...DEFAULT_INPUTS, saleableFactorPct: 0 });
    expect(r.saleableAreaM2).toBe(0);
    expect(r.pricePerM2).toBe(0);
  });

  it('escenario con utilidad negativa (sobre-costo): utilidad < 0 y aportesSocios cubre el faltante', () => {
    const r = calculate({
      ...DEFAULT_INPUTS,
      directos: ci(DEFAULT_INPUTS.totalSales, 0), // costos directos = ventas
    });
    expect(r.utilidad).toBeLessThan(0);
    expect(r.aportesSocios).toBeGreaterThan(0);
  });

  it('los totales fid + con coinciden con total en cada LineResult', () => {
    const r = calculate(DEFAULT_INPUTS);
    for (const line of [r.lote, r.urbanismo, r.directos, r.totalUsos]) {
      expect(line.fid + line.con).toBeCloseTo(line.total, 0);
    }
  });
});

describe('feasibility-engine helpers de formato', () => {
  it('fmtM formatea millones con sufijo M', () => {
    expect(fmtM(9_273_800_000)).toContain('M');
    expect(fmtM(1_000_000)).toMatch(/1[,.]/);
  });

  it('fmtMiles formatea miles', () => {
    expect(fmtMiles(1_500_000)).toBeTruthy();
  });

  it('fmtPct convierte fracción a porcentaje', () => {
    expect(fmtPct(0.5)).toContain('50');
    expect(fmtPct(0.095)).toMatch(/9[,.]5/);
  });
});

describe('feasibility-engine ci helper', () => {
  it('ci() crea CostItem con valores por defecto en 0', () => {
    expect(ci()).toEqual({ fid: 0, con: 0 });
    expect(ci(100)).toEqual({ fid: 100, con: 0 });
    expect(ci(100, 50)).toEqual({ fid: 100, con: 50 });
  });
});
