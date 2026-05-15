'use client';

import { useQuery } from '@tanstack/react-query';
import { BarChart3, Calendar, DollarSign, FileText, TrendingUp, Users } from 'lucide-react';
import Link from 'next/link';
import React, { use } from 'react';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { api } from '@/lib/api-client';

const STATUS_LABELS: Record<string, string> = {
  PREFACTIBILIDAD: 'Prefactibilidad',
  FACTIBILIDAD: 'Factibilidad',
  EJECUCION: 'Ejecución',
  CIERRE: 'Cierre',
  ARCHIVADO: 'Archivado',
};

const HOUSING_LABELS: Record<string, string> = {
  VIS: 'VIS',
  VIP: 'VIP',
  NO_VIS: 'NO VIS',
  COMERCIAL: 'Comercial',
  MIXTO: 'Mixto',
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
  disabled?: boolean;
}> = [
  {
    href: 'budget',
    icon: DollarSign,
    title: 'Presupuesto',
    description: 'Capítulos, APU, ítems y AIU',
    color: 'text-green-600',
  },
  {
    href: 'schedule',
    icon: Calendar,
    title: 'Cronograma',
    description: 'Gantt, WBS y ruta crítica',
    color: 'text-blue-600',
  },
  {
    href: 'cashflow',
    icon: TrendingUp,
    title: 'Flujo de caja',
    description: 'Devengo, caja y crédito',
    color: 'text-orange-600',
  },
  {
    href: 'sales',
    icon: Users,
    title: 'Ventas',
    description: 'Unidades, precios y reservas',
    color: 'text-purple-600',
  },
  {
    href: 'changes',
    icon: FileText,
    title: 'Cambios',
    description: 'Órdenes de cambio y aprobaciones',
    color: 'text-red-600',
  },
  {
    href: 'dashboard',
    icon: BarChart3,
    title: 'Dashboard',
    description: 'KPIs, curva S y alertas',
    color: 'text-indigo-600',
  },
];

export default function ProjectDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);

  const { data, isLoading, error } = useQuery({
    queryKey: ['project', id],
    queryFn: () => api.getProject(id),
  });

  const project = data as unknown as Project | undefined;

  return (
    <div className="space-y-6">
      <header className="flex items-start justify-between gap-4">
        <div>
          {isLoading && <p className="text-sm">Cargando…</p>}
          {project && (
            <>
              <p className="font-mono text-xs text-muted-foreground">{project.code}</p>
              <h1 className="text-3xl font-bold tracking-tight">{project.name}</h1>
              <div className="mt-1 flex flex-wrap gap-3 text-sm text-muted-foreground">
                <span>
                  {HOUSING_LABELS[project.housingType] ?? project.housingType}
                </span>
                <span>·</span>
                <span>{STATUS_LABELS[project.status] ?? project.status}</span>
                <span>·</span>
                <span>
                  {project.city}, {project.department}
                </span>
              </div>
              {project.description && (
                <p className="mt-2 max-w-2xl text-sm text-muted-foreground">{project.description}</p>
              )}
            </>
          )}
          {error && <p className="text-sm text-destructive">Error al cargar el proyecto.</p>}
        </div>
        <Button variant="outline" asChild>
          <Link href="/dashboard/projects">← Proyectos</Link>
        </Button>
      </header>

      {/* Module Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {modules.map((mod) => {
          const Icon = mod.icon;
          return (
            <Card
              key={mod.href}
              className={`transition-shadow ${mod.disabled ? 'opacity-50' : 'hover:shadow-md'}`}
            >
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-base">
                  <Icon className={`h-5 w-5 ${mod.color}`} />
                  {mod.title}
                  {mod.disabled && (
                    <span className="ml-auto rounded-full bg-muted px-2 py-0.5 text-xs font-normal text-muted-foreground">
                      Próximamente
                    </span>
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="mb-3 text-sm text-muted-foreground">{mod.description}</p>
                {!mod.disabled && (
                  <Button size="sm" asChild>
                    <Link href={`/dashboard/projects/${id}/${mod.href}`}>Abrir</Link>
                  </Button>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
