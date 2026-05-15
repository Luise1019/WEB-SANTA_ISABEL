'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Check, RefreshCw, X } from 'lucide-react';
import Link from 'next/link';
import { useMemo, useState } from 'react';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { api } from '@/lib/api-client';

// ─── Constants ───────────────────────────────────────────────
const RESOURCE_TYPES = [
  { value: 'ALL',          label: 'Todos',        color: '' },
  { value: 'MANO_OBRA',    label: 'Mano de obra', color: 'bg-blue-100 text-blue-700' },
  { value: 'MATERIAL',     label: 'Material',     color: 'bg-amber-100 text-amber-700' },
  { value: 'EQUIPO',       label: 'Equipo',       color: 'bg-purple-100 text-purple-700' },
  { value: 'SUBCONTRATO',  label: 'Subcontrato',  color: 'bg-gray-100 text-gray-600' },
];

const TYPE_BADGE: Record<string, string> = {
  MANO_OBRA:   'bg-blue-100 text-blue-700',
  MATERIAL:    'bg-amber-100 text-amber-700',
  EQUIPO:      'bg-purple-100 text-purple-700',
  SUBCONTRATO: 'bg-gray-100 text-gray-600',
};

type Resource = {
  id: string;
  type: string;
  code: string;
  name: string;
  unit: string;
  rates: Array<{ id: string; unitCost: string; effectiveDate: string }>;
};

// ─── Helpers ─────────────────────────────────────────────────
function formatCOP(value: string | number) {
  return new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    maximumFractionDigits: 0,
  }).format(Number(value));
}

// ─── Update Rate Inline ───────────────────────────────────────
function UpdateRateCell({ resource }: { resource: Resource }) {
  const qc = useQueryClient();
  const [editing, setEditing] = useState(false);
  const [newCost, setNewCost] = useState('');

  const mutation = useMutation({
    mutationFn: () => api.addResourceRate(resource.id, newCost),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['resources'] });
      setEditing(false);
      setNewCost('');
    },
  });

  const currentRate = resource.rates[0]?.unitCost;

  if (!editing) {
    return (
      <div className="flex items-center justify-end gap-2 group">
        <span className="font-mono">{currentRate ? formatCOP(currentRate) : '—'}</span>
        <button
          title="Actualizar precio"
          className="opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-primary"
          onClick={() => {
            setNewCost(currentRate ?? '');
            setEditing(true);
          }}
        >
          <RefreshCw className="h-3.5 w-3.5" />
        </button>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-end gap-1">
      <Input
        type="number"
        autoFocus
        value={newCost}
        onChange={(e) => setNewCost(e.target.value)}
        className="h-6 w-28 text-xs text-right"
        min="0"
        onKeyDown={(e) => {
          if (e.key === 'Enter' && newCost) mutation.mutate();
          if (e.key === 'Escape') { setEditing(false); setNewCost(''); }
        }}
      />
      <button
        className="text-green-600 hover:text-green-700 disabled:opacity-40"
        disabled={!newCost || mutation.isPending}
        onClick={() => mutation.mutate()}
      >
        <Check className="h-3.5 w-3.5" />
      </button>
      <button
        className="text-muted-foreground hover:text-destructive"
        onClick={() => { setEditing(false); setNewCost(''); }}
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

// ─── Main Page ───────────────────────────────────────────────
export default function ResourcesPage({ params }: { params: { id: string } }) {
  const { id: projectId } = params;
  const qc = useQueryClient();

  const [typeFilter, setTypeFilter] = useState('ALL');
  const [search, setSearch] = useState('');

  // Create form state
  const [type, setType] = useState('MANO_OBRA');
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [unit, setUnit] = useState('');
  const [unitCost, setUnitCost] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['resources'],
    queryFn: api.listResources,
  });

  const resources = (data ?? []) as unknown as Resource[];

  const filteredResources = useMemo(() => {
    return resources.filter((r) => {
      const matchesType = typeFilter === 'ALL' || r.type === typeFilter;
      const matchesSearch =
        !search ||
        r.name.toLowerCase().includes(search.toLowerCase()) ||
        r.code.toLowerCase().includes(search.toLowerCase());
      return matchesType && matchesSearch;
    });
  }, [resources, typeFilter, search]);

  const groupedCount = useMemo(() => {
    const counts: Record<string, number> = { ALL: resources.length };
    for (const r of resources) {
      counts[r.type] = (counts[r.type] ?? 0) + 1;
    }
    return counts;
  }, [resources]);

  const mutation = useMutation({
    mutationFn: () =>
      api.createResource({
        type: type as 'MANO_OBRA' | 'MATERIAL' | 'EQUIPO' | 'SUBCONTRATO',
        code,
        name,
        unit,
        unitCost,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['resources'] });
      setCode('');
      setName('');
      setUnit('');
      setUnitCost('');
    },
  });

  return (
    <div className="space-y-6">
      <header className="flex items-center gap-3">
        <Button variant="ghost" size="sm" asChild>
          <Link href={`/dashboard/projects/${projectId}/budget`}>
            <ArrowLeft className="mr-1 h-4 w-4" />
            Presupuesto
          </Link>
        </Button>
        <div>
          <h1 className="text-2xl font-bold">Biblioteca de Recursos</h1>
          <p className="text-sm text-muted-foreground">
            MO, materiales, equipos y subcontratos con histórico de tarifas. Hover en precio → actualizar.
          </p>
        </div>
      </header>

      {/* Create Form */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Nuevo recurso</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
            <div className="space-y-1">
              <Label className="text-xs">Tipo</Label>
              <Select value={type} onChange={(e) => setType(e.target.value)}>
                {RESOURCE_TYPES.filter(t => t.value !== 'ALL').map((r) => (
                  <option key={r.value} value={r.value}>{r.label}</option>
                ))}
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Código</Label>
              <Input
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder="MO-001"
                className="h-8 text-sm"
              />
            </div>
            <div className="space-y-1 col-span-2">
              <Label className="text-xs">Nombre</Label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Oficial de mampostería"
                className="h-8 text-sm"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Unidad</Label>
              <Input
                value={unit}
                onChange={(e) => setUnit(e.target.value)}
                placeholder="Jornal"
                className="h-8 text-sm"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Costo unitario (COP)</Label>
              <Input
                type="number"
                value={unitCost}
                onChange={(e) => setUnitCost(e.target.value)}
                placeholder="85000"
                className="h-8 text-sm"
              />
            </div>
          </div>
          <Button
            size="sm"
            className="mt-3"
            disabled={mutation.isPending || !code || !name || !unit || !unitCost}
            onClick={() => mutation.mutate()}
          >
            Agregar recurso
          </Button>
        </CardContent>
      </Card>

      {/* Resources Table */}
      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <CardTitle className="text-base">Biblioteca ({resources.length} recursos)</CardTitle>
            <div className="flex items-center gap-2">
              <Input
                placeholder="Buscar…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="h-7 w-40 text-xs"
              />
            </div>
          </div>
          {/* Type filter tabs */}
          <div className="mt-2 flex flex-wrap gap-1">
            {RESOURCE_TYPES.map((t) => (
              <button
                key={t.value}
                onClick={() => setTypeFilter(t.value)}
                className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                  typeFilter === t.value
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-muted text-muted-foreground hover:bg-muted/80'
                }`}
              >
                {t.label}
                <span className="ml-1 opacity-70">({groupedCount[t.value] ?? 0})</span>
              </button>
            ))}
          </div>
        </CardHeader>
        <CardContent>
          {isLoading && <p className="text-sm">Cargando…</p>}
          {!isLoading && filteredResources.length === 0 && (
            <p className="text-sm text-muted-foreground">
              {resources.length === 0
                ? 'No hay recursos todavía. Agrega el primero con el formulario superior.'
                : 'Sin resultados para el filtro aplicado.'}
            </p>
          )}
          {filteredResources.length > 0 && (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="border-b">
                  <tr className="text-left text-xs text-muted-foreground">
                    <th className="py-2 pr-4 font-medium">Tipo</th>
                    <th className="py-2 pr-4 font-medium">Código</th>
                    <th className="py-2 pr-4 font-medium">Nombre</th>
                    <th className="py-2 pr-4 font-medium">Unidad</th>
                    <th className="py-2 pr-4 text-right font-medium">
                      Tarifa vigente
                      <span className="ml-1 font-normal opacity-60">(hover → editar)</span>
                    </th>
                    <th className="py-2 text-right font-medium">Historial</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredResources.map((r) => (
                    <tr key={r.id} className="border-b last:border-0 hover:bg-muted/10">
                      <td className="py-2 pr-4">
                        <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${TYPE_BADGE[r.type] ?? 'bg-gray-100'}`}>
                          {RESOURCE_TYPES.find(t => t.value === r.type)?.label ?? r.type}
                        </span>
                      </td>
                      <td className="py-2 pr-4 font-mono text-xs">{r.code}</td>
                      <td className="py-2 pr-4 font-medium">{r.name}</td>
                      <td className="py-2 pr-4 text-muted-foreground">{r.unit}</td>
                      <td className="py-2 pr-4">
                        <UpdateRateCell resource={r} />
                      </td>
                      <td className="py-2 text-right text-xs text-muted-foreground">
                        {r.rates.length} {r.rates.length === 1 ? 'tarifa' : 'tarifas'}
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
