'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';
import { useRouter } from 'next/navigation';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { api } from '@/lib/api-client';

type Task = { id: string; code: string; name: string };

export default function NewTaskPage({ params }: { params: { id: string } }) {
  const { id: projectId } = params;
  const router = useRouter();
  const qc = useQueryClient();

  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [kind, setKind] = useState('TASK');
  const [parentId, setParentId] = useState('');
  const [plannedStart, setPlannedStart] = useState('');
  const [plannedEnd, setPlannedEnd] = useState('');
  const [durationDays, setDurationDays] = useState('5');

  const { data: tasksData } = useQuery({
    queryKey: ['tasks', projectId],
    queryFn: () => api.listTasks(projectId),
  });
  const tasks = (tasksData ?? []) as unknown as Task[];

  const mutation = useMutation({
    mutationFn: () =>
      api.createTask(projectId, {
        code,
        name,
        kind: kind as 'SUMMARY' | 'TASK' | 'MILESTONE',
        parentId: parentId || null,
        plannedStart,
        plannedEnd,
        durationDays: Number(durationDays),
        progress: 0,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['tasks', projectId] });
      router.push(`/dashboard/projects/${projectId}/schedule`);
    },
  });

  const canSubmit = code && name && plannedStart && plannedEnd && durationDays && !mutation.isPending;

  return (
    <div className="space-y-6">
      <header className="flex items-center gap-3">
        <Button variant="ghost" size="sm" asChild>
          <Link href={`/dashboard/projects/${projectId}/schedule`}>
            <ArrowLeft className="mr-1 h-4 w-4" />
            Cronograma
          </Link>
        </Button>
        <div>
          <h1 className="text-2xl font-bold">Nueva tarea</h1>
          <p className="text-sm text-muted-foreground">Agregar tarea al cronograma del proyecto.</p>
        </div>
      </header>

      <Card className="max-w-2xl">
        <CardHeader>
          <CardTitle className="text-base">Datos de la tarea</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Code + Kind */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label>Código WBS</Label>
              <Input
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder="1.1.1"
              />
            </div>
            <div className="space-y-1">
              <Label>Tipo</Label>
              <Select value={kind} onChange={(e) => setKind(e.target.value)}>
                <option value="SUMMARY">Resumen</option>
                <option value="TASK">Tarea</option>
                <option value="MILESTONE">Hito</option>
              </Select>
            </div>
          </div>

          {/* Name */}
          <div className="space-y-1">
            <Label>Nombre de la tarea</Label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Mampostería nivel 1"
            />
          </div>

          {/* Parent */}
          {tasks.length > 0 && (
            <div className="space-y-1">
              <Label>Tarea padre (opcional)</Label>
              <Select value={parentId} onChange={(e) => setParentId(e.target.value)}>
                <option value="">— Sin padre —</option>
                {tasks.filter((t) => (t as unknown as { kind: string }).kind === 'SUMMARY').map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.code} {t.name}
                  </option>
                ))}
              </Select>
            </div>
          )}

          {/* Dates */}
          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1">
              <Label>Inicio planificado</Label>
              <Input
                type="date"
                value={plannedStart}
                onChange={(e) => setPlannedStart(e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <Label>Fin planificado</Label>
              <Input
                type="date"
                value={plannedEnd}
                onChange={(e) => setPlannedEnd(e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <Label>Duración (días háb.)</Label>
              <Input
                type="number"
                min="0"
                value={durationDays}
                onChange={(e) => setDurationDays(e.target.value)}
              />
            </div>
          </div>

          {mutation.isError && (
            <p className="text-sm text-destructive">
              Error al guardar. Verifica los datos e intenta de nuevo.
            </p>
          )}

          <div className="flex gap-2">
            <Button disabled={!canSubmit} onClick={() => mutation.mutate()}>
              Crear tarea
            </Button>
            <Button variant="outline" asChild>
              <Link href={`/dashboard/projects/${projectId}/schedule`}>Cancelar</Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
