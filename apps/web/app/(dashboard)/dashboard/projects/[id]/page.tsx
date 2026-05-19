'use client';

import { useQuery } from '@tanstack/react-query';
import {
  ArrowRight,
  BarChart3,
  Calendar,
  CheckCircle2,
  Clock,
  DollarSign,
  FileText,
  LineChart,
  MapPin,
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
    href: 'dashboard',
    icon: BarChart3,
    title: 'Dashboard',
    description: 'Vista ejecutiva con indicadores de desempeño',
    badge: 'KPIs ejecutivos · Alertas · SPI/CPI',
    color: 'text-indigo-700',
    bgGradient: 'from-indigo-50 to-blue-50',
    borderColor: 'border-indigo-200',
    iconBg: 'bg-indigo-100 text-indigo-700',
  },
];

export default function ProjectDetailPage({ params }: { params: { id: string } }) {
  const { id } = params;

  const { data, isLoading, error } = useQuery({
    queryKey: ['project', id],
    queryFn: () => api.getProject(id),
  });

  const project = data as unknown as Project | undefined;
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
