'use client';

import { useQuery } from '@tanstack/react-query';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { api } from '@/lib/api-client';
import { useAuth } from '@/lib/auth-store';

export default function ProjectsPage() {
  const token = useAuth((s) => s.accessToken);

  const { data, isLoading, error } = useQuery({
    queryKey: ['projects'],
    queryFn: () => api.listProjects(token ?? ''),
    enabled: !!token,
  });

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-3xl font-bold tracking-tight">Proyectos</h1>
        <p className="text-muted-foreground">Listado de proyectos del consorcio.</p>
      </header>

      <Card>
        <CardHeader>
          <CardTitle>Activos</CardTitle>
        </CardHeader>
        <CardContent>
          {!token && <p className="text-sm text-muted-foreground">Inicia sesión para ver los proyectos.</p>}
          {isLoading && <p className="text-sm">Cargando…</p>}
          {error && <p className="text-sm text-destructive">Error al cargar proyectos.</p>}
          {data && data.length === 0 && (
            <p className="text-sm text-muted-foreground">
              No hay proyectos todavía. Crea uno o importa desde Excel.
            </p>
          )}
          {data && data.length > 0 && (
            <pre className="text-xs overflow-auto">{JSON.stringify(data, null, 2)}</pre>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
