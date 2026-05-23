'use client';

import { useQuery } from '@tanstack/react-query';
import {
  Download,
  ExternalLink,
  FileSpreadsheet,
  FileText,
  Loader2,
  Monitor,
  TrendingUp,
} from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { DrivePanel } from '@/components/drive-panel';
import { api } from '@/lib/api-client';

// ─── Helper ──────────────────────────────────────────────────────────────────

async function triggerDownload(res: Response, filename: string) {
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error((body as { message?: string }).message ?? res.statusText);
  }
  const blob = await res.blob();
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = filename;
  link.click();
  URL.revokeObjectURL(link.href);
}

function fmtCOP(v?: string) {
  const n = Number(v);
  if (!v || isNaN(n)) return '—';
  if (Math.abs(n) >= 1_000_000_000) return `$${(n / 1_000_000_000).toFixed(1)}B`;
  if (Math.abs(n) >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  return `$${n.toLocaleString('es-CO')}`;
}

// ─── Types ────────────────────────────────────────────────────────────────────

type Summary = {
  presupuesto?: {
    directCost: string;
    totalBudget: string;
    executedCost: string;
    executedPct: string;
  };
  ventas?: {
    unitsSold: number;
    totalUnits: number;
    totalSalesValue: string;
    margenPct: string;
    unitsAvailable?: number;
  };
  cronograma?: { totalTasks: number; avgProgress: number; criticalTasks: number };
  caja?: { saldoNeto: string; totalIngresos: string; totalEgresos: string };
};

// ─── Sub-components ───────────────────────────────────────────────────────────

function StatRow({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="flex items-center justify-between py-2 border-b last:border-0 border-border/50">
      <span className="text-sm text-muted-foreground">{label}</span>
      <div className="text-right">
        <span className="text-sm font-semibold">{value}</span>
        {sub && <div className="text-xs text-muted-foreground">{sub}</div>}
      </div>
    </div>
  );
}

function ProgressBar({
  value,
  color = 'blue',
}: {
  value: number;
  color?: 'blue' | 'green' | 'red' | 'amber';
}) {
  const colors = {
    blue: 'bg-blue-600',
    green: 'bg-green-600',
    red: 'bg-red-500',
    amber: 'bg-amber-500',
  };
  return (
    <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
      <div
        className={`h-full rounded-full transition-all ${colors[color]}`}
        style={{ width: `${Math.min(100, value)}%` }}
      />
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function ReportsPage({ params }: { params: { id: string } }) {
  const { id } = params;
  const [loading, setLoading] = useState<Record<string, boolean>>({});
  const [htmlLoading, setHtmlLoading] = useState(false);

  const { data } = useQuery({
    queryKey: ['dashboard', id],
    queryFn: () => api.getDashboardSummary(id),
  });

  const summary = data as unknown as { kpis: Summary } | undefined;
  const kpis = summary?.kpis;

  const busy = (key: string, val: boolean) => setLoading((p) => ({ ...p, [key]: val }));

  const downloadCsv = async (type: 'budget' | 'cashflow') => {
    busy(type, true);
    try {
      const res =
        type === 'budget' ? await api.exportBudgetCsv(id) : await api.exportCashflowCsv(id);
      const date = new Date().toISOString().slice(0, 10);
      await triggerDownload(res, `${type === 'budget' ? 'presupuesto' : 'flujo-caja'}-${date}.csv`);
      toast.success('Archivo descargado');
    } catch (e) {
      toast.error(`Error: ${(e as Error).message}`);
    } finally {
      busy(type, false);
    }
  };

  const openHtmlReport = async () => {
    setHtmlLoading(true);
    try {
      const res = await api.exportHtmlReport(id);
      if (!res.ok) throw new Error(res.statusText);
      const html = await res.text();
      const blob = new Blob([html], { type: 'text/html' });
      const url = URL.createObjectURL(blob);
      window.open(url, '_blank');
      // Revoke after delay so the tab has time to load
      setTimeout(() => URL.revokeObjectURL(url), 10_000);
      toast.success('Presentación abierta en nueva pestaña');
    } catch (e) {
      toast.error(`Error al generar presentación: ${(e as Error).message}`);
    } finally {
      setHtmlLoading(false);
    }
  };

  const executedPct = Number(kpis?.presupuesto?.executedPct ?? 0);
  const margenPct = Number(kpis?.ventas?.margenPct ?? 0);
  const avgProgress = Number(kpis?.cronograma?.avgProgress ?? 0);
  const saldoNeto = Number(kpis?.caja?.saldoNeto ?? 0);
  const unitsSold = kpis?.ventas?.unitsSold ?? 0;
  const totalUnits = kpis?.ventas?.totalUnits ?? 0;
  const salesPct = totalUnits > 0 ? Math.round((unitsSold / totalUnits) * 100) : 0;

  return (
    <div className="space-y-8">
      {/* ── Header ── */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Reportes y Presentación</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Exporta datos del proyecto o genera una presentación ejecutiva HTML con gráficas
          </p>
        </div>

        {/* Presentación HTML — botón principal */}
        <Button
          size="lg"
          onClick={openHtmlReport}
          disabled={htmlLoading}
          className="gap-2 bg-gradient-to-r from-blue-700 to-blue-500 hover:from-blue-800 hover:to-blue-600 text-white shadow-md shadow-blue-200"
        >
          {htmlLoading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Monitor className="h-4 w-4" />
          )}
          Ver presentación ejecutiva
          <ExternalLink className="h-3.5 w-3.5 opacity-70" />
        </Button>
      </div>

      {/* ── Preview KPIs ── */}
      {kpis && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Presupuesto */}
          <Card className="border-0 shadow-sm bg-gradient-to-br from-blue-950 to-blue-800 text-white">
            <CardContent className="p-5">
              <p className="text-xs text-blue-200 font-medium uppercase tracking-wide mb-1">
                Presupuesto CD
              </p>
              <p className="text-2xl font-bold">{fmtCOP(kpis.presupuesto?.directCost)}</p>
              <div className="mt-3 space-y-1">
                <div className="flex justify-between text-xs text-blue-200">
                  <span>Ejecución</span>
                  <span>{kpis.presupuesto?.executedPct ?? 0}%</span>
                </div>
                <ProgressBar
                  value={executedPct}
                  color={executedPct > 90 ? 'red' : executedPct > 70 ? 'amber' : 'green'}
                />
              </div>
            </CardContent>
          </Card>

          {/* Margen */}
          <Card
            className={`border-0 shadow-sm text-white bg-gradient-to-br ${margenPct >= 15 ? 'from-green-800 to-green-600' : margenPct >= 8 ? 'from-amber-700 to-amber-500' : 'from-red-800 to-red-600'}`}
          >
            <CardContent className="p-5">
              <p className="text-xs text-white/70 font-medium uppercase tracking-wide mb-1">
                Margen bruto
              </p>
              <p className="text-2xl font-bold">{margenPct.toFixed(1)}%</p>
              <p className="text-xs text-white/70 mt-2">
                {fmtCOP(kpis.ventas?.totalSalesValue)} en ventas
              </p>
            </CardContent>
          </Card>

          {/* Avance */}
          <Card className="border-0 shadow-sm bg-gradient-to-br from-indigo-800 to-indigo-600 text-white">
            <CardContent className="p-5">
              <p className="text-xs text-white/70 font-medium uppercase tracking-wide mb-1">
                Avance obra
              </p>
              <p className="text-2xl font-bold">{avgProgress}%</p>
              <div className="mt-3 space-y-1">
                <ProgressBar value={avgProgress} color={avgProgress >= 80 ? 'green' : 'blue'} />
              </div>
            </CardContent>
          </Card>

          {/* Saldo */}
          <Card
            className={`border-0 shadow-sm text-white bg-gradient-to-br ${saldoNeto >= 0 ? 'from-teal-800 to-teal-600' : 'from-red-800 to-red-600'}`}
          >
            <CardContent className="p-5">
              <p className="text-xs text-white/70 font-medium uppercase tracking-wide mb-1">
                Saldo de caja
              </p>
              <p className="text-2xl font-bold">{fmtCOP(kpis.caja?.saldoNeto)}</p>
              <p className="text-xs text-white/70 mt-2">
                Ing: {fmtCOP(kpis.caja?.totalIngresos)} · Eg: {fmtCOP(kpis.caja?.totalEgresos)}
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* ── Detalle en cards ── */}
      {kpis && (
        <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-4">
          {/* Presupuesto detail */}
          <Card>
            <CardHeader className="pb-2 pt-4 px-5">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <FileSpreadsheet className="h-4 w-4 text-blue-600" /> Presupuesto
              </CardTitle>
            </CardHeader>
            <CardContent className="px-5 pb-4">
              <StatRow label="Costo directo" value={fmtCOP(kpis.presupuesto?.directCost)} />
              <StatRow label="Total con AIU" value={fmtCOP(kpis.presupuesto?.totalBudget)} />
              <StatRow
                label="Ejecutado"
                value={fmtCOP(kpis.presupuesto?.executedCost)}
                sub={`${executedPct}%`}
              />
              <div className="mt-2">
                <ProgressBar value={executedPct} color={executedPct > 90 ? 'red' : 'blue'} />
              </div>
            </CardContent>
          </Card>

          {/* Ventas detail */}
          <Card>
            <CardHeader className="pb-2 pt-4 px-5">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-green-600" /> Ventas
              </CardTitle>
            </CardHeader>
            <CardContent className="px-5 pb-4">
              <StatRow label="Realizadas" value={fmtCOP(kpis.ventas?.totalSalesValue)} />
              <StatRow
                label="Unidades vendidas"
                value={`${unitsSold} / ${totalUnits}`}
                sub={`${salesPct}%`}
              />
              <StatRow label="Disponibles" value={String(kpis.ventas?.unitsAvailable ?? 0)} />
              <div className="mt-2">
                <ProgressBar value={salesPct} color="green" />
              </div>
            </CardContent>
          </Card>

          {/* Cronograma detail */}
          <Card>
            <CardHeader className="pb-2 pt-4 px-5">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <FileText className="h-4 w-4 text-indigo-600" /> Cronograma
              </CardTitle>
            </CardHeader>
            <CardContent className="px-5 pb-4">
              <StatRow label="Total tareas" value={String(kpis.cronograma?.totalTasks ?? 0)} />
              <StatRow
                label="Tareas críticas"
                value={String(kpis.cronograma?.criticalTasks ?? 0)}
              />
              <StatRow label="Avance promedio" value={`${avgProgress}%`} />
              <div className="mt-2">
                <ProgressBar value={avgProgress} color={avgProgress >= 80 ? 'green' : 'blue'} />
              </div>
            </CardContent>
          </Card>

          {/* Caja detail */}
          <Card>
            <CardHeader className="pb-2 pt-4 px-5">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-teal-600" /> Flujo de caja
              </CardTitle>
            </CardHeader>
            <CardContent className="px-5 pb-4">
              <StatRow label="Total ingresos" value={fmtCOP(kpis.caja?.totalIngresos)} />
              <StatRow label="Total egresos" value={fmtCOP(kpis.caja?.totalEgresos)} />
              <StatRow
                label="Saldo neto"
                value={fmtCOP(kpis.caja?.saldoNeto)}
                sub={saldoNeto >= 0 ? '✓ Positivo' : '⚠ Negativo'}
              />
            </CardContent>
          </Card>
        </div>
      )}

      {/* ── Exportaciones CSV ── */}
      <div>
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground mb-4">
          Exportaciones de datos
        </h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {/* Presupuesto CSV */}
          <Card className="border hover:shadow-md transition-shadow">
            <CardContent className="p-5 flex gap-4">
              <div className="h-11 w-11 rounded-lg bg-green-50 flex items-center justify-center shrink-0">
                <FileSpreadsheet className="h-5 w-5 text-green-700" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-sm">Presupuesto detallado</p>
                <p className="text-xs text-muted-foreground mt-0.5 mb-3">
                  Capítulos, ítems, cantidades y costos · Compatible Excel
                </p>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => downloadCsv('budget')}
                  disabled={loading['budget']}
                  className="w-full border-green-200 text-green-700 hover:bg-green-50"
                >
                  {loading['budget'] ? (
                    <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                  ) : (
                    <Download className="h-3.5 w-3.5 mr-1.5" />
                  )}
                  Descargar CSV
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Flujo de caja CSV */}
          <Card className="border hover:shadow-md transition-shadow">
            <CardContent className="p-5 flex gap-4">
              <div className="h-11 w-11 rounded-lg bg-blue-50 flex items-center justify-center shrink-0">
                <TrendingUp className="h-5 w-5 text-blue-700" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-sm">Flujo de caja</p>
                <p className="text-xs text-muted-foreground mt-0.5 mb-3">
                  Ingresos y egresos cronológicos con categorías
                </p>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => downloadCsv('cashflow')}
                  disabled={loading['cashflow']}
                  className="w-full border-blue-200 text-blue-700 hover:bg-blue-50"
                >
                  {loading['cashflow'] ? (
                    <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                  ) : (
                    <Download className="h-3.5 w-3.5 mr-1.5" />
                  )}
                  Descargar CSV
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Presentación HTML */}
          <Card className="border hover:shadow-md transition-shadow bg-gradient-to-br from-blue-50 to-indigo-50 border-blue-200">
            <CardContent className="p-5 flex gap-4">
              <div className="h-11 w-11 rounded-lg bg-blue-100 flex items-center justify-center shrink-0">
                <Monitor className="h-5 w-5 text-blue-700" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-sm text-blue-900">Presentación HTML</p>
                <p className="text-xs text-blue-700/70 mt-0.5 mb-3">
                  Reporte ejecutivo con gráficas interactivas · Imprimible como PDF
                </p>
                <Button
                  size="sm"
                  onClick={openHtmlReport}
                  disabled={htmlLoading}
                  className="w-full bg-blue-700 hover:bg-blue-800 text-white"
                >
                  {htmlLoading ? (
                    <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                  ) : (
                    <ExternalLink className="h-3.5 w-3.5 mr-1.5" />
                  )}
                  Abrir en nueva pestaña
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* ── Drive: Import / Export ── */}
      <div>
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground mb-4">
          Importar / Exportar (Google Drive compatible)
        </h2>
        <DrivePanel projectId={id} />
      </div>

      {/* ── Info ── */}
      <Card className="bg-slate-50 border-slate-200">
        <CardContent className="p-4 flex gap-3">
          <FileText className="h-4 w-4 text-slate-500 shrink-0 mt-0.5" />
          <div className="text-xs text-slate-600 space-y-1">
            <p className="font-semibold text-slate-800">Sobre los reportes</p>
            <p>
              • <strong>CSV:</strong> incluye BOM UTF-8 para compatibilidad con Excel en español.
              Valores en COP.
            </p>
            <p>
              • <strong>Presentación HTML:</strong> se abre en nueva pestaña con gráficas
              interactivas (Chart.js). Usa{' '}
              <kbd className="bg-white border px-1 rounded text-xs">Ctrl+P</kbd> para imprimir o
              guardar como PDF.
            </p>
            <p>• Los reportes reflejan el estado actual del proyecto al momento de generarlos.</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
