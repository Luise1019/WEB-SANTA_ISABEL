import { Injectable, NotFoundException } from '@nestjs/common';
import {
  FeasibilityAnalysis,
  FeasibilityCashFlow,
  FeasibilityCostItem,
  FeasibilityScenario,
  Prisma,
} from '@prisma/client';
import Decimal from 'decimal.js';
import type {
  FeasibilityAnalysisInput,
  FeasibilityCashFlowInput,
  FeasibilityCostItemInput,
  FeasibilityScenarioInput,
} from '@santaisabel/shared';

import { PrismaService } from '../prisma/prisma.service';
import { calculateIRR, calculateNPV, calculatePaybackMonths } from './tir-npv.calculator';

// ─── Helpers ────────────────────────────────────────────────────────────────

const toDec = (v: string | null | undefined): Prisma.Decimal | null =>
  v === null || v === undefined || v === '' ? null : new Prisma.Decimal(v);

const toDecDefault = (v: string | null | undefined, fallback = '0'): Prisma.Decimal =>
  new Prisma.Decimal(v ?? fallback);

/** Compute net cash flow for a single row (inflows - outflows). */
function netFlowForRow(r: FeasibilityCashFlow, priceFactor = 1, costFactor = 1): number {
  const pf = new Decimal(priceFactor);
  const cf = new Decimal(costFactor);

  const salesInflow = new Decimal(r.salesInitialPayment.toString())
    .plus(r.salesFinalPayment.toString())
    .times(pf);
  const otherInflow = new Decimal(r.ownResources.toString()).plus(r.constructionCredit.toString());
  const outflow = new Decimal(r.directCosts.toString())
    .plus(r.indirectCosts.toString())
    .plus(r.financialCosts.toString())
    .times(cf);

  return salesInflow.plus(otherInflow).minus(outflow).toNumber();
}

/** Convert annual discount rate (as percentage, e.g. 12) to monthly decimal rate. */
function toMonthlyRate(annualPct: Decimal | Prisma.Decimal): number {
  const annual = Number(new Decimal(annualPct.toString()).div(100));
  return Math.pow(1 + annual, 1 / 12) - 1;
}

// ─── DTOs de respuesta tipados ──────────────────────────────────────────────

export interface FeasibilityFullResponse {
  analysis: FeasibilityAnalysis;
  costItems: FeasibilityCostItem[];
  cashFlow: FeasibilityCashFlow[];
  scenarios: FeasibilityScenario[];
}

export interface IndicatorsResponse {
  tir: string | null;
  npv: string | null;
  paybackMonths: number | null;
  netFlows: string[];
}

// ─── Service ────────────────────────────────────────────────────────────────

@Injectable()
export class FeasibilityService {
  constructor(private readonly prisma: PrismaService) {}

  /** Get or lazily create the analysis record for a project. */
  async getOrCreate(projectId: string): Promise<FeasibilityAnalysis> {
    const existing = await this.prisma.feasibilityAnalysis.findUnique({
      where: { projectId },
    });
    if (existing) return existing;
    return this.prisma.feasibilityAnalysis.create({
      data: { projectId, discountRate: new Prisma.Decimal('12') },
    });
  }

  /** Full read: analysis + costItems + cashFlow + scenarios. */
  async getByProject(projectId: string): Promise<FeasibilityFullResponse> {
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

  /** Upsert header fields — DRY: builds data object once. */
  async updateAnalysis(
    projectId: string,
    input: FeasibilityAnalysisInput,
  ): Promise<FeasibilityAnalysis> {
    const fields = {
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
      update: fields,
      create: { projectId, ...fields },
    });
  }

  /** Atomic replace of all cost items for a project. */
  async replaceCostItems(
    projectId: string,
    items: FeasibilityCostItemInput[],
  ): Promise<FeasibilityCostItem[]> {
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

  /** Atomic replace of all cash flow rows for a project. */
  async replaceCashFlow(
    projectId: string,
    rows: FeasibilityCashFlowInput[],
  ): Promise<FeasibilityCashFlow[]> {
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
  async recalculateIndicators(projectId: string): Promise<IndicatorsResponse> {
    const analysis = await this.getOrCreate(projectId);
    const rows = await this.prisma.feasibilityCashFlow.findMany({
      where: { analysisId: analysis.id },
      orderBy: [{ year: 'asc' }, { month: 'asc' }],
    });

    const netFlows = rows.map((r) => netFlowForRow(r));
    const monthlyRate = toMonthlyRate(analysis.discountRate);

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

  /** Create a what-if scenario with price/cost variation applied to cash flows. */
  async createScenario(
    projectId: string,
    input: FeasibilityScenarioInput,
  ): Promise<FeasibilityScenario> {
    const analysis = await this.getOrCreate(projectId);
    const rows = await this.prisma.feasibilityCashFlow.findMany({
      where: { analysisId: analysis.id },
      orderBy: [{ year: 'asc' }, { month: 'asc' }],
    });

    const priceFactor = 1 + Number(input.priceVariationPct) / 100;
    const costFactor = 1 + Number(input.costVariationPct) / 100;
    const netFlows = rows.map((r) => netFlowForRow(r, priceFactor, costFactor));

    const monthlyRate = toMonthlyRate(analysis.discountRate);
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

  /**
   * Delete a scenario — validates it belongs to the given project.
   * Prevents cross-project deletion if someone guesses a UUID.
   */
  async deleteScenario(projectId: string, scenarioId: string): Promise<void> {
    const analysis = await this.getOrCreate(projectId);
    const sc = await this.prisma.feasibilityScenario.findUnique({
      where: { id: scenarioId },
    });
    if (!sc || sc.analysisId !== analysis.id) {
      throw new NotFoundException(`Escenario ${scenarioId} no existe`);
    }
    await this.prisma.feasibilityScenario.delete({ where: { id: scenarioId } });
  }
}
