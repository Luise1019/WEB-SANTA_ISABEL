'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { use, useState } from 'react';
import { useRouter } from 'next/navigation';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { api } from '@/lib/api-client';

type Chapter = {
  id: string;
  code: string;
  name: string;
  subchapters: Array<{ id: string; code: string; name: string }>;
};

export default function NewBudgetItemPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: projectId } = use(params);
  const router = useRouter();
  const qc = useQueryClient();

  const [selectedSubchapter, setSelectedSubchapter] = useState('');
  const [code, setCode] = useState('');
  const [description, setDescription] = useState('');
  const [unit, setUnit] = useState('');
  const [quantity, setQuantity] = useState('');
  const [unitCost, setUnitCost] = useState('');

  const { data: chaptersData } = useQuery({
    queryKey: ['chapters', projectId],
    queryFn: () => api.listChapters(projectId),
  });

  const chapters = (chaptersData ?? []) as unknown as Chapter[];
  const allSubs = chapters.flatMap((c) =>
    c.subchapters.map((s) => ({
      ...s,
      chapterLabel: `${c.code} — ${c.name}`,
    })),
  );

  const mutation = useMutation({
    mutationFn: () =>
      api.createItem(projectId, selectedSubchapter, {
        code,
        description,
        unit,
        quantity,
        unitCost,
        apuId: null,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['budget-summary', projectId] });
      router.push(`/dashboard/projects/${projectId}/budget`);
    },
  });

  const canSubmit =
    selectedSubchapter && code && description && unit && quantity && unitCost && !mutation.isPending;

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
          <h1 className="text-2xl font-bold">Nuevo ítem de presupuesto</h1>
          <p className="text-sm text-muted-foreground">Agregar una partida al presupuesto del proyecto.</p>
        </div>
      </header>

      <Card className="max-w-2xl">
        <CardHeader>
          <CardTitle className="text-base">Datos del ítem</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Subchapter */}
          <div className="space-y-1">
            <Label>Subcapítulo</Label>
            <Select
              value={selectedSubchapter}
              onChange={(e) => setSelectedSubchapter(e.target.value)}
            >
              <option value="">— Seleccione subcapítulo —</option>
              {allSubs.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.chapterLabel} / {s.code} {s.name}
                </option>
              ))}
            </Select>
            {allSubs.length === 0 && (
              <p className="text-xs text-muted-foreground">
                No hay subcapítulos. Créalos desde la vista de presupuesto.
              </p>
            )}
          </div>

          {/* Code + Unit */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label>Código</Label>
              <Input
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder="P-01"
              />
            </div>
            <div className="space-y-1">
              <Label>Unidad</Label>
              <Input
                value={unit}
                onChange={(e) => setUnit(e.target.value)}
                placeholder="m², ml, und…"
              />
            </div>
          </div>

          {/* Description */}
          <div className="space-y-1">
            <Label>Descripción</Label>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Descripción detallada de la actividad o partida"
              rows={2}
            />
          </div>

          {/* Quantity + Unit cost */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label>Cantidad</Label>
              <Input
                type="number"
                min="0"
                step="0.01"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                placeholder="100"
              />
            </div>
            <div className="space-y-1">
              <Label>Valor unitario (COP)</Label>
              <Input
                type="number"
                min="0"
                step="1"
                value={unitCost}
                onChange={(e) => setUnitCost(e.target.value)}
                placeholder="85000"
              />
            </div>
          </div>

          {/* Total preview */}
          {quantity && unitCost && (
            <div className="rounded-md bg-muted/40 px-3 py-2 text-sm">
              <span className="text-muted-foreground">Total estimado: </span>
              <span className="font-mono font-semibold">
                {new Intl.NumberFormat('es-CO', {
                  style: 'currency',
                  currency: 'COP',
                  maximumFractionDigits: 0,
                }).format(Number(quantity) * Number(unitCost))}
              </span>
            </div>
          )}

          {mutation.isError && (
            <p className="text-sm text-destructive">
              Error al guardar. Verifica los datos e intenta de nuevo.
            </p>
          )}

          <div className="flex gap-2">
            <Button disabled={!canSubmit} onClick={() => mutation.mutate()}>
              Guardar ítem
            </Button>
            <Button variant="outline" asChild>
              <Link href={`/dashboard/projects/${projectId}/budget`}>Cancelar</Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
