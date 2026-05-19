'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  AlertTriangle, BarChart2, Calendar, CheckCircle2, Clock, Download,
  Flag, GitBranch, Layers, List, Plus, RefreshCw, Save, Trash2, Zap,
} from 'lucide-react';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import { useMemo, useState } from 'react';
import { toast } from 'sonner';
import {
  AreaChart, Area, ResponsiveContainer,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend,
} from 'recharts';

import { ModuleHeader } from '@/components/module-header';
import { ReportHtmlButton } from '@/components/report-html-button';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { api } from '@/lib/api-client';

const GanttChart = dynamic(() => import('./gantt-chart'), { ssr: false });

// ── Types ──────────────────────────────────────────────────────────────────────
type Task = {
  id: string; code: string; name: string;
  kind: 'SUMMARY' | 'TASK' | 'MILESTONE';
  plannedStart: string; plannedEnd: string;
  actualStart?: string | null; actualEnd?: string | null;
  durationDays: number; progress: string | number;
  parentId?: string | null; isCritical: boolean;
  totalFloat?: number | null;
  predecessors?: Array<{ predecessorId: string; type: string; lagDays: number }>;
};

type Milestone = {
  id: string; code: string; name: string;
  plannedDate: string; actualDate?: string | null; isContractual: boolean;
};

type Baseline = { id: string; version: number; label: string; frozenAt: string };

// ── Formatters ─────────────────────────────────────────────────────────────────
const fmtDate = (d?: string | null) =>
  d ? new Date(d).toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';
const fmtPct = (p: string | number) => `${Math.round(Number(p) * 100)}%`;

// ── KPI Card ──────────────────────────────────────────────────────────────────
function KpiCard({ label, value, subtitle, color }: {
  label: string; value: string; subtitle?: string; color?: string;
}) {
  return (
    <div className="rounded-lg border bg-card p-4">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={`mt-1 text-2xl font-bold ${color ?? ''}`}>{value}</p>
      {subtitle && <p className="text-xs text-muted-foreground mt-0.5">{subtitle}</p>}
    </div>
  );
}

// ── EVM Panel ─────────────────────────────────────────────────────────────────
function EvmPanel({ tasks }: { tasks: Task[] }) {
  const progressTasks = tasks.filter((t) => t.kind === 'TASK');
  const avgProg = progressTasks.length > 0
    ? progressTasks.reduce((s, t) => s + Number(t.progress), 0) / progressTasks.length : 0;

  const starts = tasks.map((t) => new Date(t.plannedStart).getTime()).filter(isFinite);
  const ends   = tasks.map((t) => new Date(t.plannedEnd).getTime()).filter(isFinite);
  const projStart = starts.length ? Math.min(...starts) : Date.now();
  const projEnd   = ends.length   ? Math.max(...ends)   : Date.now();
  const totalDur  = projEnd - projStart || 1;
  const elapsed   = Math.max(0, Math.min(Date.now() - projStart, totalDur));
  const timePct   = elapsed / totalDur;

  const SPI = timePct > 0 ? avgProg / timePct : null;
  const spiColor = SPI == null ? '' : SPI >= 1 ? 'text-green-700' : SPI >= 0.85 ? 'text-amber-600' : 'text-red-700';
  const critCount = tasks.filter((t) => t.isCritical).length;
  const doneCount = tasks.filter((t) => Number(t.progress) >= 1).length;

  const sCurve = useMemo(() => {
    if (!tasks.length || totalDur <= 0) return [];
    const months: { mes: string; Planificado: number; Real: number }[] = [];
    const cur = new Date(new Date(projStart).getFullYear(), new Date(projStart).getMonth(), 1);
    while (cur.getTime() <= projEnd) {
      const monthEnd = new Date(cur.getFullYear(), cur.getMonth() + 1, 0).getTime();
      const plan = Math.min(100, Math.round(((Math.min(monthEnd, projEnd) - projStart) / totalDur) * 100));
      const real = Math.min(plan, Math.round(avgProg * 100));
      months.push({ mes: cur.toLocaleDateString('es-CO', { month: 'short', year: '2-digit' }), Planificado: plan, Real: real });
      cur.setMonth(cur.getMonth() + 1);
    }
    return months;
  }, [tasks, avgProg, projStart, projEnd, totalDur]);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <KpiCard label="Avance físico" value={`${(avgProg * 100).toFixed(1)}%`}
          color={avgProg >= timePct ? 'text-green-700' : 'text-red-700'} subtitle="% real ejecutado" />
        <KpiCard label="Avance temporal" value={`${(timePct * 100).toFixed(1)}%`} color="text-blue-700" subtitle="tiempo transcurrido" />
        <KpiCard label="SPI" value={SPI != null ? SPI.toFixed(2) : '—'} color={spiColor} subtitle="índice cronograma" />
        <KpiCard label="En ruta crítica" value={String(critCount)} color={critCount > 0 ? 'text-red-700' : ''}
          subtitle={`${doneCount} terminadas`} />
      </div>

      {sCurve.length > 1 && (
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">Curva S — Avance acumulado (%)</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={220}>
              <AreaChart data={sCurve} margin={{ top: 4, right: 8, left: 0, bottom: 4 }}>
                <defs>
                  <linearGradient id="planGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="realGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#16a34a" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#16a34a" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis dataKey="mes" tick={{ fontSize: 10 }} tickLine={false} />
                <YAxis domain={[0, 100]} tickFormatter={(v) => `${v}%`} tick={{ fontSize: 10 }}
                  tickLine={false} axisLine={false} width={36} />
                <Tooltip formatter={(v) => [`${Number(v ?? 0)}%`]} contentStyle={{ fontSize: 11 }} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Area type="monotone" dataKey="Planificado" stroke="#3b82f6" fill="url(#planGrad)" strokeWidth={2} dot={false} />
                <Area type="monotone" dataKey="Real" stroke="#16a34a" fill="url(#realGrad)" strokeWidth={2} dot={false} />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// ── Milestones Panel ──────────────────────────────────────────────────────────
function MilestonesPanel({ projectId }: { projectId: string }) {
  const qc = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ code: '', name: '', plannedDate: '', isContractual: false });

  const { data } = useQuery({
    queryKey: ['milestones', projectId],
    queryFn: () => api.listMilestones(projectId),
  });
  const milestones = (data ?? []) as unknown as Milestone[];

  const createMut = useMutation({
    mutationFn: () => api.createMilestone(projectId, form as Parameters<typeof api.createMilestone>[1]),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['milestones', projectId] });
      setShowForm(false);
      setForm({ code: '', name: '', plannedDate: '', isContractual: false });
      toast.success('Hito creado');
    },
    onError: () => toast.error('Error al crear hito'),
  });

  const completeMut = useMutation({
    mutationFn: ({ id, date }: { id: string; date: string }) =>
      api.updateMilestone(projectId, id, { actualDate: date }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['milestones', projectId] }); toast.success('Hito completado'); },
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => api.deleteMilestone(projectId, id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['milestones', projectId] }); toast.success('Hito eliminado'); },
  });

  const today = new Date().toISOString().split('T')[0]!;
  const overdue = milestones.filter((m) => !m.actualDate && m.plannedDate < today);
  const done    = milestones.filter((m) => m.actualDate);
  const pending = milestones.filter((m) => !m.actualDate && m.plannedDate >= today);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex gap-3 text-xs">
          <span className="text-green-700 font-medium">{done.length} completados</span>
          <span className="text-blue-700 font-medium">{pending.length} pendientes</span>
          {overdue.length > 0 && <span className="text-red-700 font-medium">{overdue.length} vencidos</span>}
        </div>
        <Button size="sm" onClick={() => setShowForm(true)}><Plus className="mr-1 h-3 w-3" />Nuevo hito</Button>
      </div>

      {milestones.length === 0 ? (
        <div className="py-8 text-center text-sm text-muted-foreground">
          Sin hitos. Crea uno para marcar fechas clave del proyecto.
        </div>
      ) : (
        <div className="space-y-2">
          {milestones.map((m) => {
            const isOverdue = !m.actualDate && m.plannedDate < today;
            const isDone = !!m.actualDate;
            return (
              <div key={m.id} className={`flex items-center gap-3 rounded-lg border p-3 ${
                isDone ? 'border-green-200 bg-green-50/40' :
                isOverdue ? 'border-red-200 bg-red-50/40' : 'border-border bg-card'
              }`}>
                <div className={`flex-shrink-0 ${isDone ? 'text-green-600' : isOverdue ? 'text-red-600' : 'text-amber-500'}`}>
                  {isDone ? <CheckCircle2 className="h-5 w-5" /> : isOverdue ? <AlertTriangle className="h-5 w-5" /> : <Flag className="h-5 w-5" />}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium">{m.code} — {m.name}</p>
                  <p className="text-xs text-muted-foreground">
                    Planif: {fmtDate(m.plannedDate)}
                    {m.actualDate && ` · Real: ${fmtDate(m.actualDate)}`}
                    {m.isContractual && <span className="ml-2 text-amber-700 font-medium">Contractual</span>}
                  </p>
                </div>
                <div className="flex gap-1.5">
                  {!isDone && (
                    <Button variant="outline" size="sm" className="h-7 text-xs"
                      onClick={() => completeMut.mutate({ id: m.id, date: today })}>
                      <CheckCircle2 className="mr-1 h-3 w-3" />Completar
                    </Button>
                  )}
                  <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-muted-foreground hover:text-red-600"
                    onClick={() => deleteMut.mutate(m.id)}>
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent>
          <DialogHeader><DialogTitle>Nuevo Hito</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Código</Label><Input value={form.code} onChange={(e) => setForm((f) => ({ ...f, code: e.target.value }))} placeholder="H-01" className="mt-1" /></div>
              <div><Label>Fecha planificada</Label><Input type="date" value={form.plannedDate} onChange={(e) => setForm((f) => ({ ...f, plannedDate: e.target.value }))} className="mt-1" /></div>
            </div>
            <div><Label>Nombre</Label><Input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} placeholder="Entrega de estructura" className="mt-1" /></div>
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <input type="checkbox" checked={form.isContractual} onChange={(e) => setForm((f) => ({ ...f, isContractual: e.target.checked }))} />
              Hito contractual (fecha comprometida con cliente/curador)
            </label>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowForm(false)}>Cancelar</Button>
            <Button onClick={() => createMut.mutate()} disabled={!form.code || !form.name || !form.plannedDate || createMut.isPending}>
              {createMut.isPending ? 'Guardando…' : 'Crear hito'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ── Baselines Panel ───────────────────────────────────────────────────────────
function BaselinesPanel({ projectId }: { projectId: string }) {
  const qc = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [label, setLabel] = useState('');

  const { data } = useQuery({
    queryKey: ['schedule-baselines', projectId],
    queryFn: () => api.listScheduleBaselines(projectId),
  });
  const baselines = (data ?? []) as unknown as Baseline[];

  const createMut = useMutation({
    mutationFn: () => api.createScheduleBaseline(projectId, label),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['schedule-baselines', projectId] });
      setShowForm(false); setLabel('');
      toast.success('Línea base guardada');
    },
    onError: () => toast.error('Error al guardar línea base'),
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">Guarda fotos del cronograma para comparar avance vs plan original.</p>
        <Button size="sm" onClick={() => setShowForm(true)}><Save className="mr-1 h-3 w-3" />Guardar línea base</Button>
      </div>

      {baselines.length === 0 ? (
        <div className="py-8 text-center text-sm text-muted-foreground">
          Sin líneas base. Guarda una para comparar el cronograma vs el plan original.
        </div>
      ) : (
        <div className="overflow-hidden rounded-lg border">
          <table className="w-full text-sm">
            <thead className="bg-muted/30">
              <tr className="text-left text-xs text-muted-foreground">
                <th className="px-3 py-2 font-medium">Versión</th>
                <th className="px-3 py-2 font-medium">Etiqueta</th>
                <th className="px-3 py-2 font-medium">Congelada el</th>
              </tr>
            </thead>
            <tbody>
              {baselines.map((b) => (
                <tr key={b.id} className="border-t hover:bg-muted/10">
                  <td className="px-3 py-2"><Badge variant="secondary">v{b.version}</Badge></td>
                  <td className="px-3 py-2 font-medium">{b.label}</td>
                  <td className="px-3 py-2 text-muted-foreground">{fmtDate(b.frozenAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent>
          <DialogHeader><DialogTitle>Guardar Línea Base</DialogTitle></DialogHeader>
          <div>
            <Label>Etiqueta</Label>
            <Input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="LB-01 Aprobación cliente" className="mt-1" />
            <p className="text-xs text-muted-foreground mt-1">Copia del cronograma actual como referencia histórica.</p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowForm(false)}>Cancelar</Button>
            <Button onClick={() => createMut.mutate()} disabled={!label || createMut.isPending}>
              {createMut.isPending ? 'Guardando…' : 'Guardar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ── Weekly Progress Panel ─────────────────────────────────────────────────────
function WeeklyProgressPanel({ tasks, projectId }: { tasks: Task[]; projectId: string }) {
  const qc = useQueryClient();
  const [updates, setUpdates] = useState<Map<string, number>>(new Map());
  const [saving, setSaving] = useState(false);

  const leafTasks = tasks.filter((t) => t.kind === 'TASK');

  const saveAll = async () => {
    setSaving(true);
    const pending = Array.from(updates.entries()).filter(([, v]) => v >= 0 && v <= 100);
    try {
      await Promise.all(pending.map(([id, pct]) => api.updateTaskProgress(projectId, id, pct / 100)));
      setUpdates(new Map());
      qc.invalidateQueries({ queryKey: ['tasks', projectId] });
      toast.success(`${pending.length} tareas actualizadas`);
    } catch { toast.error('Error al guardar avances'); }
    finally { setSaving(false); }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-xs text-muted-foreground">
          Edita el % de avance de cada actividad. Presiona "Guardar todo" para aplicar los cambios.
        </p>
        <Button onClick={saveAll} disabled={updates.size === 0 || saving} size="sm">
          {saving ? 'Guardando…' : <><Save className="mr-1 h-3 w-3" />Guardar todo {updates.size > 0 && `(${updates.size})`}</>}
        </Button>
      </div>

      {leafTasks.length === 0 ? (
        <div className="py-8 text-center text-sm text-muted-foreground">Sin tareas de actividad aún.</div>
      ) : (
        <div className="overflow-hidden rounded-lg border max-h-[600px] overflow-y-auto">
          <table className="w-full text-xs">
            <thead className="bg-muted/30 sticky top-0 z-10">
              <tr className="text-left text-muted-foreground">
                <th className="px-3 py-2 font-medium">Cód.</th>
                <th className="px-3 py-2 font-medium">Actividad</th>
                <th className="px-3 py-2 font-medium">Inicio</th>
                <th className="px-3 py-2 font-medium">Fin</th>
                <th className="px-3 py-2 text-right font-medium w-32">Avance %</th>
                <th className="px-3 py-2 w-24 font-medium">Barra</th>
              </tr>
            </thead>
            <tbody>
              {leafTasks.map((t, i) => {
                const cur = Math.round(Number(t.progress) * 100);
                const edited = updates.get(t.id) ?? cur;
                const dirty = updates.has(t.id);
                return (
                  <tr key={t.id} className={`border-t ${
                    t.isCritical ? 'bg-red-50/30' : i % 2 !== 0 ? 'bg-muted/10' : ''
                  }`}>
                    <td className="px-3 py-1.5 font-mono text-muted-foreground">{t.code}</td>
                    <td className="px-3 py-1.5">
                      <span className={t.isCritical ? 'text-red-700 font-medium' : ''}>{t.name}</span>
                    </td>
                    <td className="px-3 py-1.5 text-muted-foreground whitespace-nowrap">{fmtDate(t.plannedStart)}</td>
                    <td className="px-3 py-1.5 text-muted-foreground whitespace-nowrap">{fmtDate(t.plannedEnd)}</td>
                    <td className="px-3 py-1.5 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        {dirty && <span className="text-amber-500 text-lg leading-none">•</span>}
                        <input type="number" min={0} max={100} step={5}
                          className={`w-20 rounded border px-2 py-1 text-right transition-colors ${dirty ? 'border-amber-400 bg-amber-50' : 'border-border'}`}
                          value={edited}
                          onChange={(e) => setUpdates((prev) => new Map(prev).set(t.id, Number(e.target.value)))} />
                        <span className="text-muted-foreground">%</span>
                      </div>
                    </td>
                    <td className="px-3 py-1.5">
                      <div className="h-2 w-20 rounded-full bg-muted overflow-hidden">
                        <div className={`h-full rounded-full transition-all ${t.isCritical ? 'bg-red-500' : 'bg-blue-500'}`}
                          style={{ width: `${edited}%` }} />
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ── WBS Table ─────────────────────────────────────────────────────────────────
function WbsTable({ tasks, projectId }: { tasks: Task[]; projectId: string }) {
  const qc = useQueryClient();

  const deleteMut = useMutation({
    mutationFn: (taskId: string) => api.deleteTask(projectId, taskId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['tasks', projectId] }),
    onError: () => toast.error('Error al eliminar tarea'),
  });

  return (
    <div className="overflow-x-auto rounded-lg border max-h-[600px] overflow-y-auto">
      <table className="w-full text-xs">
        <thead className="bg-muted/30 sticky top-0 z-10">
          <tr className="text-left text-muted-foreground">
            {['Código', 'Nombre', 'Tipo', 'Inicio', 'Fin', 'Dur.', 'Avance', 'Float', 'Crítica', ''].map((h) => (
              <th key={h} className="px-3 py-2 font-medium whitespace-nowrap">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {tasks.map((t, i) => (
            <tr key={t.id} className={`border-t ${
              t.kind === 'SUMMARY' ? 'bg-indigo-50/50 font-semibold text-indigo-900' :
              t.isCritical ? 'bg-red-50/30' : i % 2 !== 0 ? 'bg-muted/10' : ''
            } hover:bg-muted/20`}>
              <td className="px-3 py-1.5 font-mono text-muted-foreground">{t.code}</td>
              <td className="px-3 py-1.5 max-w-[260px]">
                <span className="truncate block" style={{ paddingLeft: t.parentId ? 16 : 0 }}>
                  {t.kind === 'MILESTONE' ? '◆ ' : t.kind === 'SUMMARY' ? '▸ ' : ''}{t.name}
                </span>
              </td>
              <td className="px-3 py-1.5">
                <Badge variant={t.kind === 'SUMMARY' ? 'secondary' : t.kind === 'MILESTONE' ? 'outline' : 'default'} className="text-xs">
                  {t.kind === 'SUMMARY' ? 'Resumen' : t.kind === 'MILESTONE' ? 'Hito' : 'Tarea'}
                </Badge>
              </td>
              <td className="px-3 py-1.5 whitespace-nowrap text-muted-foreground">{fmtDate(t.plannedStart)}</td>
              <td className="px-3 py-1.5 whitespace-nowrap text-muted-foreground">{fmtDate(t.plannedEnd)}</td>
              <td className="px-3 py-1.5 text-center">{t.durationDays > 0 ? `${t.durationDays}d` : '—'}</td>
              <td className="px-3 py-1.5">
                <div className="flex items-center gap-1.5">
                  <div className="h-1.5 w-14 rounded-full bg-muted overflow-hidden">
                    <div className={`h-full rounded-full ${t.isCritical ? 'bg-red-500' : 'bg-blue-500'}`}
                      style={{ width: fmtPct(t.progress) }} />
                  </div>
                  <span>{fmtPct(t.progress)}</span>
                </div>
              </td>
              <td className="px-3 py-1.5 text-muted-foreground">{t.totalFloat != null ? `${t.totalFloat}d` : '—'}</td>
              <td className="px-3 py-1.5">
                {t.isCritical
                  ? <Badge variant="destructive" className="text-xs">Sí</Badge>
                  : <span className="text-muted-foreground">No</span>}
              </td>
              <td className="px-3 py-1.5">
                <Button variant="ghost" size="sm" className="h-6 w-6 p-0 text-muted-foreground hover:text-red-600"
                  onClick={() => { if (confirm('¿Eliminar esta tarea?')) deleteMut.mutate(t.id); }}>
                  <Trash2 className="h-3 w-3" />
                </Button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function SchedulePage({ params }: { params: { id: string } }) {
  const { id: projectId } = params;
  const qc = useQueryClient();
  const [cpmRunning, setCpmRunning] = useState(false);
  const [seedConfirm, setSeedConfirm] = useState(false);
  const [clearConfirm, setClearConfirm] = useState(false);

  const { data, isLoading, error } = useQuery({
    queryKey: ['tasks', projectId],
    queryFn: () => api.listTasks(projectId),
  });
  const tasks = (data ?? []) as unknown as Task[];

  // ── Actions ───────────────────────────────────────────────────
  const cpmMut = useMutation({
    mutationFn: () => api.computeCPM(projectId),
    onMutate: () => setCpmRunning(true),
    onSettled: () => setCpmRunning(false),
    onSuccess: (res) => { qc.setQueryData(['tasks', projectId], res); toast.success('CPM calculado'); },
    onError: () => toast.error('Error al calcular CPM'),
  });

  const seedMut = useMutation({
    mutationFn: () => api.seedSantaIsabelSchedule(projectId),
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ['tasks', projectId] });
      setSeedConfirm(false);
      toast.success(res.message);
    },
    onError: () => toast.error('Error al cargar plantilla'),
  });

  const clearMut = useMutation({
    mutationFn: () => api.clearSchedule(projectId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['tasks', projectId] });
      setClearConfirm(false);
      toast.success('Cronograma eliminado');
    },
    onError: () => toast.error('Error al limpiar cronograma'),
  });

  const exportExcel = async () => {
    try {
      const res = await api.exportScheduleExcel(projectId);
      if (!res.ok) { toast.error('Error al exportar'); return; }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a'); a.href = url;
      a.download = 'cronograma-santa-isabel.xlsx'; a.click();
      URL.revokeObjectURL(url);
      toast.success('Excel exportado');
    } catch { toast.error('Error al exportar Excel'); }
  };

  const handleTaskDateChange = async (taskId: string, start: Date, end: Date, durationDays: number) => {
    try {
      await api.updateTask(projectId, taskId, {
        plannedStart: start.toISOString(), plannedEnd: end.toISOString(), durationDays,
      });
      qc.invalidateQueries({ queryKey: ['tasks', projectId] });
    } catch { toast.error('Error al actualizar fechas'); }
  };

  // ── Stats ─────────────────────────────────────────────────────
  const stats = useMemo(() => {
    const total    = tasks.length;
    const critical = tasks.filter((t) => t.isCritical).length;
    const done     = tasks.filter((t) => Number(t.progress) >= 1).length;
    const leaf     = tasks.filter((t) => t.kind === 'TASK');
    const avgProg  = leaf.length > 0 ? Math.round(leaf.reduce((s, t) => s + Number(t.progress) * 100, 0) / leaf.length) : 0;
    const allStarts = tasks.filter((t) => t.plannedStart).map((t) => new Date(t.plannedStart));
    const allEnds   = tasks.filter((t) => t.plannedEnd).map((t) => new Date(t.plannedEnd));
    const projStart = allStarts.length ? new Date(Math.min(...allStarts.map((d) => d.getTime()))) : null;
    const projEnd   = allEnds.length   ? new Date(Math.max(...allEnds.map((d) => d.getTime())))   : null;
    return { total, critical, done, avgProg, projStart, projEnd };
  }, [tasks]);

  return (
    <div className="space-y-5">
      <ModuleHeader
        title="Cronograma de Obra"
        description={
          stats.projStart
            ? `${fmtDate(stats.projStart.toISOString())} → ${fmtDate(stats.projEnd?.toISOString())} · Torre Santa Isabel, Dosquebradas`
            : 'WBS · Gantt · CPM · EVM — Torre Santa Isabel, Dosquebradas'
        }
        infoText="Cronograma con WBS jerárquico, Gantt interactivo con arrastre, ruta crítica CPM, valor ganado SPI, hitos contractuales y líneas base. Plantilla de 57 actividades reales basadas en especificaciones técnicas NSR-10."
        actions={
          <div className="flex flex-wrap gap-2">
            <Button size="sm" onClick={() => setSeedConfirm(true)} disabled={seedMut.isPending}>
              <Layers className="mr-1 h-4 w-4" />🏗 Plantilla Santa Isabel
            </Button>
            <Button size="sm" variant="outline" onClick={() => cpmMut.mutate()}
              disabled={cpmRunning || tasks.length === 0}>
              <Zap className="mr-1 h-4 w-4" />{cpmRunning ? 'Calculando…' : 'Calcular CPM'}
            </Button>
            <Button size="sm" variant="outline" onClick={exportExcel} disabled={tasks.length === 0}>
              <Download className="mr-1 h-4 w-4" />Exportar Excel
            </Button>
            <ReportHtmlButton
              label="Reporte HTML"
              fetcher={() => api.exportScheduleHtml(projectId)}
              className="border-indigo-200 text-indigo-700 hover:bg-indigo-50"
            />
            {tasks.length > 0 && (
              <Button size="sm" variant="ghost" className="text-muted-foreground hover:text-red-600"
                onClick={() => setClearConfirm(true)}>
                <Trash2 className="mr-1 h-4 w-4" />Limpiar
              </Button>
            )}
            <Button asChild size="sm">
              <Link href={`/dashboard/projects/${projectId}/schedule/tasks/new`}>
                <Plus className="mr-1 h-4 w-4" />Nueva tarea
              </Link>
            </Button>
          </div>
        }
      />

      {/* KPI Row */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <KpiCard label="Total actividades" value={String(stats.total)} />
        <KpiCard label="Ruta crítica" value={String(stats.critical)}
          color={stats.critical > 0 ? 'text-red-700' : ''} subtitle="tareas críticas" />
        <KpiCard label="Completadas" value={String(stats.done)}
          color={stats.done > 0 ? 'text-green-700' : ''} />
        <KpiCard label="Avance promedio" value={`${stats.avgProg}%`}
          color={stats.avgProg >= 50 ? 'text-green-700' : 'text-amber-600'} />
      </div>

      {/* Error */}
      {error && (
        <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          <AlertTriangle className="h-4 w-4 flex-shrink-0" />
          Error al cargar el cronograma. Verifica que la API esté disponible.
        </div>
      )}

      {/* Empty state */}
      {!isLoading && !error && tasks.length === 0 && (
        <Card className="border-dashed border-2">
          <CardContent className="py-16 text-center">
            <Calendar className="h-14 w-14 mx-auto text-muted-foreground/30 mb-4" />
            <p className="text-base font-semibold mb-1">Cronograma vacío</p>
            <p className="text-sm text-muted-foreground mb-6 max-w-md mx-auto">
              Carga la plantilla con las 57 actividades reales de Santa Isabel (11 capítulos, Abr 2026 – Dic 2027) o crea tareas manualmente.
            </p>
            <div className="flex gap-3 justify-center">
              <Button size="lg" onClick={() => setSeedConfirm(true)}>
                <Layers className="mr-2 h-5 w-5" />🏗 Cargar plantilla Santa Isabel
              </Button>
              <Button variant="outline" size="lg" asChild>
                <Link href={`/dashboard/projects/${projectId}/schedule/tasks/new`}>
                  <Plus className="mr-1 h-4 w-4" />Nueva tarea
                </Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Tabs */}
      {tasks.length > 0 && (
        <Tabs defaultValue="gantt">
          <TabsList className="h-auto flex-wrap gap-1 p-1">
            <TabsTrigger value="gantt" className="gap-1.5 text-xs"><BarChart2 className="h-3.5 w-3.5" />Gantt</TabsTrigger>
            <TabsTrigger value="wbs" className="gap-1.5 text-xs"><List className="h-3.5 w-3.5" />WBS / Tabla</TabsTrigger>
            <TabsTrigger value="evm" className="gap-1.5 text-xs"><GitBranch className="h-3.5 w-3.5" />EVM / Curva S</TabsTrigger>
            <TabsTrigger value="progress" className="gap-1.5 text-xs"><RefreshCw className="h-3.5 w-3.5" />Avance semanal</TabsTrigger>
            <TabsTrigger value="milestones" className="gap-1.5 text-xs"><Flag className="h-3.5 w-3.5" />Hitos</TabsTrigger>
            <TabsTrigger value="baselines" className="gap-1.5 text-xs"><Clock className="h-3.5 w-3.5" />Líneas base</TabsTrigger>
          </TabsList>

          <TabsContent value="gantt">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Diagrama de Gantt</CardTitle>
                <p className="text-xs text-muted-foreground">
                  Arrastra las barras para mover · Arrastra los extremos para ajustar duración · Las flechas muestran dependencias FS · Línea amarilla = hoy
                </p>
              </CardHeader>
              <CardContent className="overflow-x-auto">
                {isLoading
                  ? <div className="py-8 text-center text-sm text-muted-foreground">Cargando Gantt…</div>
                  : <GanttChart tasks={tasks} projectId={projectId} onTaskDateChange={handleTaskDateChange} />
                }
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="wbs">
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm">WBS — Estructura de Desglose de Trabajo</CardTitle></CardHeader>
              <CardContent><WbsTable tasks={tasks} projectId={projectId} /></CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="evm">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Valor Ganado (EVM) — SPI / Curva S</CardTitle>
                <p className="text-xs text-muted-foreground">SPI ≥ 1 = adelantado · SPI &lt; 1 = atrasado respecto al plan</p>
              </CardHeader>
              <CardContent><EvmPanel tasks={tasks} /></CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="progress">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Registro de Avance Semanal</CardTitle>
                <p className="text-xs text-muted-foreground">Edita el % de avance y guarda todo en un clic. Las celdas editadas se resaltan en amarillo.</p>
              </CardHeader>
              <CardContent><WeeklyProgressPanel tasks={tasks} projectId={projectId} /></CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="milestones">
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm">Hitos del Proyecto</CardTitle></CardHeader>
              <CardContent><MilestonesPanel projectId={projectId} /></CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="baselines">
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm">Líneas Base de Cronograma</CardTitle></CardHeader>
              <CardContent><BaselinesPanel projectId={projectId} /></CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      )}

      {/* Seed confirm */}
      <Dialog open={seedConfirm} onOpenChange={setSeedConfirm}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>🏗️ Plantilla Santa Isabel</DialogTitle></DialogHeader>
          <div className="space-y-3 text-sm">
            <p>Se crearán <strong>57 actividades</strong> en <strong>11 capítulos</strong> con fechas Abr 2026 – Dic 2027:</p>
            <div className="grid grid-cols-2 gap-1 text-xs text-muted-foreground">
              {[
                'CAP 1 — Preliminares', 'CAP 2 — Cimentación (pilotes)',
                'CAP 3 — Estructura 12 pisos', 'CAP 4 — Hidrosanitarias y gas',
                'CAP 5 — Eléctricas y TELCO', 'CAP 6 — Cubierta (geomembrana PVC)',
                'CAP 7 — Urbanismo', 'CAP 8 — Acabados zonas comunes',
                'CAP 9 — Acabados unidades priv.', 'CAP 10 — Muebles y aparatos',
                'CAP 11 — Entrega y cierre', '◆ Hito — Entrega final Dic 2027',
              ].map((c) => <div key={c} className="flex items-center gap-1"><span className="text-green-600">✓</span>{c}</div>)}
            </div>
            {tasks.length > 0 && (
              <div className="rounded-md bg-amber-50 border border-amber-200 p-3 text-amber-800 text-xs">
                ⚠️ Ya hay {tasks.length} tareas. La plantilla no se cargará para evitar duplicados.
                Usa el botón <strong>Limpiar</strong> primero.
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSeedConfirm(false)}>Cancelar</Button>
            <Button onClick={() => seedMut.mutate()} disabled={seedMut.isPending}>
              {seedMut.isPending ? 'Cargando…' : '✅ Cargar plantilla'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Clear confirm */}
      <Dialog open={clearConfirm} onOpenChange={setClearConfirm}>
        <DialogContent>
          <DialogHeader><DialogTitle>¿Eliminar todo el cronograma?</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">
            Se eliminarán las <strong>{tasks.length} tareas</strong> actuales. Esta acción no se puede deshacer.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setClearConfirm(false)}>Cancelar</Button>
            <Button variant="destructive" onClick={() => clearMut.mutate()} disabled={clearMut.isPending}>
              {clearMut.isPending ? 'Eliminando…' : 'Sí, eliminar todo'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
