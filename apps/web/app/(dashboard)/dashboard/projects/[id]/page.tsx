'use client';

import { useQuery } from '@tanstack/react-query';
import {
  ArrowLeft,
  BarChart3,
  Calendar,
  CheckCircle2,
  Clock,
  DollarSign,
  FileText,
  MapPin,
  TrendingUp,
  Users,
} from 'lucide-react';
import Link from 'next/link';
import React, { use } from 'react';

import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
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
  color: string;
  bgColor: string;
  disabled?: boolean;
}> = [
  {
    href: 'budget',
    icon: DollarSign,
    title: 'Presupuesto',
    description: 'Capítulos, ítems, APU y AIU',
    color: 'text-green-700',
    bgColor: 'bg-green-50 border-green-200',
  },
  {
    href: 'schedule',
    icon: Calendar,
    title: 'Cronograma',
    description: 'Gantt, WBS y ruta crítica CPM',
    color: 'text-blue-700',
    bgColor: 'bg-blue-50 border-blue-200',
  },
  {
    href: 'cashflow',
    icon: TrendingUp,
    title: 'Flujo de caja',
    description: 'Ingresos, egresos y préstamos',
    color: 'text-orange-700',
    bgColor: 'bg-orange-50 border-orange-200',
  },
  {
    href: 'sales',
    icon: Users,
    title: 'Ventas',
    description: 'Unidades, precios y reservas',
    color: 'text-purple-700',
    bgColor: 'bg-purple-50 border-purple-200',
  },
  {
    href: 'changes',
    icon: FileText,
    title: 'Cambios',
    description: 'Órdenes de cambio y aprobaciones',
    color: 'text-red-700',
    bgColor: 'bg-red-50 border-red-200',
  },
  {
    href: 'dashboard',
    icon: BarChart3,
    title: 'Dashboard',
    description: 'KPIs ejecutivos, curva S y alertas',
    color: 'text-indigo-700',
    bgColor: 'bg-indigo-50 border-indigo-200',
  },
];

export default function ProjectDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);

  const { data, isLoading, error } = useQuery({
    queryKey: ['project', id],
    queryFn: () => api.getProject(id),
  });

  const project = data as unknown as Project | undefined;
  const statusCfg = project ? (STATUS_CONFIG[project.status] ?? { label: project.status, color: 'bg-gray-100 text-gray-700' }) : null;
  const housingCfg = project ? (HOUSING_CONFIG[project.housingType] ?? { label: project.housingType, color: 'bg-gray-100 text-gray-700' }) : null;

  const formatDate = (d?: string) =>
    d ? new Date(d).toLocaleDateString('es-CO', { year: 'numeric', month: 'short', day: 'numeric' }) : '—';

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start gap-4">
        <Button variant="outline" size="sm" asChild className="shrink-0 mt-1">
          <Link href="/dashboard/projects">
            <ArrowLeft className="h-4 w-4 mr-1" />
            Proyectos
          </Link>
        </Button>

        <div className="flex-1 min-w-0">
          {isLoading && (
            <div className="space-y-2">
              <div className="h-4 w-24 animate-pulse rounded bg-muted" />
              <div className="h-8 w-64 animate-pulse rounded bg-muted" />
            </div>
          )}
          {project && (
            <>
              <div className="flex flex-wrap items-center gap-2 mb-1">
                <span className="font-mono text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded">
                  {project.code}
                </span>
                {housingCfg && (
                  <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${housingCfg.color}`}>
                    {housingCfg.label}
                  </span>
                )}
                {statusCfg && (
                  <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${statusCfg.color}`}>
                    {statusCfg.label}
                  </span>
                )}
              </div>
              <h1 className="text-2xl font-bold tracking-tight">{project.name}</h1>
              <div className="mt-2 flex flex-wrap gap-4 text-sm text-muted-foreground">
                <span className="flex items-center gap-1">
                  <MapPin className="h-3.5 w-3.5" />
                  {project.city}, {project.department}
                </span>
                <span className="flex items-center gap-1">
                  <Clock className="h-3.5 w-3.5" />
                  {formatDate(project.startDate)} → {formatDate(project.expectedEndDate)}
                </span>
                {project.saleableAreaM2 && (
                  <span className="flex items-center gap-1">
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
      </div>

      {/* Module grid */}
      <div>
        <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-3">
          Módulos del proyecto
        </h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {modules.map((mod) => {
            const Icon = mod.icon;
            return (
              <Link
                key={mod.href}
                href={`/dashboard/projects/${id}/${mod.href}`}
                className={`group block rounded-xl border-2 p-5 transition-all hover:shadow-md hover:-translate-y-0.5 ${mod.bgColor}`}
              >
                <div className="flex items-start gap-4">
                  <div className={`rounded-lg p-2.5 bg-white shadow-sm ${mod.color}`}>
                    <Icon className="h-5 w-5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className={`font-semibold ${mod.color}`}>{mod.title}</h3>
                    <p className="text-xs text-muted-foreground mt-0.5">{mod.description}</p>
                  </div>
                  <ArrowLeft className={`h-4 w-4 rotate-180 opacity-0 group-hover:opacity-100 transition-opacity shrink-0 mt-0.5 ${mod.color}`} />
                </div>
              </Link>
            );
          })}
        </div>
      </div>
    </div>
  );
}
