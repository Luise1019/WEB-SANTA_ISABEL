'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus, TrendingDown, TrendingUp } from 'lucide-react';
import { use, useMemo, useState } from 'react';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { api } from '@/lib/api-client';

// ─── Types ───────────────────────────────────────────────────
type CashFlowEntry = {
  id: string;
  date: string;
  kind: 'INGRESO' | 'EGRESO';
  category: string;
  description: string;
  amount: string;
};

type Summary = {
  totalIngresos: string;
  totalEgresos: string;
  netFlow: string;
  byMonth: Array<{ month: string; ingresos: string; egresos: string; net: string }>;
  byCategory: Array<{ category: string; kind: string; total: string }>;
};

// ─── Constants ───────────────────────────────────────────────
const CATEGORIES = [
  { value: 'VENTA_CUOTA_INICIAL', label: 'Cuota inicial venta', kind: 'INGRESO' },
  { value: 'VENTA_SALDO', label: 'Saldo venta', kind: 'INGRESO' },
  { value: 'DESEMBOLSO_CREDITO', label: 'Desembolso crédito', kind: 'INGRESO' },
  { value: 'APORTE_SOCIO', label: 'Aporte de socio', kind: 'INGRESO' },
  { value: 'EGRESO_CAPITULO', label: 'Pago capítulo construcción', kind: 'EGRESO' },
  { value: 'INTERES_CREDITO', label: 'Interés crédito', kind: 'EGRESO' },
  { value: 'AMORTIZACION_CREDITO', label: 'Amortización crédito', kind: 'EGRESO' },
  { value: 'IMPUESTOS', label: 'Impuestos', kind: 'EGRESO' },
  { value: 'OTRO', label: 'Otro', kind: 'EGRESO' },
] as const;

const CATEGORY_LABELS: Record<string, string> = Object.fromEntries(
  CATEGORIES.map((c) => [c.value, c.label]),
);

// ─── Helpers ─────────────────────────────────────────────────
function formatCOP(value: string | number) {
  return new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    maximumFractionDigits: 0,
  }).format(Number(value));
}

// ─── New Entry Form ───────────────────────────────────────────
function NewEntryForm({ projectId }: { projectId: string }) {
  const qc = useQueryClient();
  const [show, setShow] = useState(false);
  const [date, setDate] = useState('');
  const [kind, setKind] = useState<'INGRESO' | 'EGRESO'>('INGRESO');
  const [category, setCategory] = useState('VENTA_CUOTA_INICIAL');
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');

  const filteredCats = CATEGORIES.filter((c) => c.kind === kind);

  const mutation = useMutation({
    mutationFn: () =>
      api.createCashFlowEntry(projectId, {
        date,
        kind,
        category: category as Parameters<typeof api.createCashFlowEntry>[1]['category'],
        description,
        amount,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['cashflow', projectId] });
      qc.invalidateQueries({ queryKey: ['cashflow-summary', projectId] });
      setShow(false);
      setDate('');
      setDescription('');
      setAmount('');
    },
  });

  if (!show) {
    return (
      <Button size="sm" onClick={() => setShow(true)}>
        <Plus className="mr-1 h-4 w-4" />
        Nueva entrada
      </Button>
    );
  }

  return (
    <Card className="border-dashed">
      <CardHeader>
        <CardTitle className="text-sm">Nueva entrada de flujo de caja</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div className="space-y-1">
            <Label className="text-xs">Fecha</Label>
            <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="h-8" />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Tipo</Label>
            <Select
              value={kind}
              onChange={(e) => {
                setKind(e.target.value as 'INGRESO' | 'EGRESO');
                setCategory(
                  CATEGORIES.find((c) => c.kind === e.target.value)?.value ?? 'OTRO',
                );
              }}
              className="h-8"
            >
              <option value="INGRESO">Ingreso</option>
              <option value="EGRESO">Egreso</option>
            </Select>
          </div>
          <div className="space-y-1 col-span-2">
            <Label className="text-xs">Categoría</Label>
            <Select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="h-8"
            >
              {filteredCats.map((c) => (
                <option key={c.value} value={c.value}>
                  {c.label}
                </option>
              ))}
            </Select>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1 col-span-2 sm:col-span-1">
            <Label className="text-xs">Descripción</Label>
            <Input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Descripción del movimiento"
              className="h-8 text-sm"
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Monto (COP)</Label>
            <Input
              type="number"
              min="0"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="5000000"
              className="h-8 text-sm"
            />
          </div>
        </div>
        <div className="flex gap-2">
          <Button
            size="sm"
            disabled={!date || !description || !amount || mutation.isPending}
            onClick={() => mutation.mutate()}
          >
            Guardar
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setShow(false)}>
            Cancelar
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Main Page ───────────────────────────────────────────────
export default function CashflowPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: projectId } = use(params);
  const qc = useQueryClient();
  const [kindFilter, setKindFilter] = useState<'ALL' | 'INGRESO' | 'EGRESO'>('ALL');

  const { data: summaryData } = useQuery({
    queryKey: ['cashflow-summary', projectId],
    queryFn: () => api.getCashFlowSummary(projectId),
  });

  const { data: entriesData, isLoading, error } = useQuery({
    queryKey: ['cashflow', projectId],
    queryFn: () => api.listCashFlowEntries(projectId),
  });

  const deleteMutation = useMutation({
    mutationFn: (entryId: string) => api.deleteCashFlowEntry(projectId, entryId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['cashflow', projectId] });
      qc.invalidateQueries({ queryKey: ['cashflow-summary', projectId] });
    },
  });

  const summary = summaryData as unknown as Summary | undefined;
  const allEntries = (entriesData ?? []) as unknown as CashFlowEntry[];

  const entries = useMemo(
    () => (kindFilter === 'ALL' ? allEntries : allEntries.filter((e) => e.kind === kindFilter)),
    [allEntries, kindFilter],
  );

  return (
    <div className="space-y-6">
      <header className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Flujo de Caja</h1>
          <p className="text-muted-foreground">Ingresos y egresos del proyecto.</p>
        </div>
        <NewEntryForm projectId={projectId} />
      </header>

      {/* Summary Cards */}
      {summary && (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-green-600" />
                <p className="text-xs text-muted-foreground">Total ingresos</p>
              </div>
              <p className="mt-1 text-xl font-bold text-green-700">
                {formatCOP(summary.totalIngresos)}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center gap-2">
                <TrendingDown className="h-4 w-4 text-red-600" />
                <p className="text-xs text-muted-foreground">Total egresos</p>
              </div>
              <p className="mt-1 text-xl font-bold text-red-700">
                {formatCOP(summary.totalEgresos)}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <p className="text-xs text-muted-foreground">Saldo neto</p>
              <p
                className={`mt-1 text-xl font-bold ${
                  Number(summary.netFlow) >= 0 ? 'text-green-700' : 'text-red-700'
                }`}
              >
                {formatCOP(summary.netFlow)}
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Monthly Summary */}
      {summary && summary.byMonth.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Resumen mensual</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="border-b">
                  <tr className="text-left text-xs text-muted-foreground">
                    <th className="py-2 pr-4 font-medium">Mes</th>
                    <th className="py-2 pr-4 text-right font-medium">Ingresos</th>
                    <th className="py-2 pr-4 text-right font-medium">Egresos</th>
                    <th className="py-2 text-right font-medium">Neto</th>
                  </tr>
                </thead>
                <tbody>
                  {summary.byMonth.map((m) => (
                    <tr key={m.month} className="border-b last:border-0">
                      <td className="py-2 pr-4 font-medium">{m.month}</td>
                      <td className="py-2 pr-4 text-right text-green-700 font-mono">
                        {formatCOP(m.ingresos)}
                      </td>
                      <td className="py-2 pr-4 text-right text-red-700 font-mono">
                        {formatCOP(m.egresos)}
                      </td>
                      <td
                        className={`py-2 text-right font-mono font-medium ${
                          Number(m.net) >= 0 ? 'text-green-700' : 'text-red-700'
                        }`}
                      >
                        {formatCOP(m.net)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Entries Table */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">Movimientos ({entries.length})</CardTitle>
            <div className="flex gap-1">
              {(['ALL', 'INGRESO', 'EGRESO'] as const).map((f) => (
                <button
                  key={f}
                  onClick={() => setKindFilter(f)}
                  className={`rounded px-2 py-1 text-xs font-medium transition-colors ${
                    kindFilter === f
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-muted text-muted-foreground hover:bg-muted/80'
                  }`}
                >
                  {f === 'ALL' ? 'Todos' : f === 'INGRESO' ? 'Ingresos' : 'Egresos'}
                </button>
              ))}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading && <p className="text-sm">Cargando movimientos…</p>}
          {error && (
            <p className="text-sm text-destructive">Error al cargar movimientos.</p>
          )}
          {!isLoading && entries.length === 0 && (
            <p className="text-sm text-muted-foreground">
              No hay movimientos registrados. Crea la primera entrada con el botón superior.
            </p>
          )}
          {entries.length > 0 && (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="border-b">
                  <tr className="text-left text-xs text-muted-foreground">
                    <th className="py-2 pr-3 font-medium">Fecha</th>
                    <th className="py-2 pr-3 font-medium">Tipo</th>
                    <th className="py-2 pr-3 font-medium">Categoría</th>
                    <th className="py-2 pr-3 font-medium">Descripción</th>
                    <th className="py-2 pr-3 text-right font-medium">Monto</th>
                    <th className="py-2 font-medium"></th>
                  </tr>
                </thead>
                <tbody>
                  {entries.map((e) => (
                    <tr key={e.id} className="border-b last:border-0 hover:bg-muted/20">
                      <td className="py-2 pr-3 text-xs">
                        {new Date(e.date).toLocaleDateString('es-CO')}
                      </td>
                      <td className="py-2 pr-3">
                        <span
                          className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                            e.kind === 'INGRESO'
                              ? 'bg-green-100 text-green-700'
                              : 'bg-red-100 text-red-700'
                          }`}
                        >
                          {e.kind === 'INGRESO' ? 'Ingreso' : 'Egreso'}
                        </span>
                      </td>
                      <td className="py-2 pr-3 text-xs text-muted-foreground">
                        {CATEGORY_LABELS[e.category] ?? e.category}
                      </td>
                      <td className="py-2 pr-3">{e.description}</td>
                      <td
                        className={`py-2 pr-3 text-right font-mono font-medium ${
                          e.kind === 'INGRESO' ? 'text-green-700' : 'text-red-700'
                        }`}
                      >
                        {formatCOP(e.amount)}
                      </td>
                      <td className="py-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 px-1 text-muted-foreground hover:text-destructive"
                          onClick={() => deleteMutation.mutate(e.id)}
                        >
                          ✕
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
