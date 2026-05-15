'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ChevronDown, ChevronRight, Plus, Settings, Trash2, X } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { api } from '@/lib/api-client';

// ─── Types ───────────────────────────────────────────────────
type CostType = 'MANO_OBRA' | 'MATERIAL' | 'EQUIPO' | 'FUNGIBLE' | 'OTRO';

type ItemData = {
  id: string;
  code: string;
  description: string;
  unit: string;
  quantity: string;
  unitCostCalc: string;
  totalCalc: string;
  costType: CostType;
  customCategory: string | null;
};

type SubchapterData = {
  id: string;
  code: string;
  name: string;
  items: ItemData[];
  subtotal: string;
};

type ChapterData = {
  id: string;
  code: string;
  name: string;
  subchapters: SubchapterData[];
  total: string;
};

type Summary = {
  chapters: ChapterData[];
  directCost: string;
  aiuAmount: string;
  ivaAmount: string;
  totalCost: string;
  aiuConfig: {
    administracionPct: string;
    imprevistosPct: string;
    utilidadPct: string;
    ivaUtilidadPct: string;
  };
  costByType: Record<string, string>;
  customCategories: Record<string, string>;
};

const UNITS = ['m2', 'm3', 'ml', 'kg', 'und', 'glb', 'hr'] as const;

const COST_TYPES: { value: CostType; label: string }[] = [
  { value: 'MANO_OBRA', label: 'Mano de obra' },
  { value: 'MATERIAL', label: 'Material' },
  { value: 'EQUIPO', label: 'Equipo' },
  { value: 'FUNGIBLE', label: 'Fungible' },
  { value: 'OTRO', label: 'Otro' },
];

const COST_TYPE_BADGE: Record<CostType, string> = {
  MANO_OBRA: 'bg-blue-100 text-blue-700',
  MATERIAL:  'bg-amber-100 text-amber-700',
  EQUIPO:    'bg-purple-100 text-purple-700',
  FUNGIBLE:  'bg-green-100 text-green-700',
  OTRO:      'bg-gray-100 text-gray-600',
};

const COST_TYPE_DOT: Record<CostType, string> = {
  MANO_OBRA: 'bg-blue-500',
  MATERIAL:  'bg-amber-500',
  EQUIPO:    'bg-purple-500',
  FUNGIBLE:  'bg-green-500',
  OTRO:      'bg-gray-400',
};

// ─── Helpers ─────────────────────────────────────────────────
function formatCOP(value: string | number) {
  return new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    maximumFractionDigits: 0,
  }).format(Number(value));
}

function CostTypeBadge({ type, custom }: { type: CostType; custom?: string | null }) {
  const label = type === 'OTRO' && custom ? custom : (COST_TYPES.find(c => c.value === type)?.label ?? type);
  return (
    <span className={`inline-block rounded px-1.5 py-0.5 text-[10px] font-medium ${COST_TYPE_BADGE[type] ?? 'bg-gray-100 text-gray-600'}`}>
      {label}
    </span>
  );
}

// ─── AIU Panel ───────────────────────────────────────────────
function AIUPanel({
  projectId,
  config,
}: {
  projectId: string;
  config: Summary['aiuConfig'];
}) {
  const qc = useQueryClient();
  const [adm, setAdm] = useState(config.administracionPct ?? '10');
  const [imp, setImp] = useState(config.imprevistosPct ?? '5');
  const [uti, setUti] = useState(config.utilidadPct ?? '5');
  const [iva, setIva] = useState(config.ivaUtilidadPct ?? '19');

  const mutation = useMutation({
    mutationFn: () =>
      api.upsertAIU(projectId, {
        administracionPct: adm,
        imprevistosPct: imp,
        utilidadPct: uti,
        ivaUtilidadPct: iva,
        appliesToIndirect: false,
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['budget-summary', projectId] }),
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Settings className="h-4 w-4" />
          Configuración AIU
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            { label: 'Administración (%)', value: adm, set: setAdm },
            { label: 'Imprevistos (%)', value: imp, set: setImp },
            { label: 'Utilidad (%)', value: uti, set: setUti },
            { label: 'IVA utilidad (%)', value: iva, set: setIva },
          ].map(({ label, value, set }) => (
            <div key={label} className="space-y-1">
              <Label className="text-xs">{label}</Label>
              <Input
                type="number"
                min="0"
                max="100"
                step="0.01"
                value={value}
                onChange={(e) => set(e.target.value)}
                className="h-8 text-sm"
              />
            </div>
          ))}
        </div>
        <Button
          size="sm"
          className="mt-3"
          disabled={mutation.isPending}
          onClick={() => mutation.mutate()}
        >
          Guardar AIU
        </Button>
      </CardContent>
    </Card>
  );
}

// ─── New Subchapter Form ──────────────────────────────────────
function NewSubchapterForm({
  projectId,
  chapter,
  onDone,
}: {
  projectId: string;
  chapter: ChapterData;
  onDone: () => void;
}) {
  const qc = useQueryClient();
  const [name, setName] = useState('');

  const mutation = useMutation({
    mutationFn: () => {
      const nextNum = chapter.subchapters.length + 1;
      const code = `${chapter.code}.${String(nextNum).padStart(2, '0')}`;
      return api.createSubchapter(projectId, chapter.id, { code, name });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['budget-summary', projectId] });
      setName('');
      onDone();
    },
  });

  return (
    <tr>
      <td colSpan={7} className="py-2 pl-6 pr-3">
        <div className="flex items-center gap-2">
          <Input
            autoFocus
            placeholder="Nombre del subcapítulo…"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="h-7 text-xs"
            onKeyDown={(e) => {
              if (e.key === 'Enter' && name.trim()) mutation.mutate();
              if (e.key === 'Escape') onDone();
            }}
          />
          <Button
            size="sm"
            className="h-7 px-3 text-xs"
            disabled={!name.trim() || mutation.isPending}
            onClick={() => mutation.mutate()}
          >
            Guardar
          </Button>
          <Button size="sm" variant="ghost" className="h-7 px-2" onClick={onDone}>
            <X className="h-3.5 w-3.5" />
          </Button>
        </div>
      </td>
    </tr>
  );
}

// ─── New Item Form ────────────────────────────────────────────
function NewItemForm({
  projectId,
  sub,
  onDone,
}: {
  projectId: string;
  sub: SubchapterData;
  onDone: () => void;
}) {
  const qc = useQueryClient();
  const [description, setDescription] = useState('');
  const [unit, setUnit] = useState<string>('und');
  const [quantity, setQuantity] = useState('');
  const [unitCost, setUnitCost] = useState('');
  const [costType, setCostType] = useState<CostType>('MATERIAL');
  const [customCategory, setCustomCategory] = useState('');

  const mutation = useMutation({
    mutationFn: () => {
      const nextNum = sub.items.length + 1;
      const code = `${sub.code}.${String(nextNum).padStart(2, '0')}`;
      return api.createItem(projectId, sub.id, {
        code,
        description,
        unit,
        quantity,
        unitCost,
        costType,
        customCategory: costType === 'OTRO' ? customCategory || null : null,
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['budget-summary', projectId] });
      setDescription('');
      setQuantity('');
      setUnitCost('');
      setCostType('MATERIAL');
      setCustomCategory('');
      onDone();
    },
  });

  const canSave =
    description.trim().length >= 2 &&
    quantity !== '' &&
    !isNaN(Number(quantity)) &&
    Number(quantity) > 0 &&
    unitCost !== '' &&
    !isNaN(Number(unitCost)) &&
    Number(unitCost) >= 0 &&
    (costType !== 'OTRO' || customCategory.trim().length > 0);

  return (
    <tr>
      <td colSpan={7} className="py-2 pl-10 pr-3">
        <div className="space-y-2">
          {/* Row 1: description + unit + quantity + cost */}
          <div className="grid grid-cols-[1fr_80px_90px_120px] items-center gap-2">
            <Input
              autoFocus
              placeholder="Descripción del ítem…"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="h-7 text-xs"
              onKeyDown={(e) => e.key === 'Escape' && onDone()}
            />
            <Select
              value={unit}
              onChange={(e) => setUnit(e.target.value)}
              className="h-7 text-xs"
            >
              {UNITS.map((u) => (
                <option key={u} value={u}>
                  {u}
                </option>
              ))}
            </Select>
            <Input
              type="number"
              placeholder="Cantidad"
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              className="h-7 text-xs"
              min="0"
              step="any"
            />
            <Input
              type="number"
              placeholder="Vr. Unit COP"
              value={unitCost}
              onChange={(e) => setUnitCost(e.target.value)}
              className="h-7 text-xs"
              min="0"
              step="any"
            />
          </div>
          {/* Row 2: cost type + optional custom category + actions */}
          <div className="flex items-center gap-2">
            <Label className="text-xs text-muted-foreground whitespace-nowrap">Tipo de costo:</Label>
            <Select
              value={costType}
              onChange={(e) => setCostType(e.target.value as CostType)}
              className="h-7 text-xs w-40"
            >
              {COST_TYPES.map((ct) => (
                <option key={ct.value} value={ct.value}>
                  {ct.label}
                </option>
              ))}
            </Select>
            {costType === 'OTRO' && (
              <Input
                placeholder="Categoría personalizada…"
                value={customCategory}
                onChange={(e) => setCustomCategory(e.target.value)}
                className="h-7 text-xs w-52"
              />
            )}
            <div className="ml-auto flex gap-1">
              <Button
                size="sm"
                className="h-7 px-3 text-xs"
                disabled={!canSave || mutation.isPending}
                onClick={() => mutation.mutate()}
              >
                Guardar
              </Button>
              <Button size="sm" variant="ghost" className="h-7 px-2" onClick={onDone}>
                <X className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        </div>
      </td>
    </tr>
  );
}

// ─── Subchapter Rows ──────────────────────────────────────────
function SubchapterRows({
  sub,
  projectId,
}: {
  sub: SubchapterData;
  projectId: string;
}) {
  const qc = useQueryClient();
  const [showItemForm, setShowItemForm] = useState(false);

  const deleteMutation = useMutation({
    mutationFn: (itemId: string) => api.deleteItem(projectId, itemId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['budget-summary', projectId] }),
  });

  return (
    <>
      <tr className="bg-muted/20 text-sm font-medium">
        <td className="py-1.5 pl-6 pr-4" colSpan={6}>
          {sub.code} {sub.name}
        </td>
        <td className="py-1.5 pr-3 text-right font-mono text-xs text-muted-foreground">
          {formatCOP(sub.subtotal)}
        </td>
      </tr>
      {sub.items.map((item) => (
        <tr key={item.id} className="border-b text-xs hover:bg-muted/10 group">
          <td className="py-1.5 pl-10 pr-2 font-mono">{item.code}</td>
          <td className="py-1.5 pr-4">{item.description}</td>
          <td className="py-1.5 pr-4 text-center">{item.unit}</td>
          <td className="py-1.5 pr-4 text-right">{Number(item.quantity).toLocaleString('es-CO')}</td>
          <td className="py-1.5 pr-4 text-right">{formatCOP(item.unitCostCalc)}</td>
          <td className="py-1.5 pr-3">
            <CostTypeBadge type={item.costType ?? 'MATERIAL'} custom={item.customCategory} />
          </td>
          <td className="py-1.5 pr-3 text-right font-medium">
            <div className="flex items-center justify-end gap-2">
              <span>{formatCOP(item.totalCalc)}</span>
              <button
                className="opacity-0 group-hover:opacity-100 transition-opacity text-destructive hover:text-destructive/80"
                title="Eliminar ítem"
                onClick={() => deleteMutation.mutate(item.id)}
                disabled={deleteMutation.isPending}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          </td>
        </tr>
      ))}
      {showItemForm ? (
        <NewItemForm projectId={projectId} sub={sub} onDone={() => setShowItemForm(false)} />
      ) : (
        <tr>
          <td colSpan={7} className="py-1 pl-10">
            <button
              className="flex items-center gap-1 text-xs text-muted-foreground hover:text-primary transition-colors"
              onClick={() => setShowItemForm(true)}
            >
              <Plus className="h-3 w-3" />
              Agregar ítem
            </button>
          </td>
        </tr>
      )}
    </>
  );
}

// ─── Chapter Row Component ────────────────────────────────────
function ChapterRowComponent({
  chapter,
  projectId,
}: {
  chapter: ChapterData;
  projectId: string;
}) {
  const [open, setOpen] = useState(true);
  const [showSubchapterForm, setShowSubchapterForm] = useState(false);

  return (
    <>
      <tr
        className="cursor-pointer bg-muted/40 font-semibold hover:bg-muted/60"
        onClick={() => setOpen((o) => !o)}
      >
        <td className="py-2 pl-2 pr-4" colSpan={6}>
          <span className="flex items-center gap-1">
            {open ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
            {chapter.code} — {chapter.name}
          </span>
        </td>
        <td className="py-2 pr-3 text-right font-mono text-sm">{formatCOP(chapter.total)}</td>
      </tr>
      {open && (
        <>
          {chapter.subchapters.map((sub) => (
            <SubchapterRows key={sub.id} sub={sub} projectId={projectId} />
          ))}
          {showSubchapterForm ? (
            <NewSubchapterForm
              projectId={projectId}
              chapter={chapter}
              onDone={() => setShowSubchapterForm(false)}
            />
          ) : (
            <tr>
              <td colSpan={7} className="py-1 pl-6">
                <button
                  className="flex items-center gap-1 text-xs text-muted-foreground hover:text-primary transition-colors"
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowSubchapterForm(true);
                  }}
                >
                  <Plus className="h-3 w-3" />
                  Agregar subcapítulo
                </button>
              </td>
            </tr>
          )}
        </>
      )}
    </>
  );
}

// ─── Progress Bar ─────────────────────────────────────────────
function CostProgressBar({ directCost, totalCost }: { directCost: string; totalCost: string }) {
  const direct = Number(directCost);
  const total = Number(totalCost);
  const pct = total > 0 ? Math.min(100, (direct / total) * 100) : 0;

  return (
    <div className="mt-4 space-y-1">
      <div className="flex justify-between text-xs text-muted-foreground">
        <span>Costo directo vs total</span>
        <span>{pct.toFixed(1)}%</span>
      </div>
      <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
        <div
          className="h-full rounded-full bg-primary transition-all duration-500"
          style={{ width: `${pct}%` }}
        />
      </div>
      <div className="flex justify-between text-xs text-muted-foreground">
        <span>Directo: {formatCOP(directCost)}</span>
        <span>Total: {formatCOP(totalCost)}</span>
      </div>
    </div>
  );
}

// ─── Cost Breakdown by Type ───────────────────────────────────
function CostBreakdown({ costByType, customCategories, directCost }: {
  costByType: Record<string, string>;
  customCategories: Record<string, string>;
  directCost: string;
}) {
  const total = Number(directCost);
  const entries = COST_TYPES.map((ct) => ({
    ...ct,
    amount: Number(costByType[ct.value] ?? '0'),
  })).filter((e) => e.amount > 0);

  if (entries.length === 0) return null;

  return (
    <div className="mt-4 rounded-lg border bg-muted/20 p-4">
      <h3 className="mb-3 text-sm font-semibold">Distribución por tipo de costo</h3>
      <div className="space-y-2">
        {entries.map((entry) => {
          const pct = total > 0 ? (entry.amount / total) * 100 : 0;
          const dotCls = COST_TYPE_DOT[entry.value] ?? 'bg-gray-400';
          return (
            <div key={entry.value}>
              <div className="flex items-center justify-between text-xs mb-0.5">
                <span className="flex items-center gap-1.5">
                  <span className={`inline-block h-2 w-2 rounded-full ${dotCls}`} />
                  {entry.label}
                </span>
                <span className="font-mono">
                  {formatCOP(entry.amount)}{' '}
                  <span className="text-muted-foreground">({pct.toFixed(1)}%)</span>
                </span>
              </div>
              <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-500 ${dotCls}`}
                  style={{ width: `${pct}%` }}
                />
              </div>
              {/* Custom sub-categories for OTRO */}
              {entry.value === 'OTRO' && Object.keys(customCategories).length > 0 && (
                <div className="mt-1 ml-4 space-y-0.5">
                  {Object.entries(customCategories).map(([cat, amt]) => (
                    <div key={cat} className="flex justify-between text-[10px] text-muted-foreground">
                      <span>↳ {cat}</span>
                      <span className="font-mono">{formatCOP(amt)}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Main Page ───────────────────────────────────────────────
export default function BudgetPage({ params }: { params: { id: string } }) {
  const { id: projectId } = params;

  const { data, isLoading, error } = useQuery({
    queryKey: ['budget-summary', projectId],
    queryFn: () => api.getBudgetSummary(projectId),
  });

  const summary = data as unknown as Summary | undefined;

  return (
    <div className="space-y-6">
      <header className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Presupuesto</h1>
          <p className="text-muted-foreground">Estructura de capítulos, ítems y análisis AIU.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" asChild>
            <Link href={`/dashboard/projects/${projectId}/budget/resources`}>
              <Plus className="mr-1 h-4 w-4" />
              Recursos
            </Link>
          </Button>
          <Button asChild>
            <Link href={`/dashboard/projects/${projectId}/budget/items/new`}>
              <Plus className="mr-1 h-4 w-4" />
              Nuevo ítem
            </Link>
          </Button>
        </div>
      </header>

      {/* AIU Config */}
      {summary && <AIUPanel projectId={projectId} config={summary.aiuConfig} />}

      {/* Budget Table */}
      <Card>
        <CardHeader>
          <CardTitle>Estructura presupuestal</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading && <p className="text-sm">Cargando presupuesto…</p>}
          {error && (
            <p className="text-sm text-destructive">
              Error al cargar presupuesto. Verifica que la API esté disponible.
            </p>
          )}
          {summary && (
            <>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="border-b">
                    <tr className="text-left text-xs text-muted-foreground">
                      <th className="py-2 pl-2 pr-4 font-medium">Código</th>
                      <th className="py-2 pr-4 font-medium">Descripción</th>
                      <th className="py-2 pr-4 text-center font-medium">Und</th>
                      <th className="py-2 pr-4 text-right font-medium">Cantidad</th>
                      <th className="py-2 pr-4 text-right font-medium">Vr. Unit</th>
                      <th className="py-2 pr-4 font-medium">Tipo</th>
                      <th className="py-2 pr-3 text-right font-medium">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {summary.chapters.map((ch) => (
                      <ChapterRowComponent key={ch.id} chapter={ch} projectId={projectId} />
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Totals */}
              <div className="mt-4 space-y-1 border-t pt-4 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Costo directo</span>
                  <span className="font-mono">{formatCOP(summary.directCost)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">AIU</span>
                  <span className="font-mono">{formatCOP(summary.aiuAmount)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">IVA s/utilidad</span>
                  <span className="font-mono">{formatCOP(summary.ivaAmount)}</span>
                </div>
                <div className="flex justify-between border-t pt-2 text-base font-bold">
                  <span>TOTAL PRESUPUESTO</span>
                  <span className="font-mono text-primary">{formatCOP(summary.totalCost)}</span>
                </div>
              </div>

              {/* Progress Bar */}
              <CostProgressBar directCost={summary.directCost} totalCost={summary.totalCost} />

              {/* Cost breakdown by type */}
              {summary.costByType && (
                <CostBreakdown
                  costByType={summary.costByType}
                  customCategories={summary.customCategories ?? {}}
                  directCost={summary.directCost}
                />
              )}
            </>
          )}
          {summary && summary.chapters.every((c) => c.subchapters.every((s) => s.items.length === 0)) && (
            <p className="mt-4 text-sm text-muted-foreground">
              Los capítulos están vacíos. Agrega subcapítulos e ítems usando los botones &quot;+&quot; en cada fila.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
