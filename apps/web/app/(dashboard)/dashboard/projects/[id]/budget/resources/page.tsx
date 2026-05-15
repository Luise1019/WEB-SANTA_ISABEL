'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { api } from '@/lib/api-client';

const RESOURCE_TYPES = [
  { value: 'MANO_OBRA', label: 'Mano de obra' },
  { value: 'MATERIAL', label: 'Material' },
  { value: 'EQUIPO', label: 'Equipo' },
  { value: 'SUBCONTRATO', label: 'Subcontrato' },
];

type Resource = {
  id: string;
  type: string;
  code: string;
  name: string;
  unit: string;
  rates: Array<{ unitCost: string }>;
};

function formatCOP(value: string | number) {
  return new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    maximumFractionDigits: 0,
  }).format(Number(value));
}

export default function ResourcesPage({ params }: { params: { id: string } }) {
  const { id: projectId } = params;
  const qc = useQueryClient();

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

  const typeLabel = (t: string) => RESOURCE_TYPES.find((r) => r.value === t)?.label ?? t;

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
          <h1 className="text-2xl font-bold">Recursos</h1>
          <p className="text-sm text-muted-foreground">
            Biblioteca global de MO, materiales, equipos y subcontratos.
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
                {RESOURCE_TYPES.map((r) => (
                  <option key={r.value} value={r.value}>
                    {r.label}
                  </option>
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
              <Label className="text-xs">Costo unitario</Label>
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
          <CardTitle className="text-base">
            Biblioteca ({resources.length} recursos)
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading && <p className="text-sm">Cargando…</p>}
          {!isLoading && resources.length === 0 && (
            <p className="text-sm text-muted-foreground">No hay recursos todavía.</p>
          )}
          {resources.length > 0 && (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="border-b">
                  <tr className="text-left text-xs text-muted-foreground">
                    <th className="py-2 pr-4 font-medium">Tipo</th>
                    <th className="py-2 pr-4 font-medium">Código</th>
                    <th className="py-2 pr-4 font-medium">Nombre</th>
                    <th className="py-2 pr-4 font-medium">Unidad</th>
                    <th className="py-2 pr-4 text-right font-medium">Costo vigente</th>
                  </tr>
                </thead>
                <tbody>
                  {resources.map((r) => (
                    <tr key={r.id} className="border-b last:border-0 hover:bg-muted/20">
                      <td className="py-2 pr-4">
                        <span className="rounded-full bg-muted px-2 py-0.5 text-xs">
                          {typeLabel(r.type)}
                        </span>
                      </td>
                      <td className="py-2 pr-4 font-mono text-xs">{r.code}</td>
                      <td className="py-2 pr-4">{r.name}</td>
                      <td className="py-2 pr-4 text-muted-foreground">{r.unit}</td>
                      <td className="py-2 pr-4 text-right font-mono">
                        {r.rates[0] ? formatCOP(r.rates[0].unitCost) : '—'}
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
