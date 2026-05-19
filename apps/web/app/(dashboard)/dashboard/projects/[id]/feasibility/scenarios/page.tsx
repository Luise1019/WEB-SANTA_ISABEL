'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus, RefreshCw, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { api } from '@/lib/api-client';

type Scenario = {
  id: string;
  name: string;
  priceVariationPct: string;
  costVariationPct: string;
  salesVelocityVariationPct: string;
  computedTir?: string | null;
  computedNpv?: string | null;
};

const fmtPct = (v?: string | null) => {
  if (!v) return '—';
  const n = Number(v);
  return isNaN(n) ? '—' : `${(n * 100).toFixed(2)}%`;
};

const fmtCOP = (v?: string | null) => {
  if (!v) return '—';
  const n = Number(v);
  if (isNaN(n)) return '—';
  if (Math.abs(n) >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  return `$${n.toLocaleString('es-CO')}`;
};

export default function FeasibilityScenariosPage({ params }: { params: { id: string } }) {
  const { id } = params;
  const qc = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ['feasibility', id],
    queryFn: () => api.getFeasibility(id),
  });

  const [form, setForm] = useState({ name: '', priceVariationPct: '0', costVariationPct: '0', salesVelocityVariationPct: '0' });
  const [showForm, setShowForm] = useState(false);

  const fd = data as unknown as { scenarios?: Scenario[]; analysis?: { tir?: string | null; npv?: string | null } } | undefined;
  const scenarios = fd?.scenarios ?? [];
  const baseAnalysis = fd?.analysis;

  const createMutation = useMutation({
    mutationFn: () => api.createFeasibilityScenario(id, {
      name: form.name,
      priceVariationPct: form.priceVariationPct,
      costVariationPct: form.costVariationPct,
      salesVelocityVariationPct: form.salesVelocityVariationPct,
    }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['feasibility', id] });
      setForm({ name: '', priceVariationPct: '0', costVariationPct: '0', salesVelocityVariationPct: '0' });
      setShowForm(false);
      toast.success('Escenario creado');
    },
    onError: () => toast.error('Error al crear escenario'),
  });

  const deleteMutation = useMutation({
    mutationFn: (scenarioId: string) => api.deleteFeasibilityScenario(id, scenarioId),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['feasibility', id] });
      toast.success('Escenario eliminado');
    },
  });

  const recalcMutation = useMutation({
    mutationFn: () => api.recalculateFeasibility(id),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['feasibility', id] });
      toast.success('Escenarios recalculados');
    },
  });

  // Build chart data: base + scenarios
  const chartData = [
    ...(baseAnalysis?.tir ? [{
      name: 'Base',
      tir: Number(baseAnalysis.tir) * 100,
      npv: Number(baseAnalysis.npv ?? 0) / 1_000_000,
    }] : []),
    ...scenarios.map((s) => ({
      name: s.name,
      tir: s.computedTir ? Number(s.computedTir) * 100 : 0,
      npv: s.computedNpv ? Number(s.computedNpv) / 1_000_000 : 0,
    })),
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold">Escenarios de sensibilidad</h1>
          <p className="text-sm text-muted-foreground">Comparativa Base / Optimista / Pesimista — impacto en TIR y VPN</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => recalcMutation.mutate()} disabled={recalcMutation.isPending}>
            <RefreshCw className={`h-4 w-4 mr-1 ${recalcMutation.isPending ? 'animate-spin' : ''}`} />
            Recalcular
          </Button>
          <Button size="sm" onClick={() => setShowForm(!showForm)}>
            <Plus className="h-4 w-4 mr-1" /> Nuevo escenario
          </Button>
        </div>
      </div>

      {/* New scenario form */}
      {showForm && (
        <Card className="border-dashed border-2 border-primary/30">
          <CardContent className="p-4">
            <h3 className="font-semibold mb-3">Nuevo escenario</h3>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="sm:col-span-2">
                <label className="text-xs text-muted-foreground">Nombre *</label>
                <input
                  className="mt-1 w-full rounded-md border px-3 py-1.5 text-sm outline-none focus:ring-2 focus:ring-primary"
                  placeholder="Ej: Pesimista -10%"
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                />
              </div>
              <div>
                <label className="text-xs text-muted-foreground">Δ Precio (%)</label>
                <div className="mt-1 relative">
                  <input
                    type="range"
                    min={-30}
                    max={30}
                    step={1}
                    value={Number(form.priceVariationPct)}
                    onChange={(e) => setForm((f) => ({ ...f, priceVariationPct: e.target.value }))}
                    className="w-full"
                  />
                  <p className={`text-sm font-bold text-center ${Number(form.priceVariationPct) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {Number(form.priceVariationPct) >= 0 ? '+' : ''}{form.priceVariationPct}%
                  </p>
                </div>
              </div>
              <div>
                <label className="text-xs text-muted-foreground">Δ Costo (%)</label>
                <div className="mt-1 relative">
                  <input
                    type="range"
                    min={-30}
                    max={30}
                    step={1}
                    value={Number(form.costVariationPct)}
                    onChange={(e) => setForm((f) => ({ ...f, costVariationPct: e.target.value }))}
                    className="w-full"
                  />
                  <p className={`text-sm font-bold text-center ${Number(form.costVariationPct) <= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {Number(form.costVariationPct) >= 0 ? '+' : ''}{form.costVariationPct}%
                  </p>
                </div>
              </div>
            </div>
            <div className="mt-4 flex gap-2 justify-end">
              <Button variant="outline" size="sm" onClick={() => setShowForm(false)}>Cancelar</Button>
              <Button
                size="sm"
                disabled={!form.name || createMutation.isPending}
                onClick={() => createMutation.mutate()}
              >
                {createMutation.isPending ? 'Creando…' : 'Crear escenario'}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Chart */}
      {chartData.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">TIR por escenario (%)</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={chartData} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} tickFormatter={(v: number) => `${v.toFixed(1)}%`} />
                  <Tooltip formatter={(v) => [`${Number(v).toFixed(2)}%`, 'TIR']} />
                  <Bar dataKey="tir" name="TIR %" fill="#14b8a6" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">VPN por escenario (M COP)</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={chartData} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} tickFormatter={(v: number) => `${v.toFixed(1)}M`} />
                  <Tooltip formatter={(v) => [`$${Number(v).toFixed(2)}M`, 'VPN']} />
                  <Bar dataKey="npv" name="VPN M" fill="#818cf8" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Scenarios table */}
      {isLoading ? (
        <div className="h-32 animate-pulse rounded-xl bg-muted" />
      ) : (
        <Card>
          <CardContent className="p-0">
            <table className="w-full text-sm">
              <thead className="bg-muted/40 text-xs text-muted-foreground border-b">
                <tr>
                  <th className="text-left px-4 py-2.5 font-medium">Escenario</th>
                  <th className="text-right px-3 py-2.5 font-medium">Δ Precio</th>
                  <th className="text-right px-3 py-2.5 font-medium">Δ Costo</th>
                  <th className="text-right px-3 py-2.5 font-medium">Δ Vel. Ventas</th>
                  <th className="text-right px-3 py-2.5 font-medium">TIR</th>
                  <th className="text-right px-3 py-2.5 font-medium">VPN</th>
                  <th className="w-8 px-2" />
                </tr>
              </thead>
              <tbody>
                {/* Base row */}
                {baseAnalysis && (
                  <tr className="border-b bg-teal-50/50">
                    <td className="px-4 py-2.5 font-bold">Base</td>
                    <td className="px-3 py-2.5 text-right text-muted-foreground">—</td>
                    <td className="px-3 py-2.5 text-right text-muted-foreground">—</td>
                    <td className="px-3 py-2.5 text-right text-muted-foreground">—</td>
                    <td className="px-3 py-2.5 text-right font-mono font-semibold text-teal-700">
                      {fmtPct(baseAnalysis.tir)}
                    </td>
                    <td className="px-3 py-2.5 text-right font-mono font-semibold text-teal-700">
                      {fmtCOP(baseAnalysis.npv)}
                    </td>
                    <td />
                  </tr>
                )}
                {scenarios.length === 0 && (
                  <tr>
                    <td colSpan={7} className="py-8 text-center text-muted-foreground">
                      No hay escenarios. Crea uno con el botón de arriba.
                    </td>
                  </tr>
                )}
                {scenarios.map((s) => (
                  <tr key={s.id} className="border-b hover:bg-muted/20">
                    <td className="px-4 py-2.5 font-medium">{s.name}</td>
                    <td className={`px-3 py-2.5 text-right font-mono ${Number(s.priceVariationPct) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                      {Number(s.priceVariationPct) >= 0 ? '+' : ''}{s.priceVariationPct}%
                    </td>
                    <td className={`px-3 py-2.5 text-right font-mono ${Number(s.costVariationPct) <= 0 ? 'text-green-600' : 'text-red-600'}`}>
                      {Number(s.costVariationPct) >= 0 ? '+' : ''}{s.costVariationPct}%
                    </td>
                    <td className={`px-3 py-2.5 text-right font-mono ${Number(s.salesVelocityVariationPct) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                      {Number(s.salesVelocityVariationPct) >= 0 ? '+' : ''}{s.salesVelocityVariationPct}%
                    </td>
                    <td className="px-3 py-2.5 text-right font-mono font-semibold">
                      {fmtPct(s.computedTir)}
                    </td>
                    <td className="px-3 py-2.5 text-right font-mono">
                      {fmtCOP(s.computedNpv)}
                    </td>
                    <td className="px-2 py-2.5">
                      <button
                        onClick={() => deleteMutation.mutate(s.id)}
                        className="text-muted-foreground hover:text-destructive transition-colors"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
