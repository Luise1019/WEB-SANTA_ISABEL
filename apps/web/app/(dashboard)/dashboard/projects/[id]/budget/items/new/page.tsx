'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Info } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { api } from '@/lib/api-client';

// ── Types ──────────────────────────────────────────────────────
type Chapter = {
  id: string;
  code: string;
  name: string;
  subchapters: Array<{ id: string; code: string; name: string }>;
};

type APU = {
  id: string;
  code: string;
  name: string;
  unit: string;
};

type CostType = 'MANO_OBRA' | 'MATERIAL' | 'EQUIPO' | 'FUNGIBLE' | 'OTRO';

const COST_TYPES: { value: CostType; label: string; color: string }[] = [
  { value: 'MANO_OBRA', label: 'Mano de obra', color: 'bg-blue-100 text-blue-700' },
  { value: 'MATERIAL', label: 'Material', color: 'bg-amber-100 text-amber-700' },
  { value: 'EQUIPO', label: 'Equipo', color: 'bg-purple-100 text-purple-700' },
  { value: 'FUNGIBLE', label: 'Fungible', color: 'bg-green-100 text-green-700' },
  { value: 'OTRO', label: 'Otro', color: 'bg-gray-100 text-gray-600' },
];

const FACTOR_PRESTACIONAL = 0.52; // Colombian labor benefits factor

function formatCOP(n: number) {
  return new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(n);
}

export default function NewBudgetItemPage({ params }: { params: { id: string } }) {
  const { id: projectId } = params;
  const router = useRouter();
  const qc = useQueryClient();

  const [selectedSubchapter, setSelectedSubchapter] = useState('');
  const [code, setCode] = useState('');
  const [description, setDescription] = useState('');
  const [unit, setUnit] = useState('');
  const [quantity, setQuantity] = useState('');
  const [unitCost, setUnitCost] = useState('');
  const [costType, setCostType] = useState<CostType>('MATERIAL');
  const [customCategory, setCustomCategory] = useState('');
  const [selectedApuId, setSelectedApuId] = useState<string>('');
  const [mode, setMode] = useState<'manual' | 'apu'>('manual');

  // Fetch chapters (for subcapítulo selector)
  const { data: chaptersData } = useQuery({
    queryKey: ['chapters', projectId],
    queryFn: () => api.listChapters(projectId),
  });

  // Fetch APUs for selection
  const { data: apusData } = useQuery({
    queryKey: ['apus'],
    queryFn: () => api.listAPUs(),
  });

  const chapters = (chaptersData ?? []) as unknown as Chapter[];
  const apus = (apusData ?? []) as unknown as APU[];
  const allSubs = chapters.flatMap((c) =>
    c.subchapters.map((s) => ({ ...s, chapterLabel: `${c.code} — ${c.name}` })),
  );

  // Auto-suggest code based on existing items in selected subchapter
  const selectedSub = allSubs.find((s) => s.id === selectedSubchapter);

  // Prestacional calculation for MANO_OBRA
  const baseUnitCost = Number(unitCost) || 0;
  const effectiveUnitCost = costType === 'MANO_OBRA'
    ? baseUnitCost * (1 + FACTOR_PRESTACIONAL)
    : baseUnitCost;
  const prestacionalAmount = costType === 'MANO_OBRA' ? baseUnitCost * FACTOR_PRESTACIONAL : 0;
  const qty = Number(quantity) || 0;
  const totalCost = effectiveUnitCost * qty;

  const mutation = useMutation({
    mutationFn: () =>
      api.createItem(projectId, selectedSubchapter, {
        code,
        description,
        unit,
        quantity,
        // For MANO_OBRA: store the effective cost (with prestacional) so DB is consistent
        unitCost: costType === 'MANO_OBRA' ? String(effectiveUnitCost.toFixed(4)) : unitCost,
        apuId: mode === 'apu' && selectedApuId ? selectedApuId : null,
        costType,
        customCategory: costType === 'OTRO' ? customCategory || null : null,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['budget-summary', projectId] });
      toast.success('Ítem creado exitosamente');
      router.push(`/dashboard/projects/${projectId}/budget`);
    },
    onError: (e: Error) => toast.error(`Error: ${e.message}`),
  });

  const canSubmit =
    selectedSubchapter && code && description && unit && quantity && unitCost &&
    (costType !== 'OTRO' || customCategory.trim().length > 0) &&
    (mode !== 'apu' || selectedApuId) &&
    !mutation.isPending;

  return (
    <div className="space-y-6 max-w-2xl">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" asChild>
          <Link href={`/dashboard/projects/${projectId}/budget`}>
            <ArrowLeft className="mr-1 h-4 w-4" />
            Presupuesto
          </Link>
        </Button>
        <div>
          <h1 className="text-2xl font-bold">Nuevo ítem de presupuesto</h1>
          <p className="text-sm text-muted-foreground">
            Partida presupuestal · Factor prestacional MO: 52% (estándar colombiano)
          </p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Ubicación en el presupuesto</CardTitle>
        </CardHeader>
        <CardContent>
          <Label>Subcapítulo</Label>
          <Select
            value={selectedSubchapter}
            onChange={(e) => setSelectedSubchapter(e.target.value)}
            className="mt-1"
          >
            <option value="">— Seleccione subcapítulo —</option>
            {allSubs.map((s) => (
              <option key={s.id} value={s.id}>
                {s.chapterLabel} / {s.code} {s.name}
              </option>
            ))}
          </Select>
          {allSubs.length === 0 && (
            <p className="text-xs text-amber-600 mt-1">
              ⚠ No hay subcapítulos. Créalos desde la vista de presupuesto primero.
            </p>
          )}
          {selectedSub && (
            <p className="text-xs text-muted-foreground mt-1">
              ✓ {selectedSub.chapterLabel} / {selectedSub.code} {selectedSub.name}
            </p>
          )}
        </CardContent>
      </Card>

      {/* Mode toggle */}
      <div className="flex gap-2">
        <button
          onClick={() => setMode('manual')}
          className={`flex-1 rounded-lg border-2 py-2.5 text-sm font-medium transition-all ${
            mode === 'manual'
              ? 'border-primary bg-primary text-primary-foreground'
              : 'border-muted-foreground/20 hover:border-primary/40'
          }`}
        >
          📝 Entrada manual
        </button>
        <button
          onClick={() => setMode('apu')}
          className={`flex-1 rounded-lg border-2 py-2.5 text-sm font-medium transition-all ${
            mode === 'apu'
              ? 'border-primary bg-primary text-primary-foreground'
              : 'border-muted-foreground/20 hover:border-primary/40'
          }`}
        >
          📐 Usar APU existente
        </button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Datos del ítem</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* APU selector (only in APU mode) */}
          {mode === 'apu' && (
            <div className="space-y-1">
              <Label>APU de la biblioteca</Label>
              <Select
                value={selectedApuId}
                onChange={(e) => {
                  const apu = apus.find((a) => a.id === e.target.value);
                  setSelectedApuId(e.target.value);
                  if (apu) {
                    setDescription(apu.name);
                    setUnit(apu.unit);
                    if (!code) setCode(apu.code);
                  }
                }}
              >
                <option value="">— Seleccione APU —</option>
                {apus.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.code} — {a.name} ({a.unit})
                  </option>
                ))}
              </Select>
              {apus.length === 0 && (
                <p className="text-xs text-muted-foreground">
                  No hay APUs. Créalos en la sección de{' '}
                  <Link href={`/dashboard/projects/${projectId}/budget/apus`} className="text-primary underline">
                    APUs
                  </Link>.
                </p>
              )}
            </div>
          )}

          {/* Code + Unit */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label>Código</Label>
              <Input value={code} onChange={(e) => setCode(e.target.value)} placeholder="P-01" />
            </div>
            <div className="space-y-1">
              <Label>Unidad</Label>
              <Input value={unit} onChange={(e) => setUnit(e.target.value)} placeholder="m², ml, und…" />
            </div>
          </div>

          {/* Description */}
          <div className="space-y-1">
            <Label>Descripción</Label>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Descripción detallada de la partida o actividad"
              rows={2}
            />
          </div>

          {/* Cost type */}
          <div className="space-y-1">
            <Label>Tipo de costo</Label>
            <div className="grid grid-cols-5 gap-1.5 mt-1">
              {COST_TYPES.map((ct) => (
                <button
                  key={ct.value}
                  onClick={() => setCostType(ct.value)}
                  className={`rounded-lg border-2 py-1.5 text-xs font-semibold transition-all ${
                    costType === ct.value
                      ? `${ct.color} border-current`
                      : 'border-transparent bg-muted/40 text-muted-foreground hover:bg-muted'
                  }`}
                >
                  {ct.label}
                </button>
              ))}
            </div>
            {costType === 'MANO_OBRA' && (
              <div className="flex items-start gap-2 rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 mt-2">
                <Info className="h-4 w-4 text-blue-500 shrink-0 mt-0.5" />
                <p className="text-xs text-blue-800">
                  <strong>Factor prestacional 52%</strong> incluido automáticamente (estándar colombiano).
                  El valor que ingreses como "Valor unitario" es el salario base — el sistema calculará el costo real × 1.52.
                </p>
              </div>
            )}
          </div>

          {costType === 'OTRO' && (
            <div className="space-y-1">
              <Label>Categoría personalizada</Label>
              <Input
                value={customCategory}
                onChange={(e) => setCustomCategory(e.target.value)}
                placeholder="Ej: Papelería, Seguros, Transporte…"
              />
            </div>
          )}

          {/* Quantity + Unit cost */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label>Cantidad</Label>
              <Input
                type="number" min="0" step="0.01"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                placeholder="100"
              />
            </div>
            <div className="space-y-1">
              <Label>
                {costType === 'MANO_OBRA' ? 'Salario base (COP)' : 'Valor unitario (COP)'}
              </Label>
              <Input
                type="number" min="0" step="1"
                value={unitCost}
                onChange={(e) => setUnitCost(e.target.value)}
                placeholder="85000"
                className={costType === 'MANO_OBRA' ? 'border-blue-300 focus:ring-blue-500' : ''}
              />
            </div>
          </div>

          {/* Total preview */}
          {quantity && unitCost && (
            <div className={`rounded-xl border p-4 space-y-1.5 text-sm ${
              costType === 'MANO_OBRA' ? 'border-blue-200 bg-blue-50' : 'border-muted bg-muted/30'
            }`}>
              {costType === 'MANO_OBRA' ? (
                <>
                  <div className="flex justify-between text-blue-800">
                    <span>Salario base ({qty.toFixed(2)} × {formatCOP(baseUnitCost)})</span>
                    <span className="font-mono">{formatCOP(baseUnitCost * qty)}</span>
                  </div>
                  <div className="flex justify-between text-blue-600">
                    <span>+ Prestacional 52%</span>
                    <span className="font-mono">{formatCOP(prestacionalAmount * qty)}</span>
                  </div>
                  <div className="flex justify-between text-blue-900 font-bold border-t border-blue-200 pt-1.5">
                    <span>= Costo efectivo total</span>
                    <span className="font-mono">{formatCOP(totalCost)}</span>
                  </div>
                  <p className="text-[11px] text-blue-600">
                    Valor unitario efectivo: {formatCOP(effectiveUnitCost)}/unidad
                  </p>
                </>
              ) : (
                <div className="flex justify-between font-semibold">
                  <span className="text-muted-foreground">Total estimado</span>
                  <span className="font-mono">{formatCOP(totalCost)}</span>
                </div>
              )}
            </div>
          )}

          {mutation.isError && (
            <p className="text-sm text-destructive">Error al guardar. Verifica los datos e intenta de nuevo.</p>
          )}

          <div className="flex gap-2 pt-2">
            <Button disabled={!canSubmit} onClick={() => mutation.mutate()} className="flex-1">
              {mutation.isPending ? 'Guardando…' : 'Guardar ítem'}
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
