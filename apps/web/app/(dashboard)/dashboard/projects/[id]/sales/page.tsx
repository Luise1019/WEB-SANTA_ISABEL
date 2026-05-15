'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ChevronUp, Plus, X } from 'lucide-react';
import Link from 'next/link';
import { use, useMemo, useState } from 'react';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { api } from '@/lib/api-client';

// ── Local types ─────────────────────────────────────────────────────────────

type Unit = {
  id: string;
  code: string;
  kind: string;
  floor?: number;
  privateAreaM2: string;
  saleableAreaM2: string;
  listPrice: string;
  status: string;
  tower?: { code: string; name: string } | null;
};

type Tower = { id: string; code: string; name: string };

type Summary = {
  units: { total: number; available: number; reserved: number; sold: number };
  totalListPrice: string;
  totalSalesValue: string;
  salesCount: number;
};

// ── Helpers ──────────────────────────────────────────────────────────────────

function formatCOP(value: string | number): string {
  return new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    maximumFractionDigits: 0,
  }).format(Number(value));
}

const STATUS_FILTER_OPTIONS = [
  { label: 'Todos', value: 'ALL' },
  { label: 'Disponible', value: 'DISPONIBLE' },
  { label: 'Reservada', value: 'RESERVADA' },
  { label: 'Negociando', value: 'NEGOCIANDO' },
  { label: 'Vendida', value: 'VENDIDA' },
  { label: 'Escriturada', value: 'ESCRITURADA' },
];

const KIND_OPTIONS = [
  { label: 'Apartamento', value: 'APARTAMENTO' },
  { label: 'Casa', value: 'CASA' },
  { label: 'Local', value: 'LOCAL' },
  { label: 'Parqueadero', value: 'PARQUEADERO' },
  { label: 'Depósito', value: 'DEPOSITO' },
];

function statusBadge(status: string): JSX.Element {
  let cls = 'inline-block rounded-full px-2 py-0.5 text-xs font-medium ';
  switch (status) {
    case 'DISPONIBLE':
      cls += 'bg-green-100 text-green-700';
      break;
    case 'RESERVADA':
    case 'NEGOCIANDO':
      cls += 'bg-amber-100 text-amber-700';
      break;
    case 'VENDIDA':
    case 'ESCRITURADA':
      cls += 'bg-blue-100 text-blue-700';
      break;
    case 'BLOQUEADA':
      cls += 'bg-gray-100 text-gray-500';
      break;
    default:
      cls += 'bg-muted text-muted-foreground';
  }
  const labels: Record<string, string> = {
    DISPONIBLE: 'Disponible',
    RESERVADA: 'Reservada',
    NEGOCIANDO: 'Negociando',
    VENDIDA: 'Vendida',
    ESCRITURADA: 'Escriturada',
    BLOQUEADA: 'Bloqueada',
  };
  return <span className={cls}>{labels[status] ?? status}</span>;
}

// ── New unit form ─────────────────────────────────────────────────────────────

type UnitFormData = {
  towerId: string;
  code: string;
  kind: string;
  floor: string;
  privateAreaM2: string;
  commonAreaM2: string;
  saleableAreaM2: string;
  listPrice: string;
};

const EMPTY_FORM: UnitFormData = {
  towerId: '',
  code: '',
  kind: '',
  floor: '',
  privateAreaM2: '',
  commonAreaM2: '',
  saleableAreaM2: '',
  listPrice: '',
};

interface NewUnitFormProps {
  projectId: string;
  towers: Tower[];
  onClose: () => void;
}

function NewUnitForm({ projectId, towers, onClose }: NewUnitFormProps) {
  const qc = useQueryClient();
  const [form, setForm] = useState<UnitFormData>(EMPTY_FORM);
  const [error, setError] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: (input: Record<string, unknown>) => api.createUnit(projectId, input),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['units', projectId] });
      void qc.invalidateQueries({ queryKey: ['sales-summary', projectId] });
      onClose();
    },
    onError: (err: Error) => setError(err.message),
  });

  function set(field: keyof UnitFormData, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!form.code.trim() || !form.kind || !form.privateAreaM2 || !form.saleableAreaM2 || !form.listPrice) {
      setError('Completa los campos requeridos: código, tipo, área privada, área vendible y precio de lista.');
      return;
    }
    const input: Record<string, unknown> = {
      code: form.code.trim(),
      kind: form.kind,
      privateAreaM2: form.privateAreaM2,
      saleableAreaM2: form.saleableAreaM2,
      listPrice: form.listPrice,
    };
    if (form.towerId) input.towerId = form.towerId;
    if (form.floor) input.floor = Number(form.floor);
    if (form.commonAreaM2) input.commonAreaM2 = form.commonAreaM2;
    mutation.mutate(input);
  }

  return (
    <Card className="border-dashed border-purple-300 bg-purple-50/40">
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-base">Nueva unidad</CardTitle>
        <Button variant="ghost" size="icon" onClick={onClose}>
          <X className="h-4 w-4" />
        </Button>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {/* Tower */}
          <div className="space-y-1">
            <Label>Torre (opcional)</Label>
            <Select value={form.towerId} onChange={(e) => set('towerId', e.target.value)}>
              <option value="">Sin torre</option>
              {towers.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.code} – {t.name}
                </option>
              ))}
            </Select>
          </div>

          {/* Code */}
          <div className="space-y-1">
            <Label>
              Código <span className="text-destructive">*</span>
            </Label>
            <Input
              value={form.code}
              onChange={(e) => set('code', e.target.value)}
              placeholder="AP-101"
              required
            />
          </div>

          {/* Kind */}
          <div className="space-y-1">
            <Label>
              Tipo <span className="text-destructive">*</span>
            </Label>
            <Select value={form.kind} onChange={(e) => set('kind', e.target.value)}>
              <option value="">— Selecciona tipo —</option>
              {KIND_OPTIONS.map((k) => (
                <option key={k.value} value={k.value}>
                  {k.label}
                </option>
              ))}
            </Select>
          </div>

          {/* Floor */}
          <div className="space-y-1">
            <Label>Piso (opcional)</Label>
            <Input
              type="number"
              value={form.floor}
              onChange={(e) => set('floor', e.target.value)}
              placeholder="1"
              min={1}
            />
          </div>

          {/* Private area */}
          <div className="space-y-1">
            <Label>
              Área privada m² <span className="text-destructive">*</span>
            </Label>
            <Input
              type="number"
              value={form.privateAreaM2}
              onChange={(e) => set('privateAreaM2', e.target.value)}
              placeholder="72.50"
              step="0.01"
              min="0"
              required
            />
          </div>

          {/* Common area */}
          <div className="space-y-1">
            <Label>Área común m² (opcional)</Label>
            <Input
              type="number"
              value={form.commonAreaM2}
              onChange={(e) => set('commonAreaM2', e.target.value)}
              placeholder="8.00"
              step="0.01"
              min="0"
            />
          </div>

          {/* Saleable area */}
          <div className="space-y-1">
            <Label>
              Área vendible m² <span className="text-destructive">*</span>
            </Label>
            <Input
              type="number"
              value={form.saleableAreaM2}
              onChange={(e) => set('saleableAreaM2', e.target.value)}
              placeholder="80.50"
              step="0.01"
              min="0"
              required
            />
          </div>

          {/* List price */}
          <div className="space-y-1">
            <Label>
              Precio de lista COP <span className="text-destructive">*</span>
            </Label>
            <Input
              type="number"
              value={form.listPrice}
              onChange={(e) => set('listPrice', e.target.value)}
              placeholder="280000000"
              step="1000"
              min="0"
              required
            />
          </div>

          {/* Actions */}
          <div className="flex items-end gap-2 sm:col-span-2 lg:col-span-4">
            {error && <p className="flex-1 text-sm text-destructive">{error}</p>}
            <div className="ml-auto flex gap-2">
              <Button type="button" variant="outline" onClick={onClose} disabled={mutation.isPending}>
                Cancelar
              </Button>
              <Button type="submit" disabled={mutation.isPending}>
                {mutation.isPending ? 'Guardando…' : 'Guardar unidad'}
              </Button>
            </div>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function SalesPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: projectId } = use(params);
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [search, setSearch] = useState('');
  const [showNewUnit, setShowNewUnit] = useState(false);

  // Queries
  const summaryQ = useQuery({
    queryKey: ['sales-summary', projectId],
    queryFn: () => api.getSalesSummary(projectId),
  });

  const unitsQ = useQuery({
    queryKey: ['units', projectId],
    queryFn: () => api.listUnits(projectId),
  });

  const towersQ = useQuery({
    queryKey: ['towers', projectId],
    queryFn: () => api.listTowers(projectId),
  });

  const summary = summaryQ.data as Summary | undefined;
  const units = (unitsQ.data ?? []) as Unit[];
  const towers = (towersQ.data ?? []) as Tower[];

  // Filter
  const filtered = useMemo(() => {
    return units.filter((u) => {
      if (statusFilter !== 'ALL' && u.status !== statusFilter) return false;
      if (search.trim()) {
        const q = search.trim().toLowerCase();
        const hay = [u.code, u.kind, u.tower?.code ?? '', u.tower?.name ?? ''].join(' ').toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [units, statusFilter, search]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <header className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Ventas</h1>
          <p className="text-sm text-muted-foreground">Inventario de unidades y estado comercial</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" asChild>
            <Link href={`/dashboard/projects/${projectId}`}>← Proyecto</Link>
          </Button>
          <Button onClick={() => setShowNewUnit((v) => !v)}>
            {showNewUnit ? (
              <>
                <ChevronUp className="mr-1 h-4 w-4" /> Cancelar
              </>
            ) : (
              <>
                <Plus className="mr-1 h-4 w-4" /> Nueva unidad
              </>
            )}
          </Button>
        </div>
      </header>

      {/* Summary cards */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <Card>
          <CardHeader className="pb-1">
            <CardTitle className="text-xs font-medium text-muted-foreground">Total unidades</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{summaryQ.isLoading ? '…' : (summary?.units.total ?? 0)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-1">
            <CardTitle className="text-xs font-medium text-green-600">Disponibles</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-green-600">
              {summaryQ.isLoading ? '…' : (summary?.units.available ?? 0)}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-1">
            <CardTitle className="text-xs font-medium text-amber-600">Reservadas</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-amber-600">
              {summaryQ.isLoading ? '…' : (summary?.units.reserved ?? 0)}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-1">
            <CardTitle className="text-xs font-medium text-blue-600">Vendidas</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-blue-600">
              {summaryQ.isLoading ? '…' : (summary?.units.sold ?? 0)}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Inline new unit form */}
      {showNewUnit && (
        <NewUnitForm
          projectId={projectId}
          towers={towers}
          onClose={() => setShowNewUnit(false)}
        />
      )}

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2">
        {STATUS_FILTER_OPTIONS.map((opt) => (
          <button
            key={opt.value}
            onClick={() => setStatusFilter(opt.value)}
            className={`rounded-full px-3 py-1 text-sm font-medium transition-colors ${
              statusFilter === opt.value
                ? 'bg-purple-600 text-white'
                : 'bg-muted text-muted-foreground hover:bg-muted/80'
            }`}
          >
            {opt.label}
          </button>
        ))}
        <div className="ml-auto">
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar unidad, torre…"
            className="w-56"
          />
        </div>
      </div>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          {unitsQ.isLoading && (
            <p className="px-4 py-8 text-center text-sm text-muted-foreground">Cargando unidades…</p>
          )}
          {unitsQ.isError && (
            <p className="px-4 py-8 text-center text-sm text-destructive">
              Error al cargar unidades.
            </p>
          )}
          {!unitsQ.isLoading && filtered.length === 0 && (
            <p className="px-4 py-8 text-center text-sm text-muted-foreground">
              No hay unidades que coincidan con los filtros.
            </p>
          )}
          {!unitsQ.isLoading && filtered.length > 0 && (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/40 text-left text-xs font-medium text-muted-foreground">
                    <th className="px-4 py-3">Torre</th>
                    <th className="px-4 py-3">Código</th>
                    <th className="px-4 py-3">Tipo</th>
                    <th className="px-4 py-3 text-right">Piso</th>
                    <th className="px-4 py-3 text-right">Área priv. m²</th>
                    <th className="px-4 py-3 text-right">Área vend. m²</th>
                    <th className="px-4 py-3 text-right">Precio lista</th>
                    <th className="px-4 py-3 text-center">Estado</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((unit, idx) => (
                    <tr
                      key={unit.id}
                      className={`border-b last:border-0 ${idx % 2 === 0 ? '' : 'bg-muted/20'}`}
                    >
                      <td className="px-4 py-2 font-mono text-xs">
                        {unit.tower ? (
                          <span title={unit.tower.name}>{unit.tower.code}</span>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </td>
                      <td className="px-4 py-2 font-mono font-medium">{unit.code}</td>
                      <td className="px-4 py-2 capitalize">{unit.kind.toLowerCase()}</td>
                      <td className="px-4 py-2 text-right">
                        {unit.floor != null ? unit.floor : <span className="text-muted-foreground">—</span>}
                      </td>
                      <td className="px-4 py-2 text-right">{Number(unit.privateAreaM2).toFixed(2)}</td>
                      <td className="px-4 py-2 text-right">{Number(unit.saleableAreaM2).toFixed(2)}</td>
                      <td className="px-4 py-2 text-right font-medium">{formatCOP(unit.listPrice)}</td>
                      <td className="px-4 py-2 text-center">{statusBadge(unit.status)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Footer totals */}
      {!summaryQ.isLoading && summary && (
        <div className="flex flex-wrap gap-6 rounded-lg border bg-muted/30 px-4 py-3 text-sm">
          <div>
            <span className="text-muted-foreground">Precio total inventario: </span>
            <span className="font-semibold">{formatCOP(summary.totalListPrice)}</span>
          </div>
          <div>
            <span className="text-muted-foreground">Valor ventas realizadas: </span>
            <span className="font-semibold">{formatCOP(summary.totalSalesValue)}</span>
          </div>
          <div>
            <span className="text-muted-foreground">Contratos: </span>
            <span className="font-semibold">{summary.salesCount}</span>
          </div>
        </div>
      )}
    </div>
  );
}
