'use client';
import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { Building2, ArrowRight } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { api } from '@/lib/api-client';

type Project = { id: string; code: string; name: string; status: string; city: string; department: string };

export function ModuleRedirect({ module, title }: { module: string; title: string }) {
  const router = useRouter();
  const { data, isLoading } = useQuery({ queryKey: ['projects'], queryFn: () => api.listProjects() });
  const projects = (data ?? []) as unknown as Project[];

  useEffect(() => {
    if (projects.length === 1) {
      router.replace(`/dashboard/projects/${projects[0]!.id}/${module}`);
    }
  }, [projects, router, module]);

  if (isLoading || projects.length === 1) {
    return (
      <div className="flex h-64 items-center justify-center">
        <p className="text-sm text-muted-foreground">Redirigiendo…</p>
      </div>
    );
  }

  if (projects.length === 0) {
    return (
      <div className="flex h-64 flex-col items-center justify-center gap-4">
        <Building2 className="h-10 w-10 text-muted-foreground/40" />
        <p className="text-sm text-muted-foreground">No hay proyectos disponibles.</p>
        <Button asChild size="sm"><Link href="/dashboard/projects/new">Crear proyecto</Link></Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">{title}</h1>
        <p className="text-muted-foreground">Seleccione un proyecto para continuar.</p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {projects.map((p) => (
          <Link key={p.id} href={`/dashboard/projects/${p.id}/${module}`}>
            <Card className="hover:shadow-md transition-shadow cursor-pointer group">
              <CardContent className="pt-4">
                <span className="font-mono text-xs text-muted-foreground">{p.code}</span>
                <h3 className="font-semibold mt-1">{p.name}</h3>
                <p className="text-xs text-muted-foreground">{p.city}, {p.department}</p>
                <div className="mt-3 flex items-center gap-1 text-sm text-primary font-medium">
                  Abrir {title} <ArrowRight className="h-3.5 w-3.5" />
                </div>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
