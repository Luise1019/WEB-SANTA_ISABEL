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
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

import { api } from '@/lib/api-client';

// ─── Types ────────────────────────────────────────────────────────────────────

type DashboardPresupuesto = {
  directCost: string; totalBudget: string; executedCost: string; executedPct: string;
};
type DashboardVentas = {
  totalListPrice: string; totalSalesValue: string; margenBruto: string; margenPct: string;
  unitsSold: number; unitsAvailable: number; totalUnits: number;
  costoPorM2: string; precioPorM2: string;
};
type DashboardCronograma = { totalTasks: number; criticalTasks: number; avgProgress: number };
type DashboardCaja = { totalIngresos: string; totalEgresos: string; saldoNeto: string };
type DashboardCambios = { approved: number; pending: number; totalCOImpact: string };
type DashboardKpis = {
  presupuesto: DashboardPresupuesto; ventas: DashboardVentas;
  cronograma: DashboardCronograma; caja: DashboardCaja; cambios: DashboardCambios;
};
type SCurvePoint = { month: string; ingresos: string; egresos: string; acumulado: string };
type AlertItem = { type: 'warning' | 'danger' | 'info'; message: string };
type DashboardSummary = { kpis: DashboardKpis; sCurve: SCurvePoint[]; alerts: AlertItem[] };

// ─── Formatters ───────────────────────────────────────────────────────────────

function formatCOP(v: string | number) {
  return new Intl.NumberFormat('es-CO', {
    style: 'currency', currency: 'COP', notation: 'compact', maximumFractionDigits: 1,
  }).format(Number(v));
}
function formatCOPFull(v: string | number) {
  return new Intl.NumberFormat('es-CO', {
    style: 'currency', currency: 'COP', maximumFractionDigits: 0,
  }).format(Number(v));
}
function formatPct(v: string | number) { return `${Number(v).toFixed(1)}%`; }

// ─── Custom Tooltip ───────────────────────────────────────────────────────────

function CopTooltip({ active, payload, label }: Record<string, unknown>) {
  if (!active || !Array.isArray(payload) || !payload.length) return null;
  return (
    <div className="rounded-lg border px-3 py-2.5 text-xs shadow-lg"
      style={{ background: 'rgba(10,15,40,0.95)', borderColor: 'rgba(99,179,237,0.2)', color: '#fff' }}>
      <p className="font-semibold mb-1" style={{ color: '#e2e8f0' }}>{label as string}</p>
      {(payload as Array<{ name: string; value: number; color: string }>).map((p) => (
        <div key={p.name} className="flex items-center gap-2">
          <span className="h-2 w-2 rounded-full" style={{ background: p.color }} />
          <span style={{ color: '#94a3b8' }}>{p.name}:</span>
          <span className="font-medium" style={{ color: '#fff' }}>{formatCOPFull(p.value)}</span>
        </div>
      ))}
    </div>
  );
}

// ─── KPI Card (dark glassmorphism) ────────────────────────────────────────────

type KpiCardProps = {
  title: string; value: string; subtitle?: string;
  icon: React.ReactNode; highlight?: 'green' | 'red' | 'blue' | 'orange' | 'indigo';
  trend?: { value: string; up: boolean };
};

function KpiCard({ title, value, subtitle, icon, highlight, trend }: KpiCardProps) {
  const gradientMap: Record<string, string> = {
    blue:   'linear-gradient(135deg, #1e3a8a 0%, #1e40af 100%)',
    green:  'linear-gradient(135deg, #065f46 0%, #047857 100%)',
    indigo: 'linear-gradient(135deg, #312e81 0%, #4338ca 100%)',
    red:    'linear-gradient(135deg, #7f1d1d 0%, #991b1b 100%)',
    orange: 'linear-gradient(135deg, #78350f 0%, #92400e 100%)',
  };

  const isDark = !!highlight;
  const gradientBg = highlight ? gradientMap[highlight] : undefined;

  return (
    <div
      className="overflow-hidden rounded-xl"
      style={gradientBg
        ? { background: gradientBg, border: '1px solid rgba(255,255,255,0.08)', boxShadow: '0 4px 16px rgba(0,0,0,0.3)' }
        : { background: 'rgba(15,23,60,0.6)', border: '1px solid rgba(99,179,237,0.12)', boxShadow: '0 4px 16px rgba(0,0,0,0.2)' }
      }
    >
      <div className="pt-5 pb-4 px-4">
        <div className="flex items-start justify-between">
          <div className="flex-1 min-w-0">
            <p className="text-xs font-medium uppercase tracking-wide truncate" style={{ color: '#94a3b8' }}>{title}</p>
            <p className="mt-1.5 text-2xl font-bold tracking-tight text-white">{value}</p>
            {subtitle && <p className="mt-0.5 text-xs" style={{ color: '#94a3b8' }}>{subtitle}</p>}
            {trend && (
              <div className={`mt-1.5 flex items-center gap-1 text-xs font-medium ${trend.up ? 'text-emerald-400' : 'text-red-400'}`}>
                {trend.up ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                {trend.value}
              </div>
            )}
          </div>
          <div className="rounded-xl p-2.5 shrink-0 ml-3" style={{ background: 'rgba(255,255,255,0.1)' }}>
            <span className="text-white">{icon}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Progress ring ────────────────────────────────────────────────────────────

function ProgressRing({ value, size = 80 }: { value: number; size?: number }) {
  const r = (size - 10) / 2;
  const circ = 2 * Math.PI * r;
  const fill = circ * (1 - value / 100);
  const gradId = 'progressGrad';
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90">
      <defs>
        <linearGradient id={gradId} x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#06b6d4" />
          <stop offset="100%" stopColor="#3b82f6" />
        </linearGradient>
      </defs>
      <circle cx={size/2} cy={size/2} r={r} fill="none" strokeWidth={8} stroke="rgba(99,179,237,0.15)" />
      <circle
        cx={size/2} cy={size/2} r={r} fill="none" strokeWidth={8}
        stroke={`url(#${gradId})`} strokeLinecap="round"
        strokeDasharray={circ} strokeDashoffset={fill}
        style={{ transition: 'stroke-dashoffset 0.8s ease' }}
      />
    </svg>
  );
}

// ─── Alert banner ─────────────────────────────────────────────────────────────

function AlertBanner({ alert }: { alert: AlertItem }) {
  const styles = {
    warning: { bg: 'bg-amber-50 border-amber-200', text: 'text-amber-800', Icon: AlertTriangle, dot: 'bg-amber-500' },
    danger:  { bg: 'bg-red-50 border-red-200',     text: 'text-red-800',   Icon: TrendingDown,  dot: 'bg-red-500' },
    info:    { bg: 'bg-blue-50 border-blue-200',   text: 'text-blue-800',  Icon: Info,          dot: 'bg-blue-500' },
  };
  const { bg, text, Icon, dot } = styles[alert.type];
  return (
    <div className={`flex items-center gap-3 rounded-lg border px-4 py-2.5 text-sm ${bg} ${text}`}>
      <div className={`h-1.5 w-1.5 rounded-full shrink-0 ${dot}`} />
      <Icon className="h-4 w-4 shrink-0 opacity-70" />
      {alert.message}
    </div>
  );
}

// ─── Section header ───────────────────────────────────────────────────────────

function SectionHeader({ title, dark }: { title: string; dark?: boolean }) {
  return (
    <div className="flex items-center gap-3 mb-4">
      <div className="h-4 w-1 rounded-full bg-blue-500" />
      <h2 className={`text-xs font-bold uppercase tracking-widest ${dark ? 'text-slate-400' : 'text-slate-500'}`}>{title}</h2>
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
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-blue-600 border-t-transparent" />
          <p className="text-sm text-muted-foreground">Cargando dashboard…</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex h-64 items-center justify-center">
        <p className="text-sm text-destructive">Error al cargar el dashboard.</p>
      </div>
    );
  }

  const chartData = sCurve.map((p) => ({
    mes: p.month,
    Ingresos: Number(p.ingresos),
    Egresos: Number(p.egresos),
    Saldo: Number(p.acumulado),
  }));

  const executedPct  = Number(presupuesto?.executedPct ?? 0);
  const margenPct    = Number(ventas?.margenPct ?? 0);
  const saldoNeto    = Number(caja?.saldoNeto ?? 0);
  const unitsSold    = ventas?.unitsSold ?? 0;
  const totalUnits   = ventas?.totalUnits ?? 0;
  const unitsAvail   = ventas?.unitsAvailable ?? 0;

  // Donut data para unidades
  const unitDonut = [
    { name: 'Vendidas',    value: unitsSold, color: '#10b981' },
    { name: 'Disponibles', value: unitsAvail, color: '#6366f1' },
    { name: 'Otras',       value: Math.max(0, totalUnits - unitsSold - unitsAvail), color: 'rgba(148,163,184,0.3)' },
  ].filter((d) => d.value > 0);

  const yTickFmt = (v: number) =>
    new Intl.NumberFormat('es-CO', { notation: 'compact', maximumFractionDigits: 1 }).format(v);

  return (
    <div className="space-y-8">

      {/* ── Header ── */}
      <header>
        <h1 className="text-2xl font-bold tracking-tight">Dashboard ejecutivo</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          KPIs en tiempo real, curva S y alertas del proyecto
        </p>
      </header>

      {/* ── Alertas ── */}
      {alerts.length > 0 && (
        <section className="space-y-2">
          {alerts.map((a, i) => <AlertBanner key={i} alert={a} />)}
        </section>
      )}

      {/* ── Presupuesto ── */}
      <section>
        <SectionHeader title="Presupuesto" />
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <KpiCard title="Costo directo" value={formatCOP(presupuesto?.directCost ?? 0)} icon={<DollarSign className="h-4 w-4" />} highlight="blue" />
          <KpiCard title="Total con AIU" value={formatCOP(presupuesto?.totalBudget ?? 0)} icon={<BarChart3 className="h-4 w-4" />} highlight="indigo" />
          <KpiCard title="Costo ejecutado" value={formatCOP(presupuesto?.executedCost ?? 0)} subtitle={formatCOPFull(presupuesto?.executedCost ?? 0)} icon={<TrendingUp className="h-4 w-4" />} highlight={executedPct > 90 ? 'red' : executedPct > 70 ? 'orange' : 'green'} />
          <KpiCard title="% Ejecución" value={`${presupuesto?.executedPct ?? 0}%`} icon={<CheckCircle className="h-4 w-4" />} highlight={executedPct > 90 ? 'red' : executedPct > 70 ? 'orange' : 'blue'} />
        </div>
      </section>

      {/* ── Ventas ── */}
      <section>
        <SectionHeader title="Ventas" />
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <KpiCard title="Precio lista total" value={formatCOP(ventas?.totalListPrice ?? 0)} icon={<Building2 className="h-4 w-4" />} />
          <KpiCard title="Ventas realizadas" value={formatCOP(ventas?.totalSalesValue ?? 0)} subtitle={`${unitsSold} unidades`} icon={<TrendingUp className="h-4 w-4" />} highlight="green" />
          <KpiCard title="Margen bruto" value={formatCOP(ventas?.margenBruto ?? 0)} subtitle={formatPct(ventas?.margenPct ?? 0)} icon={<DollarSign className="h-4 w-4" />} highlight={margenPct >= 15 ? 'green' : margenPct >= 8 ? 'orange' : 'red'} />
          <KpiCard title="Unidades disponibles" value={String(unitsAvail)} subtitle={`de ${totalUnits} totales`} icon={<Building2 className="h-4 w-4" />} />
        </div>
        <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <KpiCard title="Costo / m² vendible" value={formatCOPFull(ventas?.costoPorM2 ?? 0)} icon={<BarChart3 className="h-4 w-4" />} />
          <KpiCard title="Precio / m² lista" value={formatCOPFull(ventas?.precioPorM2 ?? 0)} icon={<TrendingUp className="h-4 w-4" />} highlight="blue" />
        </div>
      </section>

      {/* ── Cronograma + Caja + Cambios + Donut ── */}
      <section>
        <SectionHeader title="Estado general" dark />
        <div className="chart-section">
          <div className="grid gap-4 lg:grid-cols-4">

            {/* Cronograma con aro */}
            <div className="glass-dark-card rounded-xl p-4">
              <p className="text-sm font-semibold text-slate-300 mb-3">Cronograma</p>
              <div className="flex flex-col items-center gap-2">
                <div className="relative">
                  <ProgressRing value={cronograma?.avgProgress ?? 0} size={96} />
                  <div className="absolute inset-0 flex items-center justify-center">
                    <span className="text-xl font-bold text-cyan-400">{cronograma?.avgProgress ?? 0}%</span>
                  </div>
                </div>
                <div className="w-full space-y-1 text-xs">
                  <div className="flex justify-between">
                    <span className="text-slate-400">Total tareas</span>
                    <span className="font-medium text-white">{cronograma?.totalTasks ?? 0}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Ruta crítica</span>
                    <span className="font-medium text-red-400">{cronograma?.criticalTasks ?? 0}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Donut unidades */}
            <div className="glass-dark-card rounded-xl p-4">
              <p className="text-sm font-semibold text-slate-300 mb-2">Unidades</p>
              {totalUnits > 0 ? (
                <ResponsiveContainer width="100%" height={120}>
                  <PieChart>
                    <Pie data={unitDonut} cx="50%" cy="50%" innerRadius={32} outerRadius={52}
                      dataKey="value" paddingAngle={3} strokeWidth={0}>
                      {unitDonut.map((d, i) => <Cell key={i} fill={d.color} />)}
                    </Pie>
                    <Tooltip formatter={(v, n) => [`${v} uds.`, n]} />
                    <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 11, color: '#94a3b8' }} />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex h-24 items-center justify-center text-xs text-slate-400">Sin unidades</div>
              )}
            </div>

            {/* Caja */}
            <div className="glass-dark-card rounded-xl p-4">
              <p className="text-sm font-semibold text-slate-300 mb-3">Flujo de caja</p>
              <div className="space-y-2.5">
                {[
                  { label: 'Ingresos', value: formatCOP(caja?.totalIngresos ?? 0), color: 'text-emerald-400' },
                  { label: 'Egresos',  value: formatCOP(caja?.totalEgresos  ?? 0), color: 'text-rose-400' },
                ].map(({ label, value, color }) => (
                  <div key={label} className="flex items-center justify-between text-sm">
                    <span className="text-slate-400">{label}</span>
                    <span className={`font-semibold ${color}`}>{value}</span>
                  </div>
                ))}
                <div className="border-t border-white/10 pt-2.5">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-semibold text-slate-300">Saldo neto</span>
                    <span className={`text-lg font-bold ${saldoNeto >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                      {formatCOP(caja?.saldoNeto ?? 0)}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Cambios */}
            <div className="glass-dark-card rounded-xl p-4">
              <p className="text-sm font-semibold text-slate-300 mb-3">Órdenes de cambio</p>
              <div className="space-y-2.5">
                {[
                  { label: 'Aprobadas / Aplicadas', value: String(cambios?.approved ?? 0), color: 'text-emerald-400' },
                  { label: 'Pendientes', value: String(cambios?.pending ?? 0), color: Number(cambios?.pending) > 0 ? 'text-amber-400' : 'text-slate-400' },
                ].map(({ label, value, color }) => (
                  <div key={label} className="flex items-center justify-between text-sm">
                    <span className="text-slate-400">{label}</span>
                    <span className={`font-semibold ${color}`}>{value}</span>
                  </div>
                ))}
                <div className="border-t border-white/10 pt-2.5">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-semibold text-slate-300">Impacto aprobado</span>
                    <span className="text-lg font-bold text-blue-400">{formatCOP(cambios?.totalCOImpact ?? 0)}</span>
                  </div>
                </div>
              </div>
            </div>

          </div>
        </div>
      </section>

      {/* ── Curva S ── */}
      {chartData.length > 0 ? (
        <section>
          <SectionHeader title="Curva S — Flujo de caja" dark />
          <div className="chart-section">
            {/* Barras Ingresos vs Egresos */}
            <p className="text-xs font-medium text-slate-400 mb-3 uppercase tracking-wide">Ingresos vs. Egresos mensual</p>
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={chartData} barCategoryGap="35%" barGap={4}>
                <defs>
                  <linearGradient id="ingGradDash" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#10b981" />
                    <stop offset="100%" stopColor="#059669" />
                  </linearGradient>
                  <linearGradient id="egGradDash" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#f43f5e" />
                    <stop offset="100%" stopColor="#e11d48" />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(99,179,237,0.1)" />
                <XAxis dataKey="mes" tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                <YAxis tickFormatter={yTickFmt} tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} width={68} />
                <Tooltip content={<CopTooltip />} />
                <Legend wrapperStyle={{ fontSize: 11, paddingTop: 8, color: '#94a3b8' }} iconType="circle" iconSize={8} />
                <Bar dataKey="Ingresos" fill="url(#ingGradDash)" radius={[4, 4, 0, 0]} />
                <Bar dataKey="Egresos"  fill="url(#egGradDash)"  radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>

            {/* Saldo acumulado — area */}
            <p className="text-xs font-medium text-slate-400 mt-6 mb-3 uppercase tracking-wide">Saldo acumulado</p>
            <ResponsiveContainer width="100%" height={140}>
              <AreaChart data={chartData} margin={{ top: 4, right: 8, bottom: 0, left: 0 }}>
                <defs>
                  <linearGradient id="saldoGradDark" x1="0" y1="0" x2="1" y2="0">
                    <stop offset="0%"   stopColor="#3b82f6" />
                    <stop offset="100%" stopColor="#8b5cf6" />
                  </linearGradient>
                  <linearGradient id="saldoFillDark" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor="#3b82f6" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(99,179,237,0.1)" />
                <XAxis dataKey="mes" tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                <YAxis tickFormatter={yTickFmt} tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} width={68} />
                <Tooltip content={<CopTooltip />} />
                <ReferenceLine y={0} stroke="rgba(99,179,237,0.3)" strokeWidth={1.5} />
                <Area
                  type="monotone" dataKey="Saldo"
                  stroke="url(#saldoGradDark)" strokeWidth={2.5}
                  fill="url(#saldoFillDark)"
                  dot={{ r: 3, fill: '#3b82f6', strokeWidth: 0 }}
                  activeDot={{ r: 5, strokeWidth: 0 }}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </section>
      ) : (
        <div className="chart-section flex h-40 items-center justify-center">
          <p className="text-sm text-slate-400">
            Sin datos de flujo de caja. Registre movimientos en el módulo de Flujo de Caja para ver la curva S.
          </p>
        </div>
      )}
    </div>
  );
}
