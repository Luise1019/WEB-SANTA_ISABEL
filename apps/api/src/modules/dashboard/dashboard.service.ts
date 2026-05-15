import { Injectable } from '@nestjs/common';
import Decimal from 'decimal.js';

import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class DashboardService {
  constructor(private readonly prisma: PrismaService) {}

  async summary(projectId: string) {
    const [project, chapters, tasks, units, sales, cashflowEntries, changeOrders] =
      await Promise.all([
        this.prisma.project.findUnique({ where: { id: projectId } }),
        this.prisma.chapter.findMany({
          where: { projectId },
          include: { subchapters: { include: { items: true } } },
        }),
        this.prisma.task.findMany({
          where: { projectId },
          select: { id: true, durationDays: true, progress: true, isCritical: true },
        }),
        this.prisma.unit.findMany({
          where: { projectId },
          select: { status: true, listPrice: true, saleableAreaM2: true },
        }),
        this.prisma.sale.findMany({
          where: { unit: { projectId }, isActive: true },
          select: { salePrice: true },
        }),
        this.prisma.cashFlowEntry.findMany({
          where: { projectId },
          select: { kind: true, amount: true, date: true },
          orderBy: { date: 'asc' },
        }),
        this.prisma.changeOrder.findMany({
          where: { projectId },
          select: { status: true, estimatedCostImpact: true },
        }),
      ]);

    let directCost = new Decimal(0);
    for (const ch of chapters) {
      for (const sub of ch.subchapters) {
        for (const item of sub.items) {
          directCost = directCost.plus(new Decimal(item.totalCost.toString()));
        }
      }
    }

    const aiuConfig = await this.prisma.aIUConfig.findUnique({ where: { projectId } });
    let totalBudget = directCost;
    if (aiuConfig) {
      const aiuPct = new Decimal(aiuConfig.administracionPct.toString())
        .plus(aiuConfig.imprevistosPct.toString())
        .plus(aiuConfig.utilidadPct.toString())
        .div(100);
      totalBudget = directCost.plus(directCost.times(aiuPct));
    }

    const totalSalesValue = sales.reduce(
      (acc, s) => acc.plus(new Decimal(s.salePrice.toString())),
      new Decimal(0),
    );
    const totalListPrice = units.reduce(
      (acc, u) => acc.plus(new Decimal(u.listPrice.toString())),
      new Decimal(0),
    );
    const totalSaleableArea = units.reduce(
      (acc, u) => acc.plus(new Decimal(u.saleableAreaM2.toString())),
      new Decimal(0),
    );
    const unitsSold = units.filter((u) => u.status === 'VENDIDA' || u.status === 'ESCRITURADA').length;
    const unitsAvailable = units.filter((u) => u.status === 'DISPONIBLE').length;
    const margenBruto = totalSalesValue.minus(directCost);
    const margenPct = totalSalesValue.gt(0) ? margenBruto.div(totalSalesValue).times(100) : new Decimal(0);
    const costoPorM2 = totalSaleableArea.gt(0) ? directCost.div(totalSaleableArea) : new Decimal(0);
    const precioPorM2 = totalSaleableArea.gt(0) ? totalListPrice.div(totalSaleableArea) : new Decimal(0);

    const totalTasks = tasks.length;
    const criticalTasks = tasks.filter((t) => t.isCritical).length;
    // progress stored as fraction 0.0–1.0 in DB; convert to percentage
    const avgProgress = totalTasks > 0
      ? Math.round(tasks.reduce((s, t) => s + Number(t.progress) * 100, 0) / totalTasks)
      : 0;

    let totalIngresos = new Decimal(0);
    let totalEgresos = new Decimal(0);
    for (const e of cashflowEntries) {
      const amount = new Decimal(e.amount.toString());
      if (e.kind === 'INGRESO') totalIngresos = totalIngresos.plus(amount);
      else totalEgresos = totalEgresos.plus(amount);
    }
    const saldoNeto = totalIngresos.minus(totalEgresos);

    const byMonth: Record<string, { ingresos: Decimal; egresos: Decimal }> = {};
    for (const e of cashflowEntries) {
      const k = e.date.toISOString().substring(0, 7);
      if (!byMonth[k]) byMonth[k] = { ingresos: new Decimal(0), egresos: new Decimal(0) };
      const bucket = byMonth[k]!;
      const amount = new Decimal(e.amount.toString());
      if (e.kind === 'INGRESO') bucket.ingresos = bucket.ingresos.plus(amount);
      else bucket.egresos = bucket.egresos.plus(amount);
    }
    let acumulado = new Decimal(0);
    const sCurve = Object.entries(byMonth)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([month, vals]) => {
        acumulado = acumulado.plus(vals.ingresos).minus(vals.egresos);
        return { month, ingresos: vals.ingresos.toFixed(2), egresos: vals.egresos.toFixed(2), acumulado: acumulado.toFixed(2) };
      });

    const approvedCOs = changeOrders.filter((c) => c.status === 'APROBADA' || c.status === 'APLICADA');
    const pendingCOs = changeOrders.filter((c) => c.status === 'BORRADOR' || c.status === 'EN_REVISION');
    const totalCOImpact = approvedCOs.reduce(
      (acc, c) => acc.plus(new Decimal(c.estimatedCostImpact.toString())),
      new Decimal(0),
    );

    const alerts: Array<{ type: 'warning' | 'danger' | 'info'; message: string }> = [];
    if (criticalTasks > 0 && avgProgress < 30) {
      alerts.push({ type: 'warning', message: `${criticalTasks} tarea(s) en ruta crítica con avance bajo (${avgProgress}%)` });
    }
    if (saldoNeto.lt(0)) {
      alerts.push({ type: 'danger', message: 'Saldo neto de caja negativo — revisar flujo de ingresos' });
    }
    if (pendingCOs.length > 0) {
      alerts.push({ type: 'info', message: `${pendingCOs.length} orden(es) de cambio pendiente(s)` });
    }

    return {
      project,
      kpis: {
        presupuesto: {
          directCost: directCost.toFixed(2),
          totalBudget: totalBudget.toFixed(2),
          executedCost: totalEgresos.toFixed(2),
          executedPct: totalBudget.gt(0) ? totalEgresos.div(totalBudget).times(100).toFixed(1) : '0',
        },
        ventas: {
          totalListPrice: totalListPrice.toFixed(2),
          totalSalesValue: totalSalesValue.toFixed(2),
          margenBruto: margenBruto.toFixed(2),
          margenPct: margenPct.toFixed(1),
          unitsSold,
          unitsAvailable,
          totalUnits: units.length,
          costoPorM2: costoPorM2.toFixed(2),
          precioPorM2: precioPorM2.toFixed(2),
        },
        cronograma: { totalTasks, criticalTasks, avgProgress },
        caja: {
          totalIngresos: totalIngresos.toFixed(2),
          totalEgresos: totalEgresos.toFixed(2),
          saldoNeto: saldoNeto.toFixed(2),
        },
        cambios: {
          approved: approvedCOs.length,
          pending: pendingCOs.length,
          totalCOImpact: totalCOImpact.toFixed(2),
        },
      },
      sCurve,
      alerts,
    };
  }
}
