'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, BarChart2, Check, ChevronDown, ChevronRight, Download, Plus, Settings, Trash2, X } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';

import { ModuleHeader } from '@/components/module-header';
import { ReportHtmlButton } from '@/components/report-html-button';
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

// ─── New Chapter Form ─────────────────────────────────────────
function NewChapterForm({
  projectId,
  existingCount,
  onDone,
}: {
  projectId: string;
  existingCount: number;
  onDone: () => void;
}) {
  const qc = useQueryClient();
  const suggestedCode = `CAP-${String(existingCount + 1).padStart(2, '0')}`;
  const [code, setCode] = useState(suggestedCode);
  const [name, setName] = useState('');

  const mutation = useMutation({
    mutationFn: () => api.createChapter(projectId, { code: code.trim(), name: name.trim() }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['budget-summary', projectId] });
      setCode('');
      setName('');
      onDone();
    },
  });

  return (
    <div className="mt-2 flex items-center gap-2 rounded-md border border-dashed border-primary/40 bg-primary/5 px-4 py-3">
      <Input
        autoFocus
        placeholder={suggestedCode}
        value={code}
        onChange={(e) => setCode(e.target.value)}
        className="h-7 w-28 text-xs font-mono"
        onKeyDown={(e) => {
          if (e.key === 'Enter' && code.trim() && name.trim()) mutation.mutate();
          if (e.key === 'Escape') onDone();
        }}
      />
      <Input
        placeholder="Nombre del capítulo…"
        value={name}
        onChange={(e) => setName(e.target.value)}
        className="h-7 flex-1 text-xs"
        onKeyDown={(e) => {
          if (e.key === 'Enter' && code.trim() && name.trim()) mutation.mutate();
          if (e.key === 'Escape') onDone();
        }}
      />
      <Button
        size="sm"
        className="h-7 px-3 text-xs"
        disabled={!code.trim() || !name.trim() || mutation.isPending}
        onClick={() => mutation.mutate()}
      >
        Guardar
      </Button>
      <Button size="sm" variant="ghost" className="h-7 px-2" onClick={onDone}>
        <X className="h-3.5 w-3.5" />
      </Button>
    </div>
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
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editQty, setEditQty] = useState('');
  const [editUC, setEditUC] = useState('');

  const deleteMutation = useMutation({
    mutationFn: (itemId: string) => api.deleteItem(projectId, itemId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['budget-summary', projectId] }),
  });

  const updateMutation = useMutation({
    mutationFn: ({ itemId, quantity, unitCost }: { itemId: string; quantity: string; unitCost: string }) =>
      api.updateItem(projectId, itemId, { quantity, unitCost }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['budget-summary', projectId] });
      setEditingId(null);
    },
  });

  function startEdit(item: ItemData) {
    setEditingId(item.id);
    setEditQty(item.quantity);
    setEditUC(item.unitCostCalc);
  }

  function cancelEdit() {
    setEditingId(null);
    setEditQty('');
    setEditUC('');
  }

  function saveEdit(itemId: string) {
    if (!editQty || !editUC) return;
    updateMutation.mutate({ itemId, quantity: editQty, unitCost: editUC });
  }

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
      {sub.items.map((item) => {
        const isEditing = editingId === item.id;

        if (isEditing) {
          return (
            <tr key={item.id} className="border-b bg-primary/5 text-xs">
              <td className="py-1.5 pl-10 pr-2 font-mono">{item.code}</td>
              <td className="py-1.5 pr-4">{item.description}</td>
              <td className="py-1.5 pr-4 text-center">{item.unit}</td>
              {/* Editable quantity */}
              <td className="py-1.5 pr-2">
                <Input
                  autoFocus
                  type="number"
                  value={editQty}
                  onChange={(e) => setEditQty(e.target.value)}
                  className="h-6 w-24 text-right text-xs"
                  min="0"
                  step="any"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') saveEdit(item.id);
                    if (e.key === 'Escape') cancelEdit();
                  }}
                />
              </td>
              {/* Editable unit cost */}
              <td className="py-1.5 pr-2">
                <Input
                  type="number"
                  value={editUC}
                  onChange={(e) => setEditUC(e.target.value)}
                  className="h-6 w-28 text-right text-xs"
                  min="0"
                  step="any"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') saveEdit(item.id);
                    if (e.key === 'Escape') cancelEdit();
                  }}
                />
              </td>
              <td className="py-1.5 pr-3">
                <CostTypeBadge type={item.costType ?? 'MATERIAL'} custom={item.customCategory} />
              </td>
              {/* Actions */}
              <td className="py-1.5 pr-3 text-right">
                <div className="flex items-center justify-end gap-1">
                  <button
                    className="rounded p-0.5 text-green-600 hover:bg-green-50 transition-colors"
                    title="Guardar cambios"
                    onClick={() => saveEdit(item.id)}
                    disabled={updateMutation.isPending}
                  >
                    <Check className="h-3.5 w-3.5" />
                  </button>
                  <button
                    className="rounded p-0.5 text-muted-foreground hover:bg-muted transition-colors"
                    title="Cancelar edición"
                    onClick={cancelEdit}
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              </td>
            </tr>
          );
        }

        return (
          <tr key={item.id} className="border-b text-xs hover:bg-muted/10 group">
            <td className="py-1.5 pl-10 pr-2 font-mono">{item.code}</td>
            <td className="py-1.5 pr-4">{item.description}</td>
            <td className="py-1.5 pr-4 text-center">{item.unit}</td>
            <td
              className="cursor-pointer py-1.5 pr-4 text-right hover:text-primary"
              title="Clic para editar"
              onClick={() => startEdit(item)}
            >
              {Number(item.quantity).toLocaleString('es-CO')}
            </td>
            <td
              className="cursor-pointer py-1.5 pr-4 text-right hover:text-primary"
              title="Clic para editar"
              onClick={() => startEdit(item)}
            >
              {formatCOP(item.unitCostCalc)}
            </td>
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
        );
      })}
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

  const moAmount = Number(costByType['MANO_OBRA'] ?? '0');
  // Reverse-compute raw MO: effective = raw × 1.52, so raw = effective / 1.52
  const moRaw = moAmount > 0 ? moAmount / 1.52 : 0;
  const moPrestacional = moAmount - moRaw;

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
                  {entry.value === 'MANO_OBRA' ? (
                    <span className="flex items-center gap-1">
                      Mano de obra
                      <span
                        className="rounded bg-blue-100 px-1 py-0.5 text-[9px] text-blue-700 cursor-help"
                        title="Incluye 52% de factor prestacional (salud, pensión, ARL, primas, cesantías, etc.) según normativa colombiana. Costo efectivo = tarifa base × 1.52"
                      >
                        +52% prest.
                      </span>
                    </span>
                  ) : (
                    entry.label
                  )}
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
              {/* MO breakdown: raw vs prestacional */}
              {entry.value === 'MANO_OBRA' && moAmount > 0 && (
                <div className="mt-1 ml-4 space-y-0.5">
                  <div className="flex justify-between text-[10px] text-muted-foreground">
                    <span>↳ Salario base</span>
                    <span className="font-mono">{formatCOP(moRaw)}</span>
                  </div>
                  <div className="flex justify-between text-[10px] text-blue-600">
                    <span>↳ Factor prestacional (52%)</span>
                    <span className="font-mono">{formatCOP(moPrestacional)}</span>
                  </div>
                </div>
              )}
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
      {moAmount > 0 && (
        <p className="mt-3 text-[10px] text-muted-foreground border-t pt-2">
          * El factor prestacional del 52% cubre salud, pensión, ARL, primas, cesantías, vacaciones y parafiscales según normativa laboral colombiana.
        </p>
      )}
    </div>
  );
}

// ─── Control Tab Types ────────────────────────────────────────
type ControlItem = {
  id: string; code: string; description: string; unit: string;
  budget: string; committed: string; actual: string;
  variance: string; pctCommitted: string; pctActual: string; costType: string;
};
type ControlSubchapter = {
  id: string; name: string; budget: string; committed: string; actual: string;
  variance: string; pctActual: string; items: ControlItem[];
};

type ControlChapter = {
  id: string; code: string; name: string; budget: string; committed: string; actual: string;
  variance: string; pctActual: string; subchapters: ControlSubchapter[];
};
type ControlData = {
  chapters: ControlChapter[];
  totals: { budget: string; committed: string; actual: string; variance: string; pctExecuted: string; cpi: string; eac: string; etc: string };
  alerts: { itemId: string; code: string; description: string; alertType: string; message: string }[];
  approvedChangeOrders: number;
};

function pctColor(pct: number) {
  if (pct >= 100) return 'bg-red-500';
  if (pct >= 90) return 'bg-amber-400';
  if (pct >= 70) return 'bg-blue-400';
  return 'bg-emerald-400';
}
function varianceColor(v: number) {
  if (v < 0) return 'text-red-600 font-semibold';
  return 'text-emerald-700';
}

function EditActualsCell({ projectId, itemId, field, value }: {
  projectId: string; itemId: string; field: 'actualCost' | 'committedCost'; value: string;
}) {
  const qc = useQueryClient();
  const [editing, setEditing] = useState(false);
  const [local, setLocal] = useState(value);
  const mut = useMutation({
    mutationFn: (v: string) => api.updateItemActuals(projectId, itemId, { [field]: v }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['budget-control', projectId] }); setEditing(false); },
  });
  if (editing) {
    return (
      <div className="flex items-center gap-1">
        <input
          className="w-28 border rounded px-1 py-0.5 text-xs text-right font-mono"
          type="number" step="1000" value={local}
          onChange={e => setLocal(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') mut.mutate(local); if (e.key === 'Escape') setEditing(false); }}
          autoFocus
        />
        <button onClick={() => mut.mutate(local)} className="text-emerald-600 hover:text-emerald-700"><Check className="h-3 w-3" /></button>
        <button onClick={() => setEditing(false)} className="text-muted-foreground hover:text-destructive"><X className="h-3 w-3" /></button>
      </div>
    );
  }
  return (
    <button onClick={() => { setLocal(value); setEditing(true); }} className="font-mono text-xs hover:underline hover:text-primary text-right w-full">
      {formatCOP(value)}
    </button>
  );
}

function ControlTab({ projectId }: { projectId: string }) {
  const { data, isLoading } = useQuery({
    queryKey: ['budget-control', projectId],
    queryFn: () => api.getBudgetControl(projectId),
  });
  const control = data as unknown as ControlData | undefined;
  const [expandedChapters, setExpandedChapters] = useState<Set<string>>(new Set());
  const [expandedSubs, setExpandedSubs] = useState<Set<string>>(new Set());

  if (isLoading) return <p className="text-sm p-4">Cargando datos de control…</p>;
  if (!control) return null;

  const { totals, alerts } = control;
  const cpi = Number(totals.cpi);

  const exportControlReport = () => {
    const html = `<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8"><title>Control Presupuestal</title>
    <style>body{font-family:Arial,sans-serif;padding:24px;color:#1e293b}table{border-collapse:collapse;width:100%}
    th,td{border:1px solid #e2e8f0;padding:6px 10px;font-size:12px}th{background:#1e3a5f;color:#fff}
    .red{color:#dc2626;font-weight:700}.amber{color:#d97706}.green{color:#059669}
    h1{color:#1e3a5f}h2{color:#334155;border-bottom:2px solid #e2e8f0;padding-bottom:4px}
    .kpi{display:flex;gap:16px;flex-wrap:wrap;margin-bottom:24px}
    .kpi-card{background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:12px;min-width:140px}
    .kpi-label{font-size:11px;color:#64748b}.kpi-value{font-size:20px;font-weight:700;color:#1e3a5f}
    </style></head><body>
    <h1>Control Presupuestal</h1>
    <div class="kpi">
      <div class="kpi-card"><div class="kpi-label">Presupuesto</div><div class="kpi-value">${formatCOP(totals.budget)}</div></div>
      <div class="kpi-card"><div class="kpi-label">Comprometido</div><div class="kpi-value">${formatCOP(totals.committed)}</div></div>
      <div class="kpi-card"><div class="kpi-label">Ejecutado</div><div class="kpi-value">${formatCOP(totals.actual)}</div></div>
      <div class="kpi-card"><div class="kpi-label">Varianza</div><div class="kpi-value ${Number(totals.variance) < 0 ? 'red' : 'green'}">${formatCOP(totals.variance)}</div></div>
      <div class="kpi-card"><div class="kpi-label">CPI</div><div class="kpi-value ${cpi > 1 ? 'green' : cpi < 1 ? 'red' : ''}">${cpi.toFixed(2)}</div></div>
      <div class="kpi-card"><div class="kpi-label">% Ejecución</div><div class="kpi-value">${totals.pctExecuted}%</div></div>
    </div>
    ${alerts.length > 0 ? `<h2>Alertas (${alerts.length})</h2><ul>${alerts.map(a => `<li class="${a.alertType === 'OVER_100_PCT' ? 'red' : 'amber'}">${a.message}</li>`).join('')}</ul>` : ''}
    <h2>Detalle por capítulo</h2>
    <table><thead><tr><th>Código</th><th>Descripción</th><th>Presupuesto</th><th>Comprometido</th><th>Ejecutado</th><th>Varianza</th><th>% Ejec.</th></tr></thead>
    <tbody>${control.chapters.map(ch => `
      <tr style="background:#dbeafe;font-weight:bold"><td colspan="2">${ch.code} ${ch.name}</td><td>${formatCOP(ch.budget)}</td><td>${formatCOP(ch.committed)}</td><td>${formatCOP(ch.actual)}</td><td class="${Number(ch.variance) < 0 ? 'red' : 'green'}">${formatCOP(ch.variance)}</td><td>${ch.pctActual}%</td></tr>
      ${ch.subchapters.map(sub => `
        <tr style="background:#f1f5f9"><td colspan="2" style="padding-left:16px">${sub.name}</td><td>${formatCOP(sub.budget)}</td><td>${formatCOP(sub.committed)}</td><td>${formatCOP(sub.actual)}</td><td class="${Number(sub.variance) < 0 ? 'red' : 'green'}">${formatCOP(sub.variance)}</td><td>${sub.pctActual}%</td></tr>
        ${sub.items.map(it => `<tr><td style="padding-left:24px">${it.code}</td><td>${it.description}</td><td>${formatCOP(it.budget)}</td><td>${formatCOP(it.committed)}</td><td>${formatCOP(it.actual)}</td><td class="${Number(it.variance) < 0 ? 'red' : 'green'}">${formatCOP(it.variance)}</td><td>${it.pctActual}%</td></tr>`).join('')}
      `).join('')}
    `).join('')}</tbody>
    <tfoot><tr style="font-weight:bold;background:#1e3a5f;color:#fff"><td colspan="2">TOTAL</td><td>${formatCOP(totals.budget)}</td><td>${formatCOP(totals.committed)}</td><td>${formatCOP(totals.actual)}</td><td>${formatCOP(totals.variance)}</td><td>${totals.pctExecuted}%</td></tr></tfoot></table>
    </body></html>`;
    const blob = new Blob([html], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const w = window.open(url, '_blank');
    setTimeout(() => { if (w) URL.revokeObjectURL(url); }, 60000);
  };

  return (
    <div className="space-y-6">
      {/* KPI Cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-6">
        {[
          { label: 'Presupuesto', value: formatCOP(totals.budget), color: 'from-blue-600 to-blue-800' },
          { label: 'Comprometido', value: formatCOP(totals.committed), color: 'from-violet-600 to-violet-800' },
          { label: 'Ejecutado', value: formatCOP(totals.actual), color: 'from-emerald-600 to-emerald-800' },
          { label: 'Varianza', value: formatCOP(totals.variance), color: Number(totals.variance) < 0 ? 'from-red-600 to-red-800' : 'from-teal-600 to-teal-800' },
          { label: 'CPI', value: Number(totals.cpi).toFixed(2), color: cpi >= 1 ? 'from-emerald-600 to-teal-700' : 'from-orange-600 to-red-700' },
          { label: '% Ejecutado', value: `${totals.pctExecuted}%`, color: 'from-slate-600 to-slate-800' },
        ].map(({ label, value, color }) => (
          <div key={label} className={`rounded-xl bg-gradient-to-br ${color} p-4 text-white shadow-lg`}>
            <div className="text-xs font-medium text-white/70">{label}</div>
            <div className="mt-1 text-lg font-bold leading-tight">{value}</div>
          </div>
        ))}
      </div>

      {/* EAC / ETC row */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { label: 'EAC (Costo estimado final)', value: formatCOP(totals.eac) },
          { label: 'ETC (Costo restante)', value: formatCOP(totals.etc) },
          { label: 'Órdenes de cambio aprobadas', value: String(control.approvedChangeOrders) },
          { label: 'Alertas activas', value: String(alerts.length), warn: alerts.length > 0 },
        ].map(({ label, value, warn }) => (
          <div key={label} className="rounded-lg border bg-card p-3">
            <div className="text-xs text-muted-foreground">{label}</div>
            <div className={`mt-0.5 text-base font-bold ${warn ? 'text-amber-600' : ''}`}>{value}</div>
          </div>
        ))}
      </div>

      {/* Alerts */}
      {alerts.length > 0 && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-4">
          <div className="flex items-center gap-2 mb-2 font-semibold text-amber-800 text-sm">
            <AlertTriangle className="h-4 w-4" />
            Alertas presupuestales ({alerts.length})
          </div>
          <ul className="space-y-1">
            {alerts.map((a, i) => (
              <li key={i} className={`text-xs flex items-center gap-2 ${a.alertType === 'OVER_100_PCT' ? 'text-red-700' : 'text-amber-700'}`}>
                <span className={`inline-block h-2 w-2 rounded-full flex-shrink-0 ${a.alertType === 'OVER_100_PCT' ? 'bg-red-500' : 'bg-amber-400'}`} />
                {a.message}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Budget vs Actuals Table */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-base">Budget vs. Actuals</CardTitle>
          <button onClick={exportControlReport} className="flex items-center gap-1 rounded-md border px-3 py-1.5 text-xs font-medium text-blue-700 border-blue-200 hover:bg-blue-50 transition-colors">
            <Download className="h-3 w-3" />
            Reporte HTML
          </button>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="border-b bg-muted/30">
                <tr className="text-left text-muted-foreground">
                  <th className="py-2 pl-3 pr-4 font-medium">Descripción</th>
                  <th className="py-2 pr-3 text-right font-medium">Presupuesto</th>
                  <th className="py-2 pr-3 text-right font-medium">Comprometido</th>
                  <th className="py-2 pr-3 text-right font-medium">Ejecutado</th>
                  <th className="py-2 pr-3 text-right font-medium">Varianza</th>
                  <th className="py-2 pr-3 font-medium w-32">% Ejec.</th>
                </tr>
              </thead>
              {control.chapters.map((ch) => (
                  <tbody key={ch.id}>
                    <tr className="border-b bg-blue-50/60 cursor-pointer hover:bg-blue-100/60"
                      onClick={() => setExpandedChapters(prev => { const s = new Set(prev); s.has(ch.id) ? s.delete(ch.id) : s.add(ch.id); return s; })}>
                      <td className="py-2 pl-3 pr-4 font-semibold">
                        <span className="flex items-center gap-1">
                          {expandedChapters.has(ch.id) ? <ChevronDown className="h-3 w-3 inline" /> : <ChevronRight className="h-3 w-3 inline" />}
                          {ch.code} {ch.name}
                        </span>
                      </td>
                      <td className="py-2 pr-3 text-right font-mono">{formatCOP(ch.budget)}</td>
                      <td className="py-2 pr-3 text-right font-mono">{formatCOP(ch.committed)}</td>
                      <td className="py-2 pr-3 text-right font-mono">{formatCOP(ch.actual)}</td>
                      <td className={`py-2 pr-3 text-right font-mono ${varianceColor(Number(ch.variance))}`}>{formatCOP(ch.variance)}</td>
                      <td className="py-2 pr-3">
                        <div className="flex items-center gap-2">
                          <div className="flex-1 h-2 rounded-full bg-muted overflow-hidden">
                            <div className={`h-full rounded-full ${pctColor(Number(ch.pctActual))}`} style={{ width: `${Math.min(Number(ch.pctActual), 100)}%` }} />
                          </div>
                          <span className="text-[10px] w-10 text-right">{ch.pctActual}%</span>
                        </div>
                      </td>
                    </tr>
                    {expandedChapters.has(ch.id) && ch.subchapters.map((sub) => (
                      <tbody key={sub.id}>
                        <tr className="border-b bg-slate-50/60 cursor-pointer hover:bg-slate-100/50"
                          onClick={() => setExpandedSubs(prev => { const s = new Set(prev); s.has(sub.id) ? s.delete(sub.id) : s.add(sub.id); return s; })}>
                          <td className="py-1.5 pl-7 pr-4 font-medium text-slate-700">
                            <span className="flex items-center gap-1">
                              {expandedSubs.has(sub.id) ? <ChevronDown className="h-3 w-3 inline" /> : <ChevronRight className="h-3 w-3 inline" />}
                              {sub.name}
                            </span>
                          </td>
                          <td className="py-1.5 pr-3 text-right font-mono">{formatCOP(sub.budget)}</td>
                          <td className="py-1.5 pr-3 text-right font-mono">{formatCOP(sub.committed)}</td>
                          <td className="py-1.5 pr-3 text-right font-mono">{formatCOP(sub.actual)}</td>
                          <td className={`py-1.5 pr-3 text-right font-mono ${varianceColor(Number(sub.variance))}`}>{formatCOP(sub.variance)}</td>
                          <td className="py-1.5 pr-3">
                            <div className="flex items-center gap-2">
                              <div className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden">
                                <div className={`h-full rounded-full ${pctColor(Number(sub.pctActual))}`} style={{ width: `${Math.min(Number(sub.pctActual), 100)}%` }} />
                              </div>
                              <span className="text-[10px] w-10 text-right">{sub.pctActual}%</span>
                            </div>
                          </td>
                        </tr>
                        {expandedSubs.has(sub.id) && sub.items.map((item) => (
                          <tr key={item.id} className="border-b hover:bg-muted/20">
                            <td className="py-1 pl-12 pr-4 text-muted-foreground">{item.code} — {item.description}</td>
                            <td className="py-1 pr-3 text-right font-mono">{formatCOP(item.budget)}</td>
                            <td className="py-1 pr-3 text-right">
                              <EditActualsCell projectId={projectId} itemId={item.id} field="committedCost" value={item.committed} />
                            </td>
                            <td className="py-1 pr-3 text-right">
                              <EditActualsCell projectId={projectId} itemId={item.id} field="actualCost" value={item.actual} />
                            </td>
                            <td className={`py-1 pr-3 text-right font-mono ${varianceColor(Number(item.variance))}`}>{formatCOP(item.variance)}</td>
                            <td className="py-1 pr-3">
                              <div className="flex items-center gap-2">
                                <div className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden">
                                  <div className={`h-full rounded-full ${pctColor(Number(item.pctActual))}`} style={{ width: `${Math.min(Number(item.pctActual), 100)}%` }} />
                                </div>
                                <span className="text-[10px] w-10 text-right">{item.pctActual}%</span>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    ))}
                  </tbody>
                ))}
              <tfoot className="border-t-2 bg-slate-100">
                <tr>
                  <td className="py-2 pl-3 font-bold">TOTAL PROYECTO</td>
                  <td className="py-2 pr-3 text-right font-mono font-bold">{formatCOP(totals.budget)}</td>
                  <td className="py-2 pr-3 text-right font-mono font-bold">{formatCOP(totals.committed)}</td>
                  <td className="py-2 pr-3 text-right font-mono font-bold">{formatCOP(totals.actual)}</td>
                  <td className={`py-2 pr-3 text-right font-mono font-bold ${varianceColor(Number(totals.variance))}`}>{formatCOP(totals.variance)}</td>
                  <td className="py-2 pr-3 text-xs font-bold">{totals.pctExecuted}%</td>
                </tr>
              </tfoot>
            </table>
          </div>
          <p className="p-3 text-[10px] text-muted-foreground border-t">
            * Haz clic en &quot;Comprometido&quot; o &quot;Ejecutado&quot; de un ítem para editar el valor. Los capítulos y subcapítulos son clickeables para expandir.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

// ─── Main Page ───────────────────────────────────────────────
export default function BudgetPage({ params }: { params: { id: string } }) {
  const { id: projectId } = params;
  const [showChapterForm, setShowChapterForm] = useState(false);
  const [activeTab, setActiveTab] = useState<'presupuesto' | 'control'>('presupuesto');

  const { data, isLoading, error } = useQuery({
    queryKey: ['budget-summary', projectId],
    queryFn: () => api.getBudgetSummary(projectId),
  });

  const summary = data as unknown as Summary | undefined;

  return (
    <div className="space-y-6">
      <ModuleHeader
        title="Presupuesto"
        description="Estructura detallada de costos: Capítulos → Subcapítulos → Ítems · Incluye AIU (Administración, Imprevistos, Utilidad)"
        infoText="Haz clic en un capítulo para expandirlo. Haz clic en la cantidad o valor unitario de un ítem para editarlo en línea. Configura el AIU antes de revisar el total."
        actions={
          <div className="flex gap-2">
            <Button variant="outline" asChild>
              <Link href={`/dashboard/projects/${projectId}/budget/apus`}>
                <Settings className="mr-1 h-4 w-4" />
                APUs
              </Link>
            </Button>
            <Button variant="outline" asChild>
              <Link href={`/dashboard/projects/${projectId}/budget/resources`}>
                <Plus className="mr-1 h-4 w-4" />
                Recursos
              </Link>
            </Button>
            <Button variant="outline" asChild className="border-emerald-300 text-emerald-700 hover:bg-emerald-50">
              <Link href={`/dashboard/projects/${projectId}/feasibility/import`}>
                <Download className="mr-1 h-4 w-4" />
                Importar Excel
              </Link>
            </Button>
            {activeTab === 'presupuesto' && (
              <>
                <ReportHtmlButton
                  label="Reporte HTML"
                  fetcher={() => api.exportBudgetHtml(projectId)}
                  className="border-blue-200 text-blue-700 hover:bg-blue-50"
                />
                <Button variant="outline" asChild>
                  <Link href={`/dashboard/projects/${projectId}/reports`}>
                    <Download className="mr-1 h-4 w-4" />
                    Exportar CSV
                  </Link>
                </Button>
                <Button variant="outline" onClick={() => setShowChapterForm((v) => !v)}>
                  <Plus className="mr-1 h-4 w-4" />
                  Nuevo capítulo
                </Button>
                <Button asChild>
                  <Link href={`/dashboard/projects/${projectId}/budget/items/new`}>
                    <Plus className="mr-1 h-4 w-4" />
                    Nuevo ítem
                  </Link>
                </Button>
              </>
            )}
          </div>
        }
      />

      {/* Tab switcher */}
      <div className="flex gap-1 rounded-lg border bg-muted/30 p-1 w-fit">
        {([['presupuesto', 'Presupuesto base', null], ['control', 'Control Budget vs. Actuals', BarChart2]] as const).map(([tab, label, Icon]) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab as 'presupuesto' | 'control')}
            className={`flex items-center gap-1.5 rounded-md px-4 py-2 text-sm font-medium transition-all ${activeTab === tab ? 'bg-background shadow text-primary' : 'text-muted-foreground hover:text-foreground'}`}
          >
            {Icon && <Icon className="h-4 w-4" />}
            {label}
          </button>
        ))}
      </div>

      {activeTab === 'control' && <ControlTab projectId={projectId} />}

      {activeTab === 'presupuesto' && (<>
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
              {/* New chapter form */}
              {showChapterForm ? (
                <NewChapterForm
                  projectId={projectId}
                  existingCount={summary.chapters.length}
                  onDone={() => setShowChapterForm(false)}
                />
              ) : (
                <button
                  className="mt-2 flex items-center gap-1 text-xs text-muted-foreground hover:text-primary transition-colors"
                  onClick={() => setShowChapterForm(true)}
                >
                  <Plus className="h-3 w-3" />
                  Agregar capítulo
                </button>
              )}

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
      </>)}
    </div>
  );
}
