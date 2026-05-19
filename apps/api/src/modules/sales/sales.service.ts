import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import Decimal from 'decimal.js';

import { PrismaService } from '../prisma/prisma.service';

type TowerInput = { code: string; name: string; floors?: number };

type UnitKindValue =
  | 'APARTAMENTO'
  | 'CASA'
  | 'OFICINA'
  | 'LOCAL'
  | 'PARQUEADERO'
  | 'DEPOSITO'
  | 'BODEGA';

type UnitInput = {
  towerId?: string | null;
  code: string;
  kind: UnitKindValue;
  floor?: number | null;
  privateAreaM2: string;
  commonAreaM2?: string;
  saleableAreaM2: string;
  listPrice: string;
};

type SaleInput = {
  unitId: string;
  buyerName: string;
  buyerDocument: string;
  salePrice: string;
  reservationDate: string;
  expectedScriptureDate?: string | null;
};

type UnitStatusValue =
  | 'DISPONIBLE'
  | 'RESERVADA'
  | 'NEGOCIANDO'
  | 'VENDIDA'
  | 'ESCRITURADA'
  | 'BLOQUEADA';

type PriceListInput = {
  name: string;
  effectiveDate: string;
  notes?: string | null;
  isBase?: boolean;
};

type PriceListItemInput = {
  unitId: string;
  price: string;
};

type UnitGroup = 'VIVIENDA' | 'COMERCIAL' | 'COMPLEMENTARIO';

function getUnitGroup(kind: string): UnitGroup {
  if (['APARTAMENTO', 'CASA'].includes(kind)) return 'VIVIENDA';
  if (['LOCAL', 'OFICINA'].includes(kind)) return 'COMERCIAL';
  return 'COMPLEMENTARIO';
}

@Injectable()
export class SalesService {
  constructor(private readonly prisma: PrismaService) {}

  // ─── Towers ───────────────────────────────────────────────────
  listTowers(projectId: string) {
    return this.prisma.tower.findMany({
      where: { projectId },
      include: { units: true },
      orderBy: { code: 'asc' },
    });
  }

  createTower(projectId: string, input: TowerInput) {
    return this.prisma.tower.create({
      data: { projectId, code: input.code, name: input.name, floors: input.floors ?? null },
    });
  }

  // ─── Units ────────────────────────────────────────────────────
  listUnits(projectId: string) {
    return this.prisma.unit.findMany({
      where: { projectId },
      include: { tower: true, sales: { where: { isActive: true }, take: 1 } },
      orderBy: [{ towerId: 'asc' }, { floor: 'asc' }, { code: 'asc' }],
    });
  }

  createUnit(projectId: string, input: UnitInput) {
    return this.prisma.unit.create({
      data: {
        projectId,
        towerId: input.towerId ?? null,
        code: input.code,
        kind: input.kind,
        floor: input.floor ?? null,
        privateAreaM2: new Decimal(input.privateAreaM2),
        commonAreaM2: new Decimal(input.commonAreaM2 ?? '0'),
        saleableAreaM2: new Decimal(input.saleableAreaM2),
        listPrice: new Decimal(input.listPrice),
      },
    });
  }

  async updateUnitStatus(unitId: string, status: UnitStatusValue) {
    const unit = await this.prisma.unit.findUnique({ where: { id: unitId } });
    if (!unit) throw new NotFoundException(`Unidad ${unitId} no existe`);
    return this.prisma.unit.update({ where: { id: unitId }, data: { status } });
  }

  async updateUnitPrice(unitId: string, listPrice: string) {
    const unit = await this.prisma.unit.findUnique({ where: { id: unitId } });
    if (!unit) throw new NotFoundException(`Unidad ${unitId} no existe`);
    return this.prisma.unit.update({
      where: { id: unitId },
      data: { listPrice: new Decimal(listPrice) },
    });
  }

  // ─── Sales ────────────────────────────────────────────────────
  listSales(projectId: string) {
    return this.prisma.sale.findMany({
      where: { unit: { projectId } },
      include: { unit: { include: { tower: true } } },
      orderBy: { reservationDate: 'desc' },
    });
  }

  async createSale(input: SaleInput) {
    const unit = await this.prisma.unit.findUnique({ where: { id: input.unitId } });
    if (!unit) throw new NotFoundException(`Unidad ${input.unitId} no existe`);
    if (unit.status === 'VENDIDA' || unit.status === 'ESCRITURADA') {
      throw new BadRequestException(`La unidad ${unit.code} ya está vendida`);
    }

    return this.prisma.$transaction(async (tx) => {
      const sale = await tx.sale.create({
        data: {
          unitId: input.unitId,
          buyerName: input.buyerName,
          buyerDocument: input.buyerDocument,
          salePrice: new Decimal(input.salePrice),
          reservationDate: new Date(input.reservationDate),
          expectedScriptureDate: input.expectedScriptureDate
            ? new Date(input.expectedScriptureDate)
            : null,
        },
      });
      await tx.unit.update({
        where: { id: input.unitId },
        data: { status: 'RESERVADA' },
      });
      return sale;
    });
  }

  async cancelSale(saleId: string) {
    const sale = await this.prisma.sale.findUnique({ where: { id: saleId } });
    if (!sale) throw new NotFoundException(`Venta ${saleId} no existe`);
    await this.prisma.$transaction(async (tx) => {
      await tx.sale.update({ where: { id: saleId }, data: { isActive: false } });
      await tx.unit.update({ where: { id: sale.unitId }, data: { status: 'DISPONIBLE' } });
    });
  }

  // ─── Sales Summary ────────────────────────────────────────────
  async getSummary(projectId: string) {
    const units = await this.listUnits(projectId);
    const sales = await this.listSales(projectId);

    const total = units.length;
    const available = units.filter((u) => u.status === 'DISPONIBLE').length;
    const reserved = units.filter(
      (u) => u.status === 'RESERVADA' || u.status === 'NEGOCIANDO',
    ).length;
    const sold = units.filter(
      (u) => u.status === 'VENDIDA' || u.status === 'ESCRITURADA',
    ).length;

    const totalListPrice = units.reduce(
      (acc, u) => acc.plus(new Decimal(u.listPrice.toString())),
      new Decimal(0),
    );

    const activeSales = sales.filter((s) => s.isActive);
    const totalSalesValue = activeSales.reduce(
      (acc, s) => acc.plus(new Decimal(s.salePrice.toString())),
      new Decimal(0),
    );

    return {
      units: { total, available, reserved, sold },
      totalListPrice: totalListPrice.toFixed(2),
      totalSalesValue: totalSalesValue.toFixed(2),
      salesCount: activeSales.length,
    };
  }

  // ─── Price Lists ──────────────────────────────────────────────
  listPriceLists(projectId: string) {
    return this.prisma.priceList.findMany({
      where: { projectId },
      include: {
        items: {
          include: { unit: true },
        },
      },
      orderBy: { effectiveDate: 'asc' },
    });
  }

  async createPriceList(projectId: string, input: PriceListInput) {
    return this.prisma.$transaction(async (tx) => {
      if (input.isBase) {
        await tx.priceList.updateMany({
          where: { projectId, isBase: true },
          data: { isBase: false },
        });
      }
      return tx.priceList.create({
        data: {
          projectId,
          name: input.name,
          effectiveDate: new Date(input.effectiveDate),
          notes: input.notes ?? null,
          isBase: input.isBase ?? false,
        },
      });
    });
  }

  async setPriceListItems(priceListId: string, items: PriceListItemInput[]) {
    const priceList = await this.prisma.priceList.findUnique({ where: { id: priceListId } });
    if (!priceList) throw new NotFoundException(`Lista de precios ${priceListId} no existe`);

    return this.prisma.$transaction(async (tx) => {
      await tx.priceListItem.deleteMany({ where: { priceListId } });
      await tx.priceListItem.createMany({
        data: items.map((item) => ({
          priceListId,
          unitId: item.unitId,
          price: new Decimal(item.price),
        })),
      });
      return tx.priceList.findUnique({
        where: { id: priceListId },
        include: { items: { include: { unit: true } } },
      });
    });
  }

  async getPriceEvolution(projectId: string) {
    const priceLists = await this.prisma.priceList.findMany({
      where: { projectId },
      include: { items: { include: { unit: true } } },
      orderBy: { effectiveDate: 'asc' },
    });

    const baseList = priceLists.find((pl) => pl.isBase);

    const units = await this.prisma.unit.findMany({ where: { projectId } });

    return units.map((unit) => {
      const baseItem = baseList?.items.find((i) => i.unitId === unit.id);
      const basePrice = baseItem ? new Decimal(baseItem.price.toString()) : null;

      const evolution = priceLists.map((pl) => {
        const item = pl.items.find((i) => i.unitId === unit.id);
        if (!item) return null;
        const price = new Decimal(item.price.toString());
        const pctVsBase =
          basePrice && !basePrice.isZero()
            ? price.minus(basePrice).div(basePrice).times(100).toDecimalPlaces(2).toNumber()
            : null;
        return {
          priceListId: pl.id,
          listName: pl.name,
          effectiveDate: pl.effectiveDate.toISOString().split('T')[0],
          price: price.toFixed(2),
          pctVsBase,
        };
      }).filter((e): e is NonNullable<typeof e> => e !== null);

      return {
        unitId: unit.id,
        unitCode: unit.code,
        kind: unit.kind,
        group: getUnitGroup(unit.kind),
        evolution,
      };
    });
  }

  async getSalesDashboard(projectId: string) {
    const units = await this.prisma.unit.findMany({
      where: { projectId },
      include: {
        sales: { where: { isActive: true }, take: 1 },
        priceListItems: {
          include: { priceList: true },
          orderBy: { priceList: { effectiveDate: 'desc' } },
          take: 1,
        },
      },
    });

    const priceLists = await this.prisma.priceList.findMany({
      where: { projectId },
      include: { items: { include: { unit: true } } },
      orderBy: { effectiveDate: 'asc' },
    });

    const baseList = priceLists.find((pl) => pl.isBase);

    const groups: UnitGroup[] = ['VIVIENDA', 'COMERCIAL', 'COMPLEMENTARIO'];
    type GroupStats = {
      total: number;
      available: number;
      reserved: number;
      sold: number;
      totalListPrice: number;
      avgPriceM2: number;
    };
    const byGroup: Record<UnitGroup, GroupStats> = {
      VIVIENDA: { total: 0, available: 0, reserved: 0, sold: 0, totalListPrice: 0, avgPriceM2: 0 },
      COMERCIAL: { total: 0, available: 0, reserved: 0, sold: 0, totalListPrice: 0, avgPriceM2: 0 },
      COMPLEMENTARIO: { total: 0, available: 0, reserved: 0, sold: 0, totalListPrice: 0, avgPriceM2: 0 },
    };
    const groupPriceM2Sum: Record<UnitGroup, number> = { VIVIENDA: 0, COMERCIAL: 0, COMPLEMENTARIO: 0 };
    const groupCount: Record<UnitGroup, number> = { VIVIENDA: 0, COMERCIAL: 0, COMPLEMENTARIO: 0 };

    for (const unit of units) {
      const group = getUnitGroup(unit.kind);
      byGroup[group].total++;
      if (unit.status === 'DISPONIBLE') byGroup[group].available++;
      else if (unit.status === 'RESERVADA' || unit.status === 'NEGOCIANDO') byGroup[group].reserved++;
      else if (unit.status === 'VENDIDA' || unit.status === 'ESCRITURADA') byGroup[group].sold++;

      const currentPrice = unit.priceListItems[0]
        ? Number(unit.priceListItems[0].price.toString())
        : Number(unit.listPrice.toString());
      byGroup[group].totalListPrice += currentPrice;

      const area = Number(unit.saleableAreaM2.toString());
      if (area > 0) {
        groupPriceM2Sum[group] += currentPrice / area;
        groupCount[group]++;
      }
    }

    for (const group of groups) {
      byGroup[group].avgPriceM2 =
        groupCount[group] > 0 ? groupPriceM2Sum[group] / groupCount[group] : 0;
    }

    // Velocity — últimos 12 meses
    const now = new Date();
    const velocity: Array<{ month: string; unitsSold: number; valueCaptured: number }> = [];
    const sCurveRaw: Array<{ month: string; unitsSold: number; valueCaptured: number }> = [];

    for (let i = 11; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const label = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      velocity.push({ month: label, unitsSold: 0, valueCaptured: 0 });
    }

    const allSales = await this.prisma.sale.findMany({
      where: { unit: { projectId }, isActive: true },
      include: { unit: true },
    });

    for (const sale of allSales) {
      const rd = new Date(sale.reservationDate);
      const label = `${rd.getFullYear()}-${String(rd.getMonth() + 1).padStart(2, '0')}`;
      const bucket = velocity.find((v) => v.month === label);
      if (bucket) {
        bucket.unitsSold++;
        bucket.valueCaptured += Number(sale.salePrice.toString());
      }
      sCurveRaw.push({ month: label, unitsSold: 1, valueCaptured: Number(sale.salePrice.toString()) });
    }

    // Build cumulative S-Curve from all historical sales sorted by month
    const allMonths = Array.from(new Set(sCurveRaw.map((s) => s.month))).sort();
    let cumUnits = 0;
    let cumValue = 0;
    const sCurve = allMonths.map((month) => {
      const monthItems = sCurveRaw.filter((s) => s.month === month);
      cumUnits += monthItems.reduce((a, b) => a + b.unitsSold, 0);
      cumValue += monthItems.reduce((a, b) => a + b.valueCaptured, 0);
      return { month, cumUnits, cumValue };
    });

    // Avg ticket per group
    const avgTicketSum: Record<UnitGroup, number> = { VIVIENDA: 0, COMERCIAL: 0, COMPLEMENTARIO: 0 };
    const avgTicketCount: Record<UnitGroup, number> = { VIVIENDA: 0, COMERCIAL: 0, COMPLEMENTARIO: 0 };
    for (const sale of allSales) {
      const group = getUnitGroup(sale.unit.kind);
      avgTicketSum[group] += Number(sale.salePrice.toString());
      avgTicketCount[group]++;
    }
    const avgTicket: Record<UnitGroup, number> = {
      VIVIENDA: avgTicketCount.VIVIENDA > 0 ? avgTicketSum.VIVIENDA / avgTicketCount.VIVIENDA : 0,
      COMERCIAL: avgTicketCount.COMERCIAL > 0 ? avgTicketSum.COMERCIAL / avgTicketCount.COMERCIAL : 0,
      COMPLEMENTARIO:
        avgTicketCount.COMPLEMENTARIO > 0
          ? avgTicketSum.COMPLEMENTARIO / avgTicketCount.COMPLEMENTARIO
          : 0,
    };

    // Discount analysis
    let listSum = 0;
    let saleSum = 0;
    let discountCount = 0;
    for (const sale of allSales) {
      const unitData = units.find((u) => u.id === sale.unitId);
      if (!unitData) continue;
      const lp = unitData.priceListItems[0]
        ? Number(unitData.priceListItems[0].price.toString())
        : Number(unitData.listPrice.toString());
      listSum += lp;
      saleSum += Number(sale.salePrice.toString());
      discountCount++;
    }
    const avgListPrice = discountCount > 0 ? listSum / discountCount : 0;
    const avgSalePrice = discountCount > 0 ? saleSum / discountCount : 0;
    const avgDiscountPct =
      avgListPrice > 0 ? ((avgListPrice - avgSalePrice) / avgListPrice) * 100 : 0;

    // Price evolution summary per list
    const priceEvolutionSummary = priceLists.map((pl) => {
      const avgByGroup: Record<string, number> = {};
      for (const group of groups) {
        const groupItems = pl.items.filter(
          (i) => getUnitGroup(i.unit.kind) === group,
        );
        avgByGroup[group] =
          groupItems.length > 0
            ? groupItems.reduce((acc, i) => acc + Number(i.price.toString()), 0) / groupItems.length
            : 0;
      }
      return {
        listName: pl.name,
        effectiveDate: pl.effectiveDate.toISOString().split('T')[0],
        avgPriceByGroup: avgByGroup,
      };
    });

    return {
      byGroup,
      velocity,
      sCurve,
      avgTicket,
      discountAnalysis: { avgListPrice, avgSalePrice, avgDiscountPct },
      priceEvolutionSummary,
    };
  }
}
