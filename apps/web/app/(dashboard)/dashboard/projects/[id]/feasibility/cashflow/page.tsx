'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus, Save, Trash2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { api } from '@/lib/api-client';

type CFRow = {
  id?: string;
  key: string;
  year: number;
  month: number;
  initialBalance: string;
  salesInitialPayment: string;
  salesFinalPayment: string;
  ownResources: string;
  constructionCredit: string;
  directCosts: string;
  indirectCosts: string;
  financialCosts: string;
  finalBalance: string;
  isNew?: boolean;
};

const MONTHS_ES = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
const fmtM = (v: string) => {
  const n = Number(v);
  if (!v || isNaN(n)) return '0';
  if (Math.abs(n) >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (Math.abs(n) >= 1_000) return `${(n / 1_000).toFixed(0)}K`;
  return n.toFixed(0);
};

let keyCounter = 0;
const newKey = () => `cf-${++keyCounter}`;

const emptyRow = (year: number, month: number): CFRow => ({
  key: newKey(),
  year,
  month,
  initialBalance: '0',
  salesInitialPayment: '0',
  salesFinalPayment: '0',
  ownResources: '0',
  constructionCredit: '0',
  directCosts: '0',
  indirectCosts: '0',
  financialCosts: '0',
  finalBalance: '0',
  isNew: true,
});

export default function FeasibilityCashflowPage({ params }: { params: { id: string } }) {
  const { id } = params;
  const qc = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ['feasibility', id],
    queryFn: () => api.getFeasibility(id),
  });

  const [rows, setRows] = useState<CFRow[]>([]);
  const [dirty, setDirty] = useState(false);

  const fd = data as unknown as { cashFlow?: Array<Record<string, string | number>> } | undefined;

  useEffect(() => {
    if (fd?.cashFlow) {
      setRows(
        fd.cashFlow
          .sort((a, b) => (Number(a.year) * 12 + Number(a.month)) - (Number(b.year) * 12 + Number(b.month)))
          .map((r) => ({
            key: String(r.id),
            id: String(r.id),
            year: Number(r.year),
            month: Number(r.month),
            initialBalance: String(r.initialBalance ?? '0'),
            salesInitialPayment: String(r.salesInitialPayment ?? '0'),
            salesFinalPayment: String(r.salesFinalPayment ?? '0'),
            ownResources: String(r.ownResources ?? '0'),
            constructionCredit: String(r.constructionCredit ?? '0'),
            directCosts: String(r.directCosts ?? '0'),
            indirectCosts: String(r.indirectCosts ?? '0'),
            financialCosts: String(r.financialCosts ?? '0'),
            finalBalance: String(r.finalBalance ?? '0'),
          })),
      );
      setDirty(false);
    }
  }, [fd]);

  const saveMutation = useMutation({
    mutationFn: (rs: CFRow[]) =>
      api.replaceFeasibilityCashFlow(
        id,
        rs.map((r) => ({
          year: r.year,
          month: r.month,
          initialBalance: r.initialBalance || '0',
          salesInitialPayment: r.salesInitialPayment || '0',
          salesFinalPayment: r.salesFinalPayment || '0',
          ownResources: r.ownResources || '0',
          constructionCredit: r.constructionCredit || '0',
          directCosts: r.directCosts || '0',
          indirectCosts: r.indirectCosts || '0',
          financialCosts: r.financialCosts || '0',
          finalBalance: r.finalBalance || '0',
        })),
      ),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['feasibility', id] });
      setDirty(false);
      toast.success('Flujo de caja guardado');
    },
    onError: () => toast.error('Error al guardar'),
  });

  const updateRow = (key: string, field: keyof CFRow, value: string) => {
    setRows((prev) =>
      prev.map((r) => {
        if (r.key !== key) return r;
        const updated = { ...r, [field]: value };
        // Recalculate final balance
        const ingresos =
          (Number(updated.initialBalance) || 0) +
          (Number(updated.salesInitialPayment) || 0) +
          (Number(updated.salesFinalPayment) || 0) +
          (Number(updated.ownResources) || 0) +
          (Number(updated.constructionCredit) || 0);
        const egresos =
          (Number(updated.directCosts) || 0) +
          (Number(updated.indirectCosts) || 0) +
          (Number(updated.financialCosts) || 0);
        updated.finalBalance = String(ingresos - egresos);
        return updated;
      }),
    );
    setDirty(true);
  };

  const addRow = () => {
    const last = rows[rows.length - 1];
    let year = last ? last.year : new Date().getFullYear();
    let month = last ? last.month + 1 : 1;
    if (month > 12) { month = 1; year++; }
    setRows((prev) => [...prev, emptyRow(year, month)]);
    setDirty(true);
  };

  const removeRow = (key: string) => {
    setRows((prev) => prev.filter((r) => r.key !== key));
    setDirty(true);
  };

  // Chart data
  const chartData = rows.map((r) => ({
    label: `${MONTHS_ES[(r.month - 1) % 12]} ${r.year}`,
    ingresos: (Number(r.salesInitialPayment) || 0) + (Number(r.salesFinalPayment) || 0) + (Number(r.ownResources) || 0) + (Number(r.constructionCredit) || 0),
    egresos: (Number(r.directCosts) || 0) + (Number(r.indirectCosts) || 0) + (Number(r.financialCosts) || 0),
    saldo: Number(r.finalBalance) || 0,
  }));

  // Cumulative S-curve
  let cumIngreso = 0;
  let cumEgreso = 0;
  const sCurve = chartData.map((d) => {
    cumIngreso += d.ingresos;
    cumEgreso += d.egresos;
    return { label: d.label, cumIngreso, cumEgreso };
  });

  const fields: Array<{ key: keyof CFRow; label: string; type: 'ingreso' | 'egreso' | 'balance' }> = [
    { key: 'initialBalance', label: 'Saldo inicial', type: 'balance' },
    { key: 'salesInitialPayment', label: 'Cuotas iniciales', type: 'ingreso' },
    { key: 'salesFinalPayment', label: 'Saldos venta', type: 'ingreso' },
    { key: 'ownResources', label: 'Recursos propios', type: 'ingreso' },
    { key: 'constructionCredit', label: 'Crédito constructor', type: 'ingreso' },
    { key: 'directCosts', label: 'Costos directos', type: 'egreso' },
    { key: 'indirectCosts', label: 'Costos indirectos', type: 'egreso' },
    { key: 'financialCosts', label: 'Costos financieros', type: 'egreso' },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold">Flujo de caja prefactibilidad</h1>
          <p className="text-sm text-muted-foreground">Proyección mensual de ingresos y egresos</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={addRow}>
            <Plus className="h-4 w-4 mr-1" /> Agregar mes
          </Button>
          <Button
            onClick={() => saveMutation.mutate(rows)}
            disabled={!dirty || saveMutation.isPending}
            className="bg-teal-600 hover:bg-teal-700"
            size="sm"
          >
            <Save className="h-4 w-4 mr-1.5" />
            {saveMutation.isPending ? 'Guardando…' : 'Guardar'}
          </Button>
        </div>
      </div>

      {/* Charts */}
      {chartData.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Ingresos vs Egresos mensuales</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={chartData} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="label" tick={{ fontSize: 10 }} />
                  <YAxis tick={{ fontSize: 10 }} tickFormatter={(v: number) => fmtM(String(v))} />
                  <Tooltip formatter={(v) => [`$${Number(v).toLocaleString('es-CO')}`, '']} />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  <Bar dataKey="ingresos" name="Ingresos" fill="#14b8a6" radius={[3, 3, 0, 0]} />
                  <Bar dataKey="egresos" name="Egresos" fill="#f87171" radius={[3, 3, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Curva S acumulada</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={200}>
                <AreaChart data={sCurve} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="label" tick={{ fontSize: 10 }} />
                  <YAxis tick={{ fontSize: 10 }} tickFormatter={(v: number) => fmtM(String(v))} />
                  <Tooltip formatter={(v) => [`$${Number(v).toLocaleString('es-CO')}`, '']} />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  <Area type="monotone" dataKey="cumIngreso" name="Ingr. acum." stroke="#14b8a6" fill="#ccfbf1" />
                  <Area type="monotone" dataKey="cumEgreso" name="Egr. acum." stroke="#f87171" fill="#fee2e2" />
                </AreaChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Table */}
      {isLoading ? (
        <div className="h-48 animate-pulse rounded-xl bg-muted" />
      ) : (
        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead className="bg-muted/40 text-muted-foreground">
                  <tr>
                    <th className="text-left px-3 py-2 font-medium sticky left-0 bg-muted/40 min-w-[90px]">Período</th>
                    {fields.map((f) => (
                      <th key={String(f.key)} className={`text-right px-2 py-2 font-medium min-w-[100px] ${f.type === 'egreso' ? 'text-red-600' : f.type === 'ingreso' ? 'text-teal-700' : ''}`}>
                        {f.label}
                      </th>
                    ))}
                    <th className="text-right px-2 py-2 font-medium min-w-[100px]">Saldo final</th>
                    <th className="w-8 px-2" />
                  </tr>
                </thead>
                <tbody>
                  {rows.length === 0 && (
                    <tr>
                      <td colSpan={fields.length + 3} className="py-8 text-center text-muted-foreground">
                        Sin datos. Agrega meses o importa el Excel.
                      </td>
                    </tr>
                  )}
                  {rows.map((row) => (
                    <tr key={row.key} className="border-t hover:bg-muted/20">
                      <td className="px-3 py-1 sticky left-0 bg-background font-medium">
                        {MONTHS_ES[(row.month - 1) % 12]} {row.year}
                      </td>
                      {fields.map((f) => (
                        <td key={String(f.key)} className="px-2 py-1">
                          <input
                            className="w-full text-right bg-transparent outline-none font-mono"
                            value={String(row[f.key])}
                            onChange={(e) => updateRow(row.key, f.key, e.target.value)}
                          />
                        </td>
                      ))}
                      <td className={`px-2 py-1 text-right font-mono font-semibold ${Number(row.finalBalance) >= 0 ? 'text-teal-700' : 'text-red-600'}`}>
                        {Number(row.finalBalance).toLocaleString('es-CO')}
                      </td>
                      <td className="px-2 py-1">
                        <button onClick={() => removeRow(row.key)} className="text-muted-foreground hover:text-destructive">
                          <Trash2 className="h-3 w-3" />
                        </button>
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
