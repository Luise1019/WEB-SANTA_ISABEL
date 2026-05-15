'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Building2,
  CalendarDays,
  FolderOpen,
  Loader2,
  MapPin,
  PlusCircle,
  Trash2,
} from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { api } from '@/lib/api-client';
import { cn } from '@/lib/utils';

type ProjectRow = {
  id: string;
  code: string;
  name: string;
  housingType: string;
  status: string;
  city: string;
  department: string;
  startDate: string;
  expectedEndDate: string;
};

const HOUSING_LABELS: Record<string, string> = {
  VIS: 'VIS',
  VIP: 'VIP',
  NO_VIS: 'NO VIS',
  COMERCIAL: 'Comercial',
  MIXTO: 'Mixto',
};

const STATUS_LABELS: Record<string, string> = {
  PREFACTIBILIDAD: 'Prefactibilidad',
  FACTIBILIDAD: 'Factibilidad',
  EJECUCION: 'Ejecución',
  CIERRE: 'Cierre',
  ARCHIVADO: 'Archivado',
};

type BadgeVariant = 'default' | 'secondary' | 'destructive' | 'outline' | 'success' | 'warning' | 'info';

const STATUS_BADGE: Record<string, BadgeVariant> = {
  PREFACTIBILIDAD: 'info',
  FACTIBILIDAD: 'warning',
  EJECUCION: 'success',
  CIERRE: 'secondary',
  ARCHIVADO: 'outline',
};

const HOUSING_BADGE: Record<string, BadgeVariant> = {
  VIS: 'success',
  VIP: 'info',
  NO_VIS: 'warning',
  COMERCIAL: 'secondary',
  MIXTO: 'default',
};

function formatDateCO(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString('es-CO', {
      year: 'numeric',
      month: 'short',
      day: '2-digit',
    });
  } catch {
    return iso;
  }
}

function StatCard({ label, value, className }: { label: string; value: number; className?: string }) {
  return (
    <div className={cn('rounded-xl border bg-white px-5 py-4', className)}>
      <p className="text-2xl font-bold text-slate-800">{value}</p>
      <p className="mt-0.5 text-xs text-muted-foreground">{label}</p>
    </div>
  );
}

function ProjectCardSkeleton() {
  return (
    <div className="rounded-xl border bg-white p-5 space-y-3">
      <Skeleton className="h-4 w-24" />
      <Skeleton className="h-6 w-3/4" />
      <Skeleton className="h-4 w-1/2" />
      <Skeleton className="h-4 w-1/3" />
    </div>
  );
}

export default function ProjectsPage() {
  const queryClient = useQueryClient();
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);

  const { data, isLoading, error } = useQuery({
    queryKey: ['projects'],
    queryFn: api.listProjects,
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.deleteProject(id),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['projects'] });
      setPendingDeleteId(null);
    },
  });

  const rows = (data ?? []) as unknown as ProjectRow[];

  // Stats
  const statusCounts = rows.reduce<Record<string, number>>((acc, r) => {
    acc[r.status] = (acc[r.status] ?? 0) + 1;
    return acc;
  }, {});

  return (
    <div className="space-y-8">
      {/* Header */}
      <header className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-slate-800 text-white">
            <Building2 className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">Proyectos</h1>
            <p className="text-sm text-muted-foreground">Listado de proyectos del consorcio Santa Isabel.</p>
          </div>
        </div>
        <Button asChild className="bg-slate-800 hover:bg-slate-700 gap-2">
          <Link href="/dashboard/projects/new">
            <PlusCircle className="h-4 w-4" />
            Nuevo proyecto
          </Link>
        </Button>
      </header>

      {/* Stats row */}
      {!isLoading && rows.length > 0 && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          <StatCard label="Total proyectos" value={rows.length} />
          {Object.entries(STATUS_LABELS).map(([key, label]) => (
            <StatCard key={key} label={label} value={statusCounts[key] ?? 0} />
          ))}
        </div>
      )}

      {/* Loading skeletons */}
      {isLoading && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <ProjectCardSkeleton key={i} />
          ))}
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-6 py-4">
          <p className="text-sm text-red-700">
            Error al cargar proyectos. Verifica que la API esté activa y la base de datos disponible.
          </p>
        </div>
      )}

      {/* Empty state */}
      {!isLoading && !error && rows.length === 0 && (
        <div className="flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-slate-200 bg-slate-50 py-20 text-center">
          <FolderOpen className="mb-4 h-12 w-12 text-slate-300" />
          <h3 className="mb-1 text-base font-semibold text-slate-700">Sin proyectos aún</h3>
          <p className="mb-6 max-w-xs text-sm text-muted-foreground">
            Crea tu primer proyecto para comenzar a gestionar el consorcio.
          </p>
          <Button asChild className="bg-slate-800 hover:bg-slate-700 gap-2">
            <Link href="/dashboard/projects/new">
              <PlusCircle className="h-4 w-4" />
              Nuevo proyecto
            </Link>
          </Button>
        </div>
      )}

      {/* Project cards grid */}
      {rows.length > 0 && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {rows.map((row) => (
            <Card
              key={row.id}
              className="group relative overflow-hidden rounded-xl border bg-white shadow-sm transition-shadow hover:shadow-md"
            >
              <CardContent className="p-5">
                {/* Top badges */}
                <div className="mb-3 flex flex-wrap gap-1.5">
                  <Badge variant={STATUS_BADGE[row.status] ?? 'default'}>
                    {STATUS_LABELS[row.status] ?? row.status}
                  </Badge>
                  <Badge variant={HOUSING_BADGE[row.housingType] ?? 'secondary'}>
                    {HOUSING_LABELS[row.housingType] ?? row.housingType}
                  </Badge>
                </div>

                {/* Code */}
                <p className="mb-1 font-mono text-[11px] text-muted-foreground">{row.code}</p>

                {/* Name */}
                <h3 className="mb-3 text-base font-semibold leading-snug text-slate-900">
                  {row.name}
                </h3>

                {/* Location */}
                <div className="mb-2 flex items-center gap-1.5 text-sm text-muted-foreground">
                  <MapPin className="h-3.5 w-3.5 shrink-0" />
                  <span>
                    {row.city}, {row.department}
                  </span>
                </div>

                {/* Dates */}
                <div className="mb-4 flex items-center gap-1.5 text-sm text-muted-foreground">
                  <CalendarDays className="h-3.5 w-3.5 shrink-0" />
                  <span>
                    {formatDateCO(row.startDate)} → {formatDateCO(row.expectedEndDate)}
                  </span>
                </div>

                {/* Actions */}
                {pendingDeleteId === row.id ? (
                  <div className="flex items-center gap-2 rounded-lg bg-red-50 px-3 py-2">
                    <p className="flex-1 text-xs text-red-700">¿Eliminar este proyecto?</p>
                    <Button
                      variant="destructive"
                      size="sm"
                      className="h-7 px-2 text-xs"
                      disabled={deleteMutation.isPending}
                      onClick={() => deleteMutation.mutate(row.id)}
                    >
                      {deleteMutation.isPending && deleteMutation.variables === row.id ? (
                        <Loader2 className="h-3 w-3 animate-spin" />
                      ) : (
                        'Confirmar'
                      )}
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 px-2 text-xs"
                      onClick={() => setPendingDeleteId(null)}
                    >
                      Cancelar
                    </Button>
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <Button
                      asChild
                      size="sm"
                      className="flex-1 bg-slate-800 hover:bg-slate-700 text-xs"
                    >
                      <Link href={`/dashboard/projects/${row.id}`}>Abrir proyecto</Link>
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-8 w-8 p-0 text-slate-400 hover:border-red-300 hover:bg-red-50 hover:text-red-600"
                      onClick={() => setPendingDeleteId(row.id)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      <span className="sr-only">Eliminar</span>
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
