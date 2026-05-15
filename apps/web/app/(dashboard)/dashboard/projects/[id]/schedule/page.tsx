'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus } from 'lucide-react';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import { use, useMemo, useState } from 'react';

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

const KIND_LABELS: Record<string, string> = {
  SUMMARY: 'Resumen',
  TASK: 'Tarea',
  MILESTONE: 'Hito',
};

export default function SchedulePage({ params }: { params: { id: string } }) {
  const { id: projectId } = params;
  const qc = useQueryClient();
  const [showGantt, setShowGantt] = useState(true);
  const [cpmRunning, setCpmRunning] = useState(false);

  const { data, isLoading, error } = useQuery({
    queryKey: ['tasks', projectId],
    queryFn: () => api.listTasks(projectId),
  });

  const tasks = (data ?? []) as unknown as Task[];

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
    // progress stored as fraction 0.0–1.0 in DB
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
                              // store as fraction
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
                            Sí
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
