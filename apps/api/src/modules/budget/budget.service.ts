import { Injectable, NotFoundException } from '@nestjs/common';
import Decimal from 'decimal.js';
import type {
  ChapterInput,
  APUInput,
  BudgetItemInput,
  AIUConfigInput,
  ResourceInput,
} from '@santaisabel/shared';

import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class BudgetService {
  constructor(private readonly prisma: PrismaService) {}

  // ─── Chapters ────────────────────────────────────────────────
  listChapters(projectId: string) {
    return this.prisma.chapter.findMany({
      where: { projectId },
      include: {
        subchapters: {
          include: {
            items: {
              include: {
                apu: {
                  include: {
                    components: {
                      include: {
                        resource: { include: { rates: { orderBy: { effectiveDate: 'desc' }, take: 1 } } },
                      },
                    },
                  },
                },
              },
              orderBy: { order: 'asc' },
            },
          },
          orderBy: { order: 'asc' },
        },
      },
      orderBy: { order: 'asc' },
    });
  }

  async createSubchapter(projectId: string, chapterId: string, input: ChapterInput) {
    const chapter = await this.prisma.chapter.findFirst({ where: { id: chapterId, projectId } });
    if (!chapter) throw new NotFoundException(`Capítulo ${chapterId} no existe en este proyecto`);
    const count = await this.prisma.subchapter.count({ where: { chapterId } });
    return this.prisma.subchapter.create({
      data: { chapterId, code: input.code, name: input.name, order: count },
    });
  }

  // ─── Resources (global library) ───────────────────────────────
  listResources() {
    return this.prisma.resource.findMany({
      include: { rates: { orderBy: { effectiveDate: 'desc' }, take: 1 } },
      orderBy: [{ type: 'asc' }, { code: 'asc' }],
    });
  }

  createResource(input: ResourceInput) {
    return this.prisma.resource.create({
      data: {
        type: input.type,
        code: input.code,
        name: input.name,
        unit: input.unit,
        rates: {
          create: { effectiveDate: new Date(), unitCost: new Decimal(input.unitCost) },
        },
      },
      include: { rates: true },
    });
  }

  async addResourceRate(resourceId: string, unitCost: string) {
    const resource = await this.prisma.resource.findUnique({ where: { id: resourceId } });
    if (!resource) throw new NotFoundException(`Recurso ${resourceId} no existe`);
    return this.prisma.resourceRate.create({
      data: { resourceId, effectiveDate: new Date(), unitCost: new Decimal(unitCost) },
    });
  }

  // ─── APU (global library) ─────────────────────────────────────
  listAPUs() {
    return this.prisma.aPU.findMany({
      include: {
        components: {
          include: { resource: { include: { rates: { orderBy: { effectiveDate: 'desc' }, take: 1 } } } },
        },
      },
      orderBy: { code: 'asc' },
    });
  }

  async createAPU(input: APUInput) {
    return this.prisma.aPU.create({
      data: {
        code: input.code,
        name: input.name,
        unit: input.unit,
        version: 1,
        isLibrary: input.isLibrary ?? false,
        components: {
          create: input.components.map((c) => ({
            resourceId: c.resourceId,
            quantity: new Decimal(c.quantity),
            wasteFactor: new Decimal(c.wasteFactor ?? '0'),
            performance: c.performance ? new Decimal(c.performance) : null,
          })),
        },
      },
      include: {
        components: {
          include: { resource: { include: { rates: { orderBy: { effectiveDate: 'desc' }, take: 1 } } } },
        },
      },
    });
  }

  // ─── Budget Items ─────────────────────────────────────────────
  async listItems(projectId: string, chapterId?: string) {
    let subchapterIds: string[];

    if (chapterId) {
      const subs = await this.prisma.subchapter.findMany({
        where: { chapterId, chapter: { projectId } },
        select: { id: true },
      });
      subchapterIds = subs.map((s) => s.id);
    } else {
      const chapters = await this.prisma.chapter.findMany({
        where: { projectId },
        select: { subchapters: { select: { id: true } } },
      });
      subchapterIds = chapters.flatMap((c) => c.subchapters.map((s) => s.id));
    }

    return this.prisma.budgetItem.findMany({
      where: { subchapterId: { in: subchapterIds } },
      include: { apu: { include: { components: { include: { resource: true } } } } },
      orderBy: { order: 'asc' },
    });
  }

  async createItem(projectId: string, subchapterId: string, input: BudgetItemInput) {
    const sub = await this.prisma.subchapter.findFirst({
      where: { id: subchapterId, chapter: { projectId } },
    });
    if (!sub) throw new NotFoundException(`Subcapítulo ${subchapterId} no existe`);
    const count = await this.prisma.budgetItem.count({ where: { subchapterId } });
    const qty = new Decimal(input.quantity);
    const uc = new Decimal(input.unitCost);
    return this.prisma.budgetItem.create({
      data: {
        subchapterId,
        apuId: input.apuId ?? null,
        code: input.code,
        description: input.description,
        unit: input.unit,
        quantity: qty,
        unitCost: uc,
        totalCost: qty.times(uc),
        order: count,
      },
      include: { apu: { include: { components: { include: { resource: true } } } } },
    });
  }

  async updateItem(itemId: string, input: Partial<BudgetItemInput>) {
    const item = await this.prisma.budgetItem.findUnique({ where: { id: itemId } });
    if (!item) throw new NotFoundException(`Ítem ${itemId} no existe`);

    const qty = input.quantity ? new Decimal(input.quantity) : new Decimal(item.quantity.toString());
    const uc = input.unitCost ? new Decimal(input.unitCost) : new Decimal(item.unitCost.toString());

    return this.prisma.budgetItem.update({
      where: { id: itemId },
      data: {
        ...(input.code !== undefined ? { code: input.code } : {}),
        ...(input.description !== undefined ? { description: input.description } : {}),
        ...(input.unit !== undefined ? { unit: input.unit } : {}),
        ...(input.quantity !== undefined ? { quantity: qty } : {}),
        ...(input.unitCost !== undefined ? { unitCost: uc } : {}),
        ...(input.apuId !== undefined ? { apuId: input.apuId } : {}),
        totalCost: qty.times(uc),
      },
    });
  }

  async deleteItem(itemId: string) {
    const item = await this.prisma.budgetItem.findUnique({ where: { id: itemId } });
    if (!item) throw new NotFoundException(`Ítem ${itemId} no existe`);
    await this.prisma.budgetItem.delete({ where: { id: itemId } });
  }

  // ─── AIU Config ───────────────────────────────────────────────
  async getAIU(projectId: string) {
    const aiu = await this.prisma.aIUConfig.findUnique({ where: { projectId } });
    return (
      aiu ?? {
        projectId,
        administracionPct: '0',
        imprevistosPct: '0',
        utilidadPct: '0',
        ivaUtilidadPct: '19',
        appliesToIndirect: false,
      }
    );
  }

  async upsertAIU(projectId: string, input: AIUConfigInput) {
    return this.prisma.aIUConfig.upsert({
      where: { projectId },
      update: {
        administracionPct: new Decimal(input.administracionPct),
        imprevistosPct: new Decimal(input.imprevistosPct),
        utilidadPct: new Decimal(input.utilidadPct),
        ivaUtilidadPct: new Decimal(input.ivaUtilidadPct ?? '19'),
        appliesToIndirect: input.appliesToIndirect ?? false,
      },
      create: {
        projectId,
        administracionPct: new Decimal(input.administracionPct),
        imprevistosPct: new Decimal(input.imprevistosPct),
        utilidadPct: new Decimal(input.utilidadPct),
        ivaUtilidadPct: new Decimal(input.ivaUtilidadPct ?? '19'),
        appliesToIndirect: input.appliesToIndirect ?? false,
      },
    });
  }

  // ─── Budget Summary ───────────────────────────────────────────
  async getSummary(projectId: string) {
    const chapters = await this.listChapters(projectId);
    const aiu = await this.getAIU(projectId);

    let directCost = new Decimal(0);

    const chaptersWithTotals = chapters.map((ch) => {
      let chapterTotal = new Decimal(0);

      const subchapters = ch.subchapters.map((sub) => {
        let subTotal = new Decimal(0);

        const items = sub.items.map((item) => {
          let unitCostCalc = new Decimal(0);

          if (item.apu && item.apu.components.length > 0) {
            for (const comp of item.apu.components) {
              const rate = comp.resource.rates?.[0]?.unitCost ?? new Decimal(0);
              const cost = new Decimal(rate.toString())
                .times(new Decimal(comp.quantity.toString()))
                .times(new Decimal(1).plus(new Decimal(comp.wasteFactor.toString())));
              unitCostCalc = unitCostCalc.plus(cost);
            }
          } else {
            unitCostCalc = new Decimal(item.unitCost.toString());
          }

          const qty = new Decimal(item.quantity.toString());
          const total = unitCostCalc.times(qty);
          subTotal = subTotal.plus(total);

          return {
            id: item.id,
            code: item.code,
            description: item.description,
            unit: item.unit,
            quantity: item.quantity,
            unitCostCalc: unitCostCalc.toFixed(2),
            totalCalc: total.toFixed(2),
            apuId: item.apuId,
          };
        });

        chapterTotal = chapterTotal.plus(subTotal);
        return { id: sub.id, code: sub.code, name: sub.name, items, subtotal: subTotal.toFixed(2) };
      });

      directCost = directCost.plus(chapterTotal);
      return { id: ch.id, code: ch.code, name: ch.name, subchapters, total: chapterTotal.toFixed(2) };
    });

    const aiuObj =
      typeof aiu.administracionPct === 'object'
        ? {
            adm: new Decimal((aiu.administracionPct as unknown as { toString(): string }).toString()),
            imp: new Decimal((aiu.imprevistosPct as unknown as { toString(): string }).toString()),
            uti: new Decimal((aiu.utilidadPct as unknown as { toString(): string }).toString()),
            iva: new Decimal((aiu.ivaUtilidadPct as unknown as { toString(): string }).toString()),
          }
        : {
            adm: new Decimal(String(aiu.administracionPct)),
            imp: new Decimal(String(aiu.imprevistosPct)),
            uti: new Decimal(String(aiu.utilidadPct)),
            iva: new Decimal(String(aiu.ivaUtilidadPct)),
          };

    const aiuPct = aiuObj.adm.plus(aiuObj.imp).plus(aiuObj.uti).div(100);
    const aiuAmount = directCost.times(aiuPct);
    const ivaAmount = aiuObj.uti.div(100).times(directCost).times(aiuObj.iva.div(100));
    const totalCost = directCost.plus(aiuAmount).plus(ivaAmount);

    return {
      chapters: chaptersWithTotals,
      directCost: directCost.toFixed(2),
      aiuAmount: aiuAmount.toFixed(2),
      ivaAmount: ivaAmount.toFixed(2),
      totalCost: totalCost.toFixed(2),
      aiuConfig: aiu,
    };
  }
}
