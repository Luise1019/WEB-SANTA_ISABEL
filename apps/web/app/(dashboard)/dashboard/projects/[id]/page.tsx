'use client';

import { useQuery } from '@tanstack/react-query';
import {
  AlertTriangle,
  ArrowRight,
  BarChart3,
  BookOpen,
  Calendar,
  CheckCircle2,
  Clock,
  DollarSign,
  FileText,
  LineChart,
  MapPin,
  ShieldCheck,
  TrendingUp,
  Users,
} from 'lucide-react';
import Link from 'next/link';
import React from 'react';

import { Button } from '@/components/ui/button';
import { api } from '@/lib/api-client';

const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  PREFACTIBILIDAD: { label: 'Prefactibilidad', color: 'bg-slate-100 text-slate-700' },
  FACTIBILIDAD: { label: 'Factibilidad', color: 'bg-blue-100 text-blue-700' },
  EJECUCION: { label: 'En ejecución', color: 'bg-green-100 text-green-700' },
  CIERRE: { label: 'Cierre', color: 'bg-amber-100 text-amber-700' },
  ARCHIVADO: { label: 'Archivado', color: 'bg-gray-100 text-gray-500' },
};

const HOUSING_CONFIG: Record<string, { label: string; color: string }> = {
  VIS: { label: 'VIS', color: 'bg-emerald-100 text-emerald-700' },
  VIP: { label: 'VIP', color: 'bg-teal-100 text-teal-700' },
  NO_VIS: { label: 'NO VIS', color: 'bg-purple-100 text-purple-700' },
  COMERCIAL: { label: 'Comercial', color: 'bg-orange-100 text-orange-700' },
  MIXTO: { label: 'Mixto', color: 'bg-pink-100 text-pink-700' },
};

type Project = {
  id: string;
  code: string;
  name: string;
  housingType: string;
  status: string;
  city: string;
  department: string;
  startDate: string;
  expectedEndDate: string;
  totalAreaM2?: string;
  saleableAreaM2?: string;
  description?: string;
};

const modules: Array<{
  href: string;
  icon: React.ElementType;
  title: string;
  description: string;
  badge: string;
  color: string;
  bgGradient: string;
  borderColor: string;
  iconBg: string;
}> = [
  {
    href: 'dashboard',
    icon: BarChart3,
    title: 'Dashboard',
    description: 'Vista ejecutiva con KPIs, alertas y curva S del proyecto',
    badge: 'KPIs ejecutivos · Alertas · Curva S',
    color: 'text-indigo-700',
    bgGradient: 'from-indigo-50 to-blue-50',
    borderColor: 'border-indigo-200',
    iconBg: 'bg-indigo-100 text-indigo-700',
  },
  {
    href: 'feasibility',
    icon: LineChart,
    title: 'Prefactibilidad',
    description: 'Análisis de rentabilidad y escenarios financieros',
    badge: 'TIR · VPN · Payback · Excel CREDICORP',
    color: 'text-teal-700',
    bgGradient: 'from-teal-50 to-cyan-50',
    borderColor: 'border-teal-200',
    iconBg: 'bg-teal-100 text-teal-700',
  },
  {
    href: 'budget',
    icon: DollarSign,
    title: 'Presupuesto',
    description: 'Estructura jerárquica de costos con análisis de precios',
    badge: 'Capítulos → Subcapítulos → Ítems · AIU · APUs',
    color: 'text-green-700',
    bgGradient: 'from-green-50 to-emerald-50',
    borderColor: 'border-green-200',
    iconBg: 'bg-green-100 text-green-700',
  },
  {
    href: 'schedule',
    icon: Calendar,
    title: 'Cronograma',
    description: 'Planificación de actividades y control de avance',
    badge: 'Gantt · CPM Ruta Crítica · Valor Ganado EV',
    color: 'text-blue-700',
    bgGradient: 'from-blue-50 to-sky-50',
    borderColor: 'border-blue-200',
    iconBg: 'bg-blue-100 text-blue-700',
  },
  {
    href: 'cashflow',
    icon: TrendingUp,
    title: 'Flujo de caja',
    description: 'Proyección y control de ingresos y egresos',
    badge: 'Ingresos/Egresos · Crédito constructor · Curva S',
    color: 'text-orange-700',
    bgGradient: 'from-orange-50 to-amber-50',
    borderColor: 'border-orange-200',
    iconBg: 'bg-orange-100 text-orange-700',
  },
  {
    href: 'sales',
    icon: Users,
    title: 'Ventas',
    description: 'Inventario de unidades y gestión comercial',
    badge: 'Torres · Unidades · Reservas · CRM básico',
    color: 'text-purple-700',
    bgGradient: 'from-purple-50 to-violet-50',
    borderColor: 'border-purple-200',
    iconBg: 'bg-purple-100 text-purple-700',
  },
  {
    href: 'logbook',
    icon: BookOpen,
    title: 'Bitácora',
    description: 'Registro diario de obra, personal, materiales y avances',
    badge: 'Entradas · Fotos · Personal · Equipo',
    color: 'text-sky-700',
    bgGradient: 'from-sky-50 to-blue-50',
    borderColor: 'border-sky-200',
    iconBg: 'bg-sky-100 text-sky-700',
  },
  {
    href: 'changes',
    icon: FileText,
    title: 'Cambios',
    description: 'Control de modificaciones al alcance del proyecto',
    badge: 'Órdenes de cambio · Aprobaciones · Línea base',
    color: 'text-red-700',
    bgGradient: 'from-red-50 to-rose-50',
    borderColor: 'border-red-200',
    iconBg: 'bg-red-100 text-red-700',
  },
  {
    href: 'quality',
    icon: AlertTriangle,
    title: 'Calidad',
    description: 'Gestión de no conformidades y acciones correctivas',
    badge: 'No conformidades · Acciones · Cierre',
    color: 'text-amber-700',
    bgGradient: 'from-amber-50 to-yellow-50',
    borderColor: 'border-amber-200',
    iconBg: 'bg-amber-100 text-amber-700',
  },
  {
    href: 'safety',
    icon: ShieldCheck,
    title: 'SST',
    description: 'Seguridad y salud en el trabajo, reportes de incidentes',
    badge: 'Reportes SST · Inspecciones · COPASST',
    color: 'text-emerald-700',
    bgGradient: 'from-emerald-50 to-green-50',
    borderColor: 'border-emerald-200',
    iconBg: 'bg-emerald-100 text-emerald-700',
  },
  {
    href: 'reports',
    icon: BarChart3,
    title: 'Reportes',
    description: 'Generación de informes ejecutivos en PDF',
    badge: 'PDF ejecutivo · Exportar · Compartir',
    color: 'text-slate-700',
    bgGradient: 'from-slate-50 to-gray-50',
    borderColor: 'border-slate-200',
    iconBg: 'bg-slate-100 text-slate-700',
  },
];

type MiniKpi = {
  kpis: {
    presupuesto: { directCost: string; executedPct: string };
    ventas: { unitsSold: number; totalUnits: number; margenPct: string };
    cronograma: { avgProgress: number };
    caja: { saldoNeto: string };
  };
  alerts: Array<{ type: 'warning' | 'danger' | 'info'; message: string }>;
};

function formatCOP(v: string | number) {
  return new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', notation: 'compact', maximumFractionDigits: 1 }).format(Number(v));
}

export default function ProjectDetailPage({ params }: { params: { id: string } }) {
  const { id } = params;

  const { data, isLoading, error } = useQuery({
    queryKey: ['project', id],
    queryFn: () => api.getProject(id),
  });
  const { data: kpiRaw } = useQuery({
    queryKey: ['dashboard', id],
    queryFn: () => api.getDashboardSummary(id),
    staleTime: 60_000,
  });

  const project = data as unknown as Project | undefined;
  const kpiData = kpiRaw as unknown as MiniKpi | undefined;
  const statusCfg = project
    ? (STATUS_CONFIG[project.status] ?? { label: project.status, color: 'bg-gray-100 text-gray-700' })
    : null;
  const housingCfg = project
    ? (HOUSING_CONFIG[project.housingType] ?? { label: project.housingType, color: 'bg-gray-100 text-gray-700' })
    : null;

  const formatDate = (d?: string) =>
    d ? new Date(d).toLocaleDateString('es-CO', { year: 'numeric', month: 'short', day: 'numeric' }) : '—';

  return (
    <div className="space-y-8">
      {/* ── Project header card ── */}
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex items-start gap-4">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-slate-700 to-slate-900 text-white shadow-sm">
            {isLoading ? (
              <div className="h-5 w-5 animate-pulse rounded bg-white/20" />
            ) : (
              <span className="text-lg font-bold">{project?.code?.charAt(0) ?? '?'}</span>
            )}
          </div>

          <div className="flex-1 min-w-0">
            {isLoading && (
              <div className="space-y-2">
                <div className="h-4 w-24 animate-pulse rounded bg-slate-200" />
                <div className="h-8 w-64 animate-pulse rounded bg-slate-200" />
                <div className="h-4 w-48 animate-pulse rounded bg-slate-200" />
              </div>
            )}
            {project && (
              <>
                <div className="flex flex-wrap items-center gap-2 mb-1.5">
                  <span className="font-mono text-xs text-muted-foreground bg-slate-100 px-2 py-0.5 rounded">
                    {project.code}
                  </span>
                  {housingCfg && (
                    <span className={`text-xs font-semibold px-2.5 py-0.5 rounded-full ${housingCfg.color}`}>
                      {housingCfg.label}
                    </span>
                  )}
                  {statusCfg && (
                    <span className={`text-xs font-semibold px-2.5 py-0.5 rounded-full ${statusCfg.color}`}>
                      {statusCfg.label}
                    </span>
                  )}
                </div>
                <h1 className="text-2xl font-bold tracking-tight text-slate-900">{project.name}</h1>
                <div className="mt-2 flex flex-wrap gap-4 text-sm text-muted-foreground">
                  <span className="flex items-center gap-1.5">
                    <MapPin className="h-3.5 w-3.5" />
                    {project.city}, {project.department}
                  </span>
                  <span className="flex items-center gap-1.5">
                    <Clock className="h-3.5 w-3.5" />
                    {formatDate(project.startDate)} → {formatDate(project.expectedEndDate)}
                  </span>
                  {project.saleableAreaM2 && (
                    <span className="flex items-center gap-1.5">
                      <CheckCircle2 className="h-3.5 w-3.5" />
                      {Number(project.saleableAreaM2).toLocaleString('es-CO')} m² vendibles
                    </span>
                  )}
                </div>
                {project.description && (
                  <p className="mt-2 text-sm text-muted-foreground max-w-2xl">{project.description}</p>
                )}
              </>
            )}
            {error && <p className="text-sm text-destructive">Error al cargar el proyecto.</p>}
          </div>

          <Button variant="outline" size="sm" asChild className="shrink-0">
            <Link href="/dashboard/projects">← Proyectos</Link>
          </Button>
        </div>
      </div>

      {/* ── Mini KPI strip ── */}
      {kpiData && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            {
              label: 'Costo directo',
              value: formatCOP(kpiData.kpis.presupuesto.directCost),
              sub: `${kpiData.kpis.presupuesto.executedPct}% ejecutado`,
              color: 'border-l-blue-500',
              iconBg: 'bg-blue-50',
              icon: <DollarSign className="h-4 w-4 text-blue-600" />,
            },
            {
              label: 'Avance cronograma',
              value: `${kpiData.kpis.cronograma.avgProgress}%`,
              sub: 'progreso promedio',
              color: Number(kpiData.kpis.cronograma.avgProgress) < 30
                ? 'border-l-amber-500' : 'border-l-green-500',
              iconBg: 'bg-green-50',
              icon: <Calendar className="h-4 w-4 text-green-600" />,
            },
            {
              label: 'Unidades vendidas',
              value: `${kpiData.kpis.ventas.unitsSold} / ${kpiData.kpis.ventas.totalUnits}`,
              sub: `Margen ${kpiData.kpis.ventas.margenPct}%`,
              color: 'border-l-purple-500',
              iconBg: 'bg-purple-50',
              icon: <Users className="h-4 w-4 text-purple-600" />,
            },
            {
              label: 'Saldo neto caja',
              value: formatCOP(kpiData.kpis.caja.saldoNeto),
              sub: Number(kpiData.kpis.caja.saldoNeto) >= 0 ? 'Positivo ✓' : 'Negativo ⚠',
              color: Number(kpiData.kpis.caja.saldoNeto) >= 0
                ? 'border-l-emerald-500' : 'border-l-red-500',
              iconBg: 'bg-orange-50',
              icon: <TrendingUp className="h-4 w-4 text-orange-600" />,
            },
          ].map(({ label, value, sub, color, iconBg, icon }) => (
            <div key={label} className={`flex items-center gap-3 rounded-xl border bg-white p-4 shadow-sm border-l-4 ${color}`}>
              <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${iconBg}`}>{icon}</div>
              <div className="min-w-0">
                <p className="text-[11px] text-muted-foreground truncate">{label}</p>
                <p className="text-lg font-bold text-slate-900 leading-tight">{value}</p>
                <p className="text-[11px] text-muted-foreground">{sub}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── Alerts ── */}
      {kpiData && kpiData.alerts.length > 0 && (
        <div className="space-y-1.5">
          {kpiData.alerts.map((a, i) => {
            const styles = {
              warning: 'bg-amber-50 border-amber-200 text-amber-800',
              danger:  'bg-red-50 border-red-200 text-red-800',
              info:    'bg-blue-50 border-blue-200 text-blue-800',
            } as const;
            return (
              <div key={i} className={`flex items-center gap-2 rounded-lg border px-4 py-2 text-xs ${styles[a.type]}`}>
                <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                {a.message}
              </div>
            );
          })}
        </div>
      )}

      {/* ── Module grid ── */}
      <div>
        <div className="mb-4">
          <h2 className="text-base font-semibold text-slate-900">Módulos del proyecto</h2>
          <p className="text-xs text-muted-foreground">Selecciona un módulo para comenzar</p>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {modules.map((mod) => {
            const Icon = mod.icon;
            return (
              <Link
                key={mod.href}
                href={`/dashboard/projects/${id}/${mod.href}`}
                className={`group relative block overflow-hidden rounded-2xl border-2 bg-gradient-to-br p-5 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg ${mod.bgGradient} ${mod.borderColor}`}
              >
                {/* Icon + arrow row */}
                <div className="mb-3 flex items-center justify-between">
                  <div className={`inline-flex rounded-xl p-2.5 shadow-sm ${mod.iconBg}`}>
                    <Icon className="h-5 w-5" />
                  </div>
                  <ArrowRight
                    className={`h-4 w-4 transition-transform duration-150 group-hover:translate-x-1 ${mod.color} opacity-40 group-hover:opacity-100`}
                  />
                </div>

                {/* Title + description */}
                <h3 className={`font-semibold text-base leading-tight ${mod.color}`}>{mod.title}</h3>
                <p className="mt-1 text-xs text-slate-500 leading-relaxed">{mod.description}</p>

                {/* Badge row */}
                <div className="mt-3 border-t border-black/5 pt-3">
                  <p className={`text-[10px] font-medium leading-relaxed ${mod.color} opacity-70`}>
                    {mod.badge}
                  </p>
                </div>
              </Link>
            );
          })}
        </div>
      </div>
    </div>
  );
}
