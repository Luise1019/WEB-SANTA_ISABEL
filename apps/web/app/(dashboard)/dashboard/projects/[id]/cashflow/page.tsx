'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus, TrendingDown, TrendingUp } from 'lucide-react';
import { useMemo, useState } from 'react';
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';

import { ModuleHeader } from '@/components/module-header';
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

type Loan = {
  id: string;
  bank: string;
  amount: string;
  interestRateAnnual: string;
  startDate: string;
  termMonths: number;
  graceMonths: number;
  disbursements: Array<{ amount: string }>;
  payments: Array<{ amount: string }>;
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

function formatMonthLabel(month: string): string {
  // Input: "2024-01" → "Ene 24"
  const [year, mon] = month.split('-');
  const date = new Date(Number(year), Number(mon) - 1, 1);
  return date.toLocaleDateString('es-CO', { month: 'short', year: '2-digit' });
}

function formatMillions(value: number): string {
  if (Math.abs(value) >= 1_000_000) {
    return `${(value / 1_000_000).toFixed(1)}M`;
  }
  if (Math.abs(value) >= 1_000) {
    return `${(value / 1_000).toFixed(0)}K`;
  }
  return String(value);
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

// ─── Loan Section ─────────────────────────────────────────────
function LoanSection({ projectId }: { projectId: string }) {
  const qc = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [bank, setBank] = useState('');
  const [amount, setAmount] = useState('');
  const [interestRateAnnual, setInterestRateAnnual] = useState('');
  const [startDate, setStartDate] = useState('');
  const [termMonths, setTermMonths] = useState('');
  const [graceMonths, setGraceMonths] = useState('0');

  const { data: loansData } = useQuery({
    queryKey: ['loans', projectId],
    queryFn: () => api.listLoans(projectId),
  });

  const loans = (loansData ?? []) as unknown as Loan[];

  const createLoan = useMutation({
    mutationFn: () =>
      api.createLoan(projectId, {
        bank,
        amount,
        interestRateAnnual,
        startDate,
        termMonths: Number(termMonths),
        graceMonths: Number(graceMonths),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['loans', projectId] });
      setShowForm(false);
      setBank('');
      setAmount('');
      setInterestRateAnnual('');
      setStartDate('');
      setTermMonths('');
      setGraceMonths('0');
    },
  });

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-base">Crédito constructor</CardTitle>
          <Button size="sm" variant="outline" onClick={() => setShowForm((v) => !v)}>
            <Plus className="mr-1 h-4 w-4" />
            Nuevo crédito
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {loans.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No hay créditos registrados. Agrega el primero con el botón superior.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b">
                <tr className="text-left text-xs text-muted-foreground">
                  <th className="py-2 pr-3 font-medium">Banco</th>
                  <th className="py-2 pr-3 text-right font-medium">Monto aprobado</th>
                  <th className="py-2 pr-3 text-right font-medium">Tasa E.A.</th>
                  <th className="py-2 pr-3 font-medium">Inicio</th>
                  <th className="py-2 pr-3 text-right font-medium">Plazo</th>
                  <th className="py-2 text-right font-medium">Desembolsado</th>
                </tr>
              </thead>
              <tbody>
                {loans.map((loan) => {
                  const disbursed = loan.disbursements.reduce(
                    (s, d) => s + Number(d.amount),
                    0,
                  );
                  return (
                    <tr key={loan.id} className="border-b last:border-0 hover:bg-muted/20">
                      <td className="py-2 pr-3 font-medium">{loan.bank}</td>
                      <td className="py-2 pr-3 text-right font-mono">
                        {formatCOP(loan.amount)}
                      </td>
                      <td className="py-2 pr-3 text-right">
                        {Number(loan.interestRateAnnual).toFixed(2)}%
                      </td>
                      <td className="py-2 pr-3 text-xs">
                        {new Date(loan.startDate).toLocaleDateString('es-CO')}
                      </td>
                      <td className="py-2 pr-3 text-right">{loan.termMonths} meses</td>
                      <td className="py-2 text-right font-mono text-green-700">
                        {formatCOP(disbursed)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {showForm && (
          <Card className="border-dashed mt-2">
            <CardHeader>
              <CardTitle className="text-sm">Nuevo crédito constructor</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                <div className="space-y-1 col-span-2 sm:col-span-1">
                  <Label className="text-xs">Banco / Entidad</Label>
                  <Input
                    value={bank}
                    onChange={(e) => setBank(e.target.value)}
                    placeholder="Bancolombia"
                    className="h-8 text-sm"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Monto aprobado (COP)</Label>
                  <Input
                    type="number"
                    min="0"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    placeholder="500000000"
                    className="h-8 text-sm"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Tasa E.A. %</Label>
                  <Input
                    type="number"
                    min="0"
                    step="0.01"
                    value={interestRateAnnual}
                    onChange={(e) => setInterestRateAnnual(e.target.value)}
                    placeholder="12.5"
                    className="h-8 text-sm"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Fecha inicio</Label>
                  <Input
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="h-8 text-sm"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Plazo (meses)</Label>
                  <Input
                    type="number"
                    min="1"
                    value={termMonths}
                    onChange={(e) => setTermMonths(e.target.value)}
                    placeholder="24"
                    className="h-8 text-sm"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Meses gracia</Label>
                  <Input
                    type="number"
                    min="0"
                    value={graceMonths}
                    onChange={(e) => setGraceMonths(e.target.value)}
                    placeholder="0"
                    className="h-8 text-sm"
                  />
                </div>
              </div>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  disabled={
                    !bank || !amount || !interestRateAnnual || !startDate || !termMonths || createLoan.isPending
                  }
                  onClick={() => createLoan.mutate()}
                >
                  Guardar crédito
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setShowForm(false)}>
                  Cancelar
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
      </CardContent>
    </Card>
  );
}

// ─── Custom Tooltip ───────────────────────────────────────────
function CopTooltip({ active, payload, label }: {
  active?: boolean;
  payload?: Array<{ name: string; value: number; color: string }>;
  label?: string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border p-2 shadow-sm text-xs"
      style={{ background: 'rgba(10,15,40,0.95)', borderColor: 'rgba(99,179,237,0.2)', color: '#fff' }}>
      <p className="font-medium mb-1" style={{ color: '#e2e8f0' }}>{label}</p>
      {payload.map((p) => (
        <p key={p.name} style={{ color: p.color }}>
          {p.name}: {formatCOP(p.value)}
        </p>
      ))}
    </div>
  );
}

// ─── Main Page ───────────────────────────────────────────────
export default function CashflowPage({ params }: { params: { id: string } }) {
  const { id: projectId } = params;
  const qc = useQueryClient();
  const [kindFilter, setKindFilter] = useState<'ALL' | 'INGRESO' | 'EGRESO'>('ALL');
  const [chartMode, setChartMode] = useState<'bar' | 'curve'>('bar');

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

  // Chart data: transform byMonth for recharts
  const barChartData = useMemo(() => {
    if (!summary?.byMonth) return [];
    return summary.byMonth.map((m) => ({
      month: formatMonthLabel(m.month),
      Ingresos: Number(m.ingresos),
      Egresos: Number(m.egresos),
    }));
  }, [summary]);

  const sCurveData = useMemo(() => {
    if (!summary?.byMonth) return [];
    let cumIngresos = 0;
    let cumEgresos = 0;
    return summary.byMonth.map((m) => {
      cumIngresos += Number(m.ingresos);
      cumEgresos += Number(m.egresos);
      return {
        month: formatMonthLabel(m.month),
        'Ingresos acumulados': cumIngresos,
        'Egresos acumulados': cumEgresos,
      };
    });
  }, [summary]);

  // Cumulative net for monthly table
  const byMonthWithCumulative = useMemo(() => {
    if (!summary?.byMonth) return [];
    let cumNet = 0;
    return summary.byMonth.map((m) => {
      cumNet += Number(m.net);
      return { ...m, cumNet };
    });
  }, [summary]);

  return (
    <div className="space-y-6">
      <ModuleHeader
        title="Flujo de Caja"
        description="Ingresos y egresos del proyecto · Crédito constructor · Curva S acumulada"
        infoText="Registra cada movimiento de dinero (ingreso o egreso) con su fecha y categoría. La Curva S muestra la acumulación de ingresos y egresos en el tiempo. El saldo neto acumulado indica la posición de caja del proyecto."
        actions={<NewEntryForm projectId={projectId} />}
      />

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

      {/* Charts Section */}
      {summary && summary.byMonth.length > 0 && (
        <div className="chart-section">
          <div className="flex items-center justify-between mb-4">
            <p className="text-sm font-semibold text-slate-300">Evolución mensual</p>
            <div className="flex gap-1">
              <button
                onClick={() => setChartMode('bar')}
                className={`rounded px-3 py-1 text-xs font-medium transition-colors ${
                  chartMode === 'bar'
                    ? 'bg-blue-600 text-white'
                    : 'text-slate-300 hover:text-white'
                }`}
                style={chartMode !== 'bar' ? { background: 'rgba(15,23,60,0.8)' } : undefined}
              >
                Barras
              </button>
              <button
                onClick={() => setChartMode('curve')}
                className={`rounded px-3 py-1 text-xs font-medium transition-colors ${
                  chartMode === 'curve'
                    ? 'bg-blue-600 text-white'
                    : 'text-slate-300 hover:text-white'
                }`}
                style={chartMode !== 'curve' ? { background: 'rgba(15,23,60,0.8)' } : undefined}
              >
                Curva S
              </button>
            </div>
          </div>
          {chartMode === 'bar' ? (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={barChartData} margin={{ top: 4, right: 8, left: 8, bottom: 4 }}>
                <defs>
                  <linearGradient id="ingGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#10b981" />
                    <stop offset="100%" stopColor="#059669" />
                  </linearGradient>
                  <linearGradient id="egGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#f43f5e" />
                    <stop offset="100%" stopColor="#e11d48" />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(99,179,237,0.1)" />
                <XAxis
                  dataKey="month"
                  tick={{ fontSize: 11, fill: '#94a3b8' }}
                  tickLine={false}
                />
                <YAxis
                  tickFormatter={formatMillions}
                  tick={{ fontSize: 11, fill: '#94a3b8' }}
                  tickLine={false}
                  axisLine={false}
                />
                <Tooltip content={<CopTooltip />} />
                <Legend wrapperStyle={{ fontSize: 12, color: '#94a3b8' }} />
                <Bar dataKey="Ingresos" fill="url(#ingGrad)" radius={[3, 3, 0, 0]} />
                <Bar dataKey="Egresos"  fill="url(#egGrad)"  radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <AreaChart data={sCurveData} margin={{ top: 4, right: 8, left: 8, bottom: 4 }}>
                <defs>
                  <linearGradient id="ingAreaGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor="#10b981" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0.02} />
                  </linearGradient>
                  <linearGradient id="egAreaGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor="#f43f5e" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#f43f5e" stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(99,179,237,0.1)" />
                <XAxis
                  dataKey="month"
                  tick={{ fontSize: 11, fill: '#94a3b8' }}
                  tickLine={false}
                />
                <YAxis
                  tickFormatter={formatMillions}
                  tick={{ fontSize: 11, fill: '#94a3b8' }}
                  tickLine={false}
                  axisLine={false}
                />
                <Tooltip content={<CopTooltip />} />
                <Legend wrapperStyle={{ fontSize: 12, color: '#94a3b8' }} />
                <Area
                  type="monotone"
                  dataKey="Ingresos acumulados"
                  stroke="#10b981"
                  fill="url(#ingAreaGrad)"
                  fillOpacity={1}
                  strokeWidth={2.5}
                />
                <Area
                  type="monotone"
                  dataKey="Egresos acumulados"
                  stroke="#f43f5e"
                  fill="url(#egAreaGrad)"
                  fillOpacity={1}
                  strokeWidth={2.5}
                />
              </AreaChart>
            </ResponsiveContainer>
          )}
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
                    <th className="py-2 pr-4 text-right font-medium">Neto</th>
                    <th className="py-2 text-right font-medium">Acumulado neto</th>
                  </tr>
                </thead>
                <tbody>
                  {byMonthWithCumulative.map((m) => (
                    <tr key={m.month} className="border-b last:border-0">
                      <td className="py-2 pr-4 font-medium">{m.month}</td>
                      <td className="py-2 pr-4 text-right text-green-700 font-mono">
                        {formatCOP(m.ingresos)}
                      </td>
                      <td className="py-2 pr-4 text-right text-red-700 font-mono">
                        {formatCOP(m.egresos)}
                      </td>
                      <td
                        className={`py-2 pr-4 text-right font-mono font-medium ${
                          Number(m.net) >= 0 ? 'text-green-700' : 'text-red-700'
                        }`}
                      >
                        {formatCOP(m.net)}
                      </td>
                      <td
                        className={`py-2 text-right font-mono font-bold ${
                          m.cumNet >= 0 ? 'text-green-700' : 'text-red-700'
                        }`}
                      >
                        {formatCOP(m.cumNet)}
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

      {/* Loan Facilities */}
      <LoanSection projectId={projectId} />
    </div>
  );
}
