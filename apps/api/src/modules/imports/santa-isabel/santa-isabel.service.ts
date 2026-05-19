import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { SantaIsabelImportPreview } from '@santaisabel/shared';

import { FeasibilityService } from '../../feasibility/feasibility.service';
import { PrismaService } from '../../prisma/prisma.service';
import { parseSantaIsabelXls } from './parser';

const toDec = (v: string | null | undefined): Prisma.Decimal | null =>
  v === null || v === undefined || v === '' ? null : new Prisma.Decimal(v);

const toDecDef = (v: string | null | undefined, fb = '0'): Prisma.Decimal =>
  new Prisma.Decimal(v ?? fb);

@Injectable()
export class SantaIsabelService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly feasibility: FeasibilityService,
  ) {}

  preview(buffer: Buffer): SantaIsabelImportPreview {
    return parseSantaIsabelXls(buffer);
  }

  async commit(projectId: string, preview: SantaIsabelImportPreview) {
    const project = await this.prisma.project.findUnique({ where: { id: projectId } });
    if (!project) throw new NotFoundException(`Proyecto ${projectId} no existe`);

    await this.prisma.$transaction(async (tx) => {
      // Upsert FeasibilityAnalysis
      const a = preview.analysis;
      const analysis = await tx.feasibilityAnalysis.upsert({
        where: { projectId },
        update: {
          promoter: a.promoter ?? null,
          totalUnits: a.totalUnits ?? null,
          builtAreaM2: toDec(a.builtAreaM2 ?? null),
          saleableAreaM2: toDec(a.saleableAreaM2 ?? null),
          pricePerM2: toDec(a.pricePerM2 ?? null),
          totalSales: toDec(a.totalSales ?? null),
          initialPaymentPct: toDec(a.initialPaymentPct ?? null),
          breakEvenUnits: a.breakEvenUnits ?? null,
          stratum: a.stratum ?? null,
          constructionSystem: a.constructionSystem ?? null,
          discountRate: toDecDef(a.discountRate, '12'),
          notes: a.notes ?? null,
        },
        create: {
          projectId,
          promoter: a.promoter ?? null,
          totalUnits: a.totalUnits ?? null,
          builtAreaM2: toDec(a.builtAreaM2 ?? null),
          saleableAreaM2: toDec(a.saleableAreaM2 ?? null),
          pricePerM2: toDec(a.pricePerM2 ?? null),
          totalSales: toDec(a.totalSales ?? null),
          initialPaymentPct: toDec(a.initialPaymentPct ?? null),
          breakEvenUnits: a.breakEvenUnits ?? null,
          stratum: a.stratum ?? null,
          constructionSystem: a.constructionSystem ?? null,
          discountRate: toDecDef(a.discountRate, '12'),
          notes: a.notes ?? null,
        },
      });

      // Replace FeasibilityCostItems
      await tx.feasibilityCostItem.deleteMany({ where: { analysisId: analysis.id } });
      if (preview.costItems.length > 0) {
        await tx.feasibilityCostItem.createMany({
          data: preview.costItems.map((it, idx) => ({
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
      }

      // Replace FeasibilityCashFlow
      await tx.feasibilityCashFlow.deleteMany({ where: { analysisId: analysis.id } });
      if (preview.cashFlow.length > 0) {
        await tx.feasibilityCashFlow.createMany({
          data: preview.cashFlow.map((r) => ({
            analysisId: analysis.id,
            year: r.year,
            month: r.month,
            initialBalance: toDecDef(r.initialBalance),
            salesInitialPayment: toDecDef(r.salesInitialPayment),
            salesFinalPayment: toDecDef(r.salesFinalPayment),
            ownResources: toDecDef(r.ownResources),
            constructionCredit: toDecDef(r.constructionCredit),
            directCosts: toDecDef(r.directCosts),
            indirectCosts: toDecDef(r.indirectCosts),
            financialCosts: toDecDef(r.financialCosts),
            finalBalance: toDecDef(r.finalBalance),
          })),
        });
      }

      // Replace budget: delete chapters → cascade subchapters → items
      await tx.chapter.deleteMany({ where: { projectId } });
      for (let ci = 0; ci < preview.budget.chapters.length; ci++) {
        const ch = preview.budget.chapters[ci];
        if (!ch) continue;
        const createdChapter = await tx.chapter.create({
          data: { projectId, code: ch.code, name: ch.name, order: ci },
        });
        for (let si = 0; si < ch.subchapters.length; si++) {
          const sub = ch.subchapters[si];
          if (!sub) continue;
          const createdSub = await tx.subchapter.create({
            data: { chapterId: createdChapter.id, code: sub.code, name: sub.name, order: si },
          });
          if (sub.items.length === 0) continue;
          await tx.budgetItem.createMany({
            data: sub.items.map((it, ii) => {
              const q = new Prisma.Decimal(it.quantity);
              const u = new Prisma.Decimal(it.unitCost);
              return {
                subchapterId: createdSub.id,
                code: it.code,
                description: it.description,
                unit: it.unit,
                quantity: q,
                unitCost: u,
                totalCost: q.mul(u),
                costType: it.costType ?? 'MATERIAL',
                order: ii,
              };
            }),
          });
        }
      }
    });

    await this.feasibility.recalculateIndicators(projectId);
    return this.feasibility.getByProject(projectId);
  }
}
