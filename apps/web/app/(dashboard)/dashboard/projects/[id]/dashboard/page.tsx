'use client';

import { useQuery } from '@tanstack/react-query';
import {
  AlertTriangle,
  BarChart3,
  Building2,
  CheckCircle,
  DollarSign,
  Info,
  TrendingDown,
  TrendingUp,
} from 'lucide-react';
import { use } from 'react';
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

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { api } from '@/lib/api-client';

// ─── Types ────────────────────────────────────────────────────────────────────

type DashboardPresupuesto = {
  directCost: string;
  totalBudget: string;
  executedCost: string;
  executedPct: string;
};

type DashboardVentas = {
  totalListPrice: string;
  totalSalesValue: string;
  margenBruto: string;
  margenPct: string;
  unitsSold: number;
  unitsAvailable: number;
  totalUnits: number;
  costoPorM2: string;
  precioPorM2: string;
};

type DashboardCronograma = {
  totalTasks: number;
  criticalTasks: number;
  avgProgress: number;
};

type DashboardCaja = {
  totalIngresos: string;
  totalEgresos: string;
  saldoNeto: string;
};

type DashboardCambios = {
  approved: number;
  pending: number;
  totalCOImpact: string;
};

type DashboardKpis = {
  presupuesto: DashboardPresupuesto;
  ventas: DashboardVentas;
  cronograma: DashboardCronograma;
  caja: DashboardCaja;
  cambios: DashboardCambios;
};

type SCurvePoint = {
  month: string;
  ingresos: string;
  egresos: string;
  acumulado: string;
};

type AlertItem = { type: 'warning' | 'danger' | 'info'; message: string };

type DashboardSummary = {
  kpis: DashboardKpis;
  sCurve: SCurvePoint[];
  alerts: AlertItem[];
};

// ─── Formatters ───────────────────────────────────────────────────────────────

function formatCOP(v: string | number) {
  return new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    notation: 'compact',
    maximumFractionDigits: 1,
  }).format(Number(v));
}

function formatCOPFull(v: string | number) {
  return new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    maximumFractionDigits: 0,
  }).format(Number(v));
}

function formatPct(v: string | number) {
  return `${Number(v).toFixed(1)}%`;
}

// ─── Components ───────────────────────────────────────────────────────────────

type KpiCardProps = {
  title: string;
  value: string;
  subtitle?: string;
  icon: React.ReactNode;
  highlight?: 'green' | 'red' | 'blue' | 'orange';
};

function KpiCard({ title, value, subtitle, icon, highlight }: KpiCardProps) {
  const colors: Record<string, string> = {
    green: 'text-green-600',
    red: 'text-red-600',
    blue: 'text-blue-600',
    orange: 'text-orange-600',
  };
  const color = highlight ? colors[highlight] : 'text-foreground';
  return (
    <Card>
      <CardContent className="pt-5">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs text-muted-foreground">{title}</p>
            <p className={`mt-1 text-2xl font-bold ${color}`}>{value}</p>
            {subtitle && <p className="mt-0.5 text-xs text-muted-foreground">{subtitle}</p>}
          </div>
          <div className="rounded-lg bg-muted p-2 text-muted-foreground">{icon}</div>
        </div>
      </CardContent>
    </Card>
  );
}

function AlertBanner({ alert }: { alert: AlertItem }) {
  const styles = {
    warning: { bg: 'bg-amber-50 border-amber-200', text: 'text-amber-800', Icon: AlertTriangle },
    danger: { bg: 'bg-red-50 border-red-200', text: 'text-red-800', Icon: TrendingDown },
    info: { bg: 'bg-blue-50 border-blue-200', text: 'text-blue-800', Icon: Info },
  };
  const { bg, text, Icon } = styles[alert.type];
  return (
    <div className={`flex items-center gap-2 rounded-lg border px-4 py-2 text-sm ${bg} ${text}`}>
      <Icon className="h-4 w-4 shrink-0" />
      {alert.message}
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function DashboardPage({ params }: { params: { id: string } }) {
  const { id: projectId } = params;

  const { data: rawData, isLoading, error } = useQuery({
    queryKey: ['dashboard', projectId],
    queryFn: () => api.getDashboardSummary(projectId),
    refetchInterval: 60_000,
  });

  const data = rawData as unknown as DashboardSummary | undefined;
  const { presupuesto, ventas, cronograma, caja, cambios } = data?.kpis ?? ({} as Partial<DashboardKpis>);
  const sCurve = data?.sCurve ?? [];
  const alerts = data?.alerts ?? [];

  if (isLoading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <p className="text-sm text-muted-foreground">Cargando dashboard…</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex h-64 items-center justify-center">
        <p className="text-sm text-destructive">
          Error al cargar el dashboard. Verifique la conexión con la API.
        </p>
      </div>
    );
  }

  // Chart data
  const chartData = sCurve.map((p) => ({
    mes: p.month,
    Ingresos: Number(p.ingresos),
    Egresos: Number(p.egresos),
    'Saldo acum.': Number(p.acumulado),
  }));

  const executedPct = Number(presupuesto?.executedPct ?? 0);
  const margenPct = Number(ventas?.margenPct ?? 0);
  const saldoNeto = Number(caja?.saldoNeto ?? 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <header>
        <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-muted-foreground">Vista ejecutiva con KPIs, curva S y alertas del proyecto.</p>
      </header>

      {/* Alerts */}
      {alerts.length > 0 && (
        <section className="space-y-2">
          {alerts.map((a, i) => (
            <AlertBanner key={i} alert={a} />
          ))}
        </section>
      )}

      {/* Budget KPIs */}
      <section>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Presupuesto
        </h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <KpiCard
            title="Costo directo"
            value={formatCOP(presupuesto?.directCost ?? 0)}
            icon={<DollarSign className="h-4 w-4" />}
          />
          <KpiCard
            title="Presupuesto total (con AIU)"
            value={formatCOP(presupuesto?.totalBudget ?? 0)}
            icon={<BarChart3 className="h-4 w-4" />}
            highlight="blue"
          />
          <KpiCard
            title="Costo ejecutado"
            value={formatCOP(presupuesto?.executedCost ?? 0)}
            subtitle={formatCOPFull(presupuesto?.executedCost ?? 0)}
            icon={<TrendingUp className="h-4 w-4" />}
            highlight={executedPct > 90 ? 'red' : executedPct > 70 ? 'orange' : 'green'}
          />
          <KpiCard
            title="% Ejecución"
            value={`${presupuesto?.executedPct ?? 0}%`}
            icon={<CheckCircle className="h-4 w-4" />}
            highlight={executedPct > 90 ? 'red' : executedPct > 70 ? 'orange' : 'green'}
          />
        </div>
      </section>

      {/* Sales KPIs */}
      <section>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Ventas
        </h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <KpiCard
            title="Precio lista total"
            value={formatCOP(ventas?.totalListPrice ?? 0)}
            icon={<Building2 className="h-4 w-4" />}
          />
          <KpiCard
            title="Ventas realizadas"
            value={formatCOP(ventas?.totalSalesValue ?? 0)}
            subtitle={`${ventas?.unitsSold ?? 0} unidades vendidas`}
            icon={<TrendingUp className="h-4 w-4" />}
            highlight="green"
          />
          <KpiCard
            title="Margen bruto"
            value={formatCOP(ventas?.margenBruto ?? 0)}
            subtitle={formatPct(ventas?.margenPct ?? 0)}
            icon={<DollarSign className="h-4 w-4" />}
            highlight={margenPct >= 15 ? 'green' : margenPct >= 8 ? 'orange' : 'red'}
          />
          <KpiCard
            title="Unidades disponibles"
            value={String(ventas?.unitsAvailable ?? 0)}
            subtitle={`de ${ventas?.totalUnits ?? 0} totales`}
            icon={<Building2 className="h-4 w-4" />}
          />
        </div>
        <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <KpiCard
            title="Costo/m² vendible"
            value={formatCOPFull(ventas?.costoPorM2 ?? 0)}
            icon={<BarChart3 className="h-4 w-4" />}
          />
          <KpiCard
            title="Precio/m² lista"
            value={formatCOPFull(ventas?.precioPorM2 ?? 0)}
            icon={<TrendingUp className="h-4 w-4" />}
          />
        </div>
      </section>

      {/* Schedule + Cash + Changes */}
      <div className="grid gap-4 lg:grid-cols-3">
        {/* Schedule */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Cronograma</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div>
              <p className="text-xs text-muted-foreground">Avance promedio</p>
              <p className="text-3xl font-bold text-blue-600">{cronograma?.avgProgress ?? 0}%</p>
            </div>
            <div className="h-2 w-full rounded-full bg-muted">
              <div
                className="h-2 rounded-full bg-blue-600 transition-all"
                style={{ width: `${cronograma?.avgProgress ?? 0}%` }}
              />
            </div>
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>{cronograma?.totalTasks ?? 0} tareas totales</span>
              <span className="font-medium text-red-600">
                {cronograma?.criticalTasks ?? 0} críticas
              </span>
            </div>
          </CardContent>
        </Card>

        {/* Cash flow */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Flujo de caja</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Ingresos</span>
              <span className="font-medium text-green-600">
                {formatCOP(caja?.totalIngresos ?? 0)}
              </span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Egresos</span>
              <span className="font-medium text-red-600">
                {formatCOP(caja?.totalEgresos ?? 0)}
              </span>
            </div>
            <div className="border-t pt-2">
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold">Saldo neto</span>
                <span
                  className={`text-lg font-bold ${saldoNeto >= 0 ? 'text-green-600' : 'text-red-600'}`}
                >
                  {formatCOP(caja?.saldoNeto ?? 0)}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Change orders */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Órdenes de cambio</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Aprobadas / Aplicadas</span>
              <span className="font-medium text-green-600">{cambios?.approved ?? 0}</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Pendientes</span>
              <span
                className={`font-medium ${Number(cambios?.pending ?? 0) > 0 ? 'text-amber-600' : 'text-muted-foreground'}`}
              >
                {cambios?.pending ?? 0}
              </span>
            </div>
            <div className="border-t pt-2">
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold">Impacto aprobado</span>
                <span className="text-lg font-bold text-blue-600">
                  {formatCOP(cambios?.totalCOImpact ?? 0)}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* S-Curve */}
      {chartData.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Curva S — Flujo de caja mensual</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={chartData} barCategoryGap="30%">
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="mes" tick={{ fontSize: 11 }} />
                <YAxis
                  tickFormatter={(v: number) =>
                    new Intl.NumberFormat('es-CO', {
                      notation: 'compact',
                      maximumFractionDigits: 1,
                    }).format(v)
                  }
                  tick={{ fontSize: 11 }}
                  width={70}
                />
                <Tooltip
                  formatter={(value) => [formatCOPFull(Number(value)), '']}
                  labelFormatter={(label) => `Mes: ${label}`}
                />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Bar dataKey="Ingresos" fill="#22c55e" radius={[3, 3, 0, 0]} />
                <Bar dataKey="Egresos" fill="#ef4444" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>

            <div className="mt-4">
              <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Saldo acumulado
              </p>
              <ResponsiveContainer width="100%" height={120}>
                <AreaChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="mes" tick={{ fontSize: 10 }} />
                  <YAxis
                    tickFormatter={(v: number) =>
                      new Intl.NumberFormat('es-CO', {
                        notation: 'compact',
                        maximumFractionDigits: 1,
                      }).format(v)
                    }
                    tick={{ fontSize: 10 }}
                    width={70}
                  />
                  <Tooltip formatter={(value) => [formatCOPFull(Number(value)), '']} />
                  <Area
                    type="monotone"
                    dataKey="Saldo acum."
                    stroke="#6366f1"
                    fill="#e0e7ff"
                    strokeWidth={2}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="flex h-40 items-center justify-center">
            <p className="text-sm text-muted-foreground">
              Sin datos de flujo de caja. Registre entradas en el módulo de Flujo de Caja para
              ver la curva S.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
