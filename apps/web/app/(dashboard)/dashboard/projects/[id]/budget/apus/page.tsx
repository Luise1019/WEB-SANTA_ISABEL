'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, ChevronDown, ChevronRight, Info } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { api } from '@/lib/api-client';

// ─── Types ───────────────────────────────────────────────────
type ResourceType = 'MANO_OBRA' | 'MATERIAL' | 'EQUIPO' | 'SUBCONTRATO';

type ResourceRate = {
  unitCost: string;
};

type Resource = {
  id: string;
  type: ResourceType;
  code: string;
  name: string;
  unit: string;
  rates: ResourceRate[];
};

type APUComponent = {
  resourceId: string;
  quantity: number;
  wasteFactor: number;
  performance?: number | null;
  resource: Resource;
};

type APU = {
  id: string;
  code: string;
  name: string;
  unit: string;
  isLibrary: boolean;
  components: APUComponent[];
};

type ComponentRow = {
  resourceId: string;
  quantity: string;
  wasteFactor: string;
  rendimiento: string; // performance: units of work per unit time
};

// ─── Constants ───────────────────────────────────────────────
const FACTOR_PRESTACIONAL = 0.52;
const UNITS = ['m2', 'm3', 'ml', 'kg', 'und', 'glb', 'hr'] as const;

const RESOURCE_TYPE_LABEL: Record<ResourceType, string> = {
  MANO_OBRA: 'Mano de obra',
  MATERIAL: 'Material',
  EQUIPO: 'Equipo',
  SUBCONTRATO: 'Subcontrato',
};

const RESOURCE_TYPE_BADGE: Record<ResourceType, string> = {
  MANO_OBRA: 'bg-blue-100 text-blue-700',
  MATERIAL: 'bg-amber-100 text-amber-700',
  EQUIPO: 'bg-purple-100 text-purple-700',
  SUBCONTRATO: 'bg-gray-100 text-gray-600',
};

const RESOURCE_TYPE_ORDER: ResourceType[] = ['MANO_OBRA', 'MATERIAL', 'EQUIPO', 'SUBCONTRATO'];

const RESOURCE_TYPE_SUBTOTAL_BG: Record<ResourceType, string> = {
  MANO_OBRA: 'bg-blue-50 text-blue-800',
  MATERIAL: 'bg-amber-50 text-amber-800',
  EQUIPO: 'bg-purple-50 text-purple-800',
  SUBCONTRATO: 'bg-gray-50 text-gray-700',
};

// ─── Helpers ─────────────────────────────────────────────────
function formatCOP(value: number) {
  return new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    maximumFractionDigits: 0,
  }).format(value);
}

/** Apply prestacional factor: MANO_OBRA rate × 1.52, others unchanged */
function effectiveRate(rate: number, type: ResourceType): number {
  return type === 'MANO_OBRA' ? rate * (1 + FACTOR_PRESTACIONAL) : rate;
}

function calcAPUCost(apu: APU): number {
  return apu.components.reduce((sum, comp) => {
    const rate = Number(comp.resource?.rates?.[0]?.unitCost ?? 0);
    const effRate = effectiveRate(rate, comp.resource?.type ?? 'MATERIAL');
    return sum + effRate * comp.quantity * (1 + comp.wasteFactor);
  }, 0);
}

function calcAPUBreakdown(apu: APU): { mo: number; material: number; equipo: number; subcontrato: number } {
  const result = { mo: 0, material: 0, equipo: 0, subcontrato: 0 };
  for (const comp of apu.components) {
    const rate = Number(comp.resource?.rates?.[0]?.unitCost ?? 0);
    const effRate = effectiveRate(rate, comp.resource?.type ?? 'MATERIAL');
    const lineCost = effRate * comp.quantity * (1 + comp.wasteFactor);
    const t = comp.resource?.type;
    if (t === 'MANO_OBRA') result.mo += lineCost;
    else if (t === 'MATERIAL') result.material += lineCost;
    else if (t === 'EQUIPO') result.equipo += lineCost;
    else result.subcontrato += lineCost;
  }
  return result;
}

function calcPreviewCost(components: ComponentRow[], resources: Resource[]): number {
  return components.reduce((sum, row) => {
    if (!row.resourceId) return sum;
    const res = resources.find((r) => r.id === row.resourceId);
    if (!res) return sum;
    const rate = Number(res.rates?.[0]?.unitCost ?? 0);
    const effRate = effectiveRate(rate, res.type);
    const qty = Number(row.quantity) || 0;
    const wf = (Number(row.wasteFactor) || 0) / 100;
    return sum + effRate * qty * (1 + wf);
  }, 0);
}

// ─── Type Badge ───────────────────────────────────────────────
function TypeBadge({ type }: { type: ResourceType }) {
  return (
    <span
      className={`inline-block rounded px-1.5 py-0.5 text-[10px] font-medium ${RESOURCE_TYPE_BADGE[type] ?? 'bg-gray-100 text-gray-600'}`}
    >
      {RESOURCE_TYPE_LABEL[type] ?? type}
    </span>
  );
}

// ─── APU Row (expandable) ─────────────────────────────────────
function APURow({ apu }: { apu: APU }) {
  const [expanded, setExpanded] = useState(false);
  const unitCost = calcAPUCost(apu);
  const breakdown = calcAPUBreakdown(apu);

  // Group components by type
  const grouped = RESOURCE_TYPE_ORDER.map((type) => ({
    type,
    comps: apu.components.filter((c) => c.resource?.type === type),
  })).filter((g) => g.comps.length > 0);

  return (
    <>
      <tr
        className="cursor-pointer border-b text-sm hover:bg-muted/10"
        onClick={() => setExpanded((v) => !v)}
      >
        <td className="py-2 pl-3 pr-4 font-mono text-xs">{apu.code}</td>
        <td className="py-2 pr-4">{apu.name}</td>
        <td className="py-2 pr-4 text-center text-xs">{apu.unit}</td>
        <td className="py-2 pr-4 text-center text-xs">{apu.components.length}</td>
        <td className="py-2 pr-3 text-right font-mono text-xs">
          <div className="flex flex-col items-end gap-0.5">
            <div className="flex items-center gap-1">
              {expanded ? (
                <ChevronDown className="h-3 w-3 text-muted-foreground" />
              ) : (
                <ChevronRight className="h-3 w-3 text-muted-foreground" />
              )}
              <span className="font-bold">{formatCOP(unitCost)}</span>
            </div>
            {(breakdown.mo > 0 || breakdown.material > 0 || breakdown.equipo > 0) && (
              <div className="flex gap-1.5 text-[10px] text-muted-foreground">
                {breakdown.mo > 0 && <span className="text-blue-600">MO: {formatCOP(breakdown.mo)}</span>}
                {breakdown.material > 0 && <span>Mat: {formatCOP(breakdown.material)}</span>}
                {breakdown.equipo > 0 && <span>Eq: {formatCOP(breakdown.equipo)}</span>}
              </div>
            )}
          </div>
        </td>
      </tr>
      {expanded && (
        <tr>
          <td colSpan={5} className="bg-muted/5 pb-3 pl-6 pr-3 pt-0">
            {apu.components.length === 0 ? (
              <p className="py-2 text-xs text-muted-foreground">Sin componentes registrados.</p>
            ) : (
              <div className="space-y-3 pt-2">
                {grouped.map(({ type, comps }) => {
                  const groupSubtotal = comps.reduce((s, comp) => {
                    const rate = Number(comp.resource?.rates?.[0]?.unitCost ?? 0);
                    const effRate = effectiveRate(rate, type);
                    return s + effRate * comp.quantity * (1 + comp.wasteFactor);
                  }, 0);

                  return (
                    <div key={type}>
                      {/* Group header */}
                      <div className={`flex items-center justify-between rounded-t px-2 py-1 text-[10px] font-semibold ${RESOURCE_TYPE_SUBTOTAL_BG[type]}`}>
                        <span className="flex items-center gap-1.5">
                          <TypeBadge type={type} />
                          {type === 'MANO_OBRA' && (
                            <span className="rounded bg-blue-200 px-1 py-0.5 text-[9px] text-blue-800">
                              +52% prest.
                            </span>
                          )}
                        </span>
                        <span className="font-mono">{formatCOP(groupSubtotal)}</span>
                      </div>

                      {/* Component rows */}
                      <table className="w-full text-xs">
                        <thead>
                          <tr className="border-b text-left text-[10px] text-muted-foreground">
                            <th className="py-1 pr-3 font-medium">Recurso</th>
                            <th className="py-1 pr-3 font-medium">Unidad</th>
                            <th className="py-1 pr-3 text-right font-medium">Cantidad</th>
                            <th className="py-1 pr-3 text-right font-medium">Desp.%</th>
                            {type === 'MANO_OBRA' && (
                              <th className="py-1 pr-3 text-right font-medium">Tarifa efectiva</th>
                            )}
                            <th className="py-1 pr-3 text-right font-medium">Costo parcial</th>
                          </tr>
                        </thead>
                        <tbody>
                          {comps.map((comp) => {
                            const rate = Number(comp.resource?.rates?.[0]?.unitCost ?? 0);
                            const effRate = effectiveRate(rate, type);
                            const prestacionalAmt = type === 'MANO_OBRA' ? rate * FACTOR_PRESTACIONAL : 0;
                            const partial = effRate * comp.quantity * (1 + comp.wasteFactor);

                            return (
                              <tr
                                key={comp.resourceId}
                                className={`border-b border-muted/30 ${type === 'MANO_OBRA' ? 'bg-blue-50/30' : ''}`}
                              >
                                <td className="py-1.5 pr-3">
                                  {comp.resource?.code} — {comp.resource?.name}
                                  {type === 'MANO_OBRA' && (
                                    <div className="mt-0.5 space-y-0.5 text-[10px] text-muted-foreground">
                                      <div>Tarifa base: {formatCOP(rate)}</div>
                                      <div className="text-blue-600">
                                        + Prestacional (52%): {formatCOP(prestacionalAmt)}
                                      </div>
                                      <div className="font-semibold text-foreground">
                                        = Costo efectivo: {formatCOP(effRate)}
                                      </div>
                                    </div>
                                  )}
                                </td>
                                <td className="py-1.5 pr-3 text-center align-top">{comp.resource?.unit}</td>
                                <td className="py-1.5 pr-3 text-right align-top">
                                  {comp.quantity.toLocaleString('es-CO', { maximumFractionDigits: 4 })}
                                </td>
                                <td className="py-1.5 pr-3 text-right align-top">
                                  {(comp.wasteFactor * 100).toFixed(1)}%
                                </td>
                                {type === 'MANO_OBRA' && (
                                  <td className="py-1.5 pr-3 text-right align-top font-mono text-blue-700 font-semibold">
                                    {formatCOP(effRate)}
                                  </td>
                                )}
                                <td className="py-1.5 pr-3 text-right align-top font-mono font-bold">
                                  {formatCOP(partial)}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  );
                })}

                {/* Total */}
                <div className="flex items-center justify-between rounded border bg-muted/40 px-3 py-1.5 text-xs font-bold">
                  <span>COSTO UNITARIO (con prestacional)</span>
                  <span className="font-mono text-primary">{formatCOP(unitCost)}</span>
                </div>
              </div>
            )}
          </td>
        </tr>
      )}
    </>
  );
}

// ─── APU Library List ─────────────────────────────────────────
function APULibraryList() {
  const { data, isLoading, error } = useQuery({
    queryKey: ['apus'],
    queryFn: () => api.listAPUs(),
  });

  const apus = (data ?? []) as unknown as APU[];

  return (
    <Card className="h-fit">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          Biblioteca APU
          <span className="rounded bg-blue-100 px-1.5 py-0.5 text-[10px] text-blue-700 font-normal">
            MO incluye +52% prestacional
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading && <p className="text-sm text-muted-foreground">Cargando APUs…</p>}
        {error && (
          <p className="text-sm text-destructive">Error al cargar APUs.</p>
        )}
        {!isLoading && !error && apus.length === 0 && (
          <p className="py-6 text-center text-sm text-muted-foreground">
            No hay APUs en la biblioteca. Crea el primero usando el formulario.
          </p>
        )}
        {apus.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="border-b">
                <tr className="text-left text-[10px] text-muted-foreground">
                  <th className="py-2 pl-3 pr-4 font-medium">Código</th>
                  <th className="py-2 pr-4 font-medium">Nombre</th>
                  <th className="py-2 pr-4 text-center font-medium">Unidad</th>
                  <th className="py-2 pr-4 text-center font-medium">Comp.</th>
                  <th className="py-2 pr-3 text-right font-medium">Costo Unit. (c/prest.)</th>
                </tr>
              </thead>
              <tbody>
                {apus.map((apu) => (
                  <APURow key={apu.id} apu={apu} />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ─── Component Row Input ──────────────────────────────────────
function ComponentRowInput({
  row,
  index,
  resources,
  onChange,
  onRemove,
}: {
  row: ComponentRow;
  index: number;
  resources: Resource[];
  onChange: (index: number, updated: ComponentRow) => void;
  onRemove: (index: number) => void;
}) {
  const grouped = RESOURCE_TYPE_ORDER.map((type) => ({
    type,
    items: resources.filter((r) => r.type === type),
  })).filter((g) => g.items.length > 0);

  const selectedRes = resources.find((r) => r.id === row.resourceId);
  const isMO = selectedRes?.type === 'MANO_OBRA';
  const baseRate = selectedRes ? Number(selectedRes.rates?.[0]?.unitCost ?? 0) : 0;
  const effRate = isMO ? baseRate * (1 + FACTOR_PRESTACIONAL) : baseRate;

  // When rendimiento changes, auto-compute quantity = 1 / rendimiento
  function handleRendimientoChange(val: string) {
    const rend = Number(val);
    const newQty = rend > 0 ? String((1 / rend).toFixed(6)) : row.quantity;
    onChange(index, { ...row, rendimiento: val, quantity: newQty });
  }

  return (
    <div className={`space-y-1 rounded-md p-2 ${isMO ? 'bg-blue-50 border border-blue-100' : 'border border-muted/40'}`}>
      {isMO && (
        <div className="flex items-center gap-1 text-[10px] text-blue-700">
          <Info className="h-3 w-3" />
          Incluye +52% prestacional (tarifa efectiva: {formatCOP(effRate)}/u)
        </div>
      )}
      <div className="flex items-center gap-2">
        {/* Resource select grouped by type */}
        <Select
          value={row.resourceId}
          onChange={(e) => onChange(index, { ...row, resourceId: e.target.value, rendimiento: '' })}
          className="h-8 min-w-0 flex-1 text-xs"
        >
          <option value="">— Selecciona recurso —</option>
          {grouped.map((group) => (
            <optgroup key={group.type} label={RESOURCE_TYPE_LABEL[group.type]}>
              {group.items.map((res) => (
                <option key={res.id} value={res.id}>
                  [{res.code}] {res.name} ({res.unit})
                </option>
              ))}
            </optgroup>
          ))}
        </Select>

        {/* Rendimiento */}
        <div className="flex flex-col items-center">
          <span className="text-[9px] text-muted-foreground">Rendim.</span>
          <Input
            type="number"
            placeholder="u/hr"
            value={row.rendimiento}
            onChange={(e) => handleRendimientoChange(e.target.value)}
            className="h-8 w-20 text-xs"
            min="0"
            step="any"
            title="Rendimiento: unidades de trabajo por unidad de tiempo. Calcula cantidad = 1/rendimiento."
          />
        </div>

        {/* Quantity */}
        <div className="flex flex-col items-center">
          <span className="text-[9px] text-muted-foreground">Cantidad</span>
          <Input
            type="number"
            placeholder="Cant."
            value={row.quantity}
            onChange={(e) => onChange(index, { ...row, quantity: e.target.value })}
            className="h-8 w-24 text-xs"
            min="0"
            step="any"
          />
        </div>

        {/* Waste factor % */}
        <div className="flex flex-col items-center">
          <span className="text-[9px] text-muted-foreground">Desp.%</span>
          <Input
            type="number"
            placeholder="Desp.%"
            value={row.wasteFactor}
            onChange={(e) => onChange(index, { ...row, wasteFactor: e.target.value })}
            className="h-8 w-20 text-xs"
            min="0"
            max="100"
            step="any"
          />
        </div>

        <button
          type="button"
          onClick={() => onRemove(index)}
          className="shrink-0 rounded p-1 text-destructive hover:bg-destructive/10 transition-colors mt-3"
          title="Eliminar componente"
        >
          ✕
        </button>
      </div>
    </div>
  );
}

// ─── New APU Form ─────────────────────────────────────────────
function NewAPUForm() {
  const qc = useQueryClient();

  // Form fields
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [unit, setUnit] = useState<string>('m2');
  const [isLibrary, setIsLibrary] = useState(true);
  const [components, setComponents] = useState<ComponentRow[]>([
    { resourceId: '', quantity: '', wasteFactor: '', rendimiento: '' },
  ]);

  const { data: resourcesData } = useQuery({
    queryKey: ['resources'],
    queryFn: () => api.listResources(),
  });

  const resources = (resourcesData ?? []) as unknown as Resource[];

  const mutation = useMutation({
    mutationFn: () =>
      api.createAPU({
        code,
        name,
        unit,
        isLibrary,
        components: components
          .filter((c) => c.resourceId && c.quantity)
          .map((c) => ({
            resourceId: c.resourceId,
            quantity: String(c.quantity),
            wasteFactor: String((Number(c.wasteFactor) || 0) / 100),
            performance: c.rendimiento && Number(c.rendimiento) > 0 ? String(Number(c.rendimiento)) : undefined,
          })),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['apus'] });
      setCode('');
      setName('');
      setUnit('m2');
      setIsLibrary(true);
      setComponents([{ resourceId: '', quantity: '', wasteFactor: '', rendimiento: '' }]);
    },
  });

  function handleComponentChange(index: number, updated: ComponentRow) {
    setComponents((prev) => prev.map((c, i) => (i === index ? updated : c)));
  }

  function handleComponentRemove(index: number) {
    setComponents((prev) => prev.filter((_, i) => i !== index));
  }

  function addComponent() {
    setComponents((prev) => [...prev, { resourceId: '', quantity: '', wasteFactor: '', rendimiento: '' }]);
  }

  const validComponents = components.filter((c) => c.resourceId && c.quantity && Number(c.quantity) > 0);
  const canSave =
    code.trim().length > 0 &&
    name.trim().length >= 2 &&
    validComponents.length > 0 &&
    !mutation.isPending;

  const previewCost = calcPreviewCost(components, resources);

  // Preview breakdown by type
  const previewBreakdown = { mo: 0, material: 0, equipo: 0, subcontrato: 0 };
  for (const row of components) {
    if (!row.resourceId) continue;
    const res = resources.find((r) => r.id === row.resourceId);
    if (!res) continue;
    const rate = Number(res.rates?.[0]?.unitCost ?? 0);
    const effRate = effectiveRate(rate, res.type);
    const qty = Number(row.quantity) || 0;
    const wf = (Number(row.wasteFactor) || 0) / 100;
    const cost = effRate * qty * (1 + wf);
    if (res.type === 'MANO_OBRA') previewBreakdown.mo += cost;
    else if (res.type === 'MATERIAL') previewBreakdown.material += cost;
    else if (res.type === 'EQUIPO') previewBreakdown.equipo += cost;
    else previewBreakdown.subcontrato += cost;
  }

  return (
    <Card className="h-fit">
      <CardHeader>
        <CardTitle className="text-base">Nuevo APU</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Code + Name */}
        <div className="grid grid-cols-[120px_1fr] gap-3">
          <div className="space-y-1">
            <Label className="text-xs">Código</Label>
            <Input
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="APU-001"
              className="h-8 text-xs"
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Nombre</Label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Descripción del APU…"
              className="h-8 text-xs"
              minLength={2}
            />
          </div>
        </div>

        {/* Unit + isLibrary */}
        <div className="flex items-end gap-4">
          <div className="space-y-1">
            <Label className="text-xs">Unidad</Label>
            <Select
              value={unit}
              onChange={(e) => setUnit(e.target.value)}
              className="h-8 text-xs"
            >
              {UNITS.map((u) => (
                <option key={u} value={u}>
                  {u}
                </option>
              ))}
            </Select>
          </div>
          <label className="flex cursor-pointer items-center gap-2 text-xs">
            <input
              type="checkbox"
              checked={isLibrary}
              onChange={(e) => setIsLibrary(e.target.checked)}
              className="h-4 w-4 rounded border-input accent-primary"
            />
            ¿Biblioteca global?
          </label>
        </div>

        {/* Components */}
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <Label className="text-xs font-semibold">Componentes del APU</Label>
            <span className="rounded bg-blue-100 px-1.5 py-0.5 text-[9px] text-blue-700">
              MO aplica ×1.52 prestacional
            </span>
          </div>
          {resources.length === 0 && (
            <p className="text-xs text-muted-foreground">
              No hay recursos disponibles.{' '}
              <Link href="../resources" className="text-primary underline">
                Crea recursos primero.
              </Link>
            </p>
          )}
          <div className="space-y-2">
            {components.map((row, idx) => (
              <ComponentRowInput
                key={idx}
                row={row}
                index={idx}
                resources={resources}
                onChange={handleComponentChange}
                onRemove={handleComponentRemove}
              />
            ))}
          </div>
          <button
            type="button"
            onClick={addComponent}
            className="flex items-center gap-1 text-xs text-primary hover:underline"
          >
            + Agregar componente
          </button>
        </div>

        {/* Cost preview */}
        <div className="rounded-md border bg-muted/30 px-3 py-2 space-y-1.5">
          <div className="flex items-center justify-between text-xs">
            <span className="text-muted-foreground">Costo unitario calculado:</span>
            <span className="font-mono font-bold text-primary">{formatCOP(previewCost)}</span>
          </div>
          {previewCost > 0 && (
            <div className="grid grid-cols-2 gap-x-4 gap-y-0.5 text-[10px] text-muted-foreground">
              {previewBreakdown.mo > 0 && (
                <span className="text-blue-600">MO (c/prest.): {formatCOP(previewBreakdown.mo)}</span>
              )}
              {previewBreakdown.material > 0 && (
                <span>Material: {formatCOP(previewBreakdown.material)}</span>
              )}
              {previewBreakdown.equipo > 0 && (
                <span>Equipo: {formatCOP(previewBreakdown.equipo)}</span>
              )}
              {previewBreakdown.subcontrato > 0 && (
                <span>Subcontrato: {formatCOP(previewBreakdown.subcontrato)}</span>
              )}
            </div>
          )}
          <p className="text-[10px] text-muted-foreground">
            MO: tasa × 1.52 × cantidad × (1 + desp./100)
          </p>
        </div>

        {/* Save */}
        <Button
          className="w-full"
          disabled={!canSave}
          onClick={() => mutation.mutate()}
        >
          {mutation.isPending ? 'Guardando…' : 'Guardar APU'}
        </Button>
        {mutation.isError && (
          <p className="text-xs text-destructive">
            Error al guardar: {(mutation.error as Error)?.message ?? 'Error desconocido'}
          </p>
        )}
        {mutation.isSuccess && (
          <p className="text-xs text-green-600">APU guardado correctamente.</p>
        )}
      </CardContent>
    </Card>
  );
}

// ─── Main Page ───────────────────────────────────────────────
export default function APULibraryPage({ params }: { params: { id: string } }) {
  const projectId = params.id;

  return (
    <div className="space-y-6">
      {/* Header */}
      <header className="flex items-start gap-4">
        <Button variant="ghost" size="sm" asChild className="mt-1 shrink-0">
          <Link href={`/dashboard/projects/${projectId}/budget`}>
            <ArrowLeft className="mr-1 h-4 w-4" />
            Volver al presupuesto
          </Link>
        </Button>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Biblioteca APU</h1>
          <p className="text-sm text-muted-foreground">
            Análisis de Precios Unitarios — gestión de componentes y costos unitarios.
            Mano de obra incluye factor prestacional del <strong>52%</strong> (multiplier ×1.52) según normativa colombiana.
          </p>
        </div>
      </header>

      {/* Two-column layout */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <APULibraryList />
        <NewAPUForm />
      </div>
    </div>
  );
}
