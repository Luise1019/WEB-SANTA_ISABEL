'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Check, Database, Loader2, Package, RefreshCw, Sparkles, X } from 'lucide-react';
import Link from 'next/link';
import { useMemo, useState } from 'react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { api } from '@/lib/api-client';

// ─── Constants ───────────────────────────────────────────────
const RESOURCE_TYPES = [
  { value: 'ALL',         label: 'Todos',        color: '' },
  { value: 'MANO_OBRA',   label: 'Mano de obra', color: 'bg-blue-100 text-blue-700' },
  { value: 'MATERIAL',    label: 'Material',     color: 'bg-amber-100 text-amber-700' },
  { value: 'EQUIPO',      label: 'Equipo',       color: 'bg-purple-100 text-purple-700' },
  { value: 'SUBCONTRATO', label: 'Subcontrato',  color: 'bg-gray-100 text-gray-600' },
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
          onClick={() => { setNewCost(currentRate ?? ''); setEditing(true); }}
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
      <button className="text-muted-foreground hover:text-destructive"
        onClick={() => { setEditing(false); setNewCost(''); }}>
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

// ─── Colombian Resources Seed Banner ─────────────────────────
function ColombianResourcesBanner({ onSeeded }: { onSeeded: () => void }) {
  const [confirmed, setConfirmed] = useState(false);

  const mutation = useMutation({
    mutationFn: () => api.seedColombianResources(),
    onSuccess: (result) => {
      const r = result as unknown as { created: number; updated: number; total: number };
      toast.success(
        `✅ Base de datos cargada: ${r.created} recursos nuevos, ${r.updated} verificados (total ${r.total})`
      );
      onSeeded();
    },
    onError: (e: Error) => toast.error(`Error al cargar: ${e.message}`),
  });

  return (
    <Card className="border-2 border-teal-300 bg-gradient-to-br from-teal-50 to-cyan-50">
      <CardContent className="p-5">
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
          {/* Icon */}
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-teal-100 text-teal-700">
            <Database className="h-6 w-6" />
          </div>

          {/* Content */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <h3 className="font-semibold text-teal-900">Base de datos de insumos colombianos 2025</h3>
              <span className="rounded-full bg-teal-200 px-2 py-0.5 text-xs font-medium text-teal-800">
                Precios referencia 2025
              </span>
            </div>
            <p className="text-sm text-teal-700 mb-3">
              Carga automáticamente <strong>~100 recursos</strong> típicos de construcción en Colombia:
              mano de obra (salarios base sin prestacional), materiales, equipos y subcontratos con
              precios de mercado nacional 2025.
            </p>

            {/* Resource preview chips */}
            <div className="flex flex-wrap gap-1.5 mb-3">
              {[
                { label: '15 MO', color: 'bg-blue-100 text-blue-700', icon: '👷' },
                { label: '70 Materiales', color: 'bg-amber-100 text-amber-700', icon: '🧱' },
                { label: '22 Equipos', color: 'bg-purple-100 text-purple-700', icon: '🏗️' },
                { label: '7 Subcontratos', color: 'bg-gray-100 text-gray-700', icon: '🤝' },
              ].map((chip) => (
                <span key={chip.label} className={`rounded-full px-2.5 py-1 text-xs font-medium ${chip.color}`}>
                  {chip.icon} {chip.label}
                </span>
              ))}
            </div>

            {/* Categories list */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-1 text-xs text-teal-600">
              {[
                'Cemento, cal, áridos',
                'Mampostería (ladrillo/bloque)',
                'Acero de refuerzo (varillas)',
                'Concreto premezclado',
                'Redes hidrosanitarias',
                'Redes eléctricas',
                'Acabados y pintura',
                'Equipos de construcción',
              ].map((cat) => (
                <span key={cat} className="flex items-center gap-1">
                  <Sparkles className="h-2.5 w-2.5 text-teal-400" />
                  {cat}
                </span>
              ))}
            </div>
          </div>

          {/* Action */}
          <div className="flex flex-col items-end gap-2 shrink-0">
            {!confirmed ? (
              <Button
                onClick={() => setConfirmed(true)}
                className="bg-teal-600 hover:bg-teal-700 text-white"
              >
                <Database className="h-4 w-4 mr-2" />
                Cargar insumos colombianos
              </Button>
            ) : (
              <div className="flex flex-col items-end gap-2">
                <p className="text-xs text-teal-700 text-right max-w-[200px]">
                  ¿Cargar ~100 insumos con precios 2025? (operación idempotente — no duplica)
                </p>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setConfirmed(false)}
                    disabled={mutation.isPending}
                  >
                    Cancelar
                  </Button>
                  <Button
                    size="sm"
                    className="bg-teal-600 hover:bg-teal-700 text-white"
                    onClick={() => mutation.mutate()}
                    disabled={mutation.isPending}
                  >
                    {mutation.isPending ? (
                      <><Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> Cargando…</>
                    ) : (
                      <><Check className="h-3.5 w-3.5 mr-1.5" /> Confirmar carga</>
                    )}
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Main Page ───────────────────────────────────────────────
export default function ResourcesPage({ params }: { params: { id: string } }) {
  const { id: projectId } = params;
  const qc = useQueryClient();

  const [typeFilter, setTypeFilter] = useState('ALL');
  const [search, setSearch] = useState('');
  const [showCreate, setShowCreate] = useState(false);

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
  const isEmpty = resources.length === 0;

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
    for (const r of resources) counts[r.type] = (counts[r.type] ?? 0) + 1;
    return counts;
  }, [resources]);

  const createMutation = useMutation({
    mutationFn: () =>
      api.createResource({
        type: type as 'MANO_OBRA' | 'MATERIAL' | 'EQUIPO' | 'SUBCONTRATO',
        code, name, unit, unitCost,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['resources'] });
      setCode(''); setName(''); setUnit(''); setUnitCost('');
      toast.success('Recurso creado');
      setShowCreate(false);
    },
    onError: (e: Error) => toast.error(`Error: ${e.message}`),
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <header className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" asChild>
            <Link href={`/dashboard/projects/${projectId}/budget`}>
              <ArrowLeft className="mr-1 h-4 w-4" />
              Presupuesto
            </Link>
          </Button>
          <div>
            <h1 className="text-2xl font-bold">Biblioteca de Recursos</h1>
            <p className="text-sm text-muted-foreground">
              MO, materiales, equipos y subcontratos · Factor prestacional MO: 52% (se aplica automáticamente en APUs)
            </p>
          </div>
        </div>
        <Button size="sm" onClick={() => setShowCreate((v) => !v)} variant="outline">
          <Package className="h-4 w-4 mr-1.5" />
          {showCreate ? 'Cancelar' : 'Nuevo recurso'}
        </Button>
      </header>

      {/* Colombian DB Banner — always visible when list is empty, or collapsible */}
      <ColombianResourcesBanner onSeeded={() => qc.invalidateQueries({ queryKey: ['resources'] })} />

      {/* Create Form */}
      {showCreate && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Nuevo recurso personalizado</CardTitle>
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
                <Input value={code} onChange={(e) => setCode(e.target.value)} placeholder="MO-001" className="h-8 text-sm" />
              </div>
              <div className="space-y-1 col-span-2">
                <Label className="text-xs">Nombre</Label>
                <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Oficial de mampostería" className="h-8 text-sm" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Unidad</Label>
                <Input value={unit} onChange={(e) => setUnit(e.target.value)} placeholder="día" className="h-8 text-sm" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Costo (COP)</Label>
                <Input type="number" value={unitCost} onChange={(e) => setUnitCost(e.target.value)} placeholder="85000" className="h-8 text-sm" />
              </div>
            </div>
            <div className="flex gap-2 mt-3">
              <Button
                size="sm"
                disabled={createMutation.isPending || !code || !name || !unit || !unitCost}
                onClick={() => createMutation.mutate()}
              >
                {createMutation.isPending ? <><Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />Guardando…</> : 'Agregar recurso'}
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setShowCreate(false)}>Cancelar</Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Resources Table */}
      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <CardTitle className="text-base">
              Biblioteca
              <span className="ml-2 text-sm font-normal text-muted-foreground">({resources.length} recursos)</span>
            </CardTitle>
            <Input
              placeholder="Buscar recurso o código…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="h-7 w-52 text-xs"
            />
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
          {isLoading && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground py-4">
              <Loader2 className="h-4 w-4 animate-spin" /> Cargando recursos…
            </div>
          )}

          {!isLoading && isEmpty && (
            <div className="py-10 text-center text-muted-foreground">
              <Database className="h-10 w-10 mx-auto mb-3 opacity-20" />
              <p className="text-sm font-medium">Biblioteca vacía</p>
              <p className="text-xs mt-1">
                Usa el botón <strong>"Cargar insumos colombianos"</strong> arriba para poblar automáticamente
                con ~100 recursos típicos de construcción, o agrega recursos manualmente.
              </p>
            </div>
          )}

          {!isLoading && !isEmpty && filteredResources.length === 0 && (
            <p className="text-sm text-muted-foreground py-4 text-center">
              Sin resultados para "<strong>{search}</strong>"
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
                      Tarifa 2025
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
                      <td className="py-2 pr-4 font-medium">
                        {r.name}
                        {r.type === 'MANO_OBRA' && (
                          <span className="ml-2 text-[10px] text-blue-500 font-normal">+52% prest.</span>
                        )}
                      </td>
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

      {/* Info footer */}
      <Card className="bg-blue-50 border-blue-200">
        <CardContent className="p-4 text-xs text-blue-800 space-y-1">
          <p className="font-semibold">ℹ️ Sobre los precios y el factor prestacional</p>
          <ul className="space-y-0.5 ml-3 list-disc">
            <li>Los precios de <strong>Mano de Obra</strong> son salarios base diarios — el sistema aplica automáticamente <strong>+52% de factor prestacional</strong> al usarlos en APUs (salud, pensión, ARL, primas, cesantías, vacaciones, parafiscales).</li>
            <li>Precios de materiales y equipos son valores de mercado nacional Colombia 2025 — actualiza con hover sobre el precio.</li>
            <li>Operación idempotente: puedes ejecutar "Cargar insumos colombianos" múltiples veces sin duplicar registros.</li>
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
