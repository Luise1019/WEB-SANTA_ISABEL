import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import Decimal from 'decimal.js';
import type {
  FeasibilityAnalysisInput,
  FeasibilityCostItemInput,
  FeasibilityCashFlowInput,
  FeasibilityScenarioInput,
} from '@santaisabel/shared';

import { PrismaService } from '../prisma/prisma.service';
import {
  calculateIRR,
  calculateNPV,
  calculatePaybackMonths,
} from './tir-npv.calculator';

const toDec = (v: string | null | undefined): Prisma.Decimal | null =>
  v === null || v === undefined || v === '' ? null : new Prisma.Decimal(v);

const toDecDefault = (v: string | null | undefined, fallback = '0'): Prisma.Decimal =>
  new Prisma.Decimal(v ?? fallback);

@Injectable()
export class FeasibilityService {
  constructor(private readonly prisma: PrismaService) {}

  async getOrCreate(projectId: string) {
    const existing = await this.prisma.feasibilityAnalysis.findUnique({
      where: { projectId },
    });
    if (existing) return existing;
    return this.prisma.feasibilityAnalysis.create({
      data: { projectId, discountRate: new Prisma.Decimal('12') },
    });
  }

  async getByProject(projectId: string) {
    const analysis = await this.getOrCreate(projectId);
    const [costItems, cashFlow, scenarios] = await Promise.all([
      this.prisma.feasibilityCostItem.findMany({
        where: { analysisId: analysis.id },
        orderBy: [{ category: 'asc' }, { order: 'asc' }],
      }),
      this.prisma.feasibilityCashFlow.findMany({
        where: { analysisId: analysis.id },
        orderBy: [{ year: 'asc' }, { month: 'asc' }],
      }),
      this.prisma.feasibilityScenario.findMany({
        where: { analysisId: analysis.id },
        orderBy: { createdAt: 'asc' },
      }),
    ]);
    return { analysis, costItems, cashFlow, scenarios };
  }

  async updateAnalysis(projectId: string, input: FeasibilityAnalysisInput) {
    const data: Prisma.FeasibilityAnalysisUncheckedUpdateInput = {
      promoter: input.promoter ?? null,
      totalUnits: input.totalUnits ?? null,
      builtAreaM2: toDec(input.builtAreaM2 ?? null),
      saleableAreaM2: toDec(input.saleableAreaM2 ?? null),
      pricePerM2: toDec(input.pricePerM2 ?? null),
      totalSales: toDec(input.totalSales ?? null),
      initialPaymentPct: toDec(input.initialPaymentPct ?? null),
      breakEvenUnits: input.breakEvenUnits ?? null,
      stratum: input.stratum ?? null,
      constructionSystem: input.constructionSystem ?? null,
      discountRate: toDecDefault(input.discountRate, '12'),
      notes: input.notes ?? null,
    };
    return this.prisma.feasibilityAnalysis.upsert({
      where: { projectId },
      update: data,
      create: {
        projectId,
        promoter: input.promoter ?? null,
        totalUnits: input.totalUnits ?? null,
        builtAreaM2: toDec(input.builtAreaM2 ?? null),
        saleableAreaM2: toDec(input.saleableAreaM2 ?? null),
        pricePerM2: toDec(input.pricePerM2 ?? null),
        totalSales: toDec(input.totalSales ?? null),
        initialPaymentPct: toDec(input.initialPaymentPct ?? null),
        breakEvenUnits: input.breakEvenUnits ?? null,
        stratum: input.stratum ?? null,
        constructionSystem: input.constructionSystem ?? null,
        discountRate: toDecDefault(input.discountRate, '12'),
        notes: input.notes ?? null,
      },
    });
  }

  async replaceCostItems(projectId: string, items: FeasibilityCostItemInput[]) {
    const analysis = await this.getOrCreate(projectId);
    return this.prisma.$transaction(async (tx) => {
      await tx.feasibilityCostItem.deleteMany({ where: { analysisId: analysis.id } });
      if (items.length === 0) return [];
      await tx.feasibilityCostItem.createMany({
        data: items.map((it, idx) => ({
          analysisId: analysis.id,
          category: it.category,
          concept: it.concept,
          fideicomisoValue: toDec(it.fideicomisoValue ?? null),
          constructorValue: toDec(it.constructorValue ?? null),
          totalValue: new Prisma.Decimal(it.totalValue),
          pctOfSales: toDec(it.pctOfSales ?? null),
          order: it.order ?? idx,
        })),
      });
      return tx.feasibilityCostItem.findMany({
        where: { analysisId: analysis.id },
        orderBy: [{ category: 'asc' }, { order: 'asc' }],
      });
    });
  }

  async replaceCashFlow(projectId: string, rows: FeasibilityCashFlowInput[]) {
    const analysis = await this.getOrCreate(projectId);
    return this.prisma.$transaction(async (tx) => {
      await tx.feasibilityCashFlow.deleteMany({ where: { analysisId: analysis.id } });
      if (rows.length === 0) return [];
      await tx.feasibilityCashFlow.createMany({
        data: rows.map((r) => ({
          analysisId: analysis.id,
          year: r.year,
          month: r.month,
          initialBalance: toDecDefault(r.initialBalance),
          salesInitialPayment: toDecDefault(r.salesInitialPayment),
          salesFinalPayment: toDecDefault(r.salesFinalPayment),
          ownResources: toDecDefault(r.ownResources),
          constructionCredit: toDecDefault(r.constructionCredit),
          directCosts: toDecDefault(r.directCosts),
          indirectCosts: toDecDefault(r.indirectCosts),
          financialCosts: toDecDefault(r.financialCosts),
          finalBalance: toDecDefault(r.finalBalance),
        })),
      });
      return tx.feasibilityCashFlow.findMany({
        where: { analysisId: analysis.id },
        orderBy: [{ year: 'asc' }, { month: 'asc' }],
      });
    });
  }

  /** Build net monthly cash flow array and compute TIR/VPN/Payback. */
  async recalculateIndicators(projectId: string) {
    const analysis = await this.getOrCreate(projectId);
    const rows = await this.prisma.feasibilityCashFlow.findMany({
      where: { analysisId: analysis.id },
      orderBy: [{ year: 'asc' }, { month: 'asc' }],
    });

    const netFlows: number[] = rows.map((r) => {
      const inflow = new Decimal(r.salesInitialPayment.toString())
        .plus(r.salesFinalPayment.toString())
        .plus(r.ownResources.toString())
        .plus(r.constructionCredit.toString());
      const outflow = new Decimal(r.directCosts.toString())
        .plus(r.indirectCosts.toString())
        .plus(r.financialCosts.toString());
      return inflow.minus(outflow).toNumber();
    });

    const annualRate = Number(new Decimal(analysis.discountRate.toString()).div(100));
    const monthlyRate = Math.pow(1 + annualRate, 1 / 12) - 1;

    const irrMonthly = calculateIRR(netFlows);
    const irrAnnual = irrMonthly !== null ? Math.pow(1 + irrMonthly, 12) - 1 : null;
    const npv = netFlows.length > 0 ? calculateNPV(netFlows, monthlyRate) : 0;
    const payback = calculatePaybackMonths(netFlows);

    const updated = await this.prisma.feasibilityAnalysis.update({
      where: { id: analysis.id },
      data: {
        tir: irrAnnual !== null ? new Prisma.Decimal(irrAnnual.toFixed(4)) : null,
        npv: new Prisma.Decimal(npv.toFixed(2)),
        paybackMonths: payback,
      },
    });

    return {
      tir: updated.tir ? updated.tir.toString() : null,
      npv: updated.npv ? updated.npv.toString() : null,
      paybackMonths: updated.paybackMonths,
      netFlows: netFlows.map((n) => n.toFixed(2)),
    };
  }

  async createScenario(projectId: string, input: FeasibilityScenarioInput) {
    const analysis = await this.getOrCreate(projectId);
    const rows = await this.prisma.feasibilityCashFlow.findMany({
      where: { analysisId: analysis.id },
      orderBy: [{ year: 'asc' }, { month: 'asc' }],
    });

    const priceFactor = new Decimal(1).plus(new Decimal(input.priceVariationPct).div(100));
    const costFactor = new Decimal(1).plus(new Decimal(input.costVariationPct).div(100));

    const netFlows = rows.map((r) => {
      const inflow = new Decimal(r.salesInitialPayment.toString())
        .plus(r.salesFinalPayment.toString())
        .times(priceFactor)
        .plus(r.ownResources.toString())
        .plus(r.constructionCredit.toString());
      const outflow = new Decimal(r.directCosts.toString())
        .plus(r.indirectCosts.toString())
        .plus(r.financialCosts.toString())
        .times(costFactor);
      return inflow.minus(outflow).toNumber();
    });

    const annualRate = Number(new Decimal(analysis.discountRate.toString()).div(100));
    const monthlyRate = Math.pow(1 + annualRate, 1 / 12) - 1;
    const irrMonthly = calculateIRR(netFlows);
    const irrAnnual = irrMonthly !== null ? Math.pow(1 + irrMonthly, 12) - 1 : null;
    const npv = netFlows.length > 0 ? calculateNPV(netFlows, monthlyRate) : 0;

    return this.prisma.feasibilityScenario.create({
      data: {
        analysisId: analysis.id,
        name: input.name,
        priceVariationPct: new Prisma.Decimal(input.priceVariationPct),
        costVariationPct: new Prisma.Decimal(input.costVariationPct),
        salesVelocityVariationPct: new Prisma.Decimal(input.salesVelocityVariationPct),
        computedTir: irrAnnual !== null ? new Prisma.Decimal(irrAnnual.toFixed(4)) : null,
        computedNpv: new Prisma.Decimal(npv.toFixed(2)),
      },
    });
  }

  async deleteScenario(scenarioId: string) {
    const sc = await this.prisma.feasibilityScenario.findUnique({ where: { id: scenarioId } });
    if (!sc) throw new NotFoundException(`Escenario ${scenarioId} no existe`);
    await this.prisma.feasibilityScenario.delete({ where: { id: scenarioId } });
  }
}
