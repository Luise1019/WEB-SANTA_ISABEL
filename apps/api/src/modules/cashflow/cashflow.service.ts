import { Injectable, NotFoundException } from '@nestjs/common';
import Decimal from 'decimal.js';

import { PrismaService } from '../prisma/prisma.service';

type CashFlowKind = 'INGRESO' | 'EGRESO';
type CashFlowCategory =
  | 'VENTA_CUOTA_INICIAL'
  | 'VENTA_SALDO'
  | 'DESEMBOLSO_CREDITO'
  | 'APORTE_SOCIO'
  | 'EGRESO_CAPITULO'
  | 'INTERES_CREDITO'
  | 'AMORTIZACION_CREDITO'
  | 'IMPUESTOS'
  | 'OTRO';

type EntryInput = {
  date: string;
  kind: CashFlowKind;
  category: CashFlowCategory;
  description: string;
  amount: string;
  chapterId?: string | null;
  budgetItemId?: string | null;
  saleId?: string | null;
  loanFacilityId?: string | null;
};

@Injectable()
export class CashflowService {
  constructor(private readonly prisma: PrismaService) {}

  // ─── Entries (devengo) ────────────────────────────────────────
  listEntries(projectId: string, year?: number) {
    const where: Record<string, unknown> = { projectId };
    if (year) {
      where['date'] = {
        gte: new Date(`${year}-01-01`),
        lte: new Date(`${year}-12-31`),
      };
    }
    return this.prisma.cashFlowEntry.findMany({
      where,
      include: { chapter: true },
      orderBy: { date: 'asc' },
    });
  }

  createEntry(projectId: string, input: EntryInput) {
    return this.prisma.cashFlowEntry.create({
      data: {
        projectId,
        date: new Date(input.date),
        kind: input.kind,
        category: input.category,
        description: input.description,
        amount: new Decimal(input.amount),
        chapterId: input.chapterId ?? null,
        budgetItemId: input.budgetItemId ?? null,
        saleId: input.saleId ?? null,
        loanFacilityId: input.loanFacilityId ?? null,
      },
    });
  }

  async deleteEntry(entryId: string) {
    const entry = await this.prisma.cashFlowEntry.findUnique({ where: { id: entryId } });
    if (!entry) throw new NotFoundException(`Entrada ${entryId} no existe`);
    await this.prisma.cashFlowEntry.delete({ where: { id: entryId } });
  }

  // ─── Cash Flow Summary ────────────────────────────────────────
  async getSummary(projectId: string) {
    const entries = await this.listEntries(projectId);

    let totalIngresos = new Decimal(0);
    let totalEgresos = new Decimal(0);

    const byMonth: Record<string, { ingresos: Decimal; egresos: Decimal }> = {};
    const byCategory: Record<string, { kind: string; total: Decimal }> = {};

    for (const e of entries) {
      const amount = new Decimal(e.amount.toString());
      const monthKey = e.date.toISOString().substring(0, 7); // YYYY-MM

      if (!byMonth[monthKey]) {
        byMonth[monthKey] = { ingresos: new Decimal(0), egresos: new Decimal(0) };
      }
      if (!byCategory[e.category]) {
        byCategory[e.category] = { kind: e.kind, total: new Decimal(0) };
      }

      if (e.kind === 'INGRESO') {
        totalIngresos = totalIngresos.plus(amount);
        byMonth[monthKey].ingresos = byMonth[monthKey].ingresos.plus(amount);
      } else {
        totalEgresos = totalEgresos.plus(amount);
        byMonth[monthKey].egresos = byMonth[monthKey].egresos.plus(amount);
      }

      const catEntry = byCategory[e.category];
      if (catEntry) {
        catEntry.total = catEntry.total.plus(amount);
      }
    }

    const netFlow = totalIngresos.minus(totalEgresos);

    return {
      totalIngresos: totalIngresos.toFixed(2),
      totalEgresos: totalEgresos.toFixed(2),
      netFlow: netFlow.toFixed(2),
      byMonth: Object.entries(byMonth)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([month, vals]) => ({
          month,
          ingresos: vals.ingresos.toFixed(2),
          egresos: vals.egresos.toFixed(2),
          net: vals.ingresos.minus(vals.egresos).toFixed(2),
        })),
      byCategory: Object.entries(byCategory).map(([cat, vals]) => ({
        category: cat,
        kind: vals.kind,
        total: vals.total.toFixed(2),
      })),
    };
  }

  // ─── Loan Facilities ─────────────────────────────────────────
  listLoans(projectId: string) {
    return this.prisma.loanFacility.findMany({
      where: { projectId },
      include: {
        disbursements: true,
        payments: { orderBy: { date: 'asc' } },
      },
      orderBy: { startDate: 'asc' },
    });
  }

  createLoan(
    projectId: string,
    input: {
      bank: string;
      amount: string;
      interestRateAnnual: string;
      startDate: string;
      termMonths: number;
      graceMonths?: number;
    },
  ) {
    return this.prisma.loanFacility.create({
      data: {
        projectId,
        bank: input.bank,
        amount: new Decimal(input.amount),
        interestRateAnnual: new Decimal(input.interestRateAnnual),
        startDate: new Date(input.startDate),
        termMonths: input.termMonths,
        graceMonths: input.graceMonths ?? 0,
      },
    });
  }
}
