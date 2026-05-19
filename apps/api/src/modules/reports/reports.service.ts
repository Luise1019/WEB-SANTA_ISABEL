import { Injectable, Logger } from '@nestjs/common';
import Decimal from 'decimal.js';

import { PrismaService } from '../prisma/prisma.service';

/**
 * Generación de reportes: CSV + HTML de presentación.
 */
@Injectable()
export class ReportsService {
  private readonly logger = new Logger(ReportsService.name);

  constructor(private readonly prisma: PrismaService) {}

  listTemplates() {
    return this.prisma.reportTemplate.findMany({ orderBy: { kind: 'asc' } });
  }

  /** CSV presupuesto (capítulos → subcapítulos → ítems) */
  async generateBudgetCsv(projectId: string): Promise<string> {
    const chapters = await this.prisma.chapter.findMany({
      where: { projectId },
      include: { subchapters: { include: { items: true }, orderBy: { order: 'asc' } } },
      orderBy: { order: 'asc' },
    });

    const rows: string[] = [
      ['Capítulo','Subcapítulo','Código','Descripción','Unidad','Cantidad','Costo Unitario','Costo Total','Tipo Costo','Categoría'].join(','),
    ];
    for (const ch of chapters) {
      for (const sub of ch.subchapters) {
        for (const item of sub.items) {
          rows.push([
            escapeCsv(`${ch.code} - ${ch.name}`),
            escapeCsv(`${sub.code} - ${sub.name}`),
            escapeCsv(item.code),
            escapeCsv(item.description),
            escapeCsv(item.unit),
            item.quantity.toString(),
            item.unitCost.toFixed(2),
            item.totalCost.toFixed(2),
            escapeCsv(item.costType ?? 'MATERIAL'),
            escapeCsv(item.customCategory ?? ''),
          ].join(','));
        }
      }
    }
    return '﻿' + rows.join('\r\n');
  }

  /** CSV flujo de caja */
  async generateCashflowCsv(projectId: string): Promise<string> {
    const entries = await this.prisma.cashFlowEntry.findMany({
      where: { projectId },
      include: { chapter: { select: { code: true, name: true } } },
      orderBy: { date: 'asc' },
    });

    const rows: string[] = [
      ['Fecha','Tipo','Categoría','Descripción','Monto','Capítulo'].join(','),
    ];
    for (const e of entries) {
      rows.push([
        e.date.toISOString().substring(0, 10),
        escapeCsv(e.kind),
        escapeCsv(e.category),
        escapeCsv(e.description),
        e.amount.toFixed(2),
        e.chapter ? escapeCsv(`${e.chapter.code} - ${e.chapter.name}`) : '',
      ].join(','));
    }
    return '﻿' + rows.join('\r\n');
  }

  /** Reporte HTML ejecutivo de presentación */
  async generateHtmlReport(projectId: string): Promise<string> {
    this.logger.log(`Generando reporte HTML para proyecto ${projectId}`);

    // ── 1. Datos ─────────────────────────────────────────────────────────────
    const [project, chapters, tasks, milestones, units, sales, cashflowEntries] =
      await Promise.all([
        this.prisma.project.findUnique({ where: { id: projectId } }),
        this.prisma.chapter.findMany({
          where: { projectId },
          include: { subchapters: { include: { items: true } } },
          orderBy: { order: 'asc' },
        }),
        this.prisma.task.findMany({
          where: { projectId },
          orderBy: [{ parentId: 'asc' }, { plannedStart: 'asc' }],
          select: {
            id: true, code: true, name: true, kind: true,
            plannedStart: true, plannedEnd: true, durationDays: true,
            progress: true, isCritical: true, parentId: true,
          },
        }),
        this.prisma.milestone.findMany({ where: { projectId }, orderBy: { plannedDate: 'asc' } }),
        this.prisma.unit.findMany({ where: { projectId }, select: { status: true, listPrice: true, saleableAreaM2: true } }),
        this.prisma.sale.findMany({ where: { unit: { projectId }, isActive: true }, select: { salePrice: true } }),
        this.prisma.cashFlowEntry.findMany({ where: { projectId }, select: { kind: true, amount: true, date: true }, orderBy: { date: 'asc' } }),
      ]);

    // ── 2. Cálculos ──────────────────────────────────────────────────────────
    const fmt = (v: number) =>
      new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', notation: 'compact', maximumFractionDigits: 1 }).format(v);
    const fmtFull = (v: number) =>
      new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(v);

    // Budget
    const chapterData = chapters.map((ch) => {
      let total = new Decimal(0);
      for (const sub of ch.subchapters) for (const it of sub.items) total = total.plus(it.totalCost.toString());
      return { name: `${ch.code} ${ch.name}`, value: total.toNumber() };
    }).filter((c) => c.value > 0);
    const directCost = chapterData.reduce((s, c) => s + c.value, 0);

    // Sales
    const totalSalesValue = sales.reduce((s, sl) => s + Number(sl.salePrice), 0);
    const unitsSold = units.filter((u) => u.status === 'VENDIDA' || u.status === 'ESCRITURADA').length;
    const unitsAvailable = units.filter((u) => u.status === 'DISPONIBLE').length;
    const totalUnits = units.length;
    const margenBruto = totalSalesValue - directCost;
    const margenPct = totalSalesValue > 0 ? (margenBruto / totalSalesValue) * 100 : 0;

    // Schedule
    const totalTasks = tasks.filter((t) => t.kind === 'TASK').length;
    const criticalTasks = tasks.filter((t) => t.isCritical).length;
    const avgProgress = totalTasks > 0
      ? Math.round(tasks.filter((t) => t.kind === 'TASK').reduce((s, t) => s + Number(t.progress) * 100, 0) / totalTasks)
      : 0;

    // Cash flow monthly
    const byMonth: Record<string, { ing: number; eg: number }> = {};
    for (const e of cashflowEntries) {
      const k = e.date.toISOString().substring(0, 7);
      if (!byMonth[k]) byMonth[k] = { ing: 0, eg: 0 };
      const amount = Number(e.amount);
      if (e.kind === 'INGRESO') byMonth[k]!.ing += amount;
      else byMonth[k]!.eg += amount;
    }
    let acum = 0;
    const sCurve = Object.entries(byMonth).sort(([a], [b]) => a.localeCompare(b)).map(([m, v]) => {
      acum += v.ing - v.eg;
      return { label: m.substring(5) + '/' + m.substring(2, 4), ing: v.ing, eg: v.eg, acum };
    });
    const totalIngresos = cashflowEntries.filter((e) => e.kind === 'INGRESO').reduce((s, e) => s + Number(e.amount), 0);
    const totalEgresos = cashflowEntries.filter((e) => e.kind === 'EGRESO').reduce((s, e) => s + Number(e.amount), 0);
    const saldoNeto = totalIngresos - totalEgresos;

    // Unit status donut
    const statusCounts: Record<string, number> = {};
    for (const u of units) statusCounts[u.status] = (statusCounts[u.status] ?? 0) + 1;

    // Top tasks for Gantt table
    const summaryTasks = tasks.filter((t) => t.kind === 'SUMMARY').slice(0, 12);

    const generatedAt = new Date().toLocaleString('es-CO', { dateStyle: 'full', timeStyle: 'short' });
    const projectName = project?.name ?? 'Proyecto';

    // ── 3. JSON para Chart.js ─────────────────────────────────────────────────
    const budgetLabels = JSON.stringify(chapterData.map((c) => c.name.length > 30 ? c.name.substring(0, 30) + '…' : c.name));
    const budgetValues = JSON.stringify(chapterData.map((c) => Math.round(c.value)));
    const cfLabels = JSON.stringify(sCurve.map((p) => p.label));
    const cfIng = JSON.stringify(sCurve.map((p) => Math.round(p.ing)));
    const cfEg = JSON.stringify(sCurve.map((p) => Math.round(p.eg)));
    const cfAcum = JSON.stringify(sCurve.map((p) => Math.round(p.acum)));
    const statusLabels = JSON.stringify(Object.keys(statusCounts));
    const statusValues = JSON.stringify(Object.values(statusCounts));

    // ── 4. HTML ───────────────────────────────────────────────────────────────
    return `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Reporte Ejecutivo — ${projectName}</title>
<script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.3/dist/chart.umd.min.js"></script>
<style>
  :root {
    --blue-900: #0f172a;
    --blue-800: #1e3a5f;
    --blue-700: #1d4ed8;
    --blue-600: #2563eb;
    --blue-400: #60a5fa;
    --blue-100: #dbeafe;
    --gray-900: #111827;
    --gray-700: #374151;
    --gray-500: #6b7280;
    --gray-200: #e5e7eb;
    --gray-50:  #f9fafb;
    --green-600: #16a34a;
    --red-600:   #dc2626;
    --amber-500: #f59e0b;
    --accent: #2563eb;
  }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body {
    font-family: 'Segoe UI', system-ui, -apple-system, sans-serif;
    background: var(--gray-50);
    color: var(--gray-900);
    font-size: 13px;
    line-height: 1.5;
  }

  /* ── COVER ── */
  .cover {
    background: linear-gradient(135deg, var(--blue-900) 0%, var(--blue-800) 60%, #1e40af 100%);
    color: #fff;
    padding: 56px 64px 48px;
    position: relative;
    overflow: hidden;
    page-break-after: always;
  }
  .cover::before {
    content: '';
    position: absolute;
    right: -80px; top: -80px;
    width: 400px; height: 400px;
    border-radius: 50%;
    background: rgba(255,255,255,0.04);
  }
  .cover::after {
    content: '';
    position: absolute;
    right: 60px; bottom: -60px;
    width: 240px; height: 240px;
    border-radius: 50%;
    background: rgba(255,255,255,0.06);
  }
  .cover-badge {
    display: inline-block;
    background: rgba(255,255,255,0.12);
    border: 1px solid rgba(255,255,255,0.2);
    border-radius: 20px;
    padding: 4px 16px;
    font-size: 11px;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: var(--blue-400);
    margin-bottom: 24px;
  }
  .cover h1 {
    font-size: 40px;
    font-weight: 700;
    letter-spacing: -0.5px;
    line-height: 1.1;
    margin-bottom: 8px;
  }
  .cover-sub {
    font-size: 18px;
    color: rgba(255,255,255,0.65);
    margin-bottom: 40px;
  }
  .cover-meta {
    display: flex;
    gap: 40px;
    border-top: 1px solid rgba(255,255,255,0.15);
    padding-top: 24px;
    font-size: 12px;
    color: rgba(255,255,255,0.6);
  }
  .cover-meta strong { display: block; color: #fff; font-size: 14px; margin-top: 2px; }

  /* ── LAYOUT ── */
  .page { max-width: 1100px; margin: 0 auto; padding: 40px 32px; }
  .section { margin-bottom: 40px; }
  .section-title {
    font-size: 10px;
    font-weight: 700;
    letter-spacing: 0.12em;
    text-transform: uppercase;
    color: var(--blue-700);
    border-left: 3px solid var(--blue-700);
    padding-left: 10px;
    margin-bottom: 20px;
  }

  /* ── KPI CARDS ── */
  .kpi-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 16px; }
  .kpi-grid-2 { grid-template-columns: repeat(2, 1fr); }
  .kpi-grid-3 { grid-template-columns: repeat(3, 1fr); }
  .kpi {
    background: #fff;
    border: 1px solid var(--gray-200);
    border-radius: 12px;
    padding: 20px;
    box-shadow: 0 1px 3px rgba(0,0,0,0.06);
    position: relative;
    overflow: hidden;
  }
  .kpi::before {
    content: '';
    position: absolute;
    top: 0; left: 0; right: 0;
    height: 3px;
    border-radius: 12px 12px 0 0;
  }
  .kpi.blue::before  { background: linear-gradient(90deg, #2563eb, #60a5fa); }
  .kpi.green::before { background: linear-gradient(90deg, #16a34a, #4ade80); }
  .kpi.red::before   { background: linear-gradient(90deg, #dc2626, #f87171); }
  .kpi.amber::before { background: linear-gradient(90deg, #d97706, #fbbf24); }
  .kpi.gray::before  { background: linear-gradient(90deg, #6b7280, #9ca3af); }
  .kpi-label {
    font-size: 11px;
    color: var(--gray-500);
    font-weight: 500;
    margin-bottom: 6px;
  }
  .kpi-value {
    font-size: 26px;
    font-weight: 700;
    letter-spacing: -0.5px;
    line-height: 1;
    margin-bottom: 4px;
  }
  .kpi-sub { font-size: 11px; color: var(--gray-500); }
  .kpi.blue .kpi-value  { color: var(--blue-700); }
  .kpi.green .kpi-value { color: var(--green-600); }
  .kpi.red .kpi-value   { color: var(--red-600); }
  .kpi.amber .kpi-value { color: #d97706; }

  /* ── CHARTS ── */
  .chart-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; }
  .chart-card {
    background: #fff;
    border: 1px solid var(--gray-200);
    border-radius: 12px;
    padding: 20px 24px;
    box-shadow: 0 1px 3px rgba(0,0,0,0.06);
  }
  .chart-card.full { grid-column: 1 / -1; }
  .chart-title {
    font-size: 13px;
    font-weight: 600;
    color: var(--gray-900);
    margin-bottom: 4px;
  }
  .chart-subtitle { font-size: 11px; color: var(--gray-500); margin-bottom: 16px; }
  canvas { max-width: 100%; }

  /* ── PROGRESS BAR ── */
  .progress-bar {
    height: 8px; background: var(--gray-200);
    border-radius: 4px; overflow: hidden; margin-top: 8px;
  }
  .progress-fill {
    height: 100%; border-radius: 4px;
    background: linear-gradient(90deg, #2563eb, #60a5fa);
    transition: width 0.6s ease;
  }
  .progress-fill.green { background: linear-gradient(90deg, #16a34a, #4ade80); }
  .progress-fill.red   { background: linear-gradient(90deg, #dc2626, #f87171); }

  /* ── TABLE ── */
  .data-table { width: 100%; border-collapse: collapse; font-size: 12px; }
  .data-table th {
    background: var(--blue-900);
    color: #fff;
    padding: 10px 14px;
    text-align: left;
    font-size: 10px;
    font-weight: 600;
    letter-spacing: 0.06em;
    text-transform: uppercase;
  }
  .data-table th:first-child { border-radius: 8px 0 0 0; }
  .data-table th:last-child  { border-radius: 0 8px 0 0; }
  .data-table td {
    padding: 9px 14px;
    border-bottom: 1px solid var(--gray-200);
    color: var(--gray-700);
  }
  .data-table tr:last-child td { border-bottom: none; }
  .data-table tr:hover td { background: var(--gray-50); }
  .badge {
    display: inline-block;
    padding: 2px 8px;
    border-radius: 20px;
    font-size: 10px;
    font-weight: 600;
    letter-spacing: 0.04em;
  }
  .badge-blue   { background: var(--blue-100); color: var(--blue-700); }
  .badge-red    { background: #fee2e2; color: var(--red-600); }
  .badge-green  { background: #dcfce7; color: var(--green-600); }
  .badge-amber  { background: #fef3c7; color: #92400e; }
  .badge-gray   { background: var(--gray-200); color: var(--gray-700); }

  /* ── MILESTONE ROW ── */
  .milestone-list { display: flex; flex-direction: column; gap: 10px; }
  .milestone-item {
    display: flex; align-items: center; gap: 12px;
    background: #fff;
    border: 1px solid var(--gray-200);
    border-radius: 8px;
    padding: 12px 16px;
  }
  .milestone-dot {
    width: 10px; height: 10px;
    border-radius: 50%; flex-shrink: 0;
  }
  .milestone-dot.done   { background: var(--green-600); }
  .milestone-dot.late   { background: var(--red-600); }
  .milestone-dot.pending { background: var(--blue-600); }

  /* ── FOOTER ── */
  .report-footer {
    text-align: center;
    padding: 20px;
    font-size: 11px;
    color: var(--gray-500);
    border-top: 1px solid var(--gray-200);
    margin-top: 40px;
  }

  /* ── PRINT ── */
  @media print {
    body { background: #fff; }
    .cover { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    .kpi::before { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    .data-table th { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    .progress-fill { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    .section { page-break-inside: avoid; }
    .print-btn { display: none; }
  }
  .print-btn {
    position: fixed;
    bottom: 24px; right: 24px;
    background: var(--blue-700);
    color: #fff;
    border: none;
    border-radius: 8px;
    padding: 10px 20px;
    font-size: 13px;
    font-weight: 600;
    cursor: pointer;
    box-shadow: 0 4px 12px rgba(37,99,235,0.35);
    display: flex; align-items: center; gap-8px;
  }
  .print-btn:hover { background: #1d4ed8; }
</style>
</head>
<body>

<!-- COVER -->
<div class="cover">
  <div class="cover-badge">Reporte Ejecutivo</div>
  <h1>${projectName}</h1>
  <p class="cover-sub">Informe de avance, presupuesto, ventas y flujo de caja</p>
  <div class="cover-meta">
    <div>Generado<strong>${generatedAt}</strong></div>
    <div>Ciudad<strong>Colombia</strong></div>
    <div>Presupuesto total<strong>${fmt(directCost)}</strong></div>
    <div>Avance obra<strong>${avgProgress}%</strong></div>
  </div>
</div>

<div class="page">

  <!-- ── SECCIÓN 1: KPIs EJECUTIVOS ────────────────────────────────── -->
  <div class="section">
    <div class="section-title">Indicadores ejecutivos</div>

    <div class="kpi-grid" style="margin-bottom:16px">
      <div class="kpi blue">
        <div class="kpi-label">Presupuesto total (CD)</div>
        <div class="kpi-value">${fmt(directCost)}</div>
        <div class="kpi-sub">${fmtFull(directCost)}</div>
      </div>
      <div class="kpi ${margenPct >= 15 ? 'green' : margenPct >= 8 ? 'amber' : 'red'}">
        <div class="kpi-label">Margen bruto</div>
        <div class="kpi-value">${fmt(margenBruto)}</div>
        <div class="kpi-sub">${margenPct.toFixed(1)}% sobre ventas</div>
      </div>
      <div class="kpi ${saldoNeto >= 0 ? 'green' : 'red'}">
        <div class="kpi-label">Saldo neto de caja</div>
        <div class="kpi-value">${fmt(saldoNeto)}</div>
        <div class="kpi-sub">Ingresos: ${fmt(totalIngresos)} · Egresos: ${fmt(totalEgresos)}</div>
      </div>
      <div class="kpi blue">
        <div class="kpi-label">Avance de obra</div>
        <div class="kpi-value">${avgProgress}%</div>
        <div class="kpi-sub">${totalTasks} tareas · ${criticalTasks} en ruta crítica</div>
        <div class="progress-bar"><div class="progress-fill ${avgProgress > 70 ? 'green' : ''}" style="width:${avgProgress}%"></div></div>
      </div>
    </div>

    <div class="kpi-grid kpi-grid-3">
      <div class="kpi gray">
        <div class="kpi-label">Unidades totales</div>
        <div class="kpi-value">${totalUnits}</div>
        <div class="kpi-sub">${unitsSold} vendidas · ${unitsAvailable} disponibles</div>
        <div class="progress-bar"><div class="progress-fill" style="width:${totalUnits > 0 ? Math.round(unitsSold/totalUnits*100) : 0}%"></div></div>
      </div>
      <div class="kpi green">
        <div class="kpi-label">Ventas realizadas</div>
        <div class="kpi-value">${fmt(totalSalesValue)}</div>
        <div class="kpi-sub">${unitsSold} unidades cerradas</div>
      </div>
      <div class="kpi blue">
        <div class="kpi-label">Hitos del proyecto</div>
        <div class="kpi-value">${milestones.length}</div>
        <div class="kpi-sub">${milestones.filter((m) => m.actualDate).length} completados · ${milestones.filter((m) => !m.actualDate && new Date(m.plannedDate) < new Date()).length} vencidos</div>
      </div>
    </div>
  </div>

  <!-- ── SECCIÓN 2: PRESUPUESTO POR CAPÍTULOS ───────────────────── -->
  <div class="section">
    <div class="section-title">Presupuesto por capítulos</div>
    <div class="chart-card full">
      <div class="chart-title">Distribución de costos directos</div>
      <div class="chart-subtitle">Costo total por capítulo en COP · ${fmtFull(directCost)}</div>
      <canvas id="budgetChart" height="100"></canvas>
    </div>
  </div>

  <!-- ── SECCIÓN 3: CRONOGRAMA ──────────────────────────────────── -->
  <div class="section">
    <div class="section-title">Cronograma de obra</div>
    ${summaryTasks.length > 0 ? `
    <div class="chart-card full">
      <div class="chart-title">Capítulos / resúmenes de obra</div>
      <div class="chart-subtitle">Avance por capítulo · Tareas críticas marcadas en rojo</div>
      <table class="data-table" style="margin-bottom:16px">
        <thead>
          <tr>
            <th>Código</th>
            <th>Capítulo</th>
            <th>Inicio</th>
            <th>Fin</th>
            <th>Duración</th>
            <th>Avance</th>
            <th>Estado</th>
          </tr>
        </thead>
        <tbody>
          ${summaryTasks.map((t) => {
            const prog = Math.round(Number(t.progress) * 100);
            const start = t.plannedStart ? new Date(t.plannedStart).toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: '2-digit' }) : '—';
            const end = t.plannedEnd ? new Date(t.plannedEnd).toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: '2-digit' }) : '—';
            const badge = t.isCritical
              ? '<span class="badge badge-red">Crítico</span>'
              : prog >= 100
              ? '<span class="badge badge-green">Completo</span>'
              : prog > 0
              ? '<span class="badge badge-blue">En progreso</span>'
              : '<span class="badge badge-gray">Pendiente</span>';
            return `<tr>
              <td><code>${t.code}</code></td>
              <td>${t.name}</td>
              <td>${start}</td>
              <td>${end}</td>
              <td>${t.durationDays}d</td>
              <td>
                <div style="display:flex;align-items:center;gap:8px">
                  <div class="progress-bar" style="flex:1;margin:0"><div class="progress-fill ${prog >= 100 ? 'green' : t.isCritical ? 'red' : ''}" style="width:${prog}%"></div></div>
                  <span style="min-width:32px;text-align:right;font-weight:600">${prog}%</span>
                </div>
              </td>
              <td>${badge}</td>
            </tr>`;
          }).join('')}
        </tbody>
      </table>
    </div>` : '<div class="chart-card full" style="text-align:center;color:var(--gray-500);padding:32px">Sin tareas de cronograma registradas</div>'}

    ${milestones.length > 0 ? `
    <div class="chart-card full" style="margin-top:16px">
      <div class="chart-title">Hitos del proyecto</div>
      <div class="chart-subtitle">Fechas contractuales y entregables clave</div>
      <div class="milestone-list">
        ${milestones.map((m) => {
          const done = !!m.actualDate;
          const late = !done && new Date(m.plannedDate) < new Date();
          const cls = done ? 'done' : late ? 'late' : 'pending';
          const label = done ? 'Completado' : late ? 'Vencido' : 'Pendiente';
          const badgeCls = done ? 'badge-green' : late ? 'badge-red' : 'badge-blue';
          const date = new Date(m.plannedDate).toLocaleDateString('es-CO', { day: '2-digit', month: 'long', year: 'numeric' });
          return `<div class="milestone-item">
            <div class="milestone-dot ${cls}"></div>
            <div style="flex:1"><strong>${m.code} — ${m.name}</strong><div style="font-size:11px;color:var(--gray-500)">${date}${m.isContractual ? ' · Contractual' : ''}</div></div>
            <span class="badge ${badgeCls}">${label}</span>
          </div>`;
        }).join('')}
      </div>
    </div>` : ''}
  </div>

  <!-- ── SECCIÓN 4: VENTAS Y FLUJO DE CAJA ─────────────────────── -->
  <div class="section">
    <div class="section-title">Ventas y flujo de caja</div>
    <div class="chart-grid">
      <div class="chart-card">
        <div class="chart-title">Estado de unidades</div>
        <div class="chart-subtitle">Distribución por estado de venta</div>
        <canvas id="statusChart" height="200"></canvas>
      </div>
      <div class="chart-card">
        <div class="chart-title">Flujo de caja mensual</div>
        <div class="chart-subtitle">Ingresos vs. egresos por mes</div>
        <canvas id="cfChart" height="200"></canvas>
      </div>
      ${sCurve.length > 0 ? `<div class="chart-card full">
        <div class="chart-title">Saldo acumulado (Curva S)</div>
        <div class="chart-subtitle">Evolución del saldo neto acumulado a lo largo del proyecto</div>
        <canvas id="scurveChart" height="80"></canvas>
      </div>` : ''}
    </div>
  </div>

</div>

<!-- FOOTER -->
<div class="report-footer">
  Reporte generado el ${generatedAt} · ${projectName} · Sistema de Gestión de Proyectos Santa Isabel
</div>

<button class="print-btn" onclick="window.print()">🖨️ Imprimir / PDF</button>

<script>
Chart.defaults.font.family = "'Segoe UI', system-ui, sans-serif";
Chart.defaults.font.size = 12;
Chart.defaults.color = '#6b7280';

/* Colores institucionales */
const BLUE_GRAD = { colorStops: [{offset:0,color:'#1d4ed8'},{offset:1,color:'#60a5fa'}] };
const GREENS = ['#16a34a','#4ade80','#86efac','#bbf7d0'];
const AMBERS = ['#d97706','#fbbf24','#fde68a'];
const STATUS_COLORS = {
  'DISPONIBLE':   '#2563eb',
  'VENDIDA':      '#16a34a',
  'ESCRITURADA':  '#059669',
  'RESERVADA':    '#d97706',
  'NO_DISPONIBLE':'#9ca3af',
};

/* ── Presupuesto por capítulos (horizontal bar) ── */
const budgetCtx = document.getElementById('budgetChart');
if(budgetCtx) {
  const labels = ${budgetLabels};
  const values = ${budgetValues};
  const total = values.reduce((a,b)=>a+b,0);
  new Chart(budgetCtx, {
    type: 'bar',
    data: {
      labels,
      datasets: [{
        label: 'Costo (COP)',
        data: values,
        backgroundColor: labels.map((_,i) => \`hsl(\${210 + i*12}, 70%, \${45+i*3}%)\`),
        borderRadius: 6,
        borderSkipped: false,
      }]
    },
    options: {
      indexAxis: 'y',
      responsive: true,
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label(ctx) {
              const val = ctx.raw;
              const pct = total > 0 ? ((val/total)*100).toFixed(1) : 0;
              return \` \${new Intl.NumberFormat('es-CO',{style:'currency',currency:'COP',notation:'compact',maximumFractionDigits:1}).format(val)} (\${pct}%)\`;
            }
          }
        }
      },
      scales: {
        x: {
          grid: { color: '#f3f4f6' },
          ticks: {
            callback(v) {
              return new Intl.NumberFormat('es-CO',{notation:'compact',maximumFractionDigits:0}).format(v);
            }
          }
        },
        y: { grid: { display: false } }
      }
    }
  });
}

/* ── Estado de unidades (donut) ── */
const statusCtx = document.getElementById('statusChart');
if(statusCtx) {
  const labels = ${statusLabels};
  const values = ${statusValues};
  new Chart(statusCtx, {
    type: 'doughnut',
    data: {
      labels,
      datasets: [{
        data: values,
        backgroundColor: labels.map(l => STATUS_COLORS[l] || '#9ca3af'),
        borderWidth: 2,
        borderColor: '#fff',
        hoverOffset: 8,
      }]
    },
    options: {
      cutout: '65%',
      plugins: {
        legend: {
          position: 'bottom',
          labels: { padding: 12, usePointStyle: true, pointStyleWidth: 8 }
        },
        tooltip: {
          callbacks: {
            label(ctx) { return \` \${ctx.label}: \${ctx.raw} unidades\`; }
          }
        }
      }
    }
  });
}

/* ── Flujo de caja mensual (grouped bar) ── */
const cfCtx = document.getElementById('cfChart');
if(cfCtx) {
  const labels = ${cfLabels};
  const ing = ${cfIng};
  const eg = ${cfEg};
  new Chart(cfCtx, {
    type: 'bar',
    data: {
      labels,
      datasets: [
        { label: 'Ingresos', data: ing, backgroundColor: '#16a34a', borderRadius: 4 },
        { label: 'Egresos',  data: eg,  backgroundColor: '#dc2626', borderRadius: 4 },
      ]
    },
    options: {
      responsive: true,
      plugins: {
        legend: { position: 'bottom', labels: { padding: 12, usePointStyle: true } },
        tooltip: {
          callbacks: {
            label(ctx) {
              return \` \${ctx.dataset.label}: \${new Intl.NumberFormat('es-CO',{style:'currency',currency:'COP',notation:'compact',maximumFractionDigits:1}).format(ctx.raw)}\`;
            }
          }
        }
      },
      scales: {
        x: { grid: { display: false } },
        y: {
          grid: { color: '#f3f4f6' },
          ticks: {
            callback(v) {
              return new Intl.NumberFormat('es-CO',{notation:'compact',maximumFractionDigits:0}).format(v);
            }
          }
        }
      }
    }
  });
}

/* ── Curva S (area line) ── */
const scCtx = document.getElementById('scurveChart');
if(scCtx) {
  const labels = ${cfLabels};
  const acum = ${cfAcum};
  new Chart(scCtx, {
    type: 'line',
    data: {
      labels,
      datasets: [{
        label: 'Saldo acumulado',
        data: acum,
        borderColor: '#2563eb',
        borderWidth: 2.5,
        fill: true,
        backgroundColor(ctx) {
          const chart = ctx.chart;
          const { ctx: c, chartArea } = chart;
          if (!chartArea) return '#dbeafe';
          const gradient = c.createLinearGradient(0, chartArea.top, 0, chartArea.bottom);
          gradient.addColorStop(0, 'rgba(37,99,235,0.25)');
          gradient.addColorStop(1, 'rgba(37,99,235,0.02)');
          return gradient;
        },
        tension: 0.4,
        pointRadius: 3,
        pointBackgroundColor: '#2563eb',
        pointHoverRadius: 6,
      }]
    },
    options: {
      responsive: true,
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label(ctx) {
              const v = ctx.raw;
              const color = v >= 0 ? '✅' : '🔴';
              return \` \${color} \${new Intl.NumberFormat('es-CO',{style:'currency',currency:'COP',notation:'compact',maximumFractionDigits:1}).format(v)}\`;
            }
          }
        }
      },
      scales: {
        x: { grid: { display: false } },
        y: {
          grid: { color: '#f3f4f6' },
          ticks: {
            callback(v) {
              return new Intl.NumberFormat('es-CO',{notation:'compact',maximumFractionDigits:0}).format(v);
            }
          }
        }
      }
    }
  });
}
</script>
</body>
</html>`;
  }

  // ─── HTML: Reporte de Presupuesto ────────────────────────────────────────

  async generateBudgetHtml(projectId: string): Promise<string> {
    this.logger.log(`Generando reporte HTML presupuesto para ${projectId}`);

    const [project, chapters, aiuConfig] = await Promise.all([
      this.prisma.project.findUnique({ where: { id: projectId } }),
      this.prisma.chapter.findMany({
        where: { projectId },
        include: { subchapters: { include: { items: true }, orderBy: { order: 'asc' } } },
        orderBy: { order: 'asc' },
      }),
      this.prisma.aIUConfig.findUnique({ where: { projectId } }),
    ]);

    const fmt = (v: number) =>
      new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(v);
    const fmtCmp = (v: number) =>
      new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', notation: 'compact', maximumFractionDigits: 1 }).format(v);

    // Calcular totales por capítulo
    type ChapterRow = { code: string; name: string; total: number; pct: number; byType: Record<string, number> };
    const chapterRows: ChapterRow[] = chapters.map((ch) => {
      const byType: Record<string, number> = {};
      let total = 0;
      for (const sub of ch.subchapters) {
        for (const item of sub.items) {
          const v = Number(item.totalCost);
          total += v;
          const t = item.costType ?? 'MATERIAL';
          byType[t] = (byType[t] ?? 0) + v;
        }
      }
      return { code: ch.code, name: ch.name, total, pct: 0, byType };
    });

    const directCost = chapterRows.reduce((s, c) => s + c.total, 0);
    chapterRows.forEach((c) => { c.pct = directCost > 0 ? (c.total / directCost) * 100 : 0; });

    const aiuPct = aiuConfig
      ? (Number(aiuConfig.administracionPct) + Number(aiuConfig.imprevistosPct) + Number(aiuConfig.utilidadPct))
      : 0;
    const aiuAmount = directCost * (aiuPct / 100);
    const ivaAmount = aiuConfig ? aiuAmount * (Number(aiuConfig.ivaUtilidadPct) / 100) : 0;
    const totalCost = directCost + aiuAmount + ivaAmount;

    // Distribución por tipo
    const allByType: Record<string, number> = {};
    for (const ch of chapterRows) {
      for (const [t, v] of Object.entries(ch.byType)) allByType[t] = (allByType[t] ?? 0) + v;
    }
    const typeNames: Record<string, string> = {
      MANO_OBRA: 'Mano de obra', MATERIAL: 'Material', EQUIPO: 'Equipo', FUNGIBLE: 'Fungible', OTRO: 'Otro',
    };
    const typeColors: Record<string, string> = {
      MANO_OBRA: '#2563eb', MATERIAL: '#d97706', EQUIPO: '#7c3aed', FUNGIBLE: '#16a34a', OTRO: '#6b7280',
    };

    const barLabels = JSON.stringify(chapterRows.map((c) => `${c.code} ${c.name}`.substring(0, 35)));
    const barValues = JSON.stringify(chapterRows.map((c) => Math.round(c.total)));
    const barPcts   = JSON.stringify(chapterRows.map((c) => c.pct.toFixed(1)));

    const typeLabels = JSON.stringify(Object.keys(allByType).map((t) => typeNames[t] ?? t));
    const typeVals   = JSON.stringify(Object.values(allByType).map((v) => Math.round(v)));
    const typeCols   = JSON.stringify(Object.keys(allByType).map((t) => typeColors[t] ?? '#94a3b8'));

    const generatedAt = new Date().toLocaleString('es-CO', { dateStyle: 'long', timeStyle: 'short' });
    const projectName = project?.name ?? 'Proyecto';

    // Tabla de ítems (top 50 por costo)
    type ItemRow = { code: string; desc: string; unit: string; qty: number; uc: number; total: number; chapter: string; type: string };
    const allItems: ItemRow[] = [];
    for (const ch of chapters) {
      for (const sub of ch.subchapters) {
        for (const item of sub.items) {
          allItems.push({
            code: item.code, desc: item.description, unit: item.unit,
            qty: Number(item.quantity), uc: Number(item.unitCost),
            total: Number(item.totalCost),
            chapter: `${ch.code} ${ch.name}`,
            type: item.costType ?? 'MATERIAL',
          });
        }
      }
    }
    allItems.sort((a, b) => b.total - a.total);
    const topItems = allItems.slice(0, 50);

    return `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Reporte Presupuesto — ${projectName}</title>
<script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.3/dist/chart.umd.min.js"></script>
${REPORT_STYLES}
</head>
<body>
<div class="cover">
  <div class="cover-badge">Reporte de Presupuesto</div>
  <h1>${projectName}</h1>
  <p class="cover-sub">Análisis detallado de costos directos, AIU y distribución por capítulo</p>
  <div class="cover-meta">
    <div>Generado<strong>${generatedAt}</strong></div>
    <div>Costo directo<strong>${fmtCmp(directCost)}</strong></div>
    <div>Presupuesto total<strong>${fmtCmp(totalCost)}</strong></div>
    <div>Capítulos<strong>${chapterRows.length}</strong></div>
  </div>
</div>

<div class="page">

  <!-- KPIs financieros -->
  <div class="section">
    <div class="section-title">Resumen financiero</div>
    <div class="kpi-grid">
      <div class="kpi blue">
        <div class="kpi-label">Costo directo</div>
        <div class="kpi-value">${fmtCmp(directCost)}</div>
        <div class="kpi-sub">${fmt(directCost)}</div>
      </div>
      <div class="kpi amber">
        <div class="kpi-label">AIU (${aiuPct.toFixed(1)}%)</div>
        <div class="kpi-value">${fmtCmp(aiuAmount)}</div>
        <div class="kpi-sub">Adm ${aiuConfig?.administracionPct ?? 0}% + Impr ${aiuConfig?.imprevistosPct ?? 0}% + Util ${aiuConfig?.utilidadPct ?? 0}%</div>
      </div>
      <div class="kpi gray">
        <div class="kpi-label">IVA utilidad (${aiuConfig?.ivaUtilidadPct ?? 0}%)</div>
        <div class="kpi-value">${fmtCmp(ivaAmount)}</div>
        <div class="kpi-sub">${fmt(ivaAmount)}</div>
      </div>
      <div class="kpi green">
        <div class="kpi-label">Presupuesto total</div>
        <div class="kpi-value">${fmtCmp(totalCost)}</div>
        <div class="kpi-sub">${fmt(totalCost)}</div>
      </div>
    </div>
  </div>

  <!-- Gráficas -->
  <div class="section">
    <div class="section-title">Distribución de costos</div>
    <div class="chart-grid">
      <div class="chart-card full">
        <div class="chart-title">Costo por capítulo</div>
        <div class="chart-subtitle">Valor absoluto y % del costo directo total</div>
        <canvas id="barChart" height="90"></canvas>
      </div>
      <div class="chart-card">
        <div class="chart-title">Distribución por tipo de costo</div>
        <div class="chart-subtitle">Material · Mano de obra · Equipo · Otros</div>
        <canvas id="typeChart" height="200"></canvas>
      </div>
      <div class="chart-card">
        <div class="chart-title">Estructura del presupuesto</div>
        <div class="chart-subtitle">Costo directo vs AIU vs IVA</div>
        <canvas id="structChart" height="200"></canvas>
      </div>
    </div>
  </div>

  <!-- Tabla de capítulos -->
  <div class="section">
    <div class="section-title">Resumen por capítulo</div>
    <div class="chart-card full">
      <table class="data-table">
        <thead><tr>
          <th>Cód.</th><th>Capítulo</th><th style="text-align:right">Total (COP)</th>
          <th style="text-align:right">% CD</th><th>Distribución</th>
        </tr></thead>
        <tbody>
          ${chapterRows.map((ch) => `
          <tr>
            <td><code>${ch.code}</code></td>
            <td><strong>${ch.name}</strong></td>
            <td style="text-align:right;font-weight:600">${fmt(ch.total)}</td>
            <td style="text-align:right">${ch.pct.toFixed(1)}%</td>
            <td>
              <div class="progress-bar" style="margin:0;width:100%">
                <div class="progress-fill" style="width:${ch.pct}%;background:hsl(${210 + chapterRows.indexOf(ch) * 12},70%,45%)"></div>
              </div>
            </td>
          </tr>`).join('')}
          <tr style="font-weight:700;background:#f0f7ff">
            <td colspan="2">COSTO DIRECTO TOTAL</td>
            <td style="text-align:right;color:#1d4ed8">${fmt(directCost)}</td>
            <td style="text-align:right">100%</td><td></td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>

  <!-- Top 50 ítems -->
  ${topItems.length > 0 ? `
  <div class="section">
    <div class="section-title">Top ${topItems.length} ítems por valor</div>
    <div class="chart-card full">
      <table class="data-table">
        <thead><tr>
          <th>#</th><th>Código</th><th>Descripción</th><th>Und</th>
          <th style="text-align:right">Cant.</th>
          <th style="text-align:right">C. Unitario</th>
          <th style="text-align:right">Total</th>
          <th>Tipo</th>
        </tr></thead>
        <tbody>
          ${topItems.map((it, i) => {
            const typeColor: Record<string, string> = {
              MANO_OBRA: 'badge-blue', MATERIAL: 'badge-amber',
              EQUIPO: 'badge-gray', FUNGIBLE: 'badge-green', OTRO: 'badge-gray',
            };
            const typeLabel: Record<string, string> = {
              MANO_OBRA: 'M. Obra', MATERIAL: 'Material', EQUIPO: 'Equipo', FUNGIBLE: 'Fungible', OTRO: 'Otro',
            };
            return `<tr>
              <td style="color:#9ca3af;font-size:11px">${i + 1}</td>
              <td><code>${it.code}</code></td>
              <td>${it.desc}</td>
              <td>${it.unit}</td>
              <td style="text-align:right">${it.qty.toLocaleString('es-CO')}</td>
              <td style="text-align:right">${fmt(it.uc)}</td>
              <td style="text-align:right;font-weight:600">${fmt(it.total)}</td>
              <td><span class="badge ${typeColor[it.type] ?? 'badge-gray'}">${typeLabel[it.type] ?? it.type}</span></td>
            </tr>`;
          }).join('')}
        </tbody>
      </table>
    </div>
  </div>` : ''}

</div>

<div class="report-footer">
  Reporte de presupuesto generado el ${generatedAt} · ${projectName}
</div>
<button class="print-btn" onclick="window.print()">🖨️ Imprimir / PDF</button>

<script>
Chart.defaults.font.family = "'Segoe UI', system-ui, sans-serif";
Chart.defaults.font.size = 12;
Chart.defaults.color = '#6b7280';

/* Barras por capítulo */
const barCtx = document.getElementById('barChart');
if (barCtx) {
  const labels = ${barLabels};
  const values = ${barValues};
  const pcts   = ${barPcts};
  const total  = values.reduce((a,b)=>a+b,0);
  new Chart(barCtx, {
    type: 'bar',
    data: {
      labels,
      datasets: [{
        label: 'Costo (COP)',
        data: values,
        backgroundColor: labels.map((_,i) => \`hsl(\${210+i*14},68%,\${44+i*2}%)\`),
        borderRadius: 5, borderSkipped: false,
      }]
    },
    options: {
      indexAxis: 'y', responsive: true,
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label(ctx) {
              const pct = pcts[ctx.dataIndex];
              return \` \${new Intl.NumberFormat('es-CO',{style:'currency',currency:'COP',notation:'compact',maximumFractionDigits:1}).format(ctx.raw)} (\${pct}%)\`;
            }
          }
        }
      },
      scales: {
        x: { grid:{color:'#f1f5f9'}, ticks:{callback(v){return new Intl.NumberFormat('es-CO',{notation:'compact',maximumFractionDigits:0}).format(v)}} },
        y: { grid:{display:false} }
      }
    }
  });
}

/* Donut tipo de costo */
const typeCtx = document.getElementById('typeChart');
if (typeCtx) {
  new Chart(typeCtx, {
    type: 'doughnut',
    data: {
      labels: ${typeLabels},
      datasets: [{ data: ${typeVals}, backgroundColor: ${typeCols}, borderWidth:2, borderColor:'#fff', hoverOffset:8 }]
    },
    options: {
      cutout: '60%',
      plugins: {
        legend: { position:'bottom', labels:{ padding:10, usePointStyle:true, pointStyleWidth:8 } },
        tooltip: { callbacks: { label(c){ return \` \${c.label}: \${new Intl.NumberFormat('es-CO',{style:'currency',currency:'COP',notation:'compact',maximumFractionDigits:1}).format(c.raw)}\`; } } }
      }
    }
  });
}

/* Donut estructura presupuesto */
const structCtx = document.getElementById('structChart');
if (structCtx) {
  new Chart(structCtx, {
    type: 'doughnut',
    data: {
      labels: ['Costo directo','AIU','IVA utilidad'],
      datasets: [{ data: [${Math.round(directCost)},${Math.round(aiuAmount)},${Math.round(ivaAmount)}],
        backgroundColor:['#1d4ed8','#d97706','#6b7280'], borderWidth:2, borderColor:'#fff', hoverOffset:8 }]
    },
    options: {
      cutout: '60%',
      plugins: {
        legend: { position:'bottom', labels:{ padding:10, usePointStyle:true, pointStyleWidth:8 } },
        tooltip: { callbacks: { label(c){ return \` \${c.label}: \${new Intl.NumberFormat('es-CO',{style:'currency',currency:'COP',notation:'compact',maximumFractionDigits:1}).format(c.raw)}\`; } } }
      }
    }
  });
}
</script>
</body>
</html>`;
  }

  // ─── HTML: Reporte de Cronograma ──────────────────────────────────────────

  async generateScheduleHtml(projectId: string): Promise<string> {
    this.logger.log(`Generando reporte HTML cronograma para ${projectId}`);

    const [project, tasks, milestones, baselines] = await Promise.all([
      this.prisma.project.findUnique({ where: { id: projectId } }),
      this.prisma.task.findMany({
        where: { projectId },
        include: { predecessors: { include: { predecessor: { select: { code: true } } } } },
        orderBy: [{ plannedStart: 'asc' }],
      }),
      this.prisma.milestone.findMany({ where: { projectId }, orderBy: { plannedDate: 'asc' } }),
      this.prisma.scheduleBaseline.findMany({ where: { projectId }, orderBy: { version: 'asc' }, take: 1 }),
    ]);

    const generatedAt = new Date().toLocaleString('es-CO', { dateStyle: 'long', timeStyle: 'short' });
    const projectName = project?.name ?? 'Proyecto';

    const allTasks = tasks.filter((t) => t.kind !== 'MILESTONE');
    const summaries = allTasks.filter((t) => t.kind === 'SUMMARY');
    const leaves    = allTasks.filter((t) => t.kind === 'TASK');
    const criticals = leaves.filter((t) => t.isCritical);
    const avgProg = leaves.length > 0
      ? Math.round(leaves.reduce((s, t) => s + Number(t.progress) * 100, 0) / leaves.length)
      : 0;

    // Fecha inicio y fin del proyecto
    const starts = allTasks.map((t) => t.plannedStart ? new Date(t.plannedStart).getTime() : Infinity);
    const ends   = allTasks.map((t) => t.plannedEnd   ? new Date(t.plannedEnd).getTime()   : 0);
    const projStart = starts.length ? new Date(Math.min(...starts)) : null;
    const projEnd   = ends.length   ? new Date(Math.max(...ends))   : null;
    const projDuration = projStart && projEnd ? Math.round((projEnd.getTime() - projStart.getTime()) / (86400000)) : 0;

    const fmtDate = (d: Date | null | string) =>
      d ? new Date(d).toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';

    // Avance por capítulo (summaries)
    const chapProgress = summaries.map((s) => {
      const children = leaves.filter((t) => t.parentId === s.id);
      const prog = children.length
        ? Math.round(children.reduce((acc, t) => acc + Number(t.progress) * 100, 0) / children.length)
        : Math.round(Number(s.progress) * 100);
      return { code: s.code, name: s.name, prog, tasks: children.length, isCritical: s.isCritical };
    }).filter((c) => c.name);

    const chapLabels = JSON.stringify(chapProgress.map((c) => `${c.code} ${c.name}`.substring(0, 35)));
    const chapVals   = JSON.stringify(chapProgress.map((c) => c.prog));

    // S-curve EVM: avance planeado vs real (simplificado por tareas completadas)
    const evmData: { label: string; planned: number; actual: number }[] = [];
    if (projStart && projEnd) {
      const totalMs = projEnd.getTime() - projStart.getTime();
      for (let m = 0; m <= 12; m++) {
        const cutoff = new Date(projStart.getTime() + (totalMs * m) / 12);
        const planDone = leaves.filter((t) => t.plannedEnd && new Date(t.plannedEnd) <= cutoff).length;
        const planPct  = leaves.length > 0 ? Math.round((planDone / leaves.length) * 100) : 0;
        evmData.push({
          label: `${Math.round((m / 12) * 100)}%`,
          planned: planPct,
          actual: m === 12 ? avgProg : Math.min(avgProg, planPct),
        });
      }
    }
    const evmLabels  = JSON.stringify(evmData.map((d) => d.label));
    const evmPlanned = JSON.stringify(evmData.map((d) => d.planned));
    const evmActual  = JSON.stringify(evmData.map((d) => d.actual));

    return `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Reporte Cronograma — ${projectName}</title>
<script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.3/dist/chart.umd.min.js"></script>
${REPORT_STYLES}
</head>
<body>
<div class="cover" style="background:linear-gradient(135deg,#0f2027 0%,#203a43 50%,#2c5364 100%)">
  <div class="cover-badge">Reporte de Cronograma</div>
  <h1>${projectName}</h1>
  <p class="cover-sub">Estado de avance, ruta crítica, hitos y curva de avance EVM</p>
  <div class="cover-meta">
    <div>Generado<strong>${generatedAt}</strong></div>
    <div>Inicio planeado<strong>${fmtDate(projStart)}</strong></div>
    <div>Fin planeado<strong>${fmtDate(projEnd)}</strong></div>
    <div>Avance promedio<strong>${avgProg}%</strong></div>
  </div>
</div>

<div class="page">

  <!-- KPIs -->
  <div class="section">
    <div class="section-title">Indicadores del cronograma</div>
    <div class="kpi-grid">
      <div class="kpi blue">
        <div class="kpi-label">Avance promedio</div>
        <div class="kpi-value">${avgProg}%</div>
        <div class="progress-bar"><div class="progress-fill ${avgProg >= 80 ? 'green' : ''}" style="width:${avgProg}%"></div></div>
      </div>
      <div class="kpi ${criticals.length > 0 ? 'red' : 'green'}">
        <div class="kpi-label">Tareas en ruta crítica</div>
        <div class="kpi-value">${criticals.length}</div>
        <div class="kpi-sub">de ${leaves.length} tareas totales</div>
      </div>
      <div class="kpi blue">
        <div class="kpi-label">Duración total</div>
        <div class="kpi-value">${projDuration}d</div>
        <div class="kpi-sub">${fmtDate(projStart)} → ${fmtDate(projEnd)}</div>
      </div>
      <div class="kpi ${milestones.filter((m) => !m.actualDate && new Date(m.plannedDate) < new Date()).length > 0 ? 'red' : 'green'}">
        <div class="kpi-label">Hitos</div>
        <div class="kpi-value">${milestones.length}</div>
        <div class="kpi-sub">${milestones.filter((m) => m.actualDate).length} completados · ${milestones.filter((m) => !m.actualDate && new Date(m.plannedDate) < new Date()).length} vencidos</div>
      </div>
    </div>
  </div>

  <!-- Gráficas -->
  <div class="section">
    <div class="section-title">Análisis gráfico</div>
    <div class="chart-grid">
      <div class="chart-card full">
        <div class="chart-title">Avance por capítulo</div>
        <div class="chart-subtitle">% de progreso promedio por capítulo / resumen</div>
        <canvas id="chapChart" height="80"></canvas>
      </div>
      <div class="chart-card full">
        <div class="chart-title">Curva de avance (Planeado vs. Real)</div>
        <div class="chart-subtitle">Comparación del avance planeado según fechas vs. avance real registrado</div>
        <canvas id="evmChart" height="80"></canvas>
      </div>
    </div>
  </div>

  <!-- Tabla de tareas -->
  <div class="section">
    <div class="section-title">Listado de tareas</div>
    <div class="chart-card full">
      <table class="data-table">
        <thead><tr>
          <th>Código</th><th>Nombre</th><th>Tipo</th>
          <th>Inicio</th><th>Fin</th><th>Dur.</th>
          <th style="text-align:right">Avance</th><th>Ruta</th>
        </tr></thead>
        <tbody>
          ${allTasks.map((t) => {
            const prog = Math.round(Number(t.progress) * 100);
            const isSummary = t.kind === 'SUMMARY';
            const rowStyle = isSummary ? 'background:#f0f7ff;font-weight:600' : '';
            const badge = t.isCritical
              ? '<span class="badge badge-red">Crítico</span>'
              : prog >= 100 ? '<span class="badge badge-green">Completo</span>'
              : prog > 0   ? '<span class="badge badge-blue">En progreso</span>'
              : '<span class="badge badge-gray">Pendiente</span>';
            const typeBadge = isSummary
              ? '<span class="badge badge-blue">Resumen</span>'
              : '<span class="badge badge-gray">Tarea</span>';
            return `<tr style="${rowStyle}">
              <td><code style="font-size:11px">${t.code}</code></td>
              <td>${isSummary ? '<strong>' : ''}${t.name}${isSummary ? '</strong>' : ''}</td>
              <td>${typeBadge}</td>
              <td>${fmtDate(t.plannedStart)}</td>
              <td>${fmtDate(t.plannedEnd)}</td>
              <td>${t.durationDays}d</td>
              <td>
                <div style="display:flex;align-items:center;gap:6px;justify-content:flex-end">
                  <div class="progress-bar" style="width:60px;flex-shrink:0;margin:0">
                    <div class="progress-fill ${prog>=100?'green':t.isCritical?'red':''}" style="width:${prog}%"></div>
                  </div>
                  <span style="font-weight:600;min-width:28px;text-align:right">${prog}%</span>
                </div>
              </td>
              <td>${badge}</td>
            </tr>`;
          }).join('')}
        </tbody>
      </table>
    </div>
  </div>

  <!-- Hitos -->
  ${milestones.length > 0 ? `
  <div class="section">
    <div class="section-title">Hitos del proyecto</div>
    <div class="chart-card full">
      <table class="data-table">
        <thead><tr>
          <th>Código</th><th>Nombre</th><th>Fecha planeada</th>
          <th>Fecha real</th><th>Contractual</th><th>Estado</th>
        </tr></thead>
        <tbody>
          ${milestones.map((m) => {
            const done = !!m.actualDate;
            const late = !done && new Date(m.plannedDate) < new Date();
            const badge = done ? '<span class="badge badge-green">Completado</span>'
              : late ? '<span class="badge badge-red">Vencido</span>'
              : '<span class="badge badge-blue">Pendiente</span>';
            return `<tr>
              <td><code>${m.code}</code></td>
              <td><strong>${m.name}</strong></td>
              <td>${fmtDate(m.plannedDate)}</td>
              <td>${m.actualDate ? fmtDate(m.actualDate) : '—'}</td>
              <td>${m.isContractual ? '<span class="badge badge-amber">Sí</span>' : '—'}</td>
              <td>${badge}</td>
            </tr>`;
          }).join('')}
        </tbody>
      </table>
    </div>
  </div>` : ''}

  ${baselines.length > 0 ? `
  <div class="section">
    <div class="section-title">Línea base activa</div>
    <div class="kpi-grid kpi-grid-2" style="max-width:400px">
      <div class="kpi blue">
        <div class="kpi-label">Versión</div>
        <div class="kpi-value">v${baselines[0]!.version}</div>
        <div class="kpi-sub">${baselines[0]!.label}</div>
      </div>
      <div class="kpi gray">
        <div class="kpi-label">Creada</div>
        <div class="kpi-value" style="font-size:14px">${fmtDate(baselines[0]!.frozenAt)}</div>
      </div>
    </div>
  </div>` : ''}

</div>

<div class="report-footer">
  Reporte de cronograma generado el ${generatedAt} · ${projectName}
</div>
<button class="print-btn" onclick="window.print()">🖨️ Imprimir / PDF</button>

<script>
Chart.defaults.font.family = "'Segoe UI', system-ui, sans-serif";
Chart.defaults.font.size = 12;
Chart.defaults.color = '#6b7280';

/* Avance por capítulo */
const chapCtx = document.getElementById('chapChart');
if (chapCtx) {
  new Chart(chapCtx, {
    type: 'bar',
    data: {
      labels: ${chapLabels},
      datasets: [{
        label: '% Avance',
        data: ${chapVals},
        backgroundColor: ${chapVals}.map(v => v >= 100 ? '#16a34a' : v > 50 ? '#2563eb' : v > 0 ? '#d97706' : '#e5e7eb'),
        borderRadius: 5, borderSkipped: false,
      }]
    },
    options: {
      indexAxis: 'y', responsive: true,
      plugins: { legend:{display:false}, tooltip:{callbacks:{label(c){ return \` \${c.raw}% avance\`; }}} },
      scales: {
        x: { min:0, max:100, grid:{color:'#f1f5f9'}, ticks:{callback(v){ return v+'%'; }} },
        y: { grid:{display:false} }
      }
    }
  });
}

/* EVM curva avance */
const evmCtx = document.getElementById('evmChart');
if (evmCtx) {
  new Chart(evmCtx, {
    type: 'line',
    data: {
      labels: ${evmLabels},
      datasets: [
        {
          label: 'Avance planeado',
          data: ${evmPlanned},
          borderColor: '#94a3b8', borderWidth: 2,
          borderDash: [6,3],
          fill: false,
          tension: 0.3,
          pointRadius: 3, pointBackgroundColor: '#94a3b8',
        },
        {
          label: 'Avance real',
          data: ${evmActual},
          borderColor: '#2563eb', borderWidth: 2.5,
          fill: true,
          backgroundColor(ctx) {
            const c = ctx.chart.ctx, ca = ctx.chart.chartArea;
            if (!ca) return 'rgba(37,99,235,0.1)';
            const g = c.createLinearGradient(0,ca.top,0,ca.bottom);
            g.addColorStop(0,'rgba(37,99,235,0.2)');
            g.addColorStop(1,'rgba(37,99,235,0.01)');
            return g;
          },
          tension: 0.3,
          pointRadius: 4, pointBackgroundColor: '#2563eb',
        }
      ]
    },
    options: {
      responsive: true,
      plugins: {
        legend: { position:'bottom', labels:{padding:12,usePointStyle:true,pointStyleWidth:8} },
        tooltip: { callbacks: { label(c){ return \` \${c.dataset.label}: \${c.raw}%\`; } } }
      },
      scales: {
        x: { grid:{color:'#f1f5f9'} },
        y: { min:0, max:100, grid:{color:'#f1f5f9'}, ticks:{callback(v){ return v+'%'; }} }
      }
    }
  });
}
</script>
</body>
</html>`;
  }
}

/** Estilos CSS compartidos para todos los reportes HTML */
const REPORT_STYLES = `<style>
  :root {
    --blue-900:#0f172a;--blue-800:#1e3a5f;--blue-700:#1d4ed8;
    --blue-600:#2563eb;--blue-400:#60a5fa;--blue-100:#dbeafe;
    --gray-900:#111827;--gray-700:#374151;--gray-500:#6b7280;
    --gray-200:#e5e7eb;--gray-50:#f9fafb;
    --green-600:#16a34a;--red-600:#dc2626;--amber-500:#f59e0b;
  }
  *{box-sizing:border-box;margin:0;padding:0}
  body{font-family:'Segoe UI',system-ui,-apple-system,sans-serif;background:var(--gray-50);color:var(--gray-900);font-size:13px;line-height:1.5}
  .cover{background:linear-gradient(135deg,var(--blue-900) 0%,var(--blue-800) 60%,#1e40af 100%);color:#fff;padding:56px 64px 48px;position:relative;overflow:hidden;page-break-after:always}
  .cover::before{content:'';position:absolute;right:-80px;top:-80px;width:400px;height:400px;border-radius:50%;background:rgba(255,255,255,0.04)}
  .cover-badge{display:inline-block;background:rgba(255,255,255,0.12);border:1px solid rgba(255,255,255,0.2);border-radius:20px;padding:4px 16px;font-size:11px;letter-spacing:0.08em;text-transform:uppercase;color:var(--blue-400);margin-bottom:24px}
  .cover h1{font-size:36px;font-weight:700;letter-spacing:-0.5px;line-height:1.1;margin-bottom:8px}
  .cover-sub{font-size:16px;color:rgba(255,255,255,0.65);margin-bottom:40px}
  .cover-meta{display:flex;gap:40px;border-top:1px solid rgba(255,255,255,0.15);padding-top:24px;font-size:12px;color:rgba(255,255,255,0.6)}
  .cover-meta strong{display:block;color:#fff;font-size:14px;margin-top:2px}
  .page{max-width:1100px;margin:0 auto;padding:40px 32px}
  .section{margin-bottom:40px}
  .section-title{font-size:10px;font-weight:700;letter-spacing:0.12em;text-transform:uppercase;color:var(--blue-700);border-left:3px solid var(--blue-700);padding-left:10px;margin-bottom:20px}
  .kpi-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:16px}
  .kpi-grid-2{grid-template-columns:repeat(2,1fr)}
  .kpi{background:#fff;border:1px solid var(--gray-200);border-radius:12px;padding:20px;box-shadow:0 1px 3px rgba(0,0,0,0.06);position:relative;overflow:hidden}
  .kpi::before{content:'';position:absolute;top:0;left:0;right:0;height:3px;border-radius:12px 12px 0 0}
  .kpi.blue::before{background:linear-gradient(90deg,#2563eb,#60a5fa)}
  .kpi.green::before{background:linear-gradient(90deg,#16a34a,#4ade80)}
  .kpi.red::before{background:linear-gradient(90deg,#dc2626,#f87171)}
  .kpi.amber::before{background:linear-gradient(90deg,#d97706,#fbbf24)}
  .kpi.gray::before{background:linear-gradient(90deg,#6b7280,#9ca3af)}
  .kpi-label{font-size:11px;color:var(--gray-500);font-weight:500;margin-bottom:6px}
  .kpi-value{font-size:24px;font-weight:700;letter-spacing:-0.5px;line-height:1;margin-bottom:4px}
  .kpi-sub{font-size:11px;color:var(--gray-500)}
  .kpi.blue .kpi-value{color:var(--blue-700)}.kpi.green .kpi-value{color:var(--green-600)}
  .kpi.red .kpi-value{color:var(--red-600)}.kpi.amber .kpi-value{color:#d97706}
  .chart-grid{display:grid;grid-template-columns:1fr 1fr;gap:20px}
  .chart-card{background:#fff;border:1px solid var(--gray-200);border-radius:12px;padding:20px 24px;box-shadow:0 1px 3px rgba(0,0,0,0.06)}
  .chart-card.full{grid-column:1/-1}
  .chart-title{font-size:13px;font-weight:600;color:var(--gray-900);margin-bottom:4px}
  .chart-subtitle{font-size:11px;color:var(--gray-500);margin-bottom:16px}
  canvas{max-width:100%}
  .progress-bar{height:7px;background:var(--gray-200);border-radius:4px;overflow:hidden;margin-top:8px}
  .progress-fill{height:100%;border-radius:4px;background:linear-gradient(90deg,#2563eb,#60a5fa);transition:width .6s ease}
  .progress-fill.green{background:linear-gradient(90deg,#16a34a,#4ade80)}
  .progress-fill.red{background:linear-gradient(90deg,#dc2626,#f87171)}
  .data-table{width:100%;border-collapse:collapse;font-size:12px}
  .data-table th{background:var(--blue-900);color:#fff;padding:10px 14px;text-align:left;font-size:10px;font-weight:600;letter-spacing:0.06em;text-transform:uppercase}
  .data-table th:first-child{border-radius:8px 0 0 0}.data-table th:last-child{border-radius:0 8px 0 0}
  .data-table td{padding:8px 14px;border-bottom:1px solid var(--gray-200);color:var(--gray-700)}
  .data-table tr:last-child td{border-bottom:none}
  .data-table tr:hover td{background:var(--gray-50)}
  .badge{display:inline-block;padding:2px 8px;border-radius:20px;font-size:10px;font-weight:600;letter-spacing:0.04em}
  .badge-blue{background:var(--blue-100);color:var(--blue-700)}
  .badge-red{background:#fee2e2;color:var(--red-600)}
  .badge-green{background:#dcfce7;color:var(--green-600)}
  .badge-amber{background:#fef3c7;color:#92400e}
  .badge-gray{background:var(--gray-200);color:var(--gray-700)}
  .milestone-list{display:flex;flex-direction:column;gap:10px}
  .milestone-item{display:flex;align-items:center;gap:12px;background:#fff;border:1px solid var(--gray-200);border-radius:8px;padding:12px 16px}
  .milestone-dot{width:10px;height:10px;border-radius:50%;flex-shrink:0}
  .milestone-dot.done{background:var(--green-600)}.milestone-dot.late{background:var(--red-600)}.milestone-dot.pending{background:var(--blue-600)}
  .report-footer{text-align:center;padding:20px;font-size:11px;color:var(--gray-500);border-top:1px solid var(--gray-200);margin-top:40px}
  .print-btn{position:fixed;bottom:24px;right:24px;background:var(--blue-700);color:#fff;border:none;border-radius:8px;padding:10px 20px;font-size:13px;font-weight:600;cursor:pointer;box-shadow:0 4px 12px rgba(37,99,235,0.35)}
  .print-btn:hover{background:#1d4ed8}
  @media print{body{background:#fff}.cover,.kpi::before,.data-table th,.progress-fill{-webkit-print-color-adjust:exact;print-color-adjust:exact}.section{page-break-inside:avoid}.print-btn{display:none}}
</style>`;

function escapeCsv(value: string): string {
  if (value.includes(',') || value.includes('"') || value.includes('\n')) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}
