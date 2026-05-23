'use client';

/**
 * Módulo de Prefactibilidad Inmobiliaria — Modelo CREDICORP
 * - Cálculos en tiempo real con motor local
 * - Persistencia automática en API via TanStack Query
 * - Reporte HTML interactivo con gráficos CSS y print-ready
 * - Dark mode compatible
 */

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  BarChart3,
  Calculator,
  ChevronDown,
  ChevronRight,
  Download,
  Eye,
  Loader2,
  Printer,
  RefreshCw,
  Save,
  TrendingUp,
} from 'lucide-react';
import { useCallback, useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';

import { ModuleHeader } from '@/components/module-header';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { api } from '@/lib/api-client';
import {
  calculate,
  ci,
  DEFAULT_INPUTS,
  fmtMiles,
  fmtPct,
  type CostItem,
  type FeasibilityInputs,
  type FeasibilityResults,
  type LineResult,
} from '@/lib/feasibility-engine';

// ─── Helpers de UI ────────────────────────────────────────────────────────────

const toMiles = (cop: number) =>
  cop === 0 ? '—' : new Intl.NumberFormat('es-CO').format(Math.round(cop / 1000));

const parseMiles = (s: string) => Math.round((parseFloat(s.replace(/[^0-9.-]/g, '')) || 0) * 1000);

const clamp0 = (n: number) => Math.max(0, n);

// ─── CopInput ─────────────────────────────────────────────────────────────────

function CopInput({
  value,
  onChange,
  className = '',
}: {
  value: number;
  onChange: (v: number) => void;
  className?: string;
}) {
  const [editing, setEditing] = useState(false);
  const [raw, setRaw] = useState('');

  const display = value === 0 ? '' : String(Math.round(value / 1000));

  return (
    <Input
      type="text"
      inputMode="numeric"
      value={editing ? raw : display}
      onFocus={() => {
        setEditing(true);
        setRaw(display);
      }}
      onChange={(e) => setRaw(e.target.value)}
      onBlur={() => {
        setEditing(false);
        onChange(clamp0(parseMiles(raw)));
      }}
      className={`h-7 text-right text-xs font-mono tabular-nums ${className}`}
      placeholder="0"
    />
  );
}

// ─── Fila editable ────────────────────────────────────────────────────────────

function EditableCostRow({
  label,
  value,
  result,
  onChange,
  indent = false,
}: {
  label: string;
  value: CostItem;
  result: LineResult;
  onChange: (v: CostItem) => void;
  indent?: boolean;
}) {
  return (
    <tr className="border-b border-border hover:bg-primary/5 group">
      <td className={`py-1 pr-3 text-xs text-muted-foreground ${indent ? 'pl-8' : 'pl-3'}`}>
        {indent && <span className="mr-1 text-muted-foreground/50">&middot;</span>}
        {label}
      </td>
      <td className="py-1 px-1.5">
        <CopInput value={value.fid} onChange={(fid) => onChange({ ...value, fid })} />
      </td>
      <td className="py-1 px-1.5">
        <CopInput value={value.con} onChange={(con) => onChange({ ...value, con })} />
      </td>
      <td className="py-1.5 px-2 text-right font-mono tabular-nums text-xs font-semibold text-foreground">
        {toMiles(result.total)}
      </td>
      <td className="py-1.5 pl-2 pr-3 text-right text-xs font-mono text-muted-foreground">
        {result.pctSales > 0 ? fmtPct(result.pctSales) : '—'}
      </td>
    </tr>
  );
}

// ─── Collapsible section ──────────────────────────────────────────────────────

function CollapsibleSection({
  title,
  children,
  defaultOpen = true,
}: {
  title: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div>
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center gap-2 px-3 py-2 text-xs font-bold uppercase tracking-wider text-primary hover:bg-primary/5 transition-colors rounded-lg"
      >
        {open ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
        {title}
      </button>
      {open && children}
    </div>
  );
}

// ─── Field component ──────────────────────────────────────────────────────────

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <Label className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
        {label}
      </Label>
      {children}
    </div>
  );
}

// ─── Datos por defecto ────────────────────────────────────────────────────────

const DEFAULTS = DEFAULT_INPUTS;

// ─── Página principal ─────────────────────────────────────────────────────────

export default function FeasibilityPage({ params }: { params: { id: string } }) {
  const { id: projectId } = params;
  const qc = useQueryClient();
  const reportRef = useRef<HTMLIFrameElement>(null);

  // ── Estado de entradas ──────────────────────────────────────────────────
  const [inputs, setInputs] = useState<FeasibilityInputs>(DEFAULTS);
  const [dirty, setDirty] = useState(false);
  const [showReport, setShowReport] = useState(false);

  // ── Cargar datos del API ────────────────────────────────────────────────
  const { isLoading } = useQuery({
    queryKey: ['feasibility', projectId],
    queryFn: () => api.getFeasibility(projectId),
    // On success, hydrate local state from DB if analysis has data
    select: (data) => data as Record<string, unknown>,
  });

  const set = <K extends keyof FeasibilityInputs>(key: K, val: FeasibilityInputs[K]) => {
    setInputs((prev) => ({ ...prev, [key]: val }));
    setDirty(true);
  };

  const setCost = (key: keyof FeasibilityInputs, val: CostItem) => {
    setInputs((prev) => ({ ...prev, [key]: val }));
    setDirty(true);
  };

  // ── Cálculo en tiempo real ──────────────────────────────────────────────
  const r = useMemo(() => calculate(inputs), [inputs]);

  // ── Guardar en API ──────────────────────────────────────────────────────
  const saveMutation = useMutation({
    mutationFn: async () => {
      await api.updateFeasibility(projectId, {
        promoter: inputs.promoter,
        totalUnits: inputs.totalUnits,
        builtAreaM2: String(inputs.builtAreaM2),
        saleableAreaM2: String(r.saleableAreaM2),
        pricePerM2: String(r.pricePerM2),
        totalSales: String(inputs.totalSales),
        initialPaymentPct: String(inputs.initialPaymentPct * 100),
        breakEvenUnits: r.breakEvenUnits,
        stratum: inputs.stratum,
        constructionSystem: inputs.constructionSystem,
        discountRate: '12',
      });
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['feasibility', projectId] });
      setDirty(false);
      toast.success('Datos guardados exitosamente');
    },
    onError: () => toast.error('Error al guardar'),
  });

  // ── Exportar reporte HTML interactivo ───────────────────────────────────
  const handleExport = useCallback(() => {
    const html = buildInteractiveHtmlReport(inputs, r);
    const blob = new Blob([html], { type: 'text/html; charset=utf-8' });
    const url = URL.createObjectURL(blob);
    window.open(url, '_blank');
    setTimeout(() => URL.revokeObjectURL(url), 60_000);
  }, [inputs, r]);

  // ── Preview inline del reporte ─────────────────────────────────────────
  const handlePreview = useCallback(() => {
    setShowReport(!showReport);
  }, [showReport]);

  // ── Resetear ────────────────────────────────────────────────────────────
  const handleReset = () => {
    if (confirm('¿Restablecer todos los valores al ejemplo de referencia (Santa Isabel)?')) {
      setInputs(DEFAULTS);
      setDirty(true);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <span className="ml-3 text-muted-foreground">Cargando prefactibilidad...</span>
      </div>
    );
  }

  // ─── Render ────────────────────────────────────────────────────────────
  return (
    <div className="space-y-5 pb-10">
      <ModuleHeader
        title="Prefactibilidad — Modelo CREDICORP"
        description="Motor de cálculo financiero · Estructura de costos · Fuentes y Usos · Indicadores"
        infoText="Todos los campos son editables. Los cálculos se actualizan en tiempo real. Cifras en miles de COP."
        actions={
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={handleReset}>
              <RefreshCw className="mr-1 h-3.5 w-3.5" /> Restablecer
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => saveMutation.mutate()}
              disabled={!dirty || saveMutation.isPending}
            >
              <Save className="mr-1 h-3.5 w-3.5" />
              {saveMutation.isPending ? 'Guardando...' : 'Guardar'}
            </Button>
            <Button size="sm" variant="outline" onClick={handlePreview}>
              <Eye className="mr-1 h-3.5 w-3.5" /> {showReport ? 'Ocultar' : 'Preview'}
            </Button>
            <Button
              size="sm"
              onClick={handleExport}
              className="bg-primary hover:bg-primary/90 text-primary-foreground"
            >
              <Download className="mr-1 h-3.5 w-3.5" /> Exportar HTML
            </Button>
          </div>
        }
      />

      {/* ═══════ PREVIEW INLINE ══════════════════════════════════════════ */}
      {showReport && (
        <Card className="overflow-hidden">
          <CardContent className="p-0">
            <iframe
              ref={reportRef}
              srcDoc={buildInteractiveHtmlReport(inputs, r)}
              className="w-full border-0"
              style={{ height: '80vh' }}
              title="Preview del reporte"
            />
          </CardContent>
        </Card>
      )}

      {/* ═══════ 1. DATOS GENERALES ════════════════════════════════════ */}
      <CollapsibleSection title="Datos Generales del Proyecto">
        <Card>
          <CardContent className="pt-4 pb-4">
            <div className="grid grid-cols-2 gap-x-6 gap-y-3 sm:grid-cols-3 lg:grid-cols-4">
              <Field label="Promotor">
                <Input
                  value={inputs.promoter}
                  onChange={(e) => set('promoter', e.target.value)}
                  className="h-7 text-sm"
                />
              </Field>
              <Field label="Proyecto">
                <Input
                  value={inputs.projectName}
                  onChange={(e) => set('projectName', e.target.value)}
                  className="h-7 text-sm"
                />
              </Field>
              <Field label="Ciudad">
                <Input
                  value={inputs.city}
                  onChange={(e) => set('city', e.target.value)}
                  className="h-7 text-sm"
                />
              </Field>
              <Field label="Sistema constructivo">
                <Input
                  value={inputs.constructionSystem}
                  onChange={(e) => set('constructionSystem', e.target.value)}
                  className="h-7 text-sm"
                />
              </Field>
              <Field label="# Total unidades">
                <Input
                  type="number"
                  min={1}
                  value={inputs.totalUnits}
                  onChange={(e) => set('totalUnits', Number(e.target.value) || 0)}
                  className="h-7 text-sm text-right font-mono"
                />
              </Field>
              <Field label="Estrato">
                <Input
                  type="number"
                  min={1}
                  max={6}
                  value={inputs.stratum}
                  onChange={(e) => set('stratum', Number(e.target.value) || 1)}
                  className="h-7 text-sm text-right font-mono"
                />
              </Field>
              <Field label="Parqueaderos">
                <Input
                  value={inputs.parkingType}
                  onChange={(e) => set('parkingType', e.target.value)}
                  className="h-7 text-sm"
                />
              </Field>
              <Field label="M² construido">
                <Input
                  type="number"
                  min={0}
                  step={0.01}
                  value={inputs.builtAreaM2}
                  onChange={(e) => set('builtAreaM2', parseFloat(e.target.value) || 0)}
                  className="h-7 text-sm text-right font-mono"
                />
              </Field>
              <Field label="Factor área vendible">
                <div className="flex items-center gap-1.5">
                  <Input
                    type="number"
                    min={0.5}
                    max={3}
                    step={0.001}
                    value={inputs.saleableFactorPct}
                    onChange={(e) => set('saleableFactorPct', parseFloat(e.target.value) || 1)}
                    className="h-7 text-sm text-right font-mono flex-1"
                  />
                  <span className="text-xs text-muted-foreground">×m²c</span>
                </div>
              </Field>
              <Field label="M² vendibles (calculado)">
                <div className="h-7 rounded-md border border-border bg-muted/50 px-2 flex items-center">
                  <span className="text-sm font-mono font-semibold text-primary">
                    {r.saleableAreaM2.toLocaleString('es-CO', {
                      maximumFractionDigits: 2,
                    })}{' '}
                    m²
                  </span>
                </div>
              </Field>
              <Field label="Valor ventas totales (miles COP)">
                <CopInput
                  value={inputs.totalSales}
                  onChange={(v) => set('totalSales', v)}
                  className="h-7 border-primary/30 bg-primary/5 font-bold text-primary"
                />
              </Field>
              <Field label="Vlr M² vendible (calculado)">
                <div className="h-7 rounded-md border border-border bg-muted/50 px-2 flex items-center">
                  <span className="text-sm font-mono font-semibold text-primary">
                    $
                    {r.pricePerM2 > 0
                      ? new Intl.NumberFormat('es-CO', {
                          maximumFractionDigits: 0,
                        }).format(r.pricePerM2)
                      : '—'}{' '}
                    /m²
                  </span>
                </div>
              </Field>
              <Field label="Cuota inicial % (s/ventas)">
                <div className="flex items-center gap-1.5">
                  <Input
                    type="number"
                    min={0}
                    max={100}
                    step={0.5}
                    value={Math.round(inputs.initialPaymentPct * 100)}
                    onChange={(e) =>
                      set('initialPaymentPct', (parseFloat(e.target.value) || 0) / 100)
                    }
                    className="h-7 text-sm text-right font-mono flex-1"
                  />
                  <span className="text-xs text-muted-foreground">%</span>
                </div>
              </Field>
              <Field label="% Crédito constructor (s/usos)">
                <div className="flex items-center gap-1.5">
                  <Input
                    type="number"
                    min={0}
                    max={100}
                    step={0.5}
                    value={Math.round(inputs.creditPct * 100 * 10) / 10}
                    onChange={(e) => set('creditPct', (parseFloat(e.target.value) || 0) / 100)}
                    className="h-7 text-sm text-right font-mono flex-1"
                  />
                  <span className="text-xs text-muted-foreground">%</span>
                </div>
              </Field>
              <Field label="% Lote (s/ventas)">
                <div className="flex items-center gap-1.5">
                  <Input
                    type="number"
                    min={0}
                    max={50}
                    step={0.1}
                    value={Math.round(inputs.lotePct * 100 * 10) / 10}
                    onChange={(e) => set('lotePct', (parseFloat(e.target.value) || 0) / 100)}
                    className="h-7 text-sm text-right font-mono flex-1"
                  />
                  <span className="text-xs text-muted-foreground">%</span>
                </div>
              </Field>
              <Field label="Otras fuentes (miles COP)">
                <CopInput value={inputs.otherSources} onChange={(v) => set('otherSources', v)} />
              </Field>
            </div>
          </CardContent>
        </Card>
      </CollapsibleSection>

      {/* ═══════ 2. ESTRUCTURA DE COSTOS ═══════════════════════════════ */}
      <CollapsibleSection title="Estructura de Costos">
        <Card className="overflow-hidden">
          <CardHeader className="bg-primary text-primary-foreground px-4 py-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-bold tracking-wide flex items-center gap-2">
                <BarChart3 className="h-4 w-4" />
                ESTRUCTURA DE COSTOS — Aportes a través de
              </CardTitle>
              <span className="text-[10px] opacity-70 italic">Cifras en miles de COP</span>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-primary/90 text-primary-foreground">
                    <th className="py-2 pl-3 pr-3 text-left font-semibold w-[40%]">CONCEPTO</th>
                    <th className="py-2 px-2 text-right font-semibold w-[15%]">FIDEICOMISO</th>
                    <th className="py-2 px-2 text-right font-semibold w-[15%]">CONSTRUCTOR</th>
                    <th className="py-2 px-2 text-right font-semibold w-[15%]">TOTAL</th>
                    <th className="py-2 pl-2 pr-3 text-right font-semibold w-[15%]">% S/VENTAS</th>
                  </tr>
                </thead>
                <tbody>
                  {/* LOTE */}
                  <tr className="bg-warning/10 border-b border-warning/20">
                    <td className="py-1.5 pl-3 pr-3 font-semibold text-warning-foreground dark:text-warning">
                      LOTE ({(inputs.lotePct * 100).toFixed(1)}% s/ventas)
                    </td>
                    <td className="py-1.5 px-2 text-right font-mono font-semibold">
                      {toMiles(r.lote.fid)}
                    </td>
                    <td className="py-1.5 px-2 text-right font-mono text-muted-foreground">—</td>
                    <td className="py-1.5 px-2 text-right font-mono font-bold">
                      {toMiles(r.lote.total)}
                    </td>
                    <td className="py-1.5 pl-2 pr-3 text-right font-mono text-muted-foreground">
                      {fmtPct(r.lote.pctSales)}
                    </td>
                  </tr>

                  {/* URBANISMO */}
                  <tr className="bg-orange-500/10 border-b border-orange-500/20">
                    <td className="py-1 pl-3 pr-3 font-semibold">URBANISMO</td>
                    <td className="py-1 px-1.5">
                      <CopInput
                        value={inputs.urbanismo.fid}
                        onChange={(fid) => setCost('urbanismo', { ...inputs.urbanismo, fid })}
                      />
                    </td>
                    <td className="py-1 px-1.5">
                      <CopInput
                        value={inputs.urbanismo.con}
                        onChange={(con) => setCost('urbanismo', { ...inputs.urbanismo, con })}
                      />
                    </td>
                    <td className="py-1.5 px-2 text-right font-mono font-bold">
                      {toMiles(r.urbanismo.total)}
                    </td>
                    <td className="py-1.5 pl-2 pr-3 text-right font-mono text-muted-foreground">
                      {fmtPct(r.urbanismo.pctSales)}
                    </td>
                  </tr>

                  {/* COSTOS DIRECTOS */}
                  <tr className="bg-info/10 border-b border-info/20">
                    <td className="py-1 pl-3 pr-3 font-semibold">
                      COSTOS DIRECTOS (EDIFICACIONES)
                    </td>
                    <td className="py-1 px-1.5">
                      <CopInput
                        value={inputs.directos.fid}
                        onChange={(fid) => setCost('directos', { ...inputs.directos, fid })}
                      />
                    </td>
                    <td className="py-1 px-1.5">
                      <CopInput
                        value={inputs.directos.con}
                        onChange={(con) => setCost('directos', { ...inputs.directos, con })}
                      />
                    </td>
                    <td className="py-1.5 px-2 text-right font-mono font-bold">
                      {toMiles(r.directos.total)}
                    </td>
                    <td className="py-1.5 pl-2 pr-3 text-right font-mono text-muted-foreground">
                      {fmtPct(r.directos.pctSales)}
                    </td>
                  </tr>

                  {/* COSTOS INDIRECTOS */}
                  <tr className="bg-purple-500/10 border-b border-purple-500/20">
                    <td className="py-1.5 pl-3 font-bold">COSTOS INDIRECTOS</td>
                    <td className="py-1.5 px-2 text-right font-mono font-bold">
                      {toMiles(r.indirectos.subtotal.fid)}
                    </td>
                    <td className="py-1.5 px-2 text-right font-mono font-bold">
                      {toMiles(r.indirectos.subtotal.con)}
                    </td>
                    <td className="py-1.5 px-2 text-right font-mono font-bold">
                      {toMiles(r.indirectos.subtotal.total)}
                    </td>
                    <td className="py-1.5 pl-2 pr-3 text-right font-mono text-muted-foreground">
                      {fmtPct(r.indirectos.subtotal.pctSales)}
                    </td>
                  </tr>

                  {(
                    [
                      ['honorariosAdmin', 'Honorarios Administración y Construcción'],
                      ['disenoEstudios', 'Diseño, Estudios Técnicos, Asesorías'],
                      ['interventoria', 'Interventoría y Supervisión Estructural'],
                      ['licencias', 'Licencias (Urbanismo, Construcción, Ambiental)'],
                      ['seguros', 'Seguros'],
                      ['derechosImpuestos', 'Derechos e Impuestos'],
                      ['conexionServicios', 'Conexión de Servicios'],
                      ['imprevistos', 'Imprevistos'],
                      ['previsionAlza', 'Previsión al Alza'],
                    ] as const
                  ).map(([key, label]) => (
                    <EditableCostRow
                      key={key}
                      label={label}
                      indent
                      value={inputs[key] as CostItem}
                      result={r.indirectos[key]}
                      onChange={(v) => setCost(key, v)}
                    />
                  ))}

                  {/* COSTOS FINANCIEROS */}
                  <tr className="bg-danger/10 border-b border-danger/20">
                    <td className="py-1.5 pl-3 font-bold">COSTOS FINANCIEROS</td>
                    <td className="py-1.5 px-2 text-right font-mono font-bold">
                      {toMiles(r.financieros.subtotal.fid)}
                    </td>
                    <td className="py-1.5 px-2 text-right font-mono font-bold">
                      {toMiles(r.financieros.subtotal.con)}
                    </td>
                    <td className="py-1.5 px-2 text-right font-mono font-bold">
                      {toMiles(r.financieros.subtotal.total)}
                    </td>
                    <td className="py-1.5 pl-2 pr-3 text-right font-mono text-muted-foreground">
                      {fmtPct(r.financieros.subtotal.pctSales)}
                    </td>
                  </tr>
                  {(
                    [
                      ['fiducia', 'Fiducia'],
                      ['interesesCredito', 'Intereses Crédito (Constructor, Puentes)'],
                    ] as const
                  ).map(([key, label]) => (
                    <EditableCostRow
                      key={key}
                      label={label}
                      indent
                      value={inputs[key] as CostItem}
                      result={r.financieros[key]}
                      onChange={(v) => setCost(key, v)}
                    />
                  ))}

                  {/* COSTOS DE VENTAS */}
                  <tr className="bg-success/10 border-b border-success/20">
                    <td className="py-1.5 pl-3 font-bold">COSTOS DE VENTAS</td>
                    <td className="py-1.5 px-2 text-right font-mono font-bold">
                      {toMiles(r.ventasCostos.subtotal.fid)}
                    </td>
                    <td className="py-1.5 px-2 text-right font-mono font-bold">
                      {toMiles(r.ventasCostos.subtotal.con)}
                    </td>
                    <td className="py-1.5 px-2 text-right font-mono font-bold">
                      {toMiles(r.ventasCostos.subtotal.total)}
                    </td>
                    <td className="py-1.5 pl-2 pr-3 text-right font-mono text-muted-foreground">
                      {fmtPct(r.ventasCostos.subtotal.pctSales)}
                    </td>
                  </tr>
                  {(
                    [
                      ['honorariosVentas', 'Honorarios de Ventas'],
                      ['honorariosGerencia', 'Honorarios de Gerencia'],
                      ['disenoArquitectonico', 'Honorarios Diseño/Arquitectónicos'],
                      ['publicidad', 'Promoción y Publicidad'],
                      ['notariales', 'Notariales (Escrituración, Transferencia lote)'],
                    ] as const
                  ).map(([key, label]) => (
                    <EditableCostRow
                      key={key}
                      label={label}
                      indent
                      value={inputs[key] as CostItem}
                      result={r.ventasCostos[key]}
                      onChange={(v) => setCost(key, v)}
                    />
                  ))}

                  {/* TOTAL USOS */}
                  <tr className="bg-primary text-primary-foreground font-bold border-t-2">
                    <td className="py-2.5 pl-3">TOTAL USOS</td>
                    <td className="py-2.5 px-2 text-right font-mono">{toMiles(r.totalUsos.fid)}</td>
                    <td className="py-2.5 px-2 text-right font-mono">{toMiles(r.totalUsos.con)}</td>
                    <td className="py-2.5 px-2 text-right font-mono">
                      {toMiles(r.totalUsos.total)}
                    </td>
                    <td className="py-2.5 pl-2 pr-3 text-right font-mono">
                      {fmtPct(r.totalUsos.pctSales)}
                    </td>
                  </tr>

                  {/* VENTAS */}
                  <tr className="bg-muted font-semibold">
                    <td className="py-2 pl-3">VENTAS / APORTES TOTALES</td>
                    <td className="py-2 px-2 text-right font-mono">{toMiles(r.totalSales)}</td>
                    <td className="py-2 px-2 text-right font-mono text-muted-foreground">—</td>
                    <td className="py-2 px-2 text-right font-mono">{toMiles(r.totalSales)}</td>
                    <td className="py-2 pl-2 pr-3 text-right font-mono">100,00%</td>
                  </tr>

                  {/* UTILIDAD */}
                  <tr
                    className={`font-bold border-t-2 ${r.utilidad >= 0 ? 'bg-success text-success-foreground' : 'bg-danger text-danger-foreground'}`}
                  >
                    <td className="py-2.5 pl-3">
                      UTILIDAD ESTIMADA
                      <span className="ml-2 text-[10px] font-normal opacity-80">(miles COP)</span>
                    </td>
                    <td className="py-2.5 px-2" />
                    <td className="py-2.5 px-2" />
                    <td className="py-2.5 px-2 text-right font-mono text-lg">
                      {new Intl.NumberFormat('es-CO', {
                        maximumFractionDigits: 0,
                      }).format(Math.round(r.utilidadMiles))}
                    </td>
                    <td className="py-2.5 pl-2 pr-3 text-right font-mono">
                      {fmtPct(r.utilidadPct)}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </CollapsibleSection>

      {/* ═══════ 3. RESUMEN + FUENTES ═════════════════════════════════ */}
      <CollapsibleSection title="Resumen y Fuentes">
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
          {/* Resumen de costos */}
          <Card>
            <CardHeader className="pb-2 pt-3 bg-primary text-primary-foreground rounded-t-xl">
              <CardTitle className="text-xs font-bold tracking-wider flex items-center gap-2">
                <Calculator className="h-3.5 w-3.5" />
                RESUMEN DE COSTOS
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-muted text-muted-foreground">
                    <th className="py-1.5 pl-3 text-left font-semibold">Concepto</th>
                    <th className="py-1.5 pr-3 text-right font-semibold">Miles COP</th>
                    <th className="py-1.5 pr-3 text-right font-semibold">% Ventas</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {[
                    { label: 'Lote', val: r.lote.total, pct: r.lote.pctSales },
                    { label: 'Urbanismo', val: r.urbanismo.total, pct: r.urbanismo.pctSales },
                    { label: 'Costos Directos', val: r.directos.total, pct: r.directos.pctSales },
                    {
                      label: 'Costos Indirectos',
                      val: r.indirectos.subtotal.total,
                      pct: r.indirectos.subtotal.pctSales,
                    },
                    {
                      label: 'Costos Financieros',
                      val: r.financieros.subtotal.total,
                      pct: r.financieros.subtotal.pctSales,
                    },
                    {
                      label: 'Costos de Ventas',
                      val: r.ventasCostos.subtotal.total,
                      pct: r.ventasCostos.subtotal.pctSales,
                    },
                  ].map(({ label, val, pct }) => (
                    <tr key={label} className="hover:bg-muted/50">
                      <td className="py-2 pl-3 font-medium">{label}</td>
                      <td className="py-2 pr-3 text-right font-mono">{toMiles(val)}</td>
                      <td className="py-2 pr-3 text-right font-mono text-muted-foreground">
                        {fmtPct(pct)}
                      </td>
                    </tr>
                  ))}
                  <tr className="bg-primary text-primary-foreground font-bold">
                    <td className="py-2 pl-3">TOTAL USOS</td>
                    <td className="py-2 pr-3 text-right font-mono">{toMiles(r.totalUsos.total)}</td>
                    <td className="py-2 pr-3 text-right font-mono">
                      {fmtPct(r.totalUsos.pctSales)}
                    </td>
                  </tr>
                </tbody>
              </table>
            </CardContent>
          </Card>

          {/* Fuentes y Usos */}
          <Card>
            <CardHeader className="pb-2 pt-3 bg-info text-info-foreground rounded-t-xl">
              <CardTitle className="text-xs font-bold tracking-wider flex items-center gap-2">
                <TrendingUp className="h-3.5 w-3.5" />
                FUENTES Y USOS
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-info/10 text-info">
                    <th className="py-1.5 pl-3 text-left font-semibold">Fuente</th>
                    <th className="py-1.5 pr-3 text-right font-semibold">Miles COP</th>
                    <th className="py-1.5 pr-3 text-right font-semibold">% Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {[
                    { label: 'Aporte de Socios', val: r.aportesSocios },
                    { label: 'Crédito Constructor', val: r.creditoConstructor },
                    {
                      label: `Cuotas Iniciales (${Math.round(inputs.initialPaymentPct * 100)}%)`,
                      val: r.cuotasIniciales,
                    },
                  ].map(({ label, val }) => (
                    <tr key={label} className="hover:bg-muted/50">
                      <td className="py-2 pl-3 font-medium">{label}</td>
                      <td className="py-2 pr-3 text-right font-mono">{toMiles(val)}</td>
                      <td className="py-2 pr-3 text-right font-mono text-muted-foreground">
                        {r.totalUsos.total > 0 ? fmtPct(val / r.totalUsos.total) : '—'}
                      </td>
                    </tr>
                  ))}
                  <tr className="bg-info text-info-foreground font-bold">
                    <td className="py-2 pl-3">TOTAL FUENTES</td>
                    <td className="py-2 pr-3 text-right font-mono">{toMiles(r.totalFuentes)}</td>
                    <td className="py-2 pr-3 text-right font-mono">100,00%</td>
                  </tr>
                  <tr
                    className={`font-bold ${Math.abs(r.balance) < 1000 ? 'bg-success/10 text-success' : 'bg-danger/10 text-danger'}`}
                  >
                    <td className="py-2 pl-3 text-xs">Balance Fuentes − Usos</td>
                    <td className="py-2 pr-3 text-right font-mono">
                      {Math.abs(r.balance) < 1000
                        ? '✓ Cuadrado'
                        : `${toMiles(Math.abs(r.balance))} ${r.balance < 0 ? '(déficit)' : '(superávit)'}`}
                    </td>
                    <td className="py-2 pr-3 text-right font-mono">
                      {Math.abs(r.balance) < 1000 ? '✓' : '⚠'}
                    </td>
                  </tr>
                </tbody>
              </table>
            </CardContent>
          </Card>
        </div>
      </CollapsibleSection>

      {/* ═══════ 4. INDICADORES ═══════════════════════════════════════ */}
      <CollapsibleSection title="Indicadores Financieros">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          {[
            {
              label: 'Utilidad estimada',
              value: `$${toMiles(r.utilidad)}`,
              sub: 'miles COP',
              ok: r.utilidad >= 0,
            },
            {
              label: '% Margen s/ventas',
              value: fmtPct(r.utilidadPct),
              sub: r.utilidadPct >= 0.12 ? '✓ Viable (≥12%)' : '⚠ Bajo (<12%)',
              ok: r.utilidadPct >= 0.12,
            },
            {
              label: 'ROI s/inversión',
              value: `${r.roi.toFixed(1)}%`,
              sub: 'utilidad / usos totales',
              ok: true,
            },
            {
              label: 'Punto equilibrio',
              value: `${r.breakEvenUnits} uds`,
              sub: `${fmtPct(r.breakEvenPct)} de ${inputs.totalUnits}`,
              ok: r.breakEvenPct <= 0.9,
            },
            {
              label: 'Precio / unidad',
              value: `$${toMiles(r.pricePerUnit)}`,
              sub: 'miles COP / unidad',
              ok: true,
            },
            {
              label: 'Costo / m² vendible',
              value: `$${r.saleableAreaM2 > 0 ? new Intl.NumberFormat('es-CO', { maximumFractionDigits: 0 }).format(r.totalUsos.total / r.saleableAreaM2) : '—'}`,
              sub: 'COP / m²',
              ok: true,
            },
          ].map(({ label, value, sub, ok }) => (
            <div
              key={label}
              className={`rounded-xl border px-3 py-3 transition-colors ${ok ? 'bg-success/5 border-success/20' : 'bg-danger/5 border-danger/20'}`}
            >
              <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-wide leading-tight mb-1">
                {label}
              </p>
              <p
                className={`text-lg font-bold leading-none ${ok ? 'text-success' : 'text-danger'}`}
              >
                {value}
              </p>
              <p className="text-[10px] text-muted-foreground mt-1">{sub}</p>
            </div>
          ))}
        </div>
      </CollapsibleSection>

      {/* ═══════ 5. NOTA METODOLÓGICA ═══════════════════════════════ */}
      <Card className="bg-muted/50 border-border">
        <CardContent className="pt-3 pb-3">
          <p className="text-[11px] text-muted-foreground leading-relaxed">
            <span className="font-semibold">Fórmulas aplicadas:</span> Lote = %Lote × Ventas ·
            M²Vendibles = M²Construido × Factor · Vlr/m² = Ventas ÷ M²Vendibles · Total Usos =
            Σ(todos los costos) · Utilidad = Ventas − Total Usos · Punto Equilibrio (uds) = ⌈Total
            Usos ÷ (Ventas ÷ #Unidades)⌉ · ROI = Utilidad ÷ Total Usos × 100.{' '}
            <span className="text-warning font-medium">Cifras en miles de COP</span> según modelo
            CREDICORP.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

// ─── Generador de Reporte HTML Interactivo ────────────────────────────────────

function buildInteractiveHtmlReport(inp: FeasibilityInputs, r: FeasibilityResults): string {
  const fmtK = (n: number) => new Intl.NumberFormat('es-CO').format(Math.round(n / 1000));
  const fP = (f: number) => `${(f * 100).toFixed(2)}%`;
  const date = new Date().toLocaleDateString('es-CO', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  });

  // Build cost distribution data for CSS chart
  const costParts = [
    { label: 'Lote', val: r.lote.total, color: '#f59e0b' },
    { label: 'Urbanismo', val: r.urbanismo.total, color: '#f97316' },
    { label: 'Directos', val: r.directos.total, color: '#3b82f6' },
    { label: 'Indirectos', val: r.indirectos.subtotal.total, color: '#a855f7' },
    { label: 'Financieros', val: r.financieros.subtotal.total, color: '#ef4444' },
    { label: 'Ventas', val: r.ventasCostos.subtotal.total, color: '#22c55e' },
  ];
  const maxCost = Math.max(...costParts.map((p) => p.val));

  const sourceParts = [
    { label: 'Aportes Socios', val: r.aportesSocios, color: '#6366f1' },
    { label: 'Crédito Constructor', val: r.creditoConstructor, color: '#3b82f6' },
    { label: 'Cuotas Iniciales', val: r.cuotasIniciales, color: '#14b8a6' },
  ];

  const indirectRows = [
    ['Honorarios Admin.', r.indirectos.honorariosAdmin],
    ['Diseño y Estudios', r.indirectos.disenoEstudios],
    ['Interventoría', r.indirectos.interventoria],
    ['Licencias', r.indirectos.licencias],
    ['Seguros', r.indirectos.seguros],
    ['Derechos e Impuestos', r.indirectos.derechosImpuestos],
    ['Conexión Servicios', r.indirectos.conexionServicios],
    ['Imprevistos', r.indirectos.imprevistos],
    ['Previsión al Alza', r.indirectos.previsionAlza],
  ] as const;

  const finRows = [
    ['Fiducia', r.financieros.fiducia],
    ['Intereses Crédito', r.financieros.interesesCredito],
  ] as const;

  const ventasRows = [
    ['Hon. Ventas', r.ventasCostos.honorariosVentas],
    ['Hon. Gerencia', r.ventasCostos.honorariosGerencia],
    ['Diseño Arq.', r.ventasCostos.disenoArquitectonico],
    ['Publicidad', r.ventasCostos.publicidad],
    ['Notariales', r.ventasCostos.notariales],
  ] as const;

  const mkRow = (label: string, lr: LineResult, indent = false) =>
    `<tr class="detail-row ${indent ? 'indent' : ''}">
      <td>${indent ? '<span class="dot">·</span>' : ''}${label}</td>
      <td class="num">${fmtK(lr.fid)}</td>
      <td class="num">${fmtK(lr.con)}</td>
      <td class="num bold">${fmtK(lr.total)}</td>
      <td class="num muted">${lr.pctSales > 0 ? fP(lr.pctSales) : '—'}</td>
    </tr>`;

  const mkCatHeader = (label: string, lr: LineResult, cls: string) =>
    `<tr class="cat-header ${cls}">
      <td>${label}</td>
      <td class="num">${fmtK(lr.fid)}</td>
      <td class="num">${fmtK(lr.con)}</td>
      <td class="num">${fmtK(lr.total)}</td>
      <td class="num">${fP(lr.pctSales)}</td>
    </tr>`;

  return `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Prefactibilidad — ${inp.projectName}</title>
<style>
  :root {
    --primary: #1e40af;
    --primary-light: #dbeafe;
    --success: #15803d;
    --success-bg: #dcfce7;
    --danger: #b91c1c;
    --danger-bg: #fee2e2;
    --warning: #b45309;
    --warning-bg: #fef3c7;
    --text: #1e293b;
    --muted: #64748b;
    --bg: #f8fafc;
    --card: #ffffff;
    --border: #e2e8f0;
    --radius: 12px;
  }

  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: 'Segoe UI', system-ui, -apple-system, sans-serif; font-size: 13px; background: var(--bg); color: var(--text); line-height: 1.5; }

  .page { max-width: 1100px; margin: 0 auto; padding: 24px; }

  /* ─ Header ─ */
  .header {
    background: linear-gradient(135deg, #1e3a8a 0%, #2563eb 50%, #3b82f6 100%);
    color: white; border-radius: var(--radius); padding: 32px 40px 28px; margin-bottom: 24px;
    position: relative; overflow: hidden;
  }
  .header::after {
    content: ''; position: absolute; top: -50%; right: -10%; width: 300px; height: 300px;
    background: radial-gradient(circle, rgba(255,255,255,0.08) 0%, transparent 70%);
    border-radius: 50%;
  }
  .header-top { display: flex; justify-content: space-between; align-items: flex-start; position: relative; z-index: 1; }
  .header-badge {
    background: rgba(255,255,255,0.15); border: 1px solid rgba(255,255,255,0.25);
    border-radius: 20px; padding: 4px 14px; font-size: 10px; font-weight: 700;
    letter-spacing: 1px; text-transform: uppercase; backdrop-filter: blur(4px);
  }
  .header h1 { font-size: 26px; font-weight: 800; margin: 4px 0 6px; letter-spacing: -0.5px; }
  .header-sub { font-size: 12px; opacity: 0.75; }
  .promoter { font-size: 13px; opacity: 0.85; margin-bottom: 2px; }

  /* ─ Meta grid ─ */
  .meta { display: grid; grid-template-columns: repeat(4, 1fr); gap: 16px; margin-bottom: 28px; }
  .meta-card {
    background: var(--card); border: 1px solid var(--border); border-radius: var(--radius);
    padding: 14px 18px; transition: transform 0.2s, box-shadow 0.2s;
  }
  .meta-card:hover { transform: translateY(-2px); box-shadow: 0 4px 12px rgba(0,0,0,0.08); }
  .meta-lbl { font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.8px; color: var(--muted); }
  .meta-val { font-size: 16px; font-weight: 700; color: var(--text); margin-top: 4px; }

  /* ─ Section titles ─ */
  .section {
    background: var(--card); border: 1px solid var(--border); border-radius: var(--radius);
    margin-bottom: 24px; overflow: hidden;
  }
  .section-header {
    padding: 12px 20px; font-size: 11px; font-weight: 700; text-transform: uppercase;
    letter-spacing: 1px; cursor: pointer; display: flex; align-items: center; gap: 8px;
    user-select: none; transition: background 0.2s;
  }
  .section-header:hover { filter: brightness(0.95); }
  .section-header .arrow { transition: transform 0.3s; font-size: 14px; }
  .section-header.collapsed .arrow { transform: rotate(-90deg); }
  .section-body { transition: max-height 0.4s ease, opacity 0.3s; overflow: hidden; }
  .section-body.hidden { max-height: 0 !important; opacity: 0; }

  /* ─ Tables ─ */
  table { width: 100%; border-collapse: collapse; font-size: 12px; }
  thead th {
    background: var(--primary); color: white; padding: 8px 10px;
    text-align: left; font-size: 10px; letter-spacing: 0.5px; font-weight: 600;
  }
  thead th.num { text-align: right; }
  .detail-row td { padding: 5px 10px; border-bottom: 1px solid var(--border); }
  .detail-row:hover { background: #f1f5f9; }
  .detail-row.indent td:first-child { padding-left: 28px; color: var(--muted); }
  .detail-row .dot { color: #94a3b8; margin-right: 4px; }
  td.num { text-align: right; font-family: 'SF Mono', 'Cascadia Code', Consolas, monospace; font-size: 11px; }
  td.bold { font-weight: 700; }
  td.muted { color: var(--muted); }

  .cat-header td { padding: 7px 10px; font-weight: 700; font-size: 11px; }
  .cat-header.lote { background: var(--warning-bg); color: #92400e; }
  .cat-header.urbanismo { background: #ffedd5; color: #9a3412; }
  .cat-header.directos { background: var(--primary-light); color: #1e40af; }
  .cat-header.indirectos { background: #f3e8ff; color: #6b21a8; }
  .cat-header.financieros { background: var(--danger-bg); color: #991b1b; }
  .cat-header.ventas-cat { background: var(--success-bg); color: #166534; }

  .total-row td { padding: 10px; background: #1e293b; color: white; font-weight: 700; font-size: 12px; }
  .sales-row td { padding: 8px 10px; background: #475569; color: white; font-weight: 600; }
  .profit-row td { padding: 10px; font-weight: 700; font-size: 13px; color: white; }
  .profit-row.positive td { background: var(--success); }
  .profit-row.negative td { background: var(--danger); }

  /* ─ KPIs ─ */
  .kpi-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 14px; padding: 20px; }
  .kpi {
    border: 1px solid var(--border); border-radius: var(--radius); padding: 16px 20px;
    transition: transform 0.2s, box-shadow 0.2s; position: relative; overflow: hidden;
  }
  .kpi:hover { transform: translateY(-2px); box-shadow: 0 4px 16px rgba(0,0,0,0.08); }
  .kpi::before {
    content: ''; position: absolute; top: 0; left: 0; width: 4px; height: 100%;
    border-radius: 4px 0 0 4px;
  }
  .kpi.ok::before { background: var(--success); }
  .kpi.warn::before { background: var(--warning); }
  .kpi.info::before { background: var(--primary); }
  .kpi-lbl { font-size: 10px; text-transform: uppercase; letter-spacing: 0.7px; color: var(--muted); font-weight: 600; }
  .kpi-val { font-size: 22px; font-weight: 800; margin: 6px 0 4px; }
  .kpi-sub { font-size: 10px; color: var(--muted); }
  .kpi.ok .kpi-val { color: var(--success); }
  .kpi.warn .kpi-val { color: var(--warning); }
  .kpi.info .kpi-val { color: var(--primary); }

  /* ─ Chart (CSS only) ─ */
  .chart-section { padding: 20px; }
  .chart-title { font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.8px; color: var(--muted); margin-bottom: 14px; }
  .bar-chart { display: flex; flex-direction: column; gap: 8px; }
  .bar-row { display: flex; align-items: center; gap: 10px; }
  .bar-label { width: 100px; font-size: 11px; font-weight: 600; text-align: right; flex-shrink: 0; }
  .bar-track { flex: 1; height: 28px; background: #f1f5f9; border-radius: 6px; overflow: hidden; position: relative; }
  .bar-fill {
    height: 100%; border-radius: 6px; display: flex; align-items: center; padding: 0 10px;
    font-size: 10px; font-weight: 700; color: white; white-space: nowrap;
    animation: barGrow 0.8s ease-out forwards; transform-origin: left;
  }
  @keyframes barGrow { from { transform: scaleX(0); } to { transform: scaleX(1); } }
  .bar-value { font-size: 11px; font-weight: 600; color: var(--text); width: 90px; text-align: right; flex-shrink: 0; }

  /* ─ Sources donut (CSS) ─ */
  .sources-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; padding: 20px; }
  .source-list { display: flex; flex-direction: column; gap: 10px; }
  .source-item { display: flex; align-items: center; gap: 10px; }
  .source-dot { width: 12px; height: 12px; border-radius: 50%; flex-shrink: 0; }
  .source-info { flex: 1; }
  .source-name { font-size: 11px; font-weight: 600; }
  .source-val { font-size: 10px; color: var(--muted); font-family: monospace; }

  /* ─ Footer ─ */
  .footer {
    border-top: 1px solid var(--border); padding: 16px 24px; display: flex;
    justify-content: space-between; font-size: 10px; color: var(--muted);
    margin-top: 32px;
  }

  /* ─ Print ─ */
  @media print {
    *, *::before, *::after {
      print-color-adjust: exact !important;
      -webkit-print-color-adjust: exact !important;
      color-adjust: exact !important;
    }
    body { background: white !important; font-size: 11px; margin: 0; padding: 0; }
    .page { padding: 0; max-width: 100%; box-shadow: none !important; }
    .header { border-radius: 0; page-break-after: avoid; print-color-adjust: exact; -webkit-print-color-adjust: exact; }
    .section { border-radius: 0; box-shadow: none !important; page-break-inside: auto; }
    .section-header { cursor: default; page-break-after: avoid; }
    .section-body { page-break-before: avoid; }

    /* Force ALL sections open for print */
    .section-body, .section-body.hidden {
      max-height: none !important;
      opacity: 1 !important;
      overflow: visible !important;
      display: block !important;
      visibility: visible !important;
    }
    .section-header .arrow { display: none !important; }

    /* Disable ALL hover effects */
    .meta-card, .meta-card:hover,
    .kpi, .kpi:hover { transform: none !important; box-shadow: none !important; }

    /* CRITICAL: Force bars visible — animation starts at scaleX(0) */
    .bar-fill {
      animation: none !important;
      transform: scaleX(1) !important;
      print-color-adjust: exact !important;
      -webkit-print-color-adjust: exact !important;
    }
    .bar-track {
      print-color-adjust: exact !important;
      -webkit-print-color-adjust: exact !important;
    }

    /* Force background colors on KPI indicators */
    .kpi::before {
      print-color-adjust: exact !important;
      -webkit-print-color-adjust: exact !important;
    }

    /* Source dots */
    .source-dot {
      print-color-adjust: exact !important;
      -webkit-print-color-adjust: exact !important;
    }

    /* Table rows with backgrounds */
    .cat-header, .total-row, .sales-row, .profit-row {
      print-color-adjust: exact !important;
      -webkit-print-color-adjust: exact !important;
    }
    thead th {
      print-color-adjust: exact !important;
      -webkit-print-color-adjust: exact !important;
    }

    /* Hide non-print elements */
    .no-print { display: none !important; }

    /* Tooltips should never show in print */
    [data-tooltip]::after { display: none !important; }
    [data-tooltip] { cursor: default; }

    /* Page break rules */
    .kpi-grid { page-break-inside: avoid; }
    table { page-break-inside: auto; }
    tr { page-break-inside: avoid; }
    thead { display: table-header-group; }
    .footer { page-break-before: auto; margin-top: 16px; }

    @page { margin: 1.5cm 1cm; }
    @page :first { margin-top: 1cm; }
  }

  /* ─ Tooltips ─ */
  [data-tooltip] { position: relative; cursor: help; }
  [data-tooltip]:hover::after {
    content: attr(data-tooltip); position: absolute; bottom: 100%; left: 50%;
    transform: translateX(-50%); background: #1e293b; color: white;
    padding: 4px 10px; border-radius: 6px; font-size: 10px; white-space: nowrap;
    z-index: 10; pointer-events: none;
    animation: tooltipIn 0.2s ease;
  }
  @keyframes tooltipIn { from { opacity: 0; transform: translateX(-50%) translateY(4px); } }

  /* ─ Responsive ─ */
  @media (max-width: 768px) {
    .meta { grid-template-columns: repeat(2, 1fr); }
    .kpi-grid { grid-template-columns: 1fr; }
    .sources-grid { grid-template-columns: 1fr; }
    .header { padding: 20px 24px; }
    .header h1 { font-size: 20px; }
  }
</style>
</head>
<body>
<div class="page">

  <!-- HEADER -->
  <div class="header">
    <div class="header-top">
      <div>
        <div class="promoter">${inp.promoter}</div>
        <h1>${inp.projectName}</h1>
        <div class="header-sub">Cifras en miles de COP · ${date}</div>
      </div>
      <div class="header-badge">Prefactibilidad CREDICORP</div>
    </div>
  </div>

  <!-- META -->
  <div class="meta">
    <div class="meta-card"><div class="meta-lbl">Ciudad</div><div class="meta-val">${inp.city}</div></div>
    <div class="meta-card"><div class="meta-lbl"># Unidades</div><div class="meta-val">${inp.totalUnits} uds · Est. ${inp.stratum}</div></div>
    <div class="meta-card"><div class="meta-lbl">M² Vendibles</div><div class="meta-val">${r.saleableAreaM2.toLocaleString('es-CO', { maximumFractionDigits: 1 })} m²</div></div>
    <div class="meta-card"><div class="meta-lbl">Sistema</div><div class="meta-val">${inp.constructionSystem}</div></div>
  </div>

  <!-- KPIs -->
  <div class="section">
    <div class="section-header" style="background:var(--primary-light);color:var(--primary)" onclick="toggleSection(this)">
      <span class="arrow">▼</span> INDICADORES FINANCIEROS
    </div>
    <div class="section-body">
      <div class="kpi-grid">
        <div class="kpi ${r.utilidad >= 0 ? 'ok' : 'warn'}" data-tooltip="Ventas − Total Usos">
          <div class="kpi-lbl">Utilidad estimada</div>
          <div class="kpi-val">$${fmtK(r.utilidad)}</div>
          <div class="kpi-sub">miles COP</div>
        </div>
        <div class="kpi ${r.utilidadPct >= 0.12 ? 'ok' : 'warn'}" data-tooltip="Utilidad ÷ Ventas × 100">
          <div class="kpi-lbl">Margen s/ventas</div>
          <div class="kpi-val">${fP(r.utilidadPct)}</div>
          <div class="kpi-sub">${r.utilidadPct >= 0.12 ? '✓ Viable (≥12%)' : '⚠ Bajo (<12%)'}</div>
        </div>
        <div class="kpi info" data-tooltip="Utilidad ÷ Total Usos × 100">
          <div class="kpi-lbl">ROI s/inversión</div>
          <div class="kpi-val">${r.roi.toFixed(1)}%</div>
          <div class="kpi-sub">utilidad / total usos</div>
        </div>
        <div class="kpi ${r.breakEvenPct <= 0.9 ? 'ok' : 'warn'}" data-tooltip="Total Usos ÷ Precio por unidad">
          <div class="kpi-lbl">Punto de equilibrio</div>
          <div class="kpi-val">${r.breakEvenUnits} uds</div>
          <div class="kpi-sub">${fP(r.breakEvenPct)} de ${inp.totalUnits}</div>
        </div>
        <div class="kpi info" data-tooltip="Ventas ÷ # Unidades">
          <div class="kpi-lbl">Precio / unidad</div>
          <div class="kpi-val">$${fmtK(r.pricePerUnit)}</div>
          <div class="kpi-sub">miles COP / unidad</div>
        </div>
        <div class="kpi info" data-tooltip="Total Usos ÷ M² vendibles">
          <div class="kpi-lbl">Costo / m²</div>
          <div class="kpi-val">$${r.saleableAreaM2 > 0 ? new Intl.NumberFormat('es-CO', { maximumFractionDigits: 0 }).format(r.totalUsos.total / r.saleableAreaM2) : '—'}</div>
          <div class="kpi-sub">COP / m² vendible</div>
        </div>
      </div>
    </div>
  </div>

  <!-- COST DISTRIBUTION CHART -->
  <div class="section">
    <div class="section-header" style="background:#f1f5f9;color:var(--text)" onclick="toggleSection(this)">
      <span class="arrow">▼</span> DISTRIBUCIÓN DE COSTOS
    </div>
    <div class="section-body">
      <div class="chart-section">
        <div class="chart-title">Composición porcentual sobre ventas</div>
        <div class="bar-chart">
          ${costParts
            .map(
              (p) => `
          <div class="bar-row">
            <div class="bar-label">${p.label}</div>
            <div class="bar-track">
              <div class="bar-fill" style="width:${maxCost > 0 ? (p.val / maxCost) * 100 : 0}%;background:${p.color}">
                ${fP(r.totalSales > 0 ? p.val / r.totalSales : 0)}
              </div>
            </div>
            <div class="bar-value">$${fmtK(p.val)}</div>
          </div>`,
            )
            .join('')}
        </div>
      </div>

      <!-- Sources breakdown -->
      <div class="sources-grid">
        <div>
          <div class="chart-title">Fuentes de financiación</div>
          <div class="source-list">
            ${sourceParts
              .map(
                (s) => `
            <div class="source-item">
              <div class="source-dot" style="background:${s.color}"></div>
              <div class="source-info">
                <div class="source-name">${s.label}</div>
                <div class="source-val">$${fmtK(s.val)} · ${r.totalUsos.total > 0 ? fP(s.val / r.totalUsos.total) : '—'}</div>
              </div>
            </div>`,
              )
              .join('')}
          </div>
        </div>
        <div>
          <div class="chart-title">Balance</div>
          <div style="display:flex;align-items:center;gap:12px;margin-top:8px">
            <div style="font-size:36px;font-weight:800;color:${Math.abs(r.balance) < 1000 ? 'var(--success)' : 'var(--danger)'}">
              ${Math.abs(r.balance) < 1000 ? '✓' : '⚠'}
            </div>
            <div>
              <div style="font-size:14px;font-weight:700;color:${Math.abs(r.balance) < 1000 ? 'var(--success)' : 'var(--danger)'}">
                ${Math.abs(r.balance) < 1000 ? 'Fuentes cuadradas' : `Descuadre: $${fmtK(Math.abs(r.balance))}`}
              </div>
              <div style="font-size:11px;color:var(--muted)">Total fuentes = Total usos</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>

  <!-- COST TABLE -->
  <div class="section">
    <div class="section-header" style="background:var(--primary);color:white" onclick="toggleSection(this)">
      <span class="arrow">▼</span> ESTRUCTURA DE COSTOS DETALLADA
    </div>
    <div class="section-body">
      <table>
        <thead>
          <tr>
            <th style="width:40%">CONCEPTO</th>
            <th class="num" style="width:15%">FIDEICOMISO</th>
            <th class="num" style="width:15%">CONSTRUCTOR</th>
            <th class="num" style="width:15%">TOTAL</th>
            <th class="num" style="width:15%">% VENTAS</th>
          </tr>
        </thead>
        <tbody>
          ${mkCatHeader(`LOTE (${(inp.lotePct * 100).toFixed(1)}% s/ventas)`, r.lote, 'lote')}
          ${mkCatHeader('URBANISMO', r.urbanismo, 'urbanismo')}
          ${mkCatHeader('COSTOS DIRECTOS (EDIFICACIONES)', r.directos, 'directos')}
          ${mkCatHeader('COSTOS INDIRECTOS', r.indirectos.subtotal, 'indirectos')}
          ${indirectRows.map(([l, lr]) => mkRow(l, lr, true)).join('')}
          ${mkCatHeader('COSTOS FINANCIEROS', r.financieros.subtotal, 'financieros')}
          ${finRows.map(([l, lr]) => mkRow(l, lr, true)).join('')}
          ${mkCatHeader('COSTOS DE VENTAS', r.ventasCostos.subtotal, 'ventas-cat')}
          ${ventasRows.map(([l, lr]) => mkRow(l, lr, true)).join('')}
          <tr class="total-row">
            <td>TOTAL USOS</td>
            <td class="num">${fmtK(r.totalUsos.fid)}</td>
            <td class="num">${fmtK(r.totalUsos.con)}</td>
            <td class="num" style="color:#93c5fd">${fmtK(r.totalUsos.total)}</td>
            <td class="num" style="color:#93c5fd">${fP(r.totalUsos.pctSales)}</td>
          </tr>
          <tr class="sales-row">
            <td>VENTAS / APORTES TOTALES</td>
            <td class="num">${fmtK(r.totalSales)}</td>
            <td class="num" style="opacity:0.5">—</td>
            <td class="num">${fmtK(r.totalSales)}</td>
            <td class="num">100,00%</td>
          </tr>
          <tr class="profit-row ${r.utilidad >= 0 ? 'positive' : 'negative'}">
            <td>UTILIDAD ESTIMADA (miles COP)</td>
            <td colspan="2"></td>
            <td class="num" style="font-size:15px">${fmtK(r.utilidad)}</td>
            <td class="num">${fP(r.utilidadPct)}</td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>

  <!-- FOOTER -->
  <div class="footer">
    <span>Generado: ${new Date().toLocaleString('es-CO')}</span>
    <span>${inp.projectName} · Modelo CREDICORP</span>
    <button class="no-print" onclick="preparePrint()" style="background:var(--primary);color:white;border:none;padding:6px 16px;border-radius:6px;font-size:11px;font-weight:600;cursor:pointer">
      🖨 Imprimir
    </button>
  </div>

</div>

<script>
function toggleSection(header) {
  const body = header.nextElementSibling;
  header.classList.toggle('collapsed');
  body.classList.toggle('hidden');
}

function preparePrint() {
  // 1. Expand all collapsed sections
  const collapsedHeaders = document.querySelectorAll('.section-header.collapsed');
  const hiddenBodies = document.querySelectorAll('.section-body.hidden');
  collapsedHeaders.forEach(h => h.classList.remove('collapsed'));
  hiddenBodies.forEach(b => b.classList.remove('hidden'));

  // 2. Force bar animations to end state
  document.querySelectorAll('.bar-fill').forEach(bar => {
    bar.style.animation = 'none';
    bar.style.transform = 'scaleX(1)';
  });

  // 3. Small delay to let browser reflow, then print
  setTimeout(() => {
    window.print();

    // 4. Restore collapsed state after print dialog closes
    setTimeout(() => {
      collapsedHeaders.forEach(h => h.classList.add('collapsed'));
      hiddenBodies.forEach(b => b.classList.add('hidden'));
      document.querySelectorAll('.bar-fill').forEach(bar => {
        bar.style.animation = '';
        bar.style.transform = '';
      });
    }, 500);
  }, 100);
}
</script>
</body>
</html>`;
}
