'use client';

import { useQuery } from '@tanstack/react-query';
import {
  ArrowRight,
  BarChart3,
  Building2,
  Calendar,
  Clock,
  DollarSign,
  FolderOpen,
  MapPin,
  TrendingUp,
} from 'lucide-react';
import Link from 'next/link';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { api } from '@/lib/api-client';
import { useAuth } from '@/lib/auth-store';
import { cn } from '@/lib/utils';

const STATUS_COLOR: Record<string, string> = {
  PREFACTIBILIDAD: 'bg-slate-100 text-slate-700',
  FACTIBILIDAD: 'bg-blue-100 text-blue-700',
  EJECUCION: 'bg-green-100 text-green-700',
  CIERRE: 'bg-amber-100 text-amber-700',
  ARCHIVADO: 'bg-gray-100 text-gray-500',
};
const STATUS_LABEL: Record<string, string> = {
  PREFACTIBILIDAD: 'Prefactibilidad',
  FACTIBILIDAD: 'Factibilidad',
  EJECUCION: 'En ejecución',
  CIERRE: 'Cierre',
  ARCHIVADO: 'Archivado',
};
const HOUSING_COLOR: Record<string, string> = {
  VIS: 'bg-emerald-100 text-emerald-700',
  VIP: 'bg-teal-100 text-teal-700',
  NO_VIS: 'bg-purple-100 text-purple-700',
  COMERCIAL: 'bg-orange-100 text-orange-700',
  MIXTO: 'bg-pink-100 text-pink-700',
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
};

// ── Donut chart (pure SVG) ────────────────────────────────────────────────────

type DonutSlice = { label: string; value: number; color: string };

function DonutChart({ slices, total }: { slices: DonutSlice[]; total: number }) {
  const r = 36;
  const cx = 48;
  const cy = 48;
  const circumference = 2 * Math.PI * r;

  let offset = 0;
  const arcs = slices
    .filter((s) => s.value > 0)
    .map((s) => {
      const pct = total > 0 ? s.value / total : 0;
      const dash = pct * circumference;
      const arc = { ...s, dash, offset, pct };
      offset += dash;
      return arc;
    });

  if (arcs.length === 0) {
    return (
      <div className="flex h-24 w-24 items-center justify-center rounded-full border-4 border-slate-100 text-xs text-muted-foreground">
        Sin datos
      </div>
    );
  }

  return (
    <div className="flex items-center gap-6">
      <svg width="96" height="96" viewBox="0 0 96 96">
        {/* Background ring */}
        <circle cx={cx} cy={cy} r={r} fill="none" stroke="#f1f5f9" strokeWidth="12" />
        {arcs.map((arc) => (
          <circle
            key={arc.label}
            cx={cx}
            cy={cy}
            r={r}
            fill="none"
            stroke={arc.color}
            strokeWidth="12"
            strokeDasharray={`${arc.dash} ${circumference - arc.dash}`}
            strokeDashoffset={-arc.offset + circumference * 0.25}
            style={{ transform: 'rotate(-90deg)', transformOrigin: `${cx}px ${cy}px` }}
          />
        ))}
        <text x={cx} y={cy - 5} textAnchor="middle" fontSize="18" fontWeight="700" fill="#0f172a">
          {total}
        </text>
        <text x={cx} y={cy + 13} textAnchor="middle" fontSize="9" fill="#94a3b8">
          proyectos
        </text>
      </svg>
      <div className="space-y-1.5">
        {arcs.map((arc) => (
          <div key={arc.label} className="flex items-center gap-2 text-xs">
            <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ backgroundColor: arc.color }} />
            <span className="text-muted-foreground">{arc.label}</span>
            <span className="ml-auto pl-2 font-semibold text-slate-700">{arc.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── KPI card with colored left border ────────────────────────────────────────

function KPICard({
  label,
  value,
  icon: Icon,
  iconBg,
  borderColor,
  valueColor,
}: {
  label: string;
  value: number | string;
  icon: React.ElementType;
  iconBg: string;
  borderColor: string;
  valueColor?: string;
}) {
  return (
    <div className={cn('flex items-start gap-4 rounded-xl border bg-white p-5 shadow-sm border-l-4', borderColor)}>
      <div className={cn('flex h-10 w-10 shrink-0 items-center justify-center rounded-lg', iconBg)}>
        <Icon className="h-5 w-5" />
      </div>
      <div>
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className={cn('mt-1 text-3xl font-bold', valueColor)}>{value}</p>
      </div>
    </div>
  );
}

export default function DashboardHomePage() {
  const user = useAuth((s) => s.user);
  const { data } = useQuery({
    queryKey: ['projects'],
    queryFn: () => api.listProjects(),
  });
  const projects = (data ?? []) as unknown as Project[];

  const byStatus = {
    EJECUCION: projects.filter((p) => p.status === 'EJECUCION').length,
    FACTIBILIDAD: projects.filter((p) => p.status === 'FACTIBILIDAD').length,
    CIERRE: projects.filter((p) => p.status === 'CIERRE').length,
    PREFACTIBILIDAD: projects.filter((p) => p.status === 'PREFACTIBILIDAD').length,
  };

  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Buenos días' : hour < 18 ? 'Buenas tardes' : 'Buenas noches';
  const firstName = user?.fullName?.split(' ')[0] ?? 'Admin';

  const donutSlices: DonutSlice[] = [
    { label: 'En ejecución', value: byStatus.EJECUCION, color: '#16a34a' },
    { label: 'Factibilidad', value: byStatus.FACTIBILIDAD, color: '#3b82f6' },
    { label: 'Prefactibilidad', value: byStatus.PREFACTIBILIDAD, color: '#64748b' },
    { label: 'Cierre', value: byStatus.CIERRE, color: '#d97706' },
  ];

  const formatDateCO = (iso: string) => {
    try {
      return new Date(iso).toLocaleDateString('es-CO', { year: 'numeric', month: 'short', day: '2-digit' });
    } catch { return iso; }
  };

  return (
    <div className="space-y-8">
      {/* ── Welcome ── */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900">
            {greeting}, {firstName} 👋
          </h1>
          <p className="mt-1 text-muted-foreground">
            Plataforma de gestión VIS / VIP / NO VIS · Colombia
          </p>
        </div>
        <Button asChild className="bg-slate-800 hover:bg-slate-700 gap-2">
          <Link href="/dashboard/projects/new">
            <Building2 className="h-4 w-4" />
            Nuevo proyecto
          </Link>
        </Button>
      </div>

      {/* ── KPI cards with colored borders ── */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KPICard
          label="Proyectos totales"
          value={projects.length}
          icon={FolderOpen}
          iconBg="bg-blue-50 text-blue-600"
          borderColor="border-l-blue-500"
        />
        <KPICard
          label="En ejecución"
          value={byStatus.EJECUCION}
          icon={TrendingUp}
          iconBg="bg-green-50 text-green-600"
          borderColor="border-l-green-500"
          valueColor="text-green-600"
        />
        <KPICard
          label="En factibilidad"
          value={byStatus.FACTIBILIDAD}
          icon={BarChart3}
          iconBg="bg-blue-50 text-blue-600"
          borderColor="border-l-blue-400"
          valueColor="text-blue-600"
        />
        <KPICard
          label="En cierre"
          value={byStatus.CIERRE}
          icon={Calendar}
          iconBg="bg-amber-50 text-amber-600"
          borderColor="border-l-amber-500"
          valueColor="text-amber-600"
        />
      </div>

      {/* ── Chart + Recent activity ── */}
      <div className="grid gap-4 lg:grid-cols-2">
        {/* Donut status chart */}
        <Card className="shadow-sm">
          <CardHeader>
            <CardTitle className="text-sm font-semibold">Resumen de estado</CardTitle>
          </CardHeader>
          <CardContent>
            <DonutChart slices={donutSlices} total={projects.length} />
            {projects.length === 0 && (
              <p className="mt-4 text-center text-xs text-muted-foreground">
                Crea proyectos para ver el resumen de estado aquí.
              </p>
            )}
          </CardContent>
        </Card>

        {/* Recent activity placeholder */}
        <Card className="shadow-sm">
          <CardHeader>
            <CardTitle className="text-sm font-semibold">Actividad reciente</CardTitle>
          </CardHeader>
          <CardContent>
            {projects.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <Clock className="mb-2 h-8 w-8 text-slate-200" />
                <p className="text-xs text-muted-foreground">Sin actividad reciente.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {projects.slice(0, 5).map((p) => (
                  <div key={p.id} className="flex items-start gap-3">
                    <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-slate-100 text-xs font-bold text-slate-600">
                      {p.code.charAt(0)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="truncate text-xs font-medium text-slate-800">{p.name}</p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${STATUS_COLOR[p.status] ?? 'bg-gray-100 text-gray-500'}`}>
                          {STATUS_LABEL[p.status] ?? p.status}
                        </span>
                        <span className="text-[10px] text-muted-foreground flex items-center gap-0.5">
                          <MapPin className="h-2.5 w-2.5" />
                          {p.city}
                        </span>
                      </div>
                    </div>
                    <Link
                      href={`/dashboard/projects/${p.id}`}
                      className="shrink-0 text-[10px] text-primary hover:underline"
                    >
                      Abrir
                    </Link>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* ── Projects list ── */}
      <div>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-slate-900">Proyectos activos</h2>
          <Button variant="ghost" size="sm" asChild>
            <Link href="/dashboard/projects">
              Ver todos <ArrowRight className="ml-1 h-3.5 w-3.5" />
            </Link>
          </Button>
        </div>

        {projects.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center gap-3 py-12">
              <FolderOpen className="h-10 w-10 text-muted-foreground/40" />
              <p className="text-sm text-muted-foreground">No hay proyectos todavía.</p>
              <Button asChild size="sm" className="bg-slate-800 hover:bg-slate-700">
                <Link href="/dashboard/projects/new">Crear primer proyecto</Link>
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {projects.slice(0, 6).map((p) => (
              <Card key={p.id} className="group rounded-2xl hover:shadow-md transition-all hover:-translate-y-0.5 shadow-sm">
                <CardContent className="pt-5">
                  <div className="flex items-start justify-between gap-2 mb-3">
                    <span className="font-mono text-xs text-muted-foreground bg-slate-100 px-2 py-0.5 rounded">
                      {p.code}
                    </span>
                    <div className="flex gap-1.5 shrink-0">
                      <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${HOUSING_COLOR[p.housingType] ?? 'bg-gray-100 text-gray-600'}`}>
                        {p.housingType.replace('_', ' ')}
                      </span>
                      <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${STATUS_COLOR[p.status] ?? 'bg-gray-100 text-gray-600'}`}>
                        {STATUS_LABEL[p.status] ?? p.status}
                      </span>
                    </div>
                  </div>
                  <h3 className="font-semibold text-base mb-1 text-slate-900">{p.name}</h3>
                  <p className="text-xs text-muted-foreground mb-1 flex items-center gap-1">
                    <MapPin className="h-3 w-3" />
                    {p.city}, {p.department}
                  </p>
                  <p className="text-xs text-muted-foreground mb-4 flex items-center gap-1">
                    <Calendar className="h-3 w-3" />
                    {formatDateCO(p.startDate)} → {formatDateCO(p.expectedEndDate)}
                  </p>
                  <div className="flex items-center gap-2">
                    <Button size="sm" asChild className="flex-1 bg-slate-800 hover:bg-slate-700">
                      <Link href={`/dashboard/projects/${p.id}`}>
                        Abrir proyecto
                        <ArrowRight className="ml-1 h-3.5 w-3.5" />
                      </Link>
                    </Button>
                    <Button size="sm" variant="outline" asChild>
                      <Link href={`/dashboard/projects/${p.id}/dashboard`} title="Dashboard ejecutivo">
                        <BarChart3 className="h-3.5 w-3.5" />
                      </Link>
                    </Button>
                    <Button size="sm" variant="outline" asChild>
                      <Link href={`/dashboard/projects/${p.id}/budget`} title="Presupuesto">
                        <DollarSign className="h-3.5 w-3.5" />
                      </Link>
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* ── Quick actions ── */}
      <Card className="shadow-sm">
        <CardHeader>
          <CardTitle className="text-sm font-semibold">Acceso rápido</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {[
              { href: '/dashboard/budget', icon: DollarSign, label: 'Recursos APU', shortcut: 'G A' },
              { href: '/dashboard/reports', icon: BarChart3, label: 'Reportes', shortcut: 'G R' },
              { href: '/dashboard/projects/new', icon: Building2, label: 'Nuevo proyecto', shortcut: 'N' },
              { href: '/dashboard/projects', icon: FolderOpen, label: 'Todos los proyectos', shortcut: 'G P' },
            ].map(({ href, icon: Icon, label, shortcut }) => (
              <Link
                key={href}
                href={href}
                title={`${label} (${shortcut})`}
                className="group flex items-center gap-2 rounded-xl border px-3 py-2.5 text-sm font-medium transition-all hover:bg-slate-50 hover:border-slate-300"
              >
                <Icon className="h-4 w-4 text-muted-foreground group-hover:text-primary" />
                <span className="flex-1">{label}</span>
                <span className="hidden rounded bg-slate-100 px-1.5 py-0.5 text-[9px] font-mono text-slate-400 group-hover:inline">
                  {shortcut}
                </span>
              </Link>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
