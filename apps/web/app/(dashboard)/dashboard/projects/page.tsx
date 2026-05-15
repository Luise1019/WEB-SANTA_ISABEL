'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { useState } from 'react';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { api } from '@/lib/api-client';

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

function formatDateCO(iso: string): string {
  return new Date(iso).toLocaleDateString('es-CO', {
    year: 'numeric',
    month: 'short',
    day: '2-digit',
  });
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

  return (
    <div className="space-y-6">
      <header className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Proyectos</h1>
          <p className="text-muted-foreground">Listado de proyectos del consorcio.</p>
        </div>
        <Button asChild>
          <Link href="/dashboard/projects/new">Nuevo proyecto</Link>
        </Button>
      </header>

      <Card>
        <CardHeader>
          <CardTitle>Activos</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading && <p className="text-sm">Cargando…</p>}
          {error && (
            <p className="text-sm text-destructive">
              Error al cargar proyectos. Verifica que la API esté arriba y que la base de datos esté disponible.
            </p>
          )}
          {!isLoading && !error && rows.length === 0 && (
            <p className="text-sm text-muted-foreground">
              No hay proyectos todavía. Crea uno con el botón superior o importa desde Excel.
            </p>
          )}
          {rows.length > 0 && (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="border-b">
                  <tr className="text-left text-muted-foreground">
                    <th className="py-2 pr-4 font-medium">Código</th>
                    <th className="py-2 pr-4 font-medium">Nombre</th>
                    <th className="py-2 pr-4 font-medium">Tipo</th>
                    <th className="py-2 pr-4 font-medium">Estado</th>
                    <th className="py-2 pr-4 font-medium">Ubicación</th>
                    <th className="py-2 pr-4 font-medium">Inicio</th>
                    <th className="py-2 pr-4 font-medium">Fin esperado</th>
                    <th className="py-2 pr-4 font-medium text-right">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => (
                    <tr key={row.id} className="border-b last:border-b-0 hover:bg-muted/30">
                      <td className="py-2 pr-4 font-mono text-xs">{row.code}</td>
                      <td className="py-2 pr-4 font-medium">{row.name}</td>
                      <td className="py-2 pr-4">{HOUSING_LABELS[row.housingType] ?? row.housingType}</td>
                      <td className="py-2 pr-4">{STATUS_LABELS[row.status] ?? row.status}</td>
                      <td className="py-2 pr-4">
                        {row.city}, {row.department}
                      </td>
                      <td className="py-2 pr-4">{formatDateCO(row.startDate)}</td>
                      <td className="py-2 pr-4">{formatDateCO(row.expectedEndDate)}</td>
                      <td className="py-2 pr-4 text-right">
                        {pendingDeleteId !== row.id && (
                          <Button variant="outline" size="sm" asChild className="mr-1">
                            <Link href={`/dashboard/projects/${row.id}`}>Ver</Link>
                          </Button>
                        )}
                        {pendingDeleteId === row.id ? (
                          <span className="inline-flex gap-1">
                            <Button
                              variant="destructive"
                              size="sm"
                              disabled={deleteMutation.isPending}
                              onClick={() => deleteMutation.mutate(row.id)}
                            >
                              Confirmar
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setPendingDeleteId(null)}
                            >
                              Cancelar
                            </Button>
                          </span>
                        ) : (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setPendingDeleteId(row.id)}
                          >
                            Eliminar
                          </Button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
