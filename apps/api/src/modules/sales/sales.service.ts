import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import Decimal from 'decimal.js';

import { PrismaService } from '../prisma/prisma.service';

type TowerInput = { code: string; name: string; floors?: number };

type UnitInput = {
  towerId?: string | null;
  code: string;
  kind: 'APARTAMENTO' | 'CASA' | 'LOCAL' | 'PARQUEADERO' | 'DEPOSITO';
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

  async updateUnitStatus(
    unitId: string,
    status: 'DISPONIBLE' | 'RESERVADA' | 'NEGOCIANDO' | 'VENDIDA' | 'ESCRITURADA' | 'BLOQUEADA',
  ) {
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
}
