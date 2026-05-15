'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus } from 'lucide-react';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import { useMemo, useState } from 'react';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from 'recharts';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { api } from '@/lib/api-client';

// Dynamically import Gantt to avoid SSR issues
const GanttChart = dynamic(() => import('./gantt-chart'), { ssr: false });

type Task = {
  id: string;
  code: string;
  name: string;
  kind: string;
  plannedStart: string;
  plannedEnd: string;
  durationDays: number;
  progress: string | number;
  parentId?: string | null;
  isCritical: boolean;
  totalFloat?: number | null;
  cpm?: {
    es: number;
    ef: number;
    ls: number;
    lf: number;
    totalFloat: number;
    freeFloat: number;
    isCritical: boolean;
  } | null;
};

type BudgetSummary = {
  directCost: string;
  totalCost: string;
};

const KIND_LABELS: Record<string, string> = {
  SUMMARY: 'Resumen',
  TASK: 'Tarea',
  MILESTONE: 'Hito',
};

// ─── EV Panel ────────────────────────────────────────────────
function EVPanel({ tasks, summary }: { tasks: Task[]; summary: BudgetSummary | undefined }) {
  const totalBudget = Number(summary?.directCost ?? '0');

  const progressTasks = tasks.filter((t) => t.kind !== 'SUMMARY');
  const avgProgress =
    progressTasks.length > 0
      ? progressTasks.reduce((s, t) => s + Number(t.progress), 0) / progressTasks.length
      : 0;

  const BCWP = totalBudget * avgProgress;

  const now = Date.now();
  const starts = tasks
    .map((t) => new Date(t.plannedStart).getTime())
    .filter((v) => !isNaN(v));
  const ends = tasks
    .map((t) => new Date(t.plannedEnd).getTime())
    .filter((v) => !isNaN(v));
  const projectStart = starts.length > 0 ? Math.min(...starts) : now;
  const projectEnd = ends.length > 0 ? Math.max(...ends) : now;
  const totalDuration = projectEnd - projectStart;
  const elapsed = Math.max(0, Math.min(now - projectStart, totalDuration));
  const timeProgress = totalDuration > 0 ? elapsed / totalDuration : 0;
  const BCWS = totalBudget * timeProgress;

  const CPI = BCWS > 0 ? BCWP / BCWS : null;
  const SPI = BCWS > 0 ? BCWP / BCWS : null;
  const EAC = CPI && CPI > 0 ? totalBudget / CPI : totalBudget;

  const noData = tasks.length === 0 || totalBudget === 0;

  // S-Curve data
  const sCurveData = useMemo(() => {
    if (tasks.length === 0 || totalBudget === 0 || totalDuration <= 0) return [];
    const months: Array<{ month: string; Planificado: number; Ejecutado: number }> = [];
    const current = new Date(
      new Date(projectStart).getFullYear(),
      new Date(projectStart).getMonth(),
      1,
    );
    const endDate = new Date(projectEnd);
    while (current <= endDate) {
      const monthEnd = new Date(
        current.getFullYear(),
        current.getMonth() + 1,
        0,
      ).getTime();
      const planPct = Math.min(100, Math.round(
        (Math.min(monthEnd, projectEnd) - projectStart) / totalDuration * 100,
      ));
      const execPct = Math.min(planPct, Math.round(avgProgress * 100));
      months.push({
        month: current.toLocaleDateString('es-CO', { month: 'short', year: '2-digit' }),
        Planificado: planPct,
        Ejecutado: execPct,
      });
      current.setMonth(current.getMonth() + 1);
    }
    return months;
  }, [tasks, totalBudget, totalDuration, projectStart, projectEnd, avgProgress]);

  if (noData) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Valor Ganado (Earned Value)</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Sin datos suficientes. Agrega tareas y configura el presupuesto para ver el análisis EV.
          </p>
        </CardContent>
      </Card>
    );
  }

  const kpis = [
    {
      label: 'Avance físico',
      value: `${(avgProgress * 100).toFixed(1)}%`,
      color: avgProgress >= timeProgress ? 'text-green-700' : 'text-red-700',
      subtitle: 'Progreso real',
    },
    {
      label: 'Avance tiempo',
      value: `${(timeProgress * 100).toFixed(1)}%`,
      color: 'text-blue-700',
      subtitle: 'Tiempo transcurrido',
    },
    {
      label: 'CPI',
      value: CPI != null ? CPI.toFixed(2) : '—',
      color: CPI != null && CPI >= 1 ? 'text-green-700' : 'text-red-700',
      subtitle: 'Índice costo',
    },
    {
      label: 'SPI',
      value: SPI != null ? SPI.toFixed(2) : '—',
      color: SPI != null && SPI >= 1 ? 'text-green-700' : 'text-red-700',
      subtitle: 'Índice cronograma',
    },
  ];

  // Progress bars
  const bcwpPct = totalBudget > 0 ? Math.min(100, (BCWP / totalBudget) * 100) : 0;
  const bcwsPct = totalBudget > 0 ? Math.min(100, (BCWS / totalBudget) * 100) : 0;

  return (
    <Card>
      <CardHeader>
        <div>
          <CardTitle className="text-base">Valor Ganado (Earned Value)</CardTitle>
          <p className="text-xs text-muted-foreground mt-0.5">
            BCWP vs BCWS — presupuesto base: costo directo del presupuesto
          </p>
        </div>
      </CardHeader>
      <CardContent className="space-y-5">
        {/* KPI grid */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {kpis.map((k) => (
            <div key={k.label} className="rounded-lg border p-3 bg-muted/20">
              <p className="text-xs text-muted-foreground">{k.label}</p>
              <p className={`mt-1 text-2xl font-bold ${k.color}`}>{k.value}</p>
              <p className="text-xs text-muted-foreground mt-0.5">{k.subtitle}</p>
            </div>
          ))}
        </div>

        {/* Progress bars */}
        <div className="space-y-3">
          <div>
            <div className="flex justify-between text-xs text-muted-foreground mb-1">
              <span>BCWP (Trabajo ejecutado)</span>
              <span>{bcwpPct.toFixed(1)}%</span>
            </div>
            <div className="h-2 rounded-full bg-muted overflow-hidden">
              <div
                className="h-full rounded-full bg-green-500 transition-all"
                style={{ width: `${bcwpPct}%` }}
              />
            </div>
          </div>
          <div>
            <div className="flex justify-between text-xs text-muted-foreground mb-1">
              <span>BCWS (Trabajo planificado)</span>
              <span>{bcwsPct.toFixed(1)}%</span>
            </div>
            <div className="h-2 rounded-full bg-muted overflow-hidden">
              <div
                className="h-full rounded-full bg-blue-500 transition-all"
                style={{ width: `${bcwsPct}%` }}
              />
            </div>
          </div>
          <div className="flex justify-between text-xs text-muted-foreground pt-1">
            <span>EAC estimado:</span>
            <span className={`font-medium ${EAC > totalBudget ? 'text-red-600' : 'text-green-700'}`}>
              {new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(EAC)}
            </span>
          </div>
        </div>

        {/* S-Curve mini chart */}
        {sCurveData.length > 1 && (
          <div>
            <p className="text-xs font-medium text-muted-foreground mb-2">Curva S — % acumulado del presupuesto</p>
            <ResponsiveContainer width="100%" height={160}>
              <LineChart data={sCurveData} margin={{ top: 4, right: 8, left: 0, bottom: 4 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis dataKey="month" tick={{ fontSize: 10 }} tickLine={false} />
                <YAxis
                  domain={[0, 100]}
                  tickFormatter={(v) => `${v}%`}
                  tick={{ fontSize: 10 }}
                  tickLine={false}
                  axisLine={false}
                  width={36}
                />
                <Tooltip
                  formatter={(value) => [`${Number(value ?? 0)}%`]}
                  contentStyle={{ fontSize: 11 }}
                />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Line
                  type="monotone"
                  dataKey="Planificado"
                  stroke="#3b82f6"
                  strokeWidth={2}
                  dot={false}
                />
                <Line
                  type="monotone"
                  dataKey="Ejecutado"
                  stroke="#16a34a"
                  strokeWidth={2}
                  dot={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ─── Main Page ────────────────────────────────────────────────
export default function SchedulePage({ params }: { params: { id: string } }) {
  const { id: projectId } = params;
  const qc = useQueryClient();
  const [showGantt, setShowGantt] = useState(true);
  const [cpmRunning, setCpmRunning] = useState(false);

  const { data, isLoading, error } = useQuery({
    queryKey: ['tasks', projectId],
    queryFn: () => api.listTasks(projectId),
  });

  const { data: budgetSummaryData } = useQuery({
    queryKey: ['budget-summary', projectId],
    queryFn: () => api.getBudgetSummary(projectId),
    // Don't block the page if this fails
    retry: 1,
  });

  const tasks = (data ?? []) as unknown as Task[];
  const budgetSummary = budgetSummaryData as unknown as BudgetSummary | undefined;

  const cpmMutation = useMutation({
    mutationFn: () => api.computeCPM(projectId),
    onMutate: () => setCpmRunning(true),
    onSettled: () => setCpmRunning(false),
    onSuccess: (result) => {
      qc.setQueryData(['tasks', projectId], result);
    },
  });

  const progressMutation = useMutation({
    mutationFn: ({ taskId, progress }: { taskId: string; progress: number }) =>
      api.updateTaskProgress(projectId, taskId, progress),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['tasks', projectId] }),
  });

  // Build stats
  const stats = useMemo(() => {
    const total = tasks.length;
    const critical = tasks.filter((t) => t.isCritical).length;
    const done = tasks.filter((t) => Number(t.progress) >= 1).length;
    const avgProgress =
      total > 0
        ? Math.round(tasks.reduce((s, t) => s + Number(t.progress) * 100, 0) / total)
        : 0;
    return { total, critical, done, avgProgress };
  }, [tasks]);

  return (
    <div className="space-y-6">
      <header className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Cronograma</h1>
          <p className="text-muted-foreground">WBS, Gantt y ruta crítica CPM.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={cpmRunning || tasks.length === 0}
            onClick={() => cpmMutation.mutate()}
          >
            {cpmRunning ? 'Calculando…' : '⚡ Calcular CPM'}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowGantt((v) => !v)}
          >
            {showGantt ? 'Ver tabla' : 'Ver Gantt'}
          </Button>
          <Button asChild>
            <Link href={`/dashboard/projects/${projectId}/schedule/tasks/new`}>
              <Plus className="mr-1 h-4 w-4" />
              Nueva tarea
            </Link>
          </Button>
        </div>
      </header>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { label: 'Total tareas', value: stats.total },
          { label: 'En ruta crítica', value: stats.critical, highlight: stats.critical > 0 },
          { label: 'Completadas', value: stats.done },
          { label: 'Avance promedio', value: `${stats.avgProgress}%` },
        ].map(({ label, value, highlight }) => (
          <Card key={label}>
            <CardContent className="pt-4">
              <p className="text-xs text-muted-foreground">{label}</p>
              <p
                className={`mt-1 text-2xl font-bold ${highlight ? 'text-destructive' : ''}`}
              >
                {value}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Earned Value Panel */}
      {tasks.length > 0 && (
        <EVPanel tasks={tasks} summary={budgetSummary} />
      )}

      {/* Content */}
      {isLoading && <p className="text-sm">Cargando cronograma…</p>}
      {error && (
        <p className="text-sm text-destructive">
          Error al cargar el cronograma. Verifica que la API esté disponible.
        </p>
      )}

      {!isLoading && !error && tasks.length === 0 && (
        <Card>
          <CardContent className="py-8 text-center text-sm text-muted-foreground">
            No hay tareas todavía. Crea la primera tarea para comenzar el cronograma.
          </CardContent>
        </Card>
      )}

      {tasks.length > 0 && showGantt && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Diagrama Gantt</CardTitle>
          </CardHeader>
          <CardContent className="overflow-x-auto">
            <GanttChart tasks={tasks} projectId={projectId} />
          </CardContent>
        </Card>
      )}

      {tasks.length > 0 && !showGantt && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Tabla de tareas (WBS)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="border-b">
                  <tr className="text-left text-xs text-muted-foreground">
                    <th className="py-2 pr-3 font-medium">Código</th>
                    <th className="py-2 pr-3 font-medium">Nombre</th>
                    <th className="py-2 pr-3 font-medium">Tipo</th>
                    <th className="py-2 pr-3 font-medium">Duración</th>
                    <th className="py-2 pr-3 font-medium">Inicio planif.</th>
                    <th className="py-2 pr-3 font-medium">Fin planif.</th>
                    <th className="py-2 pr-3 text-right font-medium">Avance %</th>
                    <th className="py-2 pr-3 font-medium">Float</th>
                    <th className="py-2 font-medium">Crítica</th>
                  </tr>
                </thead>
                <tbody>
                  {tasks.map((t) => (
                    <tr
                      key={t.id}
                      className={`border-b last:border-0 hover:bg-muted/20 ${
                        t.isCritical ? 'bg-red-50/40' : ''
                      }`}
                    >
                      <td className="py-2 pr-3 font-mono text-xs">{t.code}</td>
                      <td className="py-2 pr-3 font-medium">{t.name}</td>
                      <td className="py-2 pr-3 text-xs text-muted-foreground">
                        {KIND_LABELS[t.kind] ?? t.kind}
                      </td>
                      <td className="py-2 pr-3">{t.durationDays}d</td>
                      <td className="py-2 pr-3 text-xs">
                        {new Date(t.plannedStart).toLocaleDateString('es-CO')}
                      </td>
                      <td className="py-2 pr-3 text-xs">
                        {new Date(t.plannedEnd).toLocaleDateString('es-CO')}
                      </td>
                      <td className="py-2 pr-3 text-right">
                        <input
                          type="number"
                          min={0}
                          max={100}
                          className="w-16 rounded border px-1 text-right text-xs"
                          defaultValue={Math.round(Number(t.progress) * 100)}
                          onBlur={(e) =>
                            progressMutation.mutate({
                              taskId: t.id,
                              progress: Number(e.target.value) / 100,
                            })
                          }
                        />
                      </td>
                      <td className="py-2 pr-3 text-xs text-muted-foreground">
                        {t.totalFloat != null ? `${t.totalFloat}d` : '—'}
                      </td>
                      <td className="py-2">
                        {t.isCritical ? (
                          <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700">
                            Si
                          </span>
                        ) : (
                          <span className="text-xs text-muted-foreground">No</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
