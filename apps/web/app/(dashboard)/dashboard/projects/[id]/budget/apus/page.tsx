'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, ChevronDown, ChevronRight } from 'lucide-react';
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
};

// ─── Constants ───────────────────────────────────────────────
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

// ─── Helpers ─────────────────────────────────────────────────
function formatCOP(value: number) {
  return new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    maximumFractionDigits: 0,
  }).format(value);
}

function calcAPUCost(apu: APU): number {
  return apu.components.reduce((sum, comp) => {
    const rate = Number(comp.resource?.rates?.[0]?.unitCost ?? 0);
    return sum + rate * comp.quantity * (1 + comp.wasteFactor);
  }, 0);
}

function calcPreviewCost(components: ComponentRow[], resources: Resource[]): number {
  return components.reduce((sum, row) => {
    if (!row.resourceId) return sum;
    const res = resources.find((r) => r.id === row.resourceId);
    if (!res) return sum;
    const rate = Number(res.rates?.[0]?.unitCost ?? 0);
    const qty = Number(row.quantity) || 0;
    const wf = (Number(row.wasteFactor) || 0) / 100;
    return sum + rate * qty * (1 + wf);
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
          <div className="flex items-center justify-end gap-1">
            {expanded ? (
              <ChevronDown className="h-3 w-3 text-muted-foreground" />
            ) : (
              <ChevronRight className="h-3 w-3 text-muted-foreground" />
            )}
            {formatCOP(unitCost)}
          </div>
        </td>
      </tr>
      {expanded && (
        <tr>
          <td colSpan={5} className="bg-muted/5 pb-3 pl-6 pr-3 pt-0">
            {apu.components.length === 0 ? (
              <p className="py-2 text-xs text-muted-foreground">Sin componentes registrados.</p>
            ) : (
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b text-left text-[10px] text-muted-foreground">
                    <th className="py-1.5 pr-3 font-medium">Tipo</th>
                    <th className="py-1.5 pr-3 font-medium">Recurso</th>
                    <th className="py-1.5 pr-3 font-medium">Unidad</th>
                    <th className="py-1.5 pr-3 text-right font-medium">Cantidad</th>
                    <th className="py-1.5 pr-3 text-right font-medium">Factor desp.</th>
                    <th className="py-1.5 pr-3 text-right font-medium">Rendim.</th>
                    <th className="py-1.5 pr-3 text-right font-medium">Costo parcial</th>
                  </tr>
                </thead>
                <tbody>
                  {apu.components.map((comp) => {
                    const rate = Number(comp.resource?.rates?.[0]?.unitCost ?? 0);
                    const partial = rate * comp.quantity * (1 + comp.wasteFactor);
                    const rendimiento = comp.wasteFactor > 0 ? 1 / (1 + comp.wasteFactor) : 1;
                    return (
                      <tr key={comp.resourceId} className="border-b border-muted/30">
                        <td className="py-1.5 pr-3">
                          <TypeBadge type={comp.resource?.type ?? ('MATERIAL' as ResourceType)} />
                        </td>
                        <td className="py-1.5 pr-3">
                          {comp.resource?.code} — {comp.resource?.name}
                        </td>
                        <td className="py-1.5 pr-3 text-center">{comp.resource?.unit}</td>
                        <td className="py-1.5 pr-3 text-right">
                          {comp.quantity.toLocaleString('es-CO', { maximumFractionDigits: 4 })}
                        </td>
                        <td className="py-1.5 pr-3 text-right">
                          {(comp.wasteFactor * 100).toFixed(1)}%
                        </td>
                        <td className="py-1.5 pr-3 text-right">
                          {rendimiento.toFixed(4)}
                        </td>
                        <td className="py-1.5 pr-3 text-right font-mono">
                          {formatCOP(partial)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr>
                    <td colSpan={6} className="py-1.5 pr-3 text-right text-xs font-semibold">
                      Costo unitario:
                    </td>
                    <td className="py-1.5 pr-3 text-right font-mono font-bold text-primary">
                      {formatCOP(unitCost)}
                    </td>
                  </tr>
                </tfoot>
              </table>
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
        <CardTitle className="text-base">Biblioteca APU</CardTitle>
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
                  <th className="py-2 pr-4 text-center font-medium">Componentes</th>
                  <th className="py-2 pr-3 text-right font-medium">Costo Unit. Calc.</th>
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

  return (
    <div className="flex items-center gap-2">
      {/* Resource select grouped by type */}
      <Select
        value={row.resourceId}
        onChange={(e) => onChange(index, { ...row, resourceId: e.target.value })}
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

      {/* Quantity */}
      <Input
        type="number"
        placeholder="Cantidad"
        value={row.quantity}
        onChange={(e) => onChange(index, { ...row, quantity: e.target.value })}
        className="h-8 w-24 text-xs"
        min="0"
        step="any"
      />

      {/* Waste factor % */}
      <Input
        type="number"
        placeholder="Desp. %"
        value={row.wasteFactor}
        onChange={(e) => onChange(index, { ...row, wasteFactor: e.target.value })}
        className="h-8 w-20 text-xs"
        min="0"
        max="100"
        step="any"
      />

      <button
        type="button"
        onClick={() => onRemove(index)}
        className="shrink-0 rounded p-1 text-destructive hover:bg-destructive/10 transition-colors"
        title="Eliminar componente"
      >
        ✕
      </button>
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
    { resourceId: '', quantity: '', wasteFactor: '' },
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
          })),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['apus'] });
      setCode('');
      setName('');
      setUnit('m2');
      setIsLibrary(true);
      setComponents([{ resourceId: '', quantity: '', wasteFactor: '' }]);
    },
  });

  function handleComponentChange(index: number, updated: ComponentRow) {
    setComponents((prev) => prev.map((c, i) => (i === index ? updated : c)));
  }

  function handleComponentRemove(index: number) {
    setComponents((prev) => prev.filter((_, i) => i !== index));
  }

  function addComponent() {
    setComponents((prev) => [...prev, { resourceId: '', quantity: '', wasteFactor: '' }]);
  }

  const validComponents = components.filter((c) => c.resourceId && c.quantity && Number(c.quantity) > 0);
  const canSave =
    code.trim().length > 0 &&
    name.trim().length >= 2 &&
    validComponents.length > 0 &&
    !mutation.isPending;

  const previewCost = calcPreviewCost(components, resources);

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
          <Label className="text-xs font-semibold">Componentes del APU</Label>
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
        <div className="rounded-md border bg-muted/30 px-3 py-2">
          <div className="flex items-center justify-between text-xs">
            <span className="text-muted-foreground">Costo unitario calculado:</span>
            <span className="font-mono font-bold text-primary">{formatCOP(previewCost)}</span>
          </div>
          <p className="mt-0.5 text-[10px] text-muted-foreground">
            Σ (tasa recurso × cantidad × (1 + desp./100))
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
