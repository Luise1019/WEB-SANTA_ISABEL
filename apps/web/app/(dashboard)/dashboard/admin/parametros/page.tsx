'use client';

import { Calculator, DollarSign, Loader2, Percent, RefreshCw, Save } from 'lucide-react';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';

import { api } from '@/lib/api-client';
import { cn } from '@/lib/utils';

type Params = {
  aiuAdmin: number;
  aiuImprevistos: number;
  aiuUtilidad: number;
  factorPrestacional: number;
  ivaRate: number;
  reteIvaRate: number;
  reteIcaRate: number;
  trm: number;
  smmlv: number;
  updatedAt?: string;
};

// ── SliderField ───────────────────────────────────────────────────────────────

function SliderField({
  label, value, onChange, min = 0, max = 50, step = 0.5, unit = '%', hint,
}: {
  label: string; value: number; onChange: (v: number) => void;
  min?: number; max?: number; step?: number; unit?: string; hint?: string;
}) {
  return (
    <div>
      <div className="flex items-center justify-between mb-1.5">
        <label className="text-xs font-semibold text-slate-700">{label}</label>
        <div className="flex items-center gap-1">
          <input
            type="number"
            value={value}
            onChange={(e) => onChange(parseFloat(e.target.value) || 0)}
            step={step}
            min={min}
            max={max}
            className="w-20 rounded-md border border-slate-200 px-2 py-1 text-right text-sm font-semibold focus:border-slate-400 focus:outline-none"
          />
          <span className="text-xs font-semibold text-slate-500">{unit}</span>
        </div>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        className="w-full accent-slate-700"
      />
      {hint && <p className="text-[11px] text-slate-400 mt-0.5">{hint}</p>}
    </div>
  );
}

// ── NumberField ───────────────────────────────────────────────────────────────

function NumberField({
  label, value, onChange, hint, prefix, step = 1, min = 0,
}: {
  label: string; value: number; onChange: (v: number) => void;
  hint?: string; prefix?: string; step?: number; min?: number;
}) {
  return (
    <div>
      <label className="mb-1.5 block text-xs font-semibold text-slate-700">{label}</label>
      <div className="flex items-center gap-2">
        {prefix && <span className="text-sm font-semibold text-slate-500">{prefix}</span>}
        <input
          type="number"
          value={value}
          onChange={(e) => onChange(parseFloat(e.target.value) || 0)}
          step={step}
          min={min}
          className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-slate-400 focus:outline-none"
        />
      </div>
      {hint && <p className="mt-1 text-[11px] text-slate-400">{hint}</p>}
    </div>
  );
}

// ── AIU preview ───────────────────────────────────────────────────────────────

function AIUPreview({ admin, imprevistos, utilidad }: { admin: number; imprevistos: number; utilidad: number }) {
  const total = admin + imprevistos + utilidad;
  const cd = 1_000_000; // costo directo ejemplo
  const aiu = cd * total / 100;

  const fmt = (n: number) =>
    n.toLocaleString('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 });

  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 mt-4">
      <p className="text-xs font-semibold text-slate-500 mb-2 uppercase tracking-wider">Ejemplo con CD = {fmt(cd)}</p>
      <div className="space-y-1.5">
        {[
          { label: 'Administración',  pct: admin,        amount: cd * admin / 100,        color: 'bg-blue-400'   },
          { label: 'Imprevistos',     pct: imprevistos,  amount: cd * imprevistos / 100,  color: 'bg-amber-400'  },
          { label: 'Utilidad',        pct: utilidad,     amount: cd * utilidad / 100,     color: 'bg-emerald-400'},
        ].map((row) => (
          <div key={row.label} className="flex items-center gap-2">
            <div className={cn('h-2 w-2 rounded-full shrink-0', row.color)} />
            <span className="text-xs text-slate-600 flex-1">{row.label} ({row.pct}%)</span>
            <span className="text-xs font-semibold text-slate-800">{fmt(row.amount)}</span>
          </div>
        ))}
        <div className="border-t border-slate-200 pt-1.5 flex justify-between">
          <span className="text-xs font-bold text-slate-700">Total AIU ({total}%)</span>
          <span className="text-xs font-bold text-slate-900">{fmt(aiu)}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-xs font-bold text-slate-700">Costo total</span>
          <span className="text-xs font-bold text-emerald-700">{fmt(cd + aiu)}</span>
        </div>
      </div>
    </div>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────

const DEFAULTS: Params = {
  aiuAdmin: 10, aiuImprevistos: 5, aiuUtilidad: 8,
  factorPrestacional: 0.5213,
  ivaRate: 19, reteIvaRate: 15, reteIcaRate: 0.966,
  trm: 4200, smmlv: 1300000,
};

export default function ParametrosPage() {
  const [form, setForm]       = useState<Params>(DEFAULTS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving]   = useState(false);
  const [dirty, setDirty]     = useState(false);

  useEffect(() => {
    api.getAdminParams()
      .then((res) => {
        const p = res as Record<string, unknown>;
        setForm({
          aiuAdmin:           Number(p.aiuAdmin)           ?? DEFAULTS.aiuAdmin,
          aiuImprevistos:     Number(p.aiuImprevistos)     ?? DEFAULTS.aiuImprevistos,
          aiuUtilidad:        Number(p.aiuUtilidad)        ?? DEFAULTS.aiuUtilidad,
          factorPrestacional: Number(p.factorPrestacional) ?? DEFAULTS.factorPrestacional,
          ivaRate:            Number(p.ivaRate)            ?? DEFAULTS.ivaRate,
          reteIvaRate:        Number(p.reteIvaRate)        ?? DEFAULTS.reteIvaRate,
          reteIcaRate:        Number(p.reteIcaRate)        ?? DEFAULTS.reteIcaRate,
          trm:                Number(p.trm)                ?? DEFAULTS.trm,
          smmlv:              Number(p.smmlv)              ?? DEFAULTS.smmlv,
          updatedAt:          p.updatedAt as string | undefined,
        });
      })
      .catch(() => toast.error('Error al cargar parámetros'))
      .finally(() => setLoading(false));
  }, []);

  function update(key: keyof Params, val: number) {
    setForm((f) => ({ ...f, [key]: val }));
    setDirty(true);
  }

  async function save() {
    setSaving(true);
    try {
      await api.updateAdminParams(form);
      setDirty(false);
      toast.success('Parámetros guardados correctamente');
    } catch {
      toast.error('Error al guardar parámetros');
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

      {/* Left — AIU */}
      <div className="lg:col-span-2 space-y-6">

        {/* AIU */}
        <div className="rounded-xl border border-slate-200 bg-white p-6">
          <div className="flex items-center gap-2 mb-5">
            <Percent className="h-4 w-4 text-slate-500" />
            <h3 className="font-semibold text-slate-900">AIU por defecto</h3>
            <span className="ml-auto text-xs text-slate-400">Se aplican al crear nuevos presupuestos</span>
          </div>
          <div className="space-y-5">
            <SliderField
              label="Administración"
              value={form.aiuAdmin}
              onChange={(v) => update('aiuAdmin', v)}
              max={30} step={0.5}
              hint="Gastos de oficina, personal administrativo, equipos de cómputo"
            />
            <SliderField
              label="Imprevistos"
              value={form.aiuImprevistos}
              onChange={(v) => update('aiuImprevistos', v)}
              max={15} step={0.5}
              hint="Riesgos no previstos, contingencias de obra"
            />
            <SliderField
              label="Utilidad"
              value={form.aiuUtilidad}
              onChange={(v) => update('aiuUtilidad', v)}
              max={25} step={0.5}
              hint="Beneficio económico esperado sobre el costo directo"
            />
          </div>
          <AIUPreview admin={form.aiuAdmin} imprevistos={form.aiuImprevistos} utilidad={form.aiuUtilidad} />
        </div>

        {/* Factor prestacional */}
        <div className="rounded-xl border border-slate-200 bg-white p-6">
          <div className="flex items-center gap-2 mb-5">
            <Calculator className="h-4 w-4 text-slate-500" />
            <h3 className="font-semibold text-slate-900">Factor prestacional</h3>
          </div>
          <SliderField
            label="Factor prestacional total"
            value={form.factorPrestacional * 100}
            onChange={(v) => update('factorPrestacional', v / 100)}
            min={30} max={80} step={0.01} unit="%"
            hint="Incluye: cesantías 8.33%, primas 8.33%, vacaciones 4.17%, dotación, ARL, salud, pensión. Típico: 52.13%"
          />
          <div className="mt-4 rounded-lg bg-slate-50 border border-slate-200 p-4">
            <p className="text-xs font-semibold text-slate-600 mb-2">Desglose típico (referencia)</p>
            <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-slate-500">
              {[
                ['Cesantías', '8.33%'], ['Prima semestral', '8.33%'], ['Vacaciones', '4.17%'],
                ['Salud (emp.)', '8.50%'], ['Pensión (emp.)', '12.00%'], ['ARL (riesgo I)', '0.52%'],
                ['Caja Compens.', '4.00%'], ['ICBF', '3.00%'], ['SENA', '2.00%'],
                ['Dotación', '1.28%'],
              ].map(([item, pct]) => (
                <div key={item} className="flex justify-between">
                  <span>{item}</span><span className="font-semibold">{pct}</span>
                </div>
              ))}
              <div className="col-span-2 border-t border-slate-200 pt-1 mt-1 flex justify-between font-semibold text-slate-700">
                <span>Total referencia</span><span>52.13%</span>
              </div>
            </div>
          </div>
        </div>

        {/* Tasas e impuestos */}
        <div className="rounded-xl border border-slate-200 bg-white p-6">
          <div className="flex items-center gap-2 mb-5">
            <DollarSign className="h-4 w-4 text-slate-500" />
            <h3 className="font-semibold text-slate-900">Tasas e impuestos</h3>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            <SliderField
              label="IVA general"
              value={form.ivaRate}
              onChange={(v) => update('ivaRate', v)}
              min={0} max={25} step={0.5}
              hint="Tarifa general Colombia: 19%"
            />
            <SliderField
              label="ReteIVA (% sobre el IVA)"
              value={form.reteIvaRate}
              onChange={(v) => update('reteIvaRate', v)}
              min={0} max={100} step={1}
              hint="Porcentaje del IVA que se retiene. Típico: 15%"
            />
            <NumberField
              label="ReteICA (por mil)"
              value={form.reteIcaRate}
              onChange={(v) => update('reteIcaRate', v)}
              step={0.001} min={0}
              hint="Tarifa por cada $1.000 de actividad. Varía por municipio. Ej: 0.966‰ (Bogotá, construcción)"
            />
            <NumberField
              label="TRM (USD → COP)"
              value={form.trm}
              onChange={(v) => update('trm', v)}
              prefix="$" step={50} min={1000}
              hint="Tasa Representativa del Mercado vigente"
            />
            <div className="sm:col-span-2">
              <NumberField
                label="SMMLV (Salario Mínimo Mensual Legal Vigente)"
                value={form.smmlv}
                onChange={(v) => update('smmlv', v)}
                prefix="$" step={1000} min={0}
                hint="Se usa en cálculo de APUs y dotaciones. 2025: $1.423.500"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Right — Summary + Save */}
      <div className="space-y-4">
        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <h4 className="text-xs font-semibold text-slate-500 mb-3 uppercase tracking-wider">Resumen actual</h4>
          <div className="space-y-2.5">
            {[
              { label: 'AIU total',            value: `${(form.aiuAdmin + form.aiuImprevistos + form.aiuUtilidad).toFixed(1)}%` },
              { label: 'Factor prestacional',  value: `${(form.factorPrestacional * 100).toFixed(2)}%` },
              { label: 'IVA',                  value: `${form.ivaRate}%` },
              { label: 'ReteIVA',              value: `${form.reteIvaRate}%` },
              { label: 'ReteICA',              value: `${form.reteIcaRate}‰` },
              { label: 'TRM',                  value: `$${form.trm.toLocaleString('es-CO')}` },
              { label: 'SMMLV',                value: `$${form.smmlv.toLocaleString('es-CO')}` },
            ].map((row) => (
              <div key={row.label} className="flex items-center justify-between text-sm">
                <span className="text-slate-500">{row.label}</span>
                <span className="font-semibold text-slate-900">{row.value}</span>
              </div>
            ))}
          </div>
          {form.updatedAt && (
            <p className="mt-4 text-[10px] text-slate-400 border-t pt-3">
              Última actualización: {new Date(form.updatedAt).toLocaleString('es-CO')}
            </p>
          )}
        </div>

        {/* Actions */}
        <button
          onClick={save}
          disabled={saving || !dirty}
          className={cn(
            'w-full flex items-center justify-center gap-2 rounded-xl py-3 text-sm font-semibold transition-all',
            dirty ? 'bg-slate-900 text-white hover:bg-slate-800 shadow-sm' : 'bg-slate-100 text-slate-400 cursor-not-allowed',
          )}
        >
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          {saving ? 'Guardando…' : 'Guardar parámetros'}
        </button>
        <button
          onClick={() => { setForm(DEFAULTS); setDirty(true); }}
          className="w-full flex items-center justify-center gap-2 rounded-xl border border-slate-200 py-2.5 text-sm font-medium text-slate-600 hover:bg-slate-50 transition-colors"
        >
          <RefreshCw className="h-3.5 w-3.5" />
          Restaurar valores por defecto
        </button>
      </div>
    </div>
  );
}
