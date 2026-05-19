'use client';

/**
 * Módulo de Prefactibilidad Inmobiliaria — Modelo CREDICORP
 * Replica la hoja "prefactibilidad CREDICORP" del Excel EJEMPLO.xlsx
 * Cálculos en tiempo real · Cifras en miles de COP (÷1000 para mostrar)
 */

import { Download, RefreshCw, Save, Trash2 } from 'lucide-react';
import { useMemo, useState } from 'react';

import { ModuleHeader } from '@/components/module-header';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  calculate,
  ci,
  DEFAULT_INPUTS,
  fmtMiles,
  fmtPct,
  type CostItem,
  type FeasibilityInputs,
  type LineResult,
} from '@/lib/feasibility-engine';

// ─── Helpers de UI ────────────────────────────────────────────────────────────

/** Formatea COP completo → miles con separador de miles CO */
const toMiles = (cop: number) =>
  cop === 0 ? '—' : new Intl.NumberFormat('es-CO').format(Math.round(cop / 1000));

/** Lee un string y devuelve COP (el usuario escribe en miles) */
const parseMiles = (s: string) =>
  Math.round((parseFloat(s.replace(/[^0-9.-]/g, '')) || 0) * 1000);

/** Clamp para no permitir negativos */
const clamp0 = (n: number) => Math.max(0, n);

// ─── Inputs numéricos de moneda (en miles de COP) ─────────────────────────────

function CopInput({
  value, onChange, className = '',
}: {
  value: number;       // COP completo internamente
  onChange: (v: number) => void;
  className?: string;
}) {
  const [editing, setEditing] = useState(false);
  const [raw, setRaw]         = useState('');

  const display = value === 0 ? '' : String(Math.round(value / 1000));

  return (
    <Input
      type="text"
      inputMode="numeric"
      value={editing ? raw : display}
      onFocus={() => { setEditing(true); setRaw(display); }}
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

/** Input para CostItem (Fideicomiso + Constructor) */
function CostItemInputs({
  value, onChange,
}: {
  value: CostItem;
  onChange: (v: CostItem) => void;
}) {
  return (
    <>
      <CopInput value={value.fid} onChange={(fid) => onChange({ ...value, fid })} />
      <CopInput value={value.con} onChange={(con) => onChange({ ...value, con })} />
    </>
  );
}

// ─── Fila calculada de la tabla de costos ─────────────────────────────────────

type RowVariant = 'header' | 'subheader' | 'sub' | 'total' | 'utilidad' | 'ventas';

function CostRow({
  label, result, variant = 'sub', indent = false,
}: {
  label:    string;
  result:   LineResult;
  variant?: RowVariant;
  indent?:  boolean;
}) {
  const bg =
    variant === 'header'   ? 'bg-slate-700 text-white font-bold' :
    variant === 'subheader'? 'bg-slate-100 font-semibold text-slate-800' :
    variant === 'total'    ? 'bg-blue-900  text-white font-bold' :
    variant === 'utilidad' ? 'bg-green-700 text-white font-bold' :
    variant === 'ventas'   ? 'bg-slate-600 text-white font-semibold' :
    'hover:bg-slate-50';

  const numCls = `text-right font-mono tabular-nums text-xs ${variant === 'sub' ? 'text-slate-700' : ''}`;

  return (
    <tr className={`border-b border-slate-100 last:border-0 ${bg}`}>
      <td className={`py-1.5 pr-3 text-xs ${indent ? 'pl-8' : 'pl-3'} ${variant === 'sub' ? 'text-slate-600' : ''}`}>
        {indent && <span className="mr-1 text-slate-400">·</span>}
        {label}
      </td>
      <td className={`py-1.5 px-2 ${numCls}`}>{toMiles(result.fid)}</td>
      <td className={`py-1.5 px-2 ${numCls}`}>{result.con > 0 ? toMiles(result.con) : (result.fid > 0 ? '—' : '—')}</td>
      <td className={`py-1.5 px-2 ${numCls} font-semibold`}>{toMiles(result.total)}</td>
      <td className={`py-1.5 pl-2 pr-3 text-right text-xs font-mono ${variant === 'sub' ? 'text-slate-500' : ''}`}>
        {result.pctSales > 0 ? fmtPct(result.pctSales) : '—'}
      </td>
    </tr>
  );
}

// ─── Fila editable de la tabla de costos ──────────────────────────────────────

function EditableCostRow({
  label, value, result, onChange, indent = false,
}: {
  label:    string;
  value:    CostItem;
  result:   LineResult;
  onChange: (v: CostItem) => void;
  indent?:  boolean;
}) {
  return (
    <tr className="border-b border-slate-100 hover:bg-blue-50/30 group">
      <td className={`py-1 pr-3 text-xs text-slate-600 ${indent ? 'pl-8' : 'pl-3'}`}>
        {indent && <span className="mr-1 text-slate-400">·</span>}{label}
      </td>
      <td className="py-1 px-1.5">
        <CopInput value={value.fid} onChange={(fid) => onChange({ ...value, fid })} />
      </td>
      <td className="py-1 px-1.5">
        <CopInput value={value.con} onChange={(con) => onChange({ ...value, con })} />
      </td>
      <td className="py-1.5 px-2 text-right font-mono tabular-nums text-xs font-semibold text-slate-800">
        {toMiles(result.total)}
      </td>
      <td className="py-1.5 pl-2 pr-3 text-right text-xs font-mono text-slate-500">
        {result.pctSales > 0 ? fmtPct(result.pctSales) : '—'}
      </td>
    </tr>
  );
}

// ─── Datos por defecto ────────────────────────────────────────────────────────

const DEFAULTS = DEFAULT_INPUTS;

// ─── Página principal ─────────────────────────────────────────────────────────

export default function FeasibilityPage({ params }: { params: { id: string } }) {
  // ── Estado de entradas ──────────────────────────────────────────────────
  const [inputs, setInputs] = useState<FeasibilityInputs>(DEFAULTS);

  const set = <K extends keyof FeasibilityInputs>(key: K, val: FeasibilityInputs[K]) =>
    setInputs((prev) => ({ ...prev, [key]: val }));

  const setCost = (key: keyof FeasibilityInputs, val: CostItem) =>
    setInputs((prev) => ({ ...prev, [key]: val }));

  // ── Cálculo en tiempo real ──────────────────────────────────────────────
  const r = useMemo(() => calculate(inputs), [inputs]);

  // ── Exportar reporte HTML ───────────────────────────────────────────────
  const handleExport = () => {
    const html = buildHtmlReport(inputs, r);
    const blob = new Blob([html], { type: 'text/html; charset=utf-8' });
    const url  = URL.createObjectURL(blob);
    window.open(url, '_blank');
    setTimeout(() => URL.revokeObjectURL(url), 60_000);
  };

  // ── Resetear ────────────────────────────────────────────────────────────
  const handleReset = () => {
    if (confirm('¿Restablecer todos los valores al ejemplo de referencia (Santa Isabel)?')) {
      setInputs(DEFAULTS);
    }
  };

  // ─── Render ────────────────────────────────────────────────────────────
  return (
    <div className="space-y-5 pb-10">
      <ModuleHeader
        title="Prefactibilidad — Modelo CREDICORP"
        description="Motor de cálculo financiero · Estructura de costos · Fuentes y Usos · Indicadores"
        infoText="Replica exactamente la hoja 'prefactibilidad CREDICORP' del Excel EJEMPLO.xlsx. Todos los campos son editables. Los cálculos se actualizan en tiempo real. Cifras en miles de COP."
        actions={
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={handleReset}>
              <RefreshCw className="mr-1 h-3.5 w-3.5" /> Restablecer
            </Button>
            <Button size="sm" onClick={handleExport} className="bg-blue-700 hover:bg-blue-800 text-white">
              <Download className="mr-1 h-3.5 w-3.5" /> Exportar HTML
            </Button>
          </div>
        }
      />

      {/* ═══════════════════════════════════════════════════════════════ */}
      {/* 1. DATOS GENERALES                                             */}
      {/* ═══════════════════════════════════════════════════════════════ */}
      <Card>
        <CardHeader className="pb-2 pt-4">
          <CardTitle className="text-sm font-bold uppercase tracking-wider text-blue-800">
            Datos Generales del Proyecto
          </CardTitle>
        </CardHeader>
        <CardContent className="pb-4">
          <div className="grid grid-cols-2 gap-x-6 gap-y-3 sm:grid-cols-3 lg:grid-cols-4">

            {/* Col 1 */}
            <Field label="Promotor">
              <Input value={inputs.promoter} onChange={(e) => set('promoter', e.target.value)} className="h-7 text-sm" />
            </Field>
            <Field label="Proyecto">
              <Input value={inputs.projectName} onChange={(e) => set('projectName', e.target.value)} className="h-7 text-sm" />
            </Field>
            <Field label="Ciudad">
              <Input value={inputs.city} onChange={(e) => set('city', e.target.value)} className="h-7 text-sm" />
            </Field>
            <Field label="Sistema constructivo">
              <Input value={inputs.constructionSystem} onChange={(e) => set('constructionSystem', e.target.value)} className="h-7 text-sm" />
            </Field>

            {/* Col 2 */}
            <Field label="# Total unidades">
              <Input type="number" min={1} value={inputs.totalUnits}
                onChange={(e) => set('totalUnits', Number(e.target.value) || 0)}
                className="h-7 text-sm text-right font-mono" />
            </Field>
            <Field label="Estrato">
              <Input type="number" min={1} max={6} value={inputs.stratum}
                onChange={(e) => set('stratum', Number(e.target.value) || 1)}
                className="h-7 text-sm text-right font-mono" />
            </Field>
            <Field label="Parqueaderos">
              <Input value={inputs.parkingType} onChange={(e) => set('parkingType', e.target.value)} className="h-7 text-sm" />
            </Field>
            <Field label="M² construido">
              <Input type="number" min={0} step={0.01} value={inputs.builtAreaM2}
                onChange={(e) => set('builtAreaM2', parseFloat(e.target.value) || 0)}
                className="h-7 text-sm text-right font-mono" />
            </Field>

            {/* Col 3 */}
            <Field label="Factor área vendible">
              <div className="flex items-center gap-1.5">
                <Input type="number" min={0.5} max={3} step={0.001}
                  value={inputs.saleableFactorPct}
                  onChange={(e) => set('saleableFactorPct', parseFloat(e.target.value) || 1)}
                  className="h-7 text-sm text-right font-mono flex-1" />
                <span className="text-xs text-muted-foreground">×m²c</span>
              </div>
            </Field>
            <Field label="M² vendibles (calculado)">
              <div className="h-7 rounded-md border border-slate-200 bg-slate-50 px-2 flex items-center">
                <span className="text-sm font-mono font-semibold text-blue-700">
                  {r.saleableAreaM2.toLocaleString('es-CO', { maximumFractionDigits: 2 })} m²
                </span>
              </div>
            </Field>
            <Field label="Valor ventas totales (miles COP)">
              <CopInput value={inputs.totalSales}
                onChange={(v) => set('totalSales', v)}
                className="h-7 border-blue-300 bg-blue-50 font-bold text-blue-800" />
            </Field>
            <Field label="Vlr M² vendible (calculado)">
              <div className="h-7 rounded-md border border-slate-200 bg-slate-50 px-2 flex items-center">
                <span className="text-sm font-mono font-semibold text-blue-700">
                  ${r.pricePerM2 > 0
                    ? new Intl.NumberFormat('es-CO', { maximumFractionDigits: 0 }).format(r.pricePerM2)
                    : '—'} /m²
                </span>
              </div>
            </Field>

            {/* Parámetros de fuentes */}
            <Field label="Cuota inicial % (s/ventas)">
              <div className="flex items-center gap-1.5">
                <Input type="number" min={0} max={100} step={0.5}
                  value={Math.round(inputs.initialPaymentPct * 100)}
                  onChange={(e) => set('initialPaymentPct', (parseFloat(e.target.value) || 0) / 100)}
                  className="h-7 text-sm text-right font-mono flex-1" />
                <span className="text-xs text-muted-foreground">%</span>
              </div>
            </Field>
            <Field label="% Crédito constructor (s/usos)">
              <div className="flex items-center gap-1.5">
                <Input type="number" min={0} max={100} step={0.5}
                  value={Math.round(inputs.creditPct * 100 * 10) / 10}
                  onChange={(e) => set('creditPct', (parseFloat(e.target.value) || 0) / 100)}
                  className="h-7 text-sm text-right font-mono flex-1" />
                <span className="text-xs text-muted-foreground">%</span>
              </div>
            </Field>
            <Field label="% Lote (s/ventas)">
              <div className="flex items-center gap-1.5">
                <Input type="number" min={0} max={50} step={0.1}
                  value={Math.round(inputs.lotePct * 100 * 10) / 10}
                  onChange={(e) => set('lotePct', (parseFloat(e.target.value) || 0) / 100)}
                  className="h-7 text-sm text-right font-mono flex-1" />
                <span className="text-xs text-muted-foreground">%</span>
              </div>
            </Field>
            <Field label="Otras fuentes (miles COP)">
              <CopInput value={inputs.otherSources}
                onChange={(v) => set('otherSources', v)} />
            </Field>
          </div>
        </CardContent>
      </Card>

      {/* ═══════════════════════════════════════════════════════════════ */}
      {/* 2. ESTRUCTURA DE COSTOS (tabla principal)                      */}
      {/* ═══════════════════════════════════════════════════════════════ */}
      <Card className="overflow-hidden">
        <CardHeader className="bg-slate-700 text-white px-4 py-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-bold tracking-wide">
              ESTRUCTURA DE COSTOS — Aportes a través de
            </CardTitle>
            <span className="text-[10px] text-slate-300 italic">Cifras en miles de COP</span>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-slate-800 text-white">
                  <th className="py-2 pl-3 pr-3 text-left font-semibold w-[40%]">CONCEPTO</th>
                  <th className="py-2 px-2 text-right font-semibold w-[15%]">FIDEICOMISO</th>
                  <th className="py-2 px-2 text-right font-semibold w-[15%]">CONSTRUCTOR</th>
                  <th className="py-2 px-2 text-right font-semibold w-[15%]">TOTAL</th>
                  <th className="py-2 pl-2 pr-3 text-right font-semibold w-[15%]">% S/VENTAS</th>
                </tr>
              </thead>
              <tbody>
                {/* LOTE */}
                <tr className="bg-amber-50 border-b border-amber-100">
                  <td className="py-1.5 pl-3 pr-3 font-semibold text-amber-900">
                    LOTE ({(inputs.lotePct * 100).toFixed(1)}% s/ventas)
                  </td>
                  <td className="py-1.5 px-2 text-right font-mono font-semibold text-amber-800">
                    {toMiles(r.lote.fid)}
                  </td>
                  <td className="py-1.5 px-2 text-right font-mono text-slate-400">—</td>
                  <td className="py-1.5 px-2 text-right font-mono font-bold text-amber-900">
                    {toMiles(r.lote.total)}
                  </td>
                  <td className="py-1.5 pl-2 pr-3 text-right font-mono text-amber-700">
                    {fmtPct(r.lote.pctSales)}
                  </td>
                </tr>

                {/* URBANISMO */}
                <tr className="bg-orange-50 border-b border-orange-100">
                  <td className="py-1 pl-3 pr-3 font-semibold text-orange-900">URBANISMO</td>
                  <td className="py-1 px-1.5">
                    <CopInput value={inputs.urbanismo.fid}
                      onChange={(fid) => setCost('urbanismo', { ...inputs.urbanismo, fid })} />
                  </td>
                  <td className="py-1 px-1.5">
                    <CopInput value={inputs.urbanismo.con}
                      onChange={(con) => setCost('urbanismo', { ...inputs.urbanismo, con })} />
                  </td>
                  <td className="py-1.5 px-2 text-right font-mono font-bold text-orange-900">
                    {toMiles(r.urbanismo.total)}
                  </td>
                  <td className="py-1.5 pl-2 pr-3 text-right font-mono text-orange-700">
                    {fmtPct(r.urbanismo.pctSales)}
                  </td>
                </tr>

                {/* COSTOS DIRECTOS */}
                <tr className="bg-blue-50 border-b border-blue-100">
                  <td className="py-1 pl-3 pr-3 font-semibold text-blue-900">COSTOS DIRECTOS (EDIFICACIONES)</td>
                  <td className="py-1 px-1.5">
                    <CopInput value={inputs.directos.fid}
                      onChange={(fid) => setCost('directos', { ...inputs.directos, fid })} />
                  </td>
                  <td className="py-1 px-1.5">
                    <CopInput value={inputs.directos.con}
                      onChange={(con) => setCost('directos', { ...inputs.directos, con })} />
                  </td>
                  <td className="py-1.5 px-2 text-right font-mono font-bold text-blue-900">
                    {toMiles(r.directos.total)}
                  </td>
                  <td className="py-1.5 pl-2 pr-3 text-right font-mono text-blue-700">
                    {fmtPct(r.directos.pctSales)}
                  </td>
                </tr>

                {/* COSTOS INDIRECTOS — header */}
                <tr className="bg-purple-100 border-b border-purple-200">
                  <td className="py-1.5 pl-3 font-bold text-purple-900">COSTOS INDIRECTOS</td>
                  <td className="py-1.5 px-2 text-right font-mono font-bold text-purple-800">{toMiles(r.indirectos.subtotal.fid)}</td>
                  <td className="py-1.5 px-2 text-right font-mono font-bold text-purple-800">{toMiles(r.indirectos.subtotal.con)}</td>
                  <td className="py-1.5 px-2 text-right font-mono font-bold text-purple-900">{toMiles(r.indirectos.subtotal.total)}</td>
                  <td className="py-1.5 pl-2 pr-3 text-right font-mono text-purple-700">{fmtPct(r.indirectos.subtotal.pctSales)}</td>
                </tr>

                {([
                  ['honorariosAdmin',   'Honorarios Administración y Construcción'],
                  ['disenoEstudios',    'Diseño, Estudios Técnicos, Asesorías'],
                  ['interventoria',     'Interventoría y Supervisión Estructural'],
                  ['licencias',         'Licencias (Urbanismo, Construcción, Ambiental)'],
                  ['seguros',           'Seguros'],
                  ['derechosImpuestos', 'Derechos e Impuestos'],
                  ['conexionServicios', 'Conexión de Servicios'],
                  ['imprevistos',       'Imprevistos'],
                  ['previsionAlza',     'Previsión al Alza'],
                ] as const).map(([key, label]) => (
                  <EditableCostRow
                    key={key} label={label} indent
                    value={inputs[key] as CostItem}
                    result={r.indirectos[key]}
                    onChange={(v) => setCost(key, v)}
                  />
                ))}

                {/* COSTOS FINANCIEROS — header */}
                <tr className="bg-red-100 border-b border-red-200">
                  <td className="py-1.5 pl-3 font-bold text-red-900">COSTOS FINANCIEROS</td>
                  <td className="py-1.5 px-2 text-right font-mono font-bold text-red-800">{toMiles(r.financieros.subtotal.fid)}</td>
                  <td className="py-1.5 px-2 text-right font-mono font-bold text-red-800">{toMiles(r.financieros.subtotal.con)}</td>
                  <td className="py-1.5 px-2 text-right font-mono font-bold text-red-900">{toMiles(r.financieros.subtotal.total)}</td>
                  <td className="py-1.5 pl-2 pr-3 text-right font-mono text-red-700">{fmtPct(r.financieros.subtotal.pctSales)}</td>
                </tr>
                {([
                  ['fiducia',          'Fiducia'],
                  ['interesesCredito', 'Intereses Crédito (Constructor, Puentes)'],
                ] as const).map(([key, label]) => (
                  <EditableCostRow
                    key={key} label={label} indent
                    value={inputs[key] as CostItem}
                    result={r.financieros[key]}
                    onChange={(v) => setCost(key, v)}
                  />
                ))}

                {/* COSTOS DE VENTAS — header */}
                <tr className="bg-green-100 border-b border-green-200">
                  <td className="py-1.5 pl-3 font-bold text-green-900">COSTOS DE VENTAS</td>
                  <td className="py-1.5 px-2 text-right font-mono font-bold text-green-800">{toMiles(r.ventasCostos.subtotal.fid)}</td>
                  <td className="py-1.5 px-2 text-right font-mono font-bold text-green-800">{toMiles(r.ventasCostos.subtotal.con)}</td>
                  <td className="py-1.5 px-2 text-right font-mono font-bold text-green-900">{toMiles(r.ventasCostos.subtotal.total)}</td>
                  <td className="py-1.5 pl-2 pr-3 text-right font-mono text-green-700">{fmtPct(r.ventasCostos.subtotal.pctSales)}</td>
                </tr>
                {([
                  ['honorariosVentas',     'Honorarios de Ventas'],
                  ['honorariosGerencia',   'Honorarios de Gerencia'],
                  ['disenoArquitectonico', 'Honorarios Diseño/Arquitectónicos'],
                  ['publicidad',           'Promoción y Publicidad'],
                  ['notariales',           'Notariales (Escrituración, Transferencia lote)'],
                ] as const).map(([key, label]) => (
                  <EditableCostRow
                    key={key} label={label} indent
                    value={inputs[key] as CostItem}
                    result={r.ventasCostos[key]}
                    onChange={(v) => setCost(key, v)}
                  />
                ))}

                {/* TOTAL USOS */}
                <tr className="bg-slate-800 text-white font-bold border-t-2 border-slate-600">
                  <td className="py-2.5 pl-3">TOTAL USOS</td>
                  <td className="py-2.5 px-2 text-right font-mono">{toMiles(r.totalUsos.fid)}</td>
                  <td className="py-2.5 px-2 text-right font-mono">{toMiles(r.totalUsos.con)}</td>
                  <td className="py-2.5 px-2 text-right font-mono text-blue-300">{toMiles(r.totalUsos.total)}</td>
                  <td className="py-2.5 pl-2 pr-3 text-right font-mono text-blue-300">{fmtPct(r.totalUsos.pctSales)}</td>
                </tr>

                {/* VENTAS TOTALES */}
                <tr className="bg-slate-600 text-white font-semibold">
                  <td className="py-2 pl-3">VENTAS / APORTES TOTALES</td>
                  <td className="py-2 px-2 text-right font-mono">{toMiles(r.totalSales)}</td>
                  <td className="py-2 px-2 text-right font-mono text-slate-300">—</td>
                  <td className="py-2 px-2 text-right font-mono">{toMiles(r.totalSales)}</td>
                  <td className="py-2 pl-2 pr-3 text-right font-mono">100,00%</td>
                </tr>

                {/* UTILIDAD */}
                <tr className={`font-bold border-t-2 ${r.utilidad >= 0 ? 'bg-green-700' : 'bg-red-700'} text-white`}>
                  <td className="py-2.5 pl-3">
                    UTILIDAD ESTIMADA
                    <span className="ml-2 text-[10px] font-normal opacity-80">(miles COP)</span>
                  </td>
                  <td className="py-2.5 px-2" />
                  <td className="py-2.5 px-2" />
                  <td className="py-2.5 px-2 text-right font-mono text-lg">
                    {new Intl.NumberFormat('es-CO', { maximumFractionDigits: 0 }).format(Math.round(r.utilidadMiles))}
                  </td>
                  <td className={`py-2.5 pl-2 pr-3 text-right font-mono ${r.utilidadPct >= 0.12 ? 'text-green-200' : 'text-yellow-200'}`}>
                    {fmtPct(r.utilidadPct)}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* ═══════════════════════════════════════════════════════════════ */}
      {/* 3. RESUMEN + FUENTES Y USOS                                    */}
      {/* ═══════════════════════════════════════════════════════════════ */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">

        {/* Resumen de costos */}
        <Card>
          <CardHeader className="pb-2 pt-3 bg-slate-700 text-white rounded-t-xl">
            <CardTitle className="text-xs font-bold tracking-wider">RESUMEN DE COSTOS</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-slate-100 text-slate-600">
                  <th className="py-1.5 pl-3 text-left font-semibold">Concepto</th>
                  <th className="py-1.5 pr-3 text-right font-semibold">Miles COP</th>
                  <th className="py-1.5 pr-3 text-right font-semibold">% Ventas</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {[
                  { label: 'Lote',                 val: r.lote.total,               pct: r.lote.pctSales,               color: 'text-amber-700'  },
                  { label: 'Urbanismo',             val: r.urbanismo.total,          pct: r.urbanismo.pctSales,          color: 'text-orange-700' },
                  { label: 'Costos Directos',       val: r.directos.total,           pct: r.directos.pctSales,           color: 'text-blue-700'   },
                  { label: 'Costos Indirectos',     val: r.indirectos.subtotal.total,pct: r.indirectos.subtotal.pctSales,color: 'text-purple-700' },
                  { label: 'Costos Financieros',   val: r.financieros.subtotal.total,pct: r.financieros.subtotal.pctSales,color:'text-red-700'   },
                  { label: 'Costos de Ventas',     val: r.ventasCostos.subtotal.total,pct:r.ventasCostos.subtotal.pctSales,color:'text-green-700'},
                ].map(({ label, val, pct, color }) => (
                  <tr key={label} className="hover:bg-slate-50">
                    <td className={`py-2 pl-3 ${color} font-medium`}>{label}</td>
                    <td className="py-2 pr-3 text-right font-mono">{toMiles(val)}</td>
                    <td className="py-2 pr-3 text-right font-mono text-slate-500">{fmtPct(pct)}</td>
                  </tr>
                ))}
                <tr className="bg-slate-800 text-white font-bold">
                  <td className="py-2 pl-3">TOTAL USOS</td>
                  <td className="py-2 pr-3 text-right font-mono">{toMiles(r.totalUsos.total)}</td>
                  <td className="py-2 pr-3 text-right font-mono">{fmtPct(r.totalUsos.pctSales)}</td>
                </tr>
                <tr className="bg-slate-100 text-slate-600">
                  <td className="py-2 pl-3 text-xs">Total costos sin lote</td>
                  <td className="py-2 pr-3 text-right font-mono">{toMiles(r.totalCostSinLote)}</td>
                  <td className="py-2 pr-3 text-right font-mono">{fmtPct(r.totalCostSinLote / r.totalSales)}</td>
                </tr>
              </tbody>
            </table>
          </CardContent>
        </Card>

        {/* Fuentes y Usos */}
        <Card>
          <CardHeader className="pb-2 pt-3 bg-blue-800 text-white rounded-t-xl">
            <CardTitle className="text-xs font-bold tracking-wider">FUENTES Y USOS — Cuadre de financiación</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-blue-100 text-blue-800">
                  <th className="py-1.5 pl-3 text-left font-semibold">Fuente</th>
                  <th className="py-1.5 pr-3 text-right font-semibold">Miles COP</th>
                  <th className="py-1.5 pr-3 text-right font-semibold">% Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {[
                  { label: 'Aporte de Socios (patrimonio)',   val: r.aportesSocios,      color: 'text-indigo-700' },
                  { label: 'Crédito Constructor',            val: r.creditoConstructor, color: 'text-blue-700'   },
                  { label: `Cuotas Iniciales (${Math.round(inputs.initialPaymentPct*100)}% s/ventas)`, val: r.cuotasIniciales, color: 'text-teal-700' },
                  { label: 'Otras Fuentes',                  val: r.totalSales - r.aportesSocios - r.creditoConstructor - r.cuotasIniciales, color: 'text-slate-500' },
                ].map(({ label, val, color }) => (
                  <tr key={label} className="hover:bg-slate-50">
                    <td className={`py-2 pl-3 ${color} font-medium`}>{label}</td>
                    <td className="py-2 pr-3 text-right font-mono">{toMiles(val)}</td>
                    <td className="py-2 pr-3 text-right font-mono text-slate-500">
                      {r.totalUsos.total > 0 ? fmtPct(val / r.totalUsos.total) : '—'}
                    </td>
                  </tr>
                ))}
                <tr className="bg-blue-800 text-white font-bold">
                  <td className="py-2 pl-3">TOTAL FUENTES</td>
                  <td className="py-2 pr-3 text-right font-mono">{toMiles(r.totalFuentes)}</td>
                  <td className="py-2 pr-3 text-right font-mono">100,00%</td>
                </tr>
                <tr className="bg-slate-800 text-white font-bold">
                  <td className="py-2 pl-3">TOTAL USOS</td>
                  <td className="py-2 pr-3 text-right font-mono">{toMiles(r.totalUsos.total)}</td>
                  <td className="py-2 pr-3 text-right font-mono">{fmtPct(r.totalUsos.pctSales)}</td>
                </tr>
                <tr className={`font-bold ${Math.abs(r.balance) < 1000 ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-800'}`}>
                  <td className="py-2 pl-3 text-xs">Balance Fuentes − Usos</td>
                  <td className="py-2 pr-3 text-right font-mono">
                    {toMiles(Math.abs(r.balance))} {r.balance < 0 ? '(déficit)' : '(superávit)'}
                  </td>
                  <td className="py-2 pr-3 text-right font-mono">
                    {Math.abs(r.balance) < 1000 ? '✓ Cuadrado' : '⚠ Revisar'}
                  </td>
                </tr>
              </tbody>
            </table>
          </CardContent>
        </Card>
      </div>

      {/* ═══════════════════════════════════════════════════════════════ */}
      {/* 4. INDICADORES FINANCIEROS                                     */}
      {/* ═══════════════════════════════════════════════════════════════ */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {[
          {
            label: 'Utilidad estimada',
            value: `$${toMiles(r.utilidad)}`,
            sub:   'miles COP',
            color: r.utilidad >= 0 ? 'text-green-700' : 'text-red-700',
            bg:    r.utilidad >= 0 ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200',
          },
          {
            label: '% Margen s/ventas',
            value: fmtPct(r.utilidadPct),
            sub:   r.utilidadPct >= 0.12 ? '✓ Viable (≥12%)' : '⚠ Bajo (<12%)',
            color: r.utilidadPct >= 0.12 ? 'text-green-700' : 'text-amber-700',
            bg:    r.utilidadPct >= 0.12 ? 'bg-green-50 border-green-200' : 'bg-amber-50 border-amber-200',
          },
          {
            label: 'ROI s/inversión',
            value: `${r.roi.toFixed(1)}%`,
            sub:   'utilidad / usos totales',
            color: 'text-blue-700',
            bg:    'bg-blue-50 border-blue-200',
          },
          {
            label: 'Punto equilibrio',
            value: `${r.breakEvenUnits} uds`,
            sub:   `${fmtPct(r.breakEvenPct)} de ${inputs.totalUnits}`,
            color: r.breakEvenPct <= 0.9 ? 'text-teal-700' : 'text-red-700',
            bg:    r.breakEvenPct <= 0.9 ? 'bg-teal-50 border-teal-200' : 'bg-red-50 border-red-200',
          },
          {
            label: 'Precio / unidad',
            value: `$${toMiles(r.pricePerUnit)}`,
            sub:   'miles COP / unidad',
            color: 'text-slate-700',
            bg:    'bg-slate-50 border-slate-200',
          },
          {
            label: 'Costo / m² vendible',
            value: `$${r.saleableAreaM2 > 0
              ? new Intl.NumberFormat('es-CO', { maximumFractionDigits: 0 }).format(r.totalUsos.total / r.saleableAreaM2)
              : '—'}`,
            sub:   'COP / m²',
            color: 'text-slate-700',
            bg:    'bg-slate-50 border-slate-200',
          },
        ].map(({ label, value, sub, color, bg }) => (
          <div key={label} className={`rounded-xl border px-3 py-3 ${bg}`}>
            <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-wide leading-tight mb-1">{label}</p>
            <p className={`text-lg font-bold leading-none ${color}`}>{value}</p>
            <p className="text-[10px] text-muted-foreground mt-1">{sub}</p>
          </div>
        ))}
      </div>

      {/* ═══════════════════════════════════════════════════════════════ */}
      {/* 5. NOTA METODOLÓGICA                                           */}
      {/* ═══════════════════════════════════════════════════════════════ */}
      <Card className="bg-slate-50 border-slate-200">
        <CardContent className="pt-3 pb-3">
          <p className="text-[11px] text-slate-500 leading-relaxed">
            <span className="font-semibold text-slate-600">Fórmulas aplicadas:</span>{' '}
            Lote = %Lote × Ventas · M²Vendibles = M²Construido × Factor ·
            Vlr/m² = Ventas ÷ M²Vendibles · Total Usos = Σ(todos los costos) ·
            Utilidad = Ventas − Total Usos · Cuotas Iniciales = %CuotaInicial × Ventas ·
            Crédito Constructor = %Crédito × Total Usos · Aporte Socios = Total Usos − Cuotas − Crédito − Otras ·
            Punto Equilibrio (uds) = ⌈Total Usos ÷ (Ventas ÷ #Unidades)⌉ ·
            ROI = Utilidad ÷ Total Usos × 100.{' '}
            <span className="text-amber-600 font-medium">Cifras en miles de COP</span> según modelo CREDICORP.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

// ─── Componente auxiliar Field ────────────────────────────────────────────────

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <Label className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">
        {label}
      </Label>
      {children}
    </div>
  );
}

// ─── Generador de reporte HTML ────────────────────────────────────────────────

function buildHtmlReport(inp: FeasibilityInputs, r: ReturnType<typeof calculate>): string {
  const fmtK = (n: number) =>
    new Intl.NumberFormat('es-CO').format(Math.round(n / 1000));

  const row = (label: string, fid: number, con: number, total: number, pct: number, indent = false) => `
    <tr>
      <td style="padding:4px 8px;${indent ? 'padding-left:24px;color:#555' : 'font-weight:600'}">${indent ? '· ' : ''}${label}</td>
      <td style="padding:4px 8px;text-align:right;font-family:monospace">${fmtK(fid)}</td>
      <td style="padding:4px 8px;text-align:right;font-family:monospace">${fmtK(con)}</td>
      <td style="padding:4px 8px;text-align:right;font-family:monospace;font-weight:600">${fmtK(total)}</td>
      <td style="padding:4px 8px;text-align:right;font-family:monospace;color:#64748b">${pct > 0 ? fmtPct(pct) : '—'}</td>
    </tr>`;

  const subHdr = (label: string, fid: number, con: number, total: number, pct: number, bg: string) => `
    <tr style="background:${bg};font-weight:700">
      <td style="padding:6px 8px">${label}</td>
      <td style="padding:6px 8px;text-align:right;font-family:monospace">${fmtK(fid)}</td>
      <td style="padding:6px 8px;text-align:right;font-family:monospace">${fmtK(con)}</td>
      <td style="padding:6px 8px;text-align:right;font-family:monospace">${fmtK(total)}</td>
      <td style="padding:6px 8px;text-align:right;font-family:monospace">${fmtPct(pct)}</td>
    </tr>`;

  return `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<title>Prefactibilidad — ${inp.projectName}</title>
<style>
  body { font-family: Arial, sans-serif; font-size: 12px; background:#f1f5f9; margin:0; }
  .page { max-width:1000px; margin:24px auto; background:#fff; border-radius:10px; overflow:hidden; box-shadow:0 4px 24px rgba(0,0,0,.12); }
  .hdr { background:linear-gradient(135deg,#1e3a8a,#2563eb); color:#fff; padding:28px 36px 22px; }
  .hdr-top { display:flex; justify-content:space-between; align-items:center; margin-bottom:14px; }
  .hdr-title { font-size:22px; font-weight:700; }
  .hdr-badge { background:rgba(255,255,255,.18); border:1px solid rgba(255,255,255,.3); border-radius:16px; padding:3px 12px; font-size:10px; font-weight:700; letter-spacing:.8px; text-transform:uppercase; }
  .meta { background:#f8fafc; border-bottom:1px solid #e5e7eb; padding:12px 36px; display:grid; grid-template-columns:repeat(4,1fr); gap:12px; }
  .meta-lbl { font-size:9px; font-weight:700; text-transform:uppercase; letter-spacing:.7px; color:#6b7280; }
  .meta-val { font-size:13px; font-weight:600; color:#111; margin-top:2px; }
  .body { padding:28px 36px; }
  .section-title { font-size:10px; font-weight:700; text-transform:uppercase; letter-spacing:1px; color:#1e40af; border-bottom:2px solid #dbeafe; padding-bottom:6px; margin:20px 0 10px; }
  table { width:100%; border-collapse:collapse; font-size:11px; }
  thead th { background:#1e3a8a; color:#fff; padding:7px 8px; text-align:left; font-size:10px; letter-spacing:.4px; }
  tbody tr:nth-child(even) { background:#f8fafc; }
  tbody tr td { border-bottom:1px solid #e5e7eb; }
  .kpi-grid { display:grid; grid-template-columns:repeat(3,1fr); gap:12px; margin:16px 0; }
  .kpi { background:#f8fafc; border:1px solid #e5e7eb; border-radius:8px; padding:12px 16px; }
  .kpi-lbl { font-size:9px; text-transform:uppercase; letter-spacing:.6px; color:#6b7280; }
  .kpi-val { font-size:18px; font-weight:700; margin-top:4px; }
  .green { color:#15803d; } .amber { color:#b45309; } .blue { color:#1d4ed8; }
  .footer { border-top:1px solid #e5e7eb; padding:14px 36px; background:#f8fafc; font-size:10px; color:#9ca3af; display:flex; justify-content:space-between; }
  @media print { body { background:white; } .page { margin:0; border-radius:0; box-shadow:none; } }
</style>
</head>
<body>
<div class="page">
  <div class="hdr">
    <div class="hdr-top">
      <div>
        <div style="font-size:12px;opacity:.8;margin-bottom:4px">${inp.promoter}</div>
        <div class="hdr-title">${inp.projectName}</div>
      </div>
      <div class="hdr-badge">Prefactibilidad CREDICORP</div>
    </div>
    <div style="font-size:11px;opacity:.7">Cifras en miles de COP · ${new Date().toLocaleDateString('es-CO', { day: '2-digit', month: 'long', year: 'numeric' })}</div>
  </div>

  <div class="meta">
    <div><div class="meta-lbl">Ciudad</div><div class="meta-val">${inp.city}</div></div>
    <div><div class="meta-lbl"># Unidades</div><div class="meta-val">${inp.totalUnits} uds · Est. ${inp.stratum}</div></div>
    <div><div class="meta-lbl">M² Vendibles</div><div class="meta-val">${r.saleableAreaM2.toLocaleString('es-CO', { maximumFractionDigits: 1 })} m²</div></div>
    <div><div class="meta-lbl">Sistema constructivo</div><div class="meta-val">${inp.constructionSystem}</div></div>
  </div>

  <div class="body">

    <div class="section-title">Estructura de Costos</div>
    <table>
      <thead><tr><th style="width:40%">CONCEPTO</th><th style="width:15%;text-align:right">FIDEICOMISO</th><th style="width:15%;text-align:right">CONSTRUCTOR</th><th style="width:15%;text-align:right">TOTAL</th><th style="width:15%;text-align:right">% VENTAS</th></tr></thead>
      <tbody>
        ${subHdr(`LOTE (${(inp.lotePct*100).toFixed(1)}% s/ventas)`, r.lote.fid, 0, r.lote.total, r.lote.pctSales, '#fef3c7')}
        ${subHdr('URBANISMO', r.urbanismo.fid, r.urbanismo.con, r.urbanismo.total, r.urbanismo.pctSales, '#ffedd5')}
        ${subHdr('COSTOS DIRECTOS (EDIFICACIONES)', r.directos.fid, r.directos.con, r.directos.total, r.directos.pctSales, '#eff6ff')}
        ${subHdr('COSTOS INDIRECTOS', r.indirectos.subtotal.fid, r.indirectos.subtotal.con, r.indirectos.subtotal.total, r.indirectos.subtotal.pctSales, '#faf5ff')}
        ${row('Honorarios Administración y Construcción', r.indirectos.honorariosAdmin.fid, r.indirectos.honorariosAdmin.con, r.indirectos.honorariosAdmin.total, r.indirectos.honorariosAdmin.pctSales, true)}
        ${row('Diseño, Estudios Técnicos, Asesorías', r.indirectos.disenoEstudios.fid, r.indirectos.disenoEstudios.con, r.indirectos.disenoEstudios.total, r.indirectos.disenoEstudios.pctSales, true)}
        ${row('Interventoría y Supervisión Estructural', r.indirectos.interventoria.fid, r.indirectos.interventoria.con, r.indirectos.interventoria.total, r.indirectos.interventoria.pctSales, true)}
        ${row('Licencias (Urbanismo, Construcción, Ambiental)', r.indirectos.licencias.fid, r.indirectos.licencias.con, r.indirectos.licencias.total, r.indirectos.licencias.pctSales, true)}
        ${row('Seguros', r.indirectos.seguros.fid, r.indirectos.seguros.con, r.indirectos.seguros.total, r.indirectos.seguros.pctSales, true)}
        ${row('Derechos e Impuestos', r.indirectos.derechosImpuestos.fid, r.indirectos.derechosImpuestos.con, r.indirectos.derechosImpuestos.total, r.indirectos.derechosImpuestos.pctSales, true)}
        ${row('Conexión de Servicios', r.indirectos.conexionServicios.fid, r.indirectos.conexionServicios.con, r.indirectos.conexionServicios.total, r.indirectos.conexionServicios.pctSales, true)}
        ${row('Imprevistos', r.indirectos.imprevistos.fid, r.indirectos.imprevistos.con, r.indirectos.imprevistos.total, r.indirectos.imprevistos.pctSales, true)}
        ${row('Previsión al Alza', r.indirectos.previsionAlza.fid, r.indirectos.previsionAlza.con, r.indirectos.previsionAlza.total, r.indirectos.previsionAlza.pctSales, true)}
        ${subHdr('COSTOS FINANCIEROS', r.financieros.subtotal.fid, r.financieros.subtotal.con, r.financieros.subtotal.total, r.financieros.subtotal.pctSales, '#fef2f2')}
        ${row('Fiducia', r.financieros.fiducia.fid, r.financieros.fiducia.con, r.financieros.fiducia.total, r.financieros.fiducia.pctSales, true)}
        ${row('Intereses Crédito (Constructor, Puentes)', r.financieros.interesesCredito.fid, r.financieros.interesesCredito.con, r.financieros.interesesCredito.total, r.financieros.interesesCredito.pctSales, true)}
        ${subHdr('COSTOS DE VENTAS', r.ventasCostos.subtotal.fid, r.ventasCostos.subtotal.con, r.ventasCostos.subtotal.total, r.ventasCostos.subtotal.pctSales, '#f0fdf4')}
        ${row('Honorarios de Ventas', r.ventasCostos.honorariosVentas.fid, r.ventasCostos.honorariosVentas.con, r.ventasCostos.honorariosVentas.total, r.ventasCostos.honorariosVentas.pctSales, true)}
        ${row('Honorarios de Gerencia', r.ventasCostos.honorariosGerencia.fid, r.ventasCostos.honorariosGerencia.con, r.ventasCostos.honorariosGerencia.total, r.ventasCostos.honorariosGerencia.pctSales, true)}
        ${row('Honorarios Diseño/Arquitectónicos', r.ventasCostos.disenoArquitectonico.fid, r.ventasCostos.disenoArquitectonico.con, r.ventasCostos.disenoArquitectonico.total, r.ventasCostos.disenoArquitectonico.pctSales, true)}
        ${row('Promoción y Publicidad', r.ventasCostos.publicidad.fid, r.ventasCostos.publicidad.con, r.ventasCostos.publicidad.total, r.ventasCostos.publicidad.pctSales, true)}
        ${row('Notariales', r.ventasCostos.notariales.fid, r.ventasCostos.notariales.con, r.ventasCostos.notariales.total, r.ventasCostos.notariales.pctSales, true)}
        <tr style="background:#1e293b;color:#fff;font-weight:700">
          <td style="padding:8px">TOTAL USOS</td>
          <td style="padding:8px;text-align:right;font-family:monospace">${fmtK(r.totalUsos.fid)}</td>
          <td style="padding:8px;text-align:right;font-family:monospace">${fmtK(r.totalUsos.con)}</td>
          <td style="padding:8px;text-align:right;font-family:monospace;color:#93c5fd">${fmtK(r.totalUsos.total)}</td>
          <td style="padding:8px;text-align:right;font-family:monospace;color:#93c5fd">${fmtPct(r.totalUsos.pctSales)}</td>
        </tr>
        <tr style="background:#475569;color:#fff;font-weight:600">
          <td style="padding:7px 8px">VENTAS / APORTES TOTALES</td>
          <td style="padding:7px 8px;text-align:right;font-family:monospace">${fmtK(r.totalSales)}</td>
          <td style="padding:7px 8px;text-align:right;color:#cbd5e1">—</td>
          <td style="padding:7px 8px;text-align:right;font-family:monospace">${fmtK(r.totalSales)}</td>
          <td style="padding:7px 8px;text-align:right">100,00%</td>
        </tr>
        <tr style="background:${r.utilidad >= 0 ? '#15803d' : '#b91c1c'};color:#fff;font-weight:700">
          <td style="padding:8px">UTILIDAD ESTIMADA (miles COP)</td>
          <td colspan="2"></td>
          <td style="padding:8px;text-align:right;font-family:monospace;font-size:15px">${fmtK(r.utilidad)}</td>
          <td style="padding:8px;text-align:right">${fmtPct(r.utilidadPct)}</td>
        </tr>
      </tbody>
    </table>

    <div class="section-title">Indicadores Financieros</div>
    <div class="kpi-grid">
      <div class="kpi"><div class="kpi-lbl">Utilidad estimada</div><div class="kpi-val ${r.utilidad >= 0 ? 'green' : ''}" style="color:${r.utilidad >= 0 ? '#15803d':'#dc2626'}">$${fmtK(r.utilidad)} M</div><div style="font-size:10px;color:#6b7280;margin-top:3px">miles COP</div></div>
      <div class="kpi"><div class="kpi-lbl">Margen sobre ventas</div><div class="kpi-val ${r.utilidadPct >= 0.12 ? 'green':'amber'}">${fmtPct(r.utilidadPct)}</div><div style="font-size:10px;color:#6b7280;margin-top:3px">${r.utilidadPct >= 0.12 ? '✓ Viable (≥12%)':'⚠ Bajo (<12%)'}</div></div>
      <div class="kpi"><div class="kpi-lbl">ROI sobre inversión</div><div class="kpi-val blue">${r.roi.toFixed(1)}%</div><div style="font-size:10px;color:#6b7280;margin-top:3px">utilidad / total usos</div></div>
      <div class="kpi"><div class="kpi-lbl">Punto de equilibrio</div><div class="kpi-val" style="color:${r.breakEvenPct <= 0.9 ? '#0d9488':'#dc2626'}">${r.breakEvenUnits} unidades</div><div style="font-size:10px;color:#6b7280;margin-top:3px">${fmtPct(r.breakEvenPct)} de ${inp.totalUnits}</div></div>
      <div class="kpi"><div class="kpi-lbl">Precio por unidad</div><div class="kpi-val" style="color:#334155">$${fmtK(r.pricePerUnit)}</div><div style="font-size:10px;color:#6b7280;margin-top:3px">miles COP / unidad</div></div>
      <div class="kpi"><div class="kpi-lbl">Costo / m² vendible</div><div class="kpi-val" style="color:#334155">$${r.saleableAreaM2 > 0 ? new Intl.NumberFormat('es-CO',{maximumFractionDigits:0}).format(r.totalUsos.total/r.saleableAreaM2) : '—'}</div><div style="font-size:10px;color:#6b7280;margin-top:3px">COP / m²</div></div>
    </div>

    <div class="section-title">Fuentes y Usos</div>
    <table>
      <thead><tr><th>FUENTE</th><th style="text-align:right">MILES COP</th><th style="text-align:right">% TOTAL USOS</th></tr></thead>
      <tbody>
        <tr><td style="padding:5px 8px">Aporte de Socios</td><td style="padding:5px 8px;text-align:right;font-family:monospace">${fmtK(r.aportesSocios)}</td><td style="padding:5px 8px;text-align:right;font-family:monospace">${r.totalUsos.total > 0 ? fmtPct(r.aportesSocios/r.totalUsos.total) : '—'}</td></tr>
        <tr style="background:#f8fafc"><td style="padding:5px 8px">Crédito Constructor</td><td style="padding:5px 8px;text-align:right;font-family:monospace">${fmtK(r.creditoConstructor)}</td><td style="padding:5px 8px;text-align:right;font-family:monospace">${r.totalUsos.total > 0 ? fmtPct(r.creditoConstructor/r.totalUsos.total) : '—'}</td></tr>
        <tr><td style="padding:5px 8px">Cuotas Iniciales (${Math.round(inp.initialPaymentPct*100)}% s/ventas)</td><td style="padding:5px 8px;text-align:right;font-family:monospace">${fmtK(r.cuotasIniciales)}</td><td style="padding:5px 8px;text-align:right;font-family:monospace">${r.totalUsos.total > 0 ? fmtPct(r.cuotasIniciales/r.totalUsos.total) : '—'}</td></tr>
        <tr style="background:#1e3a8a;color:#fff;font-weight:700"><td style="padding:7px 8px">TOTAL FUENTES = TOTAL USOS</td><td style="padding:7px 8px;text-align:right;font-family:monospace">${fmtK(r.totalFuentes)}</td><td style="padding:7px 8px;text-align:right">100,00%</td></tr>
      </tbody>
    </table>

  </div>
  <div class="footer">
    <span>Generado: ${new Date().toLocaleString('es-CO')}</span>
    <span>${inp.projectName} · Modelo CREDICORP · Cifras en miles de COP</span>
  </div>
</div>
</body>
</html>`;
}
