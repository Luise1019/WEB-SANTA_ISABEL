'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus } from 'lucide-react';
import { useState } from 'react';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { api } from '@/lib/api-client';

type ChangeOrder = {
  id: string;
  code: string;
  title: string;
  justification: string;
  estimatedCostImpact: string;
  estimatedScheduleImpactDays: number;
  status: string;
  createdAt: string;
  createdBy?: { email: string } | null;
};

const STATUS_STYLES: Record<string, string> = {
  BORRADOR: 'bg-gray-100 text-gray-600',
  EN_REVISION: 'bg-amber-100 text-amber-700',
  APROBADA: 'bg-green-100 text-green-700',
  RECHAZADA: 'bg-red-100 text-red-700',
  APLICADA: 'bg-blue-100 text-blue-700',
};

const STATUS_LABELS: Record<string, string> = {
  BORRADOR: 'Borrador',
  EN_REVISION: 'En revisión',
  APROBADA: 'Aprobada',
  RECHAZADA: 'Rechazada',
  APLICADA: 'Aplicada',
};

function formatCOP(v: string | number) {
  return new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    maximumFractionDigits: 0,
  }).format(Number(v));
}

function NewOCForm({ projectId, onDone }: { projectId: string; onDone: () => void }) {
  const qc = useQueryClient();
  const [code, setCode] = useState('');
  const [title, setTitle] = useState('');
  const [justification, setJustification] = useState('');
  const [costImpact, setCostImpact] = useState('');
  const [scheduleImpact, setScheduleImpact] = useState('0');

  const mutation = useMutation({
    mutationFn: () =>
      api.createChangeOrder(projectId, {
        code,
        title,
        justification,
        estimatedCostImpact: costImpact,
        estimatedScheduleImpactDays: Number(scheduleImpact),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['changes', projectId] });
      onDone();
    },
  });

  return (
    <Card className="border-dashed">
      <CardHeader>
        <CardTitle className="text-sm">Nueva orden de cambio</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <Label className="text-xs">Código</Label>
            <Input value={code} onChange={(e) => setCode(e.target.value)} placeholder="OC-001" className="h-8" />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Título</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Cambio en especificaciones..." className="h-8" />
          </div>
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Justificación</Label>
          <Textarea
            value={justification}
            onChange={(e) => setJustification(e.target.value)}
            placeholder="Descripción detallada del cambio y su justificación técnica"
            rows={2}
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <Label className="text-xs">Impacto costo (COP)</Label>
            <Input
              type="number"
              value={costImpact}
              onChange={(e) => setCostImpact(e.target.value)}
              placeholder="5000000"
              className="h-8"
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Impacto cronograma (días)</Label>
            <Input
              type="number"
              value={scheduleImpact}
              onChange={(e) => setScheduleImpact(e.target.value)}
              className="h-8"
            />
          </div>
        </div>
        <div className="flex gap-2">
          <Button
            size="sm"
            disabled={!code || !title || !justification || !costImpact || mutation.isPending}
            onClick={() => mutation.mutate()}
          >
            Crear OC
          </Button>
          <Button size="sm" variant="ghost" onClick={onDone}>
            Cancelar
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

export default function ChangesPage({ params }: { params: { id: string } }) {
  const { id: projectId } = params;
  const qc = useQueryClient();
  const [showForm, setShowForm] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ['changes', projectId],
    queryFn: () => api.listChangeOrders(projectId),
  });

  const { data: baselinesData } = useQuery({
    queryKey: ['baselines', projectId],
    queryFn: () => api.listBaselines(projectId),
  });

  const orders = (data ?? []) as unknown as ChangeOrder[];
  const baselines = (baselinesData ?? []) as unknown as Array<{
    id: string; version: number; label: string; frozenAt: string;
  }>;

  const statusMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) =>
      api.updateChangeOrderStatus(projectId, id, status),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['changes', projectId] }),
  });

  const approveMutation = useMutation({
    mutationFn: (id: string) => api.approveChangeOrder(projectId, id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['changes', projectId] });
      qc.invalidateQueries({ queryKey: ['baselines', projectId] });
    },
  });

  const rejectMutation = useMutation({
    mutationFn: (id: string) => api.rejectChangeOrder(projectId, id, 'Rechazado por gerencia'),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['changes', projectId] }),
  });

  return (
    <div className="space-y-6">
      <header className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Órdenes de Cambio</h1>
          <p className="text-muted-foreground">
            Control de cambios con impacto en costo y cronograma.
          </p>
        </div>
        <Button onClick={() => setShowForm((v) => !v)}>
          <Plus className="mr-1 h-4 w-4" />
          {showForm ? 'Cancelar' : 'Nueva OC'}
        </Button>
      </header>

      {showForm && <NewOCForm projectId={projectId} onDone={() => setShowForm(false)} />}

      {/* Stats */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
        {['BORRADOR', 'EN_REVISION', 'APROBADA', 'RECHAZADA', 'APLICADA'].map((s) => (
          <Card key={s}>
            <CardContent className="pt-3">
              <p className="text-xs text-muted-foreground">{STATUS_LABELS[s]}</p>
              <p className="text-2xl font-bold">
                {orders.filter((o) => o.status === s).length}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Change Orders */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Historial ({orders.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading && <p className="text-sm">Cargando…</p>}
          {!isLoading && orders.length === 0 && (
            <p className="text-sm text-muted-foreground">No hay órdenes de cambio todavía.</p>
          )}
          {orders.length > 0 && (
            <div className="space-y-3">
              {orders.map((oc) => (
                <div key={oc.id} className="rounded-lg border p-4">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <span className="font-mono text-xs text-muted-foreground">{oc.code}</span>
                      <h3 className="font-semibold">{oc.title}</h3>
                      <p className="mt-1 text-sm text-muted-foreground">{oc.justification}</p>
                    </div>
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_STYLES[oc.status] ?? 'bg-muted'}`}
                    >
                      {STATUS_LABELS[oc.status] ?? oc.status}
                    </span>
                  </div>
                  <div className="mt-3 flex flex-wrap items-center gap-4 text-sm">
                    <span className="text-muted-foreground">
                      Impacto costo: <strong>{formatCOP(oc.estimatedCostImpact)}</strong>
                    </span>
                    <span className="text-muted-foreground">
                      Cronograma: <strong>{oc.estimatedScheduleImpactDays}d</strong>
                    </span>
                    <span className="ml-auto text-xs text-muted-foreground">
                      {new Date(oc.createdAt).toLocaleDateString('es-CO')}
                      {oc.createdBy && ` · ${oc.createdBy.email}`}
                    </span>
                  </div>
                  {/* Actions */}
                  <div className="mt-3 flex flex-wrap gap-2">
                    {oc.status === 'BORRADOR' && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => statusMutation.mutate({ id: oc.id, status: 'EN_REVISION' })}
                        disabled={statusMutation.isPending}
                      >
                        Enviar a revisión
                      </Button>
                    )}
                    {oc.status === 'EN_REVISION' && (
                      <>
                        <Button
                          size="sm"
                          onClick={() => approveMutation.mutate(oc.id)}
                          disabled={approveMutation.isPending}
                          className="bg-green-600 hover:bg-green-700"
                        >
                          Aprobar
                        </Button>
                        <Button
                          size="sm"
                          variant="destructive"
                          onClick={() => rejectMutation.mutate(oc.id)}
                          disabled={rejectMutation.isPending}
                        >
                          Rechazar
                        </Button>
                      </>
                    )}
                    {oc.status === 'APROBADA' && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => statusMutation.mutate({ id: oc.id, status: 'APLICADA' })}
                        disabled={statusMutation.isPending}
                      >
                        Marcar como aplicada
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Budget Baselines */}
      {baselines.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              Versiones de presupuesto baseline ({baselines.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {baselines.map((b) => (
                <div key={b.id} className="flex items-center justify-between rounded border px-3 py-2 text-sm">
                  <div>
                    <span className="font-mono text-xs text-muted-foreground">v{b.version}</span>
                    <span className="ml-2 font-medium">{b.label}</span>
                  </div>
                  <span className="text-xs text-muted-foreground">
                    {new Date(b.frozenAt).toLocaleDateString('es-CO')}
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
