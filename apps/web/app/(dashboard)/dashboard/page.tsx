'use client';

import { useQuery } from '@tanstack/react-query';
import {
  ArrowRight,
  BarChart3,
  Building2,
  Calendar,
  DollarSign,
  FolderOpen,
  TrendingUp,
} from 'lucide-react';
import Link from 'next/link';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { api } from '@/lib/api-client';
import { useAuth } from '@/lib/auth-store';

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
  };

  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Buenos días' : hour < 18 ? 'Buenas tardes' : 'Buenas noches';
  const firstName = user?.fullName?.split(' ')[0] ?? 'Admin';

  return (
    <div className="space-y-8">
      {/* Welcome */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">
            {greeting}, {firstName} 👋
          </h1>
          <p className="mt-1 text-muted-foreground">
            Plataforma de gestión VIS / VIP / NO VIS · Colombia
          </p>
        </div>
        <Button asChild>
          <Link href="/dashboard/projects/new">
            <Building2 className="mr-2 h-4 w-4" />
            Nuevo proyecto
          </Link>
        </Button>
      </div>

      {/* Summary KPIs */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardContent className="pt-5">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs text-muted-foreground">Proyectos totales</p>
                <p className="mt-1 text-3xl font-bold">{projects.length}</p>
              </div>
              <div className="rounded-lg bg-blue-50 p-2 text-blue-600">
                <FolderOpen className="h-5 w-5" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs text-muted-foreground">En ejecución</p>
                <p className="mt-1 text-3xl font-bold text-green-600">{byStatus.EJECUCION}</p>
              </div>
              <div className="rounded-lg bg-green-50 p-2 text-green-600">
                <TrendingUp className="h-5 w-5" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs text-muted-foreground">En factibilidad</p>
                <p className="mt-1 text-3xl font-bold text-blue-600">{byStatus.FACTIBILIDAD}</p>
              </div>
              <div className="rounded-lg bg-blue-50 p-2 text-blue-600">
                <BarChart3 className="h-5 w-5" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs text-muted-foreground">En cierre</p>
                <p className="mt-1 text-3xl font-bold text-amber-600">{byStatus.CIERRE}</p>
              </div>
              <div className="rounded-lg bg-amber-50 p-2 text-amber-600">
                <Calendar className="h-5 w-5" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Projects list */}
      <div>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold">Proyectos activos</h2>
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
              <Button asChild size="sm">
                <Link href="/dashboard/projects/new">Crear primer proyecto</Link>
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {projects.slice(0, 6).map((p) => (
              <Card key={p.id} className="group hover:shadow-md transition-shadow">
                <CardContent className="pt-5">
                  <div className="flex items-start justify-between gap-2 mb-3">
                    <span className="font-mono text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded">
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
                  <h3 className="font-semibold text-base mb-1">{p.name}</h3>
                  <p className="text-xs text-muted-foreground mb-4">
                    📍 {p.city}, {p.department}
                  </p>
                  <div className="flex items-center gap-2">
                    <Button size="sm" asChild className="flex-1">
                      <Link href={`/dashboard/projects/${p.id}`}>
                        Abrir proyecto
                        <ArrowRight className="ml-1 h-3.5 w-3.5" />
                      </Link>
                    </Button>
                    <Button size="sm" variant="outline" asChild>
                      <Link href={`/dashboard/projects/${p.id}/dashboard`}>
                        <BarChart3 className="h-3.5 w-3.5" />
                      </Link>
                    </Button>
                    <Button size="sm" variant="outline" asChild>
                      <Link href={`/dashboard/projects/${p.id}/budget`}>
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

      {/* Quick links */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Acceso rápido</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {[
              { href: '/dashboard/budget', icon: DollarSign, label: 'Recursos APU' },
              { href: '/dashboard/reports', icon: BarChart3, label: 'Reportes' },
              { href: '/dashboard/projects/new', icon: Building2, label: 'Nuevo proyecto' },
              { href: '/dashboard/projects', icon: FolderOpen, label: 'Todos los proyectos' },
            ].map(({ href, icon: Icon, label }) => (
              <Link
                key={href}
                href={href}
                className="flex items-center gap-2 rounded-lg border px-3 py-2.5 text-sm font-medium hover:bg-accent transition-colors"
              >
                <Icon className="h-4 w-4 text-muted-foreground" />
                {label}
              </Link>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
