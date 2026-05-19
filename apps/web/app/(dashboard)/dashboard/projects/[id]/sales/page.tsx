'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ChevronDown, ChevronUp, Plus, X } from 'lucide-react';
import Link from 'next/link';
import { useMemo, useState } from 'react';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { toast } from 'sonner';

import { ModuleHeader } from '@/components/module-header';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { api } from '@/lib/api-client';

// ── Types ─────────────────────────────────────────────────────────────────────

type UnitGroup = 'VIVIENDA' | 'COMERCIAL' | 'COMPLEMENTARIO';

type Unit = {
  id: string;
  code: string;
  kind: string;
  floor?: number | null;
  privateAreaM2: string;
  saleableAreaM2: string;
  listPrice: string;
  status: string;
  tower?: { code: string; name: string } | null;
  priceListItems?: Array<{
    price: string;
    priceList: { name: string; effectiveDate: string; isBase: boolean };
  }>;
};

type Tower = { id: string; code: string; name: string };

type PriceListItem = { unitId: string; price: string; unit: { code: string; kind: string } };

type PriceList = {
  id: string;
  name: string;
  effectiveDate: string;
  notes?: string | null;
  isBase: boolean;
  items: PriceListItem[];
};

type GroupStats = {
  total: number;
  available: number;
  reserved: number;
  sold: number;
  totalListPrice: number;
  avgPriceM2: number;
};

type DashboardData = {
  byGroup: Record<UnitGroup, GroupStats>;
  velocity: Array<{ month: string; unitsSold: number; valueCaptured: number }>;
  sCurve: Array<{ month: string; cumUnits: number; cumValue: number }>;
  avgTicket: Record<UnitGroup, number>;
  discountAnalysis: { avgListPrice: number; avgSalePrice: number; avgDiscountPct: number };
  priceEvolutionSummary: Array<{
    listName: string;
    effectiveDate: string;
    avgPriceByGroup: Record<string, number>;
  }>;
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatCOP(value: string | number): string {
  return new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    maximumFractionDigits: 0,
  }).format(Number(value));
}

function getGroup(kind: string): UnitGroup {
  if (['APARTAMENTO', 'CASA'].includes(kind)) return 'VIVIENDA';
  if (['LOCAL', 'OFICINA'].includes(kind)) return 'COMERCIAL';
  return 'COMPLEMENTARIO';
}

const GROUP_META: Record<UnitGroup, { label: string; icon: string; color: string; badge: string }> = {
  VIVIENDA: { label: 'Vivienda', icon: '🏠', color: 'emerald', badge: 'bg-emerald-100 text-emerald-700' },
  COMERCIAL: { label: 'Comercial', icon: '🏪', color: 'orange', badge: 'bg-orange-100 text-orange-700' },
  COMPLEMENTARIO: { label: 'Complementario', icon: '🚗', color: 'slate', badge: 'bg-slate-100 text-slate-700' },
};

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
  { label: 'Oficina', value: 'OFICINA' },
  { label: 'Local', value: 'LOCAL' },
  { label: 'Parqueadero', value: 'PARQUEADERO' },
  { label: 'Depósito', value: 'DEPOSITO' },
  { label: 'Bodega', value: 'BODEGA' },
];

function statusBadge(status: string): JSX.Element {
  let cls = 'inline-block rounded-full px-2 py-0.5 text-xs font-medium ';
  switch (status) {
    case 'DISPONIBLE': cls += 'bg-green-100 text-green-700'; break;
    case 'RESERVADA':
    case 'NEGOCIANDO': cls += 'bg-amber-100 text-amber-700'; break;
    case 'VENDIDA':
    case 'ESCRITURADA': cls += 'bg-blue-100 text-blue-700'; break;
    case 'BLOQUEADA': cls += 'bg-gray-100 text-gray-500'; break;
    default: cls += 'bg-muted text-muted-foreground';
  }
  const labels: Record<string, string> = {
    DISPONIBLE: 'Disponible', RESERVADA: 'Reservada', NEGOCIANDO: 'Negociando',
    VENDIDA: 'Vendida', ESCRITURADA: 'Escriturada', BLOQUEADA: 'Bloqueada',
  };
  return <span className={cls}>{labels[status] ?? status}</span>;
}

function pctBadge(pct: number | null): JSX.Element {
  if (pct === null) return <span className="text-muted-foreground">—</span>;
  const cls = pct >= 0 ? 'text-green-600 font-medium' : 'text-red-500 font-medium';
  const sign = pct >= 0 ? '+' : '';
  return <span className={cls}>{sign}{pct.toFixed(1)}%</span>;
}

// ── New Unit Form ──────────────────────────────────────────────────────────────

type UnitFormData = {
  towerId: string; code: string; kind: string; floor: string;
  privateAreaM2: string; commonAreaM2: string; saleableAreaM2: string; listPrice: string;
};

const EMPTY_UNIT_FORM: UnitFormData = {
  towerId: '', code: '', kind: '', floor: '', privateAreaM2: '', commonAreaM2: '', saleableAreaM2: '', listPrice: '',
};

function NewUnitForm({ projectId, towers, onClose }: { projectId: string; towers: Tower[]; onClose: () => void }) {
  const qc = useQueryClient();
  const [form, setForm] = useState<UnitFormData>(EMPTY_UNIT_FORM);
  const [error, setError] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: (input: Record<string, unknown>) => api.createUnit(projectId, input),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['units', projectId] });
      void qc.invalidateQueries({ queryKey: ['sales-summary', projectId] });
      toast.success('Unidad creada');
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
      setError('Completa los campos requeridos.');
      return;
    }
    const input: Record<string, unknown> = {
      code: form.code.trim(), kind: form.kind, privateAreaM2: form.privateAreaM2,
      saleableAreaM2: form.saleableAreaM2, listPrice: form.listPrice,
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
        <Button variant="ghost" size="icon" onClick={onClose}><X className="h-4 w-4" /></Button>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="space-y-1">
            <Label>Torre (opcional)</Label>
            <Select value={form.towerId} onChange={(e) => set('towerId', e.target.value)}>
              <option value="">Sin torre</option>
              {towers.map((t) => <option key={t.id} value={t.id}>{t.code} – {t.name}</option>)}
            </Select>
          </div>
          <div className="space-y-1">
            <Label>Código <span className="text-destructive">*</span></Label>
            <Input value={form.code} onChange={(e) => set('code', e.target.value)} placeholder="AP-101" required />
          </div>
          <div className="space-y-1">
            <Label>Tipo <span className="text-destructive">*</span></Label>
            <Select value={form.kind} onChange={(e) => set('kind', e.target.value)}>
              <option value="">— Selecciona tipo —</option>
              {KIND_OPTIONS.map((k) => <option key={k.value} value={k.value}>{k.label}</option>)}
            </Select>
          </div>
          <div className="space-y-1">
            <Label>Piso (opcional)</Label>
            <Input type="number" value={form.floor} onChange={(e) => set('floor', e.target.value)} placeholder="1" min={1} />
          </div>
          <div className="space-y-1">
            <Label>Área privada m² <span className="text-destructive">*</span></Label>
            <Input type="number" value={form.privateAreaM2} onChange={(e) => set('privateAreaM2', e.target.value)} placeholder="72.50" step="0.01" min="0" required />
          </div>
          <div className="space-y-1">
            <Label>Área común m² (opcional)</Label>
            <Input type="number" value={form.commonAreaM2} onChange={(e) => set('commonAreaM2', e.target.value)} placeholder="8.00" step="0.01" min="0" />
          </div>
          <div className="space-y-1">
            <Label>Área vendible m² <span className="text-destructive">*</span></Label>
            <Input type="number" value={form.saleableAreaM2} onChange={(e) => set('saleableAreaM2', e.target.value)} placeholder="80.50" step="0.01" min="0" required />
          </div>
          <div className="space-y-1">
            <Label>Precio de lista COP <span className="text-destructive">*</span></Label>
            <Input type="number" value={form.listPrice} onChange={(e) => set('listPrice', e.target.value)} placeholder="280000000" step="1000" min="0" required />
          </div>
          <div className="flex items-end gap-2 sm:col-span-2 lg:col-span-4">
            {error && <p className="flex-1 text-sm text-destructive">{error}</p>}
            <div className="ml-auto flex gap-2">
              <Button type="button" variant="outline" onClick={onClose} disabled={mutation.isPending}>Cancelar</Button>
              <Button type="submit" disabled={mutation.isPending}>{mutation.isPending ? 'Guardando…' : 'Guardar unidad'}</Button>
            </div>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

// ── Tab: Inventario ───────────────────────────────────────────────────────────

function InventoryTab({ projectId, units, towers }: { projectId: string; units: Unit[]; towers: Tower[] }) {
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [search, setSearch] = useState('');
  const [showNewUnit, setShowNewUnit] = useState(false);
  const [collapsed, setCollapsed] = useState<Record<UnitGroup, boolean>>({ VIVIENDA: false, COMERCIAL: false, COMPLEMENTARIO: false });

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

  const grouped = useMemo(() => {
    const g: Record<UnitGroup, Unit[]> = { VIVIENDA: [], COMERCIAL: [], COMPLEMENTARIO: [] };
    for (const u of filtered) g[getGroup(u.kind)].push(u);
    return g;
  }, [filtered]);

  function getCurrentPrice(unit: Unit): { price: string; pct: number | null } {
    const latest = unit.priceListItems?.[0];
    if (!latest) return { price: unit.listPrice, pct: null };
    // find base list price from priceListItems where isBase=true
    const baseItem = unit.priceListItems?.find((i) => i.priceList.isBase);
    let pct: number | null = null;
    if (baseItem) {
      const base = Number(baseItem.price);
      const cur = Number(latest.price);
      if (base > 0) pct = ((cur - base) / base) * 100;
    }
    return { price: latest.price, pct };
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        {STATUS_FILTER_OPTIONS.map((opt) => (
          <button
            key={opt.value}
            onClick={() => setStatusFilter(opt.value)}
            className={`rounded-full px-3 py-1 text-sm font-medium transition-colors ${
              statusFilter === opt.value ? 'bg-purple-600 text-white' : 'bg-muted text-muted-foreground hover:bg-muted/80'
            }`}
          >
            {opt.label}
          </button>
        ))}
        <div className="ml-auto flex gap-2">
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar unidad, torre…" className="w-56" />
          <Button onClick={() => setShowNewUnit((v) => !v)} size="sm">
            {showNewUnit ? <><ChevronUp className="mr-1 h-4 w-4" /> Cancelar</> : <><Plus className="mr-1 h-4 w-4" /> Nueva unidad</>}
          </Button>
        </div>
      </div>

      {showNewUnit && <NewUnitForm projectId={projectId} towers={towers} onClose={() => setShowNewUnit(false)} />}

      {((['VIVIENDA', 'COMERCIAL', 'COMPLEMENTARIO'] as UnitGroup[])).map((group) => {
        const meta = GROUP_META[group];
        const groupUnits = grouped[group];
        const isCollapsed = collapsed[group];
        return (
          <Card key={group}>
            <CardHeader
              className="cursor-pointer select-none pb-2"
              onClick={() => setCollapsed((prev) => ({ ...prev, [group]: !prev[group] }))}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-lg">{meta.icon}</span>
                  <CardTitle className="text-base">{meta.label}</CardTitle>
                  <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${meta.badge}`}>{groupUnits.length}</span>
                </div>
                {isCollapsed ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronUp className="h-4 w-4 text-muted-foreground" />}
              </div>
            </CardHeader>
            {!isCollapsed && (
              <CardContent className="p-0">
                {groupUnits.length === 0 ? (
                  <p className="px-4 py-6 text-center text-sm text-muted-foreground">Sin unidades en este grupo.</p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b bg-muted/40 text-left text-xs font-medium text-muted-foreground">
                          <th className="px-4 py-3">Código</th>
                          <th className="px-4 py-3">Torre</th>
                          <th className="px-4 py-3">Tipo</th>
                          <th className="px-4 py-3 text-right">Piso</th>
                          <th className="px-4 py-3 text-right">Área priv. m²</th>
                          <th className="px-4 py-3 text-right">Área vend. m²</th>
                          <th className="px-4 py-3 text-right">Precio lista actual</th>
                          <th className="px-4 py-3 text-center">% vs base</th>
                          <th className="px-4 py-3 text-center">Estado</th>
                        </tr>
                      </thead>
                      <tbody>
                        {groupUnits.map((unit, idx) => {
                          const { price, pct } = getCurrentPrice(unit);
                          return (
                            <tr key={unit.id} className={`border-b last:border-0 ${idx % 2 === 0 ? '' : 'bg-muted/20'}`}>
                              <td className="px-4 py-2 font-mono font-medium">{unit.code}</td>
                              <td className="px-4 py-2 font-mono text-xs">
                                {unit.tower ? <span title={unit.tower.name}>{unit.tower.code}</span> : <span className="text-muted-foreground">—</span>}
                              </td>
                              <td className="px-4 py-2 capitalize">{unit.kind.toLowerCase()}</td>
                              <td className="px-4 py-2 text-right">{unit.floor != null ? unit.floor : <span className="text-muted-foreground">—</span>}</td>
                              <td className="px-4 py-2 text-right">{Number(unit.privateAreaM2).toFixed(2)}</td>
                              <td className="px-4 py-2 text-right">{Number(unit.saleableAreaM2).toFixed(2)}</td>
                              <td className="px-4 py-2 text-right font-medium">{formatCOP(price)}</td>
                              <td className="px-4 py-2 text-center">{pctBadge(pct)}</td>
                              <td className="px-4 py-2 text-center">{statusBadge(unit.status)}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </CardContent>
            )}
          </Card>
        );
      })}
    </div>
  );
}

// ── HTML Report ───────────────────────────────────────────────────────────────

function buildSalesHtmlReport(dash: DashboardData, projectName: string): string {
  const groups: UnitGroup[] = ['VIVIENDA', 'COMERCIAL', 'COMPLEMENTARIO'];
  const totalUnits = groups.reduce((a, g) => a + dash.byGroup[g].total, 0);
  const totalSold  = groups.reduce((a, g) => a + dash.byGroup[g].sold, 0);
  const totalPortfolio = groups.reduce((a, g) => a + dash.byGroup[g].totalListPrice, 0);
  const lastSC = dash.sCurve[dash.sCurve.length - 1];
  const valueCaptured = lastSC?.cumValue ?? 0;
  const pctAvance = totalPortfolio > 0 ? (valueCaptured / totalPortfolio) * 100 : 0;
  const now = new Date().toLocaleString('es-CO', { dateStyle: 'long', timeStyle: 'short' });

  const groupRows = groups.map((g) => {
    const s = dash.byGroup[g]; const pct = s.total > 0 ? ((s.sold / s.total) * 100).toFixed(1) : '0.0';
    const meta = GROUP_META[g];
    return `<tr><td>${meta.icon} ${meta.label}</td><td>${s.total}</td><td>${s.sold}</td><td>${s.available}</td><td>${s.reserved}</td><td>${pct}%</td><td>${formatCOP(s.avgPriceM2)}/m²</td></tr>`;
  }).join('');

  const velRows = dash.velocity.map((v) =>
    `<tr><td>${v.month}</td><td>${v.unitsSold}</td><td>${formatCOP(v.valueCaptured)}</td></tr>`
  ).join('');

  return `<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8">
<title>Reporte Ventas — ${projectName}</title>
<style>
  *{box-sizing:border-box;margin:0;padding:0}
  body{font-family:'Segoe UI',Arial,sans-serif;background:#f4f6fa;color:#1a2035;padding:32px}
  .cover{background:linear-gradient(135deg,#1e3a8a 0%,#7c3aed 100%);color:#fff;border-radius:16px;padding:40px;margin-bottom:32px}
  .cover h1{font-size:28px;font-weight:700;margin-bottom:8px}
  .cover p{opacity:.8;font-size:14px}
  .kpis{display:grid;grid-template-columns:repeat(4,1fr);gap:16px;margin-bottom:28px}
  .kpi{background:#fff;border-radius:12px;padding:20px;box-shadow:0 2px 8px rgba(0,0,0,.06);text-align:center}
  .kpi .val{font-size:28px;font-weight:700;color:#1e3a8a}
  .kpi .lbl{font-size:11px;color:#64748b;margin-top:4px;text-transform:uppercase;letter-spacing:.05em}
  table{width:100%;border-collapse:collapse;font-size:13px;margin-bottom:24px}
  th{background:#1e3a8a;color:#fff;padding:10px 14px;text-align:left;font-weight:600;font-size:12px}
  td{padding:9px 14px;border-bottom:1px solid #e2e8f0}
  tr:nth-child(even) td{background:#f8fafc}
  h2{font-size:16px;font-weight:700;color:#1e3a8a;margin:24px 0 12px;padding-bottom:6px;border-bottom:2px solid #e2e8f0}
  .footer{text-align:center;font-size:11px;color:#94a3b8;margin-top:32px}
  @media print{body{padding:16px}}
</style></head><body>
<div class="cover">
  <h1>📊 Reporte de Ventas</h1>
  <p>${projectName} · Generado: ${now}</p>
</div>
<div class="kpis">
  <div class="kpi"><div class="val">${totalUnits}</div><div class="lbl">Total Unidades</div></div>
  <div class="kpi"><div class="val" style="color:#7c3aed">${totalSold}</div><div class="lbl">Vendidas</div></div>
  <div class="kpi"><div class="val" style="color:#059669">${pctAvance.toFixed(1)}%</div><div class="lbl">% Avance</div></div>
  <div class="kpi"><div class="val" style="font-size:16px">${formatCOP(valueCaptured)}</div><div class="lbl">Valor Captado</div></div>
</div>
<h2>Resumen por Grupo</h2>
<table><thead><tr><th>Grupo</th><th>Total</th><th>Vendidas</th><th>Disponibles</th><th>En proceso</th><th>% Vendido</th><th>Precio prom.</th></tr></thead>
<tbody>${groupRows}</tbody></table>
<h2>Velocidad de Ventas — últimos meses</h2>
<table><thead><tr><th>Mes</th><th>Unidades vendidas</th><th>Valor captado</th></tr></thead>
<tbody>${velRows}</tbody></table>
<h2>Análisis de Descuentos</h2>
<table><thead><tr><th>Concepto</th><th>Valor</th></tr></thead>
<tbody>
  <tr><td>Precio lista promedio</td><td>${formatCOP(dash.discountAnalysis.avgListPrice)}</td></tr>
  <tr><td>Precio venta promedio</td><td>${formatCOP(dash.discountAnalysis.avgSalePrice)}</td></tr>
  <tr><td>Descuento promedio</td><td>${dash.discountAnalysis.avgDiscountPct.toFixed(2)}%</td></tr>
</tbody></table>
<div class="footer">Generado por Sistema de Gestión de Proyectos · ${now}</div>
</body></html>`;
}

// ── Tab: Dashboard ─────────────────────────────────────────────────────────────

function DashboardTab({ projectId }: { projectId: string }) {
  const dashQ = useQuery({
    queryKey: ['sales-dashboard', projectId],
    queryFn: () => api.getSalesDashboard(projectId),
  });

  const dash = dashQ.data as DashboardData | undefined;

  if (dashQ.isLoading) return <p className="py-12 text-center text-sm text-muted-foreground">Cargando dashboard…</p>;
  if (!dash) return null;

  const groups: UnitGroup[] = ['VIVIENDA', 'COMERCIAL', 'COMPLEMENTARIO'];

  const totalUnits    = groups.reduce((a, g) => a + dash.byGroup[g].total, 0);
  const totalSold     = groups.reduce((a, g) => a + dash.byGroup[g].sold, 0);
  const totalAvailable = groups.reduce((a, g) => a + dash.byGroup[g].available, 0);
  const totalReserved = groups.reduce((a, g) => a + dash.byGroup[g].reserved, 0);
  const totalPortfolio = groups.reduce((a, g) => a + dash.byGroup[g].totalListPrice, 0);
  const lastSCurve = dash.sCurve[dash.sCurve.length - 1];
  const valueCaptured = lastSCurve?.cumValue ?? 0;
  const pctAvance = totalPortfolio > 0 ? (valueCaptured / totalPortfolio) * 100 : 0;

  function exportReport() {
    const html = buildSalesHtmlReport(dash!, 'Proyecto');
    const blob = new Blob([html], { type: 'text/html' });
    const url  = URL.createObjectURL(blob);
    window.open(url, '_blank');
  }

  const axisStyle = { fill: '#94a3b8', fontSize: 10 };
  const gridStyle = { stroke: 'rgba(148,163,184,0.15)' };
  const tooltipStyle = { background: '#0f172a', border: '1px solid rgba(99,179,237,0.2)', borderRadius: 8, color: '#e2e8f0', fontSize: 12 };

  return (
    <div className="space-y-6">
      {/* Export button */}
      <div className="flex justify-end">
        <Button size="sm" variant="outline" onClick={exportReport}>
          📄 Exportar reporte HTML
        </Button>
      </div>

      {/* KPI row */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4 lg:grid-cols-7">
        {[
          { label: 'Total unidades', value: totalUnits,     fmt: String, color: 'from-blue-600 to-blue-800' },
          { label: 'Vendidas',       value: totalSold,       fmt: String, color: 'from-violet-600 to-violet-800' },
          { label: 'Disponibles',    value: totalAvailable,  fmt: String, color: 'from-emerald-600 to-emerald-800' },
          { label: 'En proceso',     value: totalReserved,   fmt: String, color: 'from-amber-500 to-amber-700' },
        ].map(({ label, value, color }) => (
          <div key={label} className={`rounded-xl bg-gradient-to-br ${color} p-4 text-white shadow-lg`}>
            <p className="text-xs font-medium opacity-75 uppercase tracking-wide">{label}</p>
            <p className="mt-1 text-3xl font-bold">{value}</p>
          </div>
        ))}
        <div className="rounded-xl bg-gradient-to-br from-slate-700 to-slate-900 p-4 text-white shadow-lg">
          <p className="text-xs font-medium opacity-75 uppercase tracking-wide">Portafolio</p>
          <p className="mt-1 text-sm font-bold leading-tight">{formatCOP(totalPortfolio)}</p>
        </div>
        <div className="rounded-xl bg-gradient-to-br from-cyan-600 to-cyan-800 p-4 text-white shadow-lg">
          <p className="text-xs font-medium opacity-75 uppercase tracking-wide">Valor captado</p>
          <p className="mt-1 text-sm font-bold leading-tight">{formatCOP(valueCaptured)}</p>
        </div>
        <div className="rounded-xl bg-gradient-to-br from-purple-600 to-indigo-800 p-4 text-white shadow-lg glow-violet">
          <p className="text-xs font-medium opacity-75 uppercase tracking-wide">% Avance</p>
          <p className="mt-1 text-3xl font-bold">{pctAvance.toFixed(1)}%</p>
        </div>
      </div>

      {/* Group cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {groups.map((group) => {
          const meta  = GROUP_META[group];
          const stats = dash.byGroup[group];
          const pct   = stats.total > 0 ? (stats.sold / stats.total) * 100 : 0;
          const barColors: Record<UnitGroup, string> = { VIVIENDA: 'bg-emerald-500', COMERCIAL: 'bg-orange-500', COMPLEMENTARIO: 'bg-slate-500' };
          return (
            <div key={group} className="rounded-xl border bg-card p-4 shadow-sm">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <span className="text-xl">{meta.icon}</span>
                  <span className="font-semibold text-sm">{meta.label}</span>
                </div>
                <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${meta.badge}`}>{stats.total} uds.</span>
              </div>
              <div className="space-y-2">
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>Vendidas: <b className="text-foreground">{stats.sold}</b></span>
                  <span>Disponibles: <b className="text-foreground">{stats.available}</b></span>
                </div>
                <div className="h-2.5 w-full rounded-full bg-muted overflow-hidden">
                  <div className={`h-full rounded-full ${barColors[group]} transition-all`} style={{ width: `${Math.min(pct, 100)}%` }} />
                </div>
                <p className="text-xs text-muted-foreground">{pct.toFixed(1)}% vendido · {formatCOP(stats.avgPriceM2)}/m²</p>
              </div>
            </div>
          );
        })}
      </div>

      {/* Velocity chart */}
      <div className="chart-section">
        <h3 className="mb-4 text-sm font-semibold text-blue-300 uppercase tracking-widest">Velocidad de ventas — últimos meses</h3>
        <ResponsiveContainer width="100%" height={240}>
          <BarChart data={dash.velocity} margin={{ top: 4, right: 16, bottom: 4, left: 0 }}>
            <defs>
              <linearGradient id="barUnits" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#a78bfa" /><stop offset="100%" stopColor="#7c3aed" />
              </linearGradient>
              <linearGradient id="barValue" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#67e8f9" /><stop offset="100%" stopColor="#06b6d4" />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" {...gridStyle} />
            <XAxis dataKey="month" tick={axisStyle} />
            <YAxis yAxisId="left" tick={axisStyle} />
            <YAxis yAxisId="right" orientation="right" tick={axisStyle} tickFormatter={(v: number) => `${(v / 1e6).toFixed(0)}M`} />
            <Tooltip contentStyle={tooltipStyle} formatter={(value, name) => name === 'unitsSold' ? [Number(value ?? 0), 'Unidades'] : [formatCOP(Number(value ?? 0)), 'Valor']} />
            <Legend wrapperStyle={{ color: '#94a3b8', fontSize: 11 }} />
            <Bar yAxisId="left" dataKey="unitsSold" name="Unidades" fill="url(#barUnits)" radius={[4, 4, 0, 0]} />
            <Bar yAxisId="right" dataKey="valueCaptured" name="Valor COP" fill="url(#barValue)" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* S-Curve */}
      {dash.sCurve.length > 0 && (
        <div className="chart-section">
          <h3 className="mb-4 text-sm font-semibold text-blue-300 uppercase tracking-widest">Curva S — acumulado de ventas</h3>
          <ResponsiveContainer width="100%" height={240}>
            <AreaChart data={dash.sCurve} margin={{ top: 4, right: 16, bottom: 4, left: 0 }}>
              <defs>
                <linearGradient id="cuUnits" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#a78bfa" stopOpacity={0.5} />
                  <stop offset="95%" stopColor="#7c3aed" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="cuValue" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#67e8f9" stopOpacity={0.5} />
                  <stop offset="95%" stopColor="#06b6d4" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" {...gridStyle} />
              <XAxis dataKey="month" tick={axisStyle} />
              <YAxis yAxisId="left" tick={axisStyle} />
              <YAxis yAxisId="right" orientation="right" tick={axisStyle} tickFormatter={(v: number) => `${(v / 1e6).toFixed(0)}M`} />
              <Tooltip contentStyle={tooltipStyle} formatter={(value, name) => name === 'cumUnits' ? [Number(value ?? 0), 'Unidades acum.'] : [formatCOP(Number(value ?? 0)), 'Valor acum.']} />
              <Legend wrapperStyle={{ color: '#94a3b8', fontSize: 11 }} />
              <Area yAxisId="left" type="monotone" dataKey="cumUnits" name="Unidades acum." stroke="#a78bfa" fill="url(#cuUnits)" strokeWidth={2} />
              <Area yAxisId="right" type="monotone" dataKey="cumValue" name="Valor acum." stroke="#67e8f9" fill="url(#cuValue)" strokeWidth={2} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Avg ticket + discount */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Card>
          <CardHeader><CardTitle className="text-sm">Ticket promedio por grupo</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {groups.map((group) => {
              const ticket = dash.avgTicket[group];
              const bar = ticket > 0 ? Math.min((ticket / Math.max(...groups.map((g) => dash.avgTicket[g]))) * 100, 100) : 0;
              return (
                <div key={group} className="space-y-1">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">{GROUP_META[group].icon} {GROUP_META[group].label}</span>
                    <span className="font-semibold">{ticket > 0 ? formatCOP(ticket) : '—'}</span>
                  </div>
                  <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
                    <div className="h-full rounded-full bg-violet-500 transition-all" style={{ width: `${bar}%` }} />
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="text-sm">Análisis de descuentos</CardTitle></CardHeader>
          <CardContent className="space-y-3 text-sm">
            {[
              { label: 'Precio lista promedio', value: formatCOP(dash.discountAnalysis.avgListPrice), colored: false },
              { label: 'Precio venta promedio', value: formatCOP(dash.discountAnalysis.avgSalePrice), colored: false },
              { label: 'Descuento promedio', value: `${dash.discountAnalysis.avgDiscountPct.toFixed(2)}%`, colored: true },
            ].map(({ label, value, colored }) => (
              <div key={label} className="flex justify-between items-center py-1 border-b last:border-0">
                <span className="text-muted-foreground">{label}</span>
                <span className={`font-semibold ${colored ? (dash.discountAnalysis.avgDiscountPct > 0 ? 'text-amber-600' : 'text-emerald-600') : ''}`}>{value}</span>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

// ── Tab: Listas de precios ─────────────────────────────────────────────────────

type PriceListForm = { name: string; effectiveDate: string; notes: string; isBase: boolean };
const EMPTY_PL_FORM: PriceListForm = { name: '', effectiveDate: '', notes: '', isBase: false };

function PriceListsTab({ projectId, units }: { projectId: string; units: Unit[] }) {
  const qc = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<PriceListForm>(EMPTY_PL_FORM);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [editPrices, setEditPrices] = useState<Record<string, string>>({});

  const plQ = useQuery({
    queryKey: ['price-lists', projectId],
    queryFn: () => api.listPriceLists(projectId),
  });

  const priceLists = (plQ.data ?? []) as PriceList[];
  const baseList = priceLists.find((pl) => pl.isBase);

  const createMut = useMutation({
    mutationFn: (input: PriceListForm) =>
      api.createPriceList(projectId, {
        name: input.name,
        effectiveDate: input.effectiveDate,
        notes: input.notes || null,
        isBase: input.isBase,
      }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['price-lists', projectId] });
      toast.success('Lista de precios creada');
      setShowForm(false);
      setForm(EMPTY_PL_FORM);
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const savePricesMut = useMutation({
    mutationFn: ({ priceListId, items }: { priceListId: string; items: Array<{ unitId: string; price: string }> }) =>
      api.setPriceListItems(projectId, priceListId, items),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['price-lists', projectId] });
      void qc.invalidateQueries({ queryKey: ['units', projectId] });
      toast.success('Precios guardados');
      setExpandedId(null);
      setEditPrices({});
    },
    onError: (err: Error) => toast.error(err.message),
  });

  function handleExpand(pl: PriceList) {
    if (expandedId === pl.id) {
      setExpandedId(null);
      setEditPrices({});
      return;
    }
    setExpandedId(pl.id);
    // Initialize edit prices from existing items or unit listPrice
    const init: Record<string, string> = {};
    for (const unit of units) {
      const existing = pl.items.find((i) => i.unitId === unit.id);
      init[unit.id] = existing ? existing.price : unit.listPrice;
    }
    setEditPrices(init);
  }

  function loadFromPrevious(pl: PriceList) {
    const sortedLists = [...priceLists].sort(
      (a, b) => new Date(a.effectiveDate).getTime() - new Date(b.effectiveDate).getTime(),
    );
    const plIndex = sortedLists.findIndex((p) => p.id === pl.id);
    if (plIndex <= 0) { toast.error('No hay lista anterior'); return; }
    const prevList = sortedLists[plIndex - 1]!;
    const updated: Record<string, string> = { ...editPrices };
    for (const unit of units) {
      const prevItem = prevList.items.find((i) => i.unitId === unit.id);
      if (prevItem) updated[unit.id] = prevItem.price;
    }
    setEditPrices(updated);
    toast.success('Precios copiados de lista anterior');
  }

  function handleSave(priceListId: string) {
    const items = Object.entries(editPrices)
      .filter(([, price]) => price && Number(price) > 0)
      .map(([unitId, price]) => ({ unitId, price }));
    savePricesMut.mutate({ priceListId, items });
  }

  function avgPriceForGroup(pl: PriceList, group: UnitGroup): number | null {
    const items = pl.items.filter((i) => getGroup(i.unit.kind) === group);
    if (items.length === 0) return null;
    return items.reduce((acc, i) => acc + Number(i.price), 0) / items.length;
  }

  function pctVsBase(pl: PriceList, group: UnitGroup): number | null {
    if (!baseList || pl.id === baseList.id) return null;
    const cur = avgPriceForGroup(pl, group);
    const base = avgPriceForGroup(baseList, group);
    if (cur === null || base === null || base === 0) return null;
    return ((cur - base) / base) * 100;
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button size="sm" onClick={() => setShowForm((v) => !v)}>
          {showForm ? 'Cancelar' : <><Plus className="mr-1 h-4 w-4" /> Nueva lista de precios</>}
        </Button>
      </div>

      {showForm && (
        <Card className="border-dashed border-purple-300 bg-purple-50/40">
          <CardHeader className="pb-2"><CardTitle className="text-base">Nueva lista de precios</CardTitle></CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <div className="space-y-1">
                <Label>Nombre <span className="text-destructive">*</span></Label>
                <Input value={form.name} onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))} placeholder="Lista v2 Abril 2025" />
              </div>
              <div className="space-y-1">
                <Label>Fecha vigencia <span className="text-destructive">*</span></Label>
                <Input type="date" value={form.effectiveDate} onChange={(e) => setForm((p) => ({ ...p, effectiveDate: e.target.value }))} />
              </div>
              <div className="space-y-1 sm:col-span-2">
                <Label>Notas (opcional)</Label>
                <Input value={form.notes} onChange={(e) => setForm((p) => ({ ...p, notes: e.target.value }))} placeholder="Ajuste por IPC…" />
              </div>
              <div className="flex items-center gap-2 sm:col-span-2 lg:col-span-4">
                <input type="checkbox" id="isBase" checked={form.isBase} onChange={(e) => setForm((p) => ({ ...p, isBase: e.target.checked }))} />
                <Label htmlFor="isBase">Marcar como lista base de referencia</Label>
                <div className="ml-auto flex gap-2">
                  <Button variant="outline" onClick={() => { setShowForm(false); setForm(EMPTY_PL_FORM); }} disabled={createMut.isPending}>Cancelar</Button>
                  <Button
                    onClick={() => createMut.mutate(form)}
                    disabled={createMut.isPending || !form.name.trim() || !form.effectiveDate}
                  >
                    {createMut.isPending ? 'Guardando…' : 'Crear lista'}
                  </Button>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {plQ.isLoading && <p className="py-8 text-center text-sm text-muted-foreground">Cargando listas…</p>}

      {priceLists.length === 0 && !plQ.isLoading && (
        <p className="py-8 text-center text-sm text-muted-foreground">No hay listas de precios. Crea la primera lista base.</p>
      )}

      {priceLists.map((pl) => {
        const isExpanded = expandedId === pl.id;
        return (
          <Card key={pl.id}>
            <CardHeader className="pb-2">
              <div className="flex flex-wrap items-start gap-2">
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <CardTitle className="text-sm">{pl.name}</CardTitle>
                    {pl.isBase && <span className="rounded-full bg-purple-100 px-2 py-0.5 text-xs font-semibold text-purple-700">Base</span>}
                  </div>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    Vigencia: {pl.effectiveDate.split('T')[0]} · {pl.items.length} unidades
                    {pl.notes && ` · ${pl.notes}`}
                  </p>
                </div>
                <div className="flex gap-4 text-xs">
                  {(['VIVIENDA', 'COMERCIAL', 'COMPLEMENTARIO'] as UnitGroup[]).map((group) => {
                    const avg = avgPriceForGroup(pl, group);
                    const pct = pctVsBase(pl, group);
                    return avg !== null ? (
                      <div key={group} className="text-right">
                        <p className="text-muted-foreground">{GROUP_META[group].icon} {GROUP_META[group].label}</p>
                        <p className="font-semibold">{formatCOP(avg)}</p>
                        {pct !== null && pctBadge(pct)}
                      </div>
                    ) : null;
                  })}
                </div>
                <Button size="sm" variant="outline" onClick={() => handleExpand(pl)}>
                  {isExpanded ? 'Cerrar' : 'Editar precios'}
                </Button>
              </div>
            </CardHeader>

            {isExpanded && (
              <CardContent>
                <div className="mb-3 flex justify-end gap-2">
                  <Button size="sm" variant="outline" onClick={() => loadFromPrevious(pl)}>
                    Cargar desde lista anterior
                  </Button>
                  <Button size="sm" onClick={() => handleSave(pl.id)} disabled={savePricesMut.isPending}>
                    {savePricesMut.isPending ? 'Guardando…' : 'Guardar precios'}
                  </Button>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b bg-muted/40 text-left text-xs font-medium text-muted-foreground">
                        <th className="px-4 py-2">Código</th>
                        <th className="px-4 py-2">Tipo</th>
                        <th className="px-4 py-2">Grupo</th>
                        <th className="px-4 py-2 text-right">Precio COP</th>
                      </tr>
                    </thead>
                    <tbody>
                      {units.map((unit) => (
                        <tr key={unit.id} className="border-b last:border-0">
                          <td className="px-4 py-1.5 font-mono text-xs font-medium">{unit.code}</td>
                          <td className="px-4 py-1.5 capitalize text-xs">{unit.kind.toLowerCase()}</td>
                          <td className="px-4 py-1.5 text-xs">
                            <span className={`rounded-full px-1.5 py-0.5 text-xs ${GROUP_META[getGroup(unit.kind)].badge}`}>
                              {GROUP_META[getGroup(unit.kind)].label}
                            </span>
                          </td>
                          <td className="px-4 py-1.5 text-right">
                            <Input
                              type="number"
                              className="ml-auto h-7 w-40 text-right text-xs"
                              value={editPrices[unit.id] ?? ''}
                              onChange={(e) => setEditPrices((prev) => ({ ...prev, [unit.id]: e.target.value }))}
                              step="1000"
                              min="0"
                            />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            )}
          </Card>
        );
      })}
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

type Tab = 'inventario' | 'dashboard' | 'precios';

export default function SalesPage({ params }: { params: { id: string } }) {
  const { id: projectId } = params;
  const [tab, setTab] = useState<Tab>('inventario');

  const unitsQ = useQuery({
    queryKey: ['units', projectId],
    queryFn: () => api.listUnits(projectId),
  });

  const towersQ = useQuery({
    queryKey: ['towers', projectId],
    queryFn: () => api.listTowers(projectId),
  });

  const units = (unitsQ.data ?? []) as Unit[];
  const towers = (towersQ.data ?? []) as Tower[];

  const tabs: Array<{ id: Tab; label: string }> = [
    { id: 'inventario', label: 'Inventario' },
    { id: 'dashboard', label: 'Dashboard' },
    { id: 'precios', label: 'Listas de precios' },
  ];

  return (
    <div className="space-y-6">
      <ModuleHeader
        title="Ventas"
        description="Inventario · Dashboard KPIs · Listas de precios versionadas"
        infoText="Gestiona el inventario por grupos (Vivienda, Comercial, Complementario), analiza KPIs de velocidad y ticket, y mantén historial de listas de precios con % de incremento."
        actions={
          <Button variant="outline" asChild>
            <Link href={`/dashboard/projects/${projectId}`}>← Proyecto</Link>
          </Button>
        }
      />

      {/* Tab selector */}
      <div className="flex border-b">
        {tabs.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`px-5 py-2.5 text-sm font-medium transition-colors border-b-2 -mb-px ${
              tab === t.id
                ? 'border-purple-600 text-purple-600'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'inventario' && (
        unitsQ.isLoading
          ? <p className="py-12 text-center text-sm text-muted-foreground">Cargando unidades…</p>
          : <InventoryTab projectId={projectId} units={units} towers={towers} />
      )}
      {tab === 'dashboard' && <DashboardTab projectId={projectId} />}
      {tab === 'precios' && <PriceListsTab projectId={projectId} units={units} />}
    </div>
  );
}
