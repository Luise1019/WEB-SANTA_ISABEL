'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Building2,
  CalendarDays,
  FolderOpen,
  LayoutGrid,
  List,
  Loader2,
  MapPin,
  PlusCircle,
  Search,
  Trash2,
} from 'lucide-react';
import Link from 'next/link';
import { useMemo, useState } from 'react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
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

const STATUS_ALL_KEYS = Object.keys(STATUS_LABELS);

// Status chip colors for filter bar
const STATUS_CHIP: Record<string, string> = {
  PREFACTIBILIDAD: 'border-slate-300 bg-slate-100 text-slate-700',
  FACTIBILIDAD: 'border-blue-300 bg-blue-100 text-blue-700',
  EJECUCION: 'border-green-300 bg-green-100 text-green-700',
  CIERRE: 'border-amber-300 bg-amber-100 text-amber-700',
  ARCHIVADO: 'border-gray-300 bg-gray-100 text-gray-500',
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

function ProjectCardSkeleton() {
  return (
    <div className="rounded-2xl border bg-white p-5 space-y-3">
      <Skeleton className="h-4 w-24" />
      <Skeleton className="h-6 w-3/4" />
      <Skeleton className="h-4 w-1/2" />
      <Skeleton className="h-4 w-1/3" />
      <div className="pt-2">
        <Skeleton className="h-8 w-full" />
      </div>
    </div>
  );
}

// ── Empty state SVG ──────────────────────────────────────────────────────────

function EmptyIllustration() {
  return (
    <svg width="120" height="120" viewBox="0 0 120 120" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="20" y="35" width="80" height="60" rx="8" fill="#f1f5f9" stroke="#cbd5e1" strokeWidth="2" />
      <rect x="30" y="25" width="60" height="15" rx="6" fill="#e2e8f0" stroke="#cbd5e1" strokeWidth="2" />
      <rect x="35" y="55" width="50" height="5" rx="2.5" fill="#cbd5e1" />
      <rect x="35" y="67" width="38" height="5" rx="2.5" fill="#e2e8f0" />
      <rect x="35" y="79" width="28" height="5" rx="2.5" fill="#e2e8f0" />
      <circle cx="95" cy="28" r="14" fill="#0f172a" />
      <line x1="95" y1="22" x2="95" y2="28" stroke="white" strokeWidth="2" strokeLinecap="round" />
      <circle cx="95" cy="32" r="1.5" fill="white" />
    </svg>
  );
}

export default function ProjectsPage() {
  const queryClient = useQueryClient();
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'card' | 'table'>('card');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');

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

  const statusCounts = rows.reduce<Record<string, number>>((acc, r) => {
    acc[r.status] = (acc[r.status] ?? 0) + 1;
    return acc;
  }, {});

  const filtered = useMemo(() => {
    return rows.filter((r) => {
      if (statusFilter !== 'ALL' && r.status !== statusFilter) return false;
      if (search.trim()) {
        const q = search.trim().toLowerCase();
        const hay = [r.code, r.name, r.city, r.department, STATUS_LABELS[r.status] ?? '', HOUSING_LABELS[r.housingType] ?? '']
          .join(' ')
          .toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [rows, search, statusFilter]);

  return (
    <div className="space-y-6">
      {/* ── Header ── */}
      <header className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-slate-800 text-white shadow-sm">
            <Building2 className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">Proyectos</h1>
            <p className="text-sm text-muted-foreground">Listado de proyectos del consorcio Santa Isabel.</p>
          </div>
        </div>
        <Button asChild className="gap-2 bg-slate-800 hover:bg-slate-700">
          <Link href="/dashboard/projects/new">
            <PlusCircle className="h-4 w-4" />
            Nuevo proyecto
          </Link>
        </Button>
      </header>

      {/* ── Status count chips ── */}
      {!isLoading && rows.length > 0 && (
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setStatusFilter('ALL')}
            className={cn(
              'rounded-full border px-3 py-1 text-xs font-semibold transition-all',
              statusFilter === 'ALL'
                ? 'border-slate-800 bg-slate-800 text-white'
                : 'border-slate-200 bg-white text-slate-600 hover:border-slate-400',
            )}
          >
            Todos ({rows.length})
          </button>
          {STATUS_ALL_KEYS.filter((k) => (statusCounts[k] ?? 0) > 0).map((k) => (
            <button
              key={k}
              onClick={() => setStatusFilter(statusFilter === k ? 'ALL' : k)}
              className={cn(
                'rounded-full border px-3 py-1 text-xs font-semibold transition-all',
                statusFilter === k
                  ? 'border-slate-800 bg-slate-800 text-white'
                  : `${STATUS_CHIP[k] ?? 'border-gray-200 bg-gray-100 text-gray-600'} hover:opacity-80`,
              )}
            >
              {STATUS_LABELS[k]} ({statusCounts[k] ?? 0})
            </button>
          ))}
        </div>
      )}

      {/* ── Search + view toggle ── */}
      {!isLoading && rows.length > 0 && (
        <div className="flex items-center gap-3">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Buscar proyecto, ciudad, tipo…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
          <div className="ml-auto flex items-center gap-1 rounded-lg border bg-white p-1">
            <button
              onClick={() => setViewMode('card')}
              className={cn(
                'rounded-md p-1.5 transition-colors',
                viewMode === 'card' ? 'bg-slate-800 text-white' : 'text-slate-400 hover:text-slate-700',
              )}
              title="Vista tarjetas"
            >
              <LayoutGrid className="h-4 w-4" />
            </button>
            <button
              onClick={() => setViewMode('table')}
              className={cn(
                'rounded-md p-1.5 transition-colors',
                viewMode === 'table' ? 'bg-slate-800 text-white' : 'text-slate-400 hover:text-slate-700',
              )}
              title="Vista tabla"
            >
              <List className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      {/* ── Loading ── */}
      {isLoading && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <ProjectCardSkeleton key={i} />
          ))}
        </div>
      )}

      {/* ── Error ── */}
      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-6 py-4">
          <p className="text-sm text-red-700">
            Error al cargar proyectos. Verifica que la API esté activa y la base de datos disponible.
          </p>
        </div>
      )}

      {/* ── Empty state ── */}
      {!isLoading && !error && rows.length === 0 && (
        <div className="flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-slate-200 bg-slate-50 py-20 text-center">
          <EmptyIllustration />
          <h3 className="mb-1 mt-4 text-base font-semibold text-slate-700">Sin proyectos aún</h3>
          <p className="mb-6 max-w-xs text-sm text-muted-foreground">
            Crea tu primer proyecto para comenzar a gestionar el consorcio.
          </p>
          <Button asChild className="gap-2 bg-slate-800 hover:bg-slate-700">
            <Link href="/dashboard/projects/new">
              <PlusCircle className="h-4 w-4" />
              Nuevo proyecto
            </Link>
          </Button>
        </div>
      )}

      {/* ── No search results ── */}
      {!isLoading && rows.length > 0 && filtered.length === 0 && (
        <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 py-12 text-center">
          <FolderOpen className="mx-auto mb-2 h-8 w-8 text-slate-300" />
          <p className="text-sm text-muted-foreground">Sin resultados para los filtros actuales.</p>
          <button
            className="mt-2 text-xs text-primary hover:underline"
            onClick={() => { setSearch(''); setStatusFilter('ALL'); }}
          >
            Limpiar filtros
          </button>
        </div>
      )}

      {/* ── Card view ── */}
      {filtered.length > 0 && viewMode === 'card' && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((row) => (
            <Card
              key={row.id}
              className="group relative overflow-hidden rounded-2xl border bg-white shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md"
            >
              <CardContent className="p-5">
                {/* Code + badges */}
                <div className="mb-2 flex items-center gap-2">
                  <span className="font-mono text-[11px] text-muted-foreground bg-slate-100 px-2 py-0.5 rounded">
                    {row.code}
                  </span>
                  <div className="ml-auto flex gap-1.5">
                    <Badge variant={STATUS_BADGE[row.status] ?? 'default'}>
                      {STATUS_LABELS[row.status] ?? row.status}
                    </Badge>
                    <Badge variant={HOUSING_BADGE[row.housingType] ?? 'secondary'}>
                      {HOUSING_LABELS[row.housingType] ?? row.housingType}
                    </Badge>
                  </div>
                </div>

                {/* Name */}
                <h3 className="mb-3 text-base font-semibold leading-snug text-slate-900">
                  {row.name}
                </h3>

                {/* Progress bar (placeholder) */}
                <div className="mb-3">
                  <div className="mb-1 flex justify-between text-[11px] text-muted-foreground">
                    <span>Avance</span>
                    <span>0%</span>
                  </div>
                  <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
                    <div className="h-full rounded-full bg-teal-500 transition-all" style={{ width: '0%' }} />
                  </div>
                </div>

                {/* Meta */}
                <div className="mb-1 flex items-center gap-1.5 text-xs text-muted-foreground">
                  <MapPin className="h-3 w-3 shrink-0" />
                  <span>{row.city}, {row.department}</span>
                </div>
                <div className="mb-4 flex items-center gap-1.5 text-xs text-muted-foreground">
                  <CalendarDays className="h-3 w-3 shrink-0" />
                  <span>{formatDateCO(row.startDate)} → {formatDateCO(row.expectedEndDate)}</span>
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
                    <Button variant="ghost" size="sm" className="h-7 px-2 text-xs" onClick={() => setPendingDeleteId(null)}>
                      Cancelar
                    </Button>
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <Button asChild size="sm" className="flex-1 bg-slate-800 hover:bg-slate-700 text-xs">
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

      {/* ── Table view ── */}
      {filtered.length > 0 && viewMode === 'table' && (
        <div className="overflow-hidden rounded-2xl border bg-white shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-slate-50 text-left text-xs font-semibold text-slate-500">
                  <th className="px-4 py-3">Código</th>
                  <th className="px-4 py-3">Nombre</th>
                  <th className="px-4 py-3">Estado</th>
                  <th className="px-4 py-3">Tipo</th>
                  <th className="px-4 py-3">Ciudad</th>
                  <th className="px-4 py-3">Inicio</th>
                  <th className="px-4 py-3">Fin estimado</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((row, idx) => (
                  <tr
                    key={row.id}
                    className={cn(
                      'border-b last:border-0 transition-colors hover:bg-slate-50',
                      idx % 2 === 1 ? 'bg-slate-50/50' : '',
                    )}
                  >
                    <td className="px-4 py-3 font-mono text-xs text-muted-foreground">{row.code}</td>
                    <td className="px-4 py-3 font-medium text-slate-900">{row.name}</td>
                    <td className="px-4 py-3">
                      <Badge variant={STATUS_BADGE[row.status] ?? 'default'}>
                        {STATUS_LABELS[row.status] ?? row.status}
                      </Badge>
                    </td>
                    <td className="px-4 py-3">
                      <Badge variant={HOUSING_BADGE[row.housingType] ?? 'secondary'}>
                        {HOUSING_LABELS[row.housingType] ?? row.housingType}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">
                      {row.city}, {row.department}
                    </td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">{formatDateCO(row.startDate)}</td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">{formatDateCO(row.expectedEndDate)}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1.5">
                        <Button asChild size="sm" variant="outline" className="h-7 text-xs">
                          <Link href={`/dashboard/projects/${row.id}`}>Abrir</Link>
                        </Button>
                        {pendingDeleteId === row.id ? (
                          <Button
                            variant="destructive"
                            size="sm"
                            className="h-7 px-2 text-xs"
                            disabled={deleteMutation.isPending}
                            onClick={() => deleteMutation.mutate(row.id)}
                          >
                            {deleteMutation.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : 'Confirmar'}
                          </Button>
                        ) : (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 w-7 p-0 text-slate-300 hover:text-destructive"
                            onClick={() => setPendingDeleteId(row.id)}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
