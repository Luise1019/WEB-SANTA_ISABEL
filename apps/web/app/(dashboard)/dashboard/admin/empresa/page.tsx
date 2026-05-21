'use client';

import { Building2, Globe, Loader2, Mail, MapPin, Palette, Phone, Save } from 'lucide-react';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';

import { api } from '@/lib/api-client';
import { cn } from '@/lib/utils';

type OrgData = {
  id: string;
  name: string;
  taxId: string | null;
  logoUrl: string | null;
  phone: string | null;
  address: string | null;
  city: string | null;
  website: string | null;
  reportFooter: string | null;
  reportColor: string | null;
};

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="mb-1.5 block text-xs font-semibold text-slate-700">{label}</label>
      {children}
      {hint && <p className="mt-1 text-[11px] text-slate-400">{hint}</p>}
    </div>
  );
}

export default function EmpresaPage() {
  const [data, setData]       = useState<OrgData | null>(null);
  const [form, setForm]       = useState<Partial<OrgData>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving]   = useState(false);
  const [dirty, setDirty]     = useState(false);

  useEffect(() => {
    api.getAdminOrg()
      .then((res) => {
        const d = res as OrgData;
        setData(d);
        setForm(d);
      })
      .catch(() => toast.error('Error al cargar datos'))
      .finally(() => setLoading(false));
  }, []);

  function update(key: keyof OrgData, val: string | null) {
    setForm((f) => ({ ...f, [key]: val }));
    setDirty(true);
  }

  async function save() {
    setSaving(true);
    try {
      const res = await api.updateAdminOrg(form) as OrgData;
      setData(res);
      setDirty(false);
      toast.success('Datos de empresa guardados');
    } catch {
      toast.error('Error al guardar');
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

      {/* Left column — Identidad */}
      <div className="lg:col-span-2 space-y-6">

        {/* Datos legales */}
        <div className="rounded-xl border border-slate-200 bg-white p-6">
          <div className="flex items-center gap-2 mb-5">
            <Building2 className="h-4 w-4 text-slate-500" />
            <h3 className="font-semibold text-slate-900">Datos legales</h3>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2">
              <Field label="Razón social *">
                <input
                  value={form.name ?? ''}
                  onChange={(e) => update('name', e.target.value)}
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-slate-400 focus:outline-none"
                  placeholder="Nombre de la empresa"
                />
              </Field>
            </div>
            <Field label="NIT / Identificación tributaria">
              <input
                value={form.taxId ?? ''}
                onChange={(e) => update('taxId', e.target.value || null)}
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-slate-400 focus:outline-none"
                placeholder="900.123.456-7"
              />
            </Field>
            <Field label="URL del logo" hint="Enlace directo a imagen (PNG/SVG recomendado)">
              <input
                value={form.logoUrl ?? ''}
                onChange={(e) => update('logoUrl', e.target.value || null)}
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-slate-400 focus:outline-none"
                placeholder="https://..."
              />
            </Field>
          </div>
        </div>

        {/* Contacto */}
        <div className="rounded-xl border border-slate-200 bg-white p-6">
          <div className="flex items-center gap-2 mb-5">
            <Phone className="h-4 w-4 text-slate-500" />
            <h3 className="font-semibold text-slate-900">Contacto y ubicación</h3>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="Teléfono">
              <input
                value={form.phone ?? ''}
                onChange={(e) => update('phone', e.target.value || null)}
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-slate-400 focus:outline-none"
                placeholder="+57 300 123 4567"
              />
            </Field>
            <Field label="Ciudad">
              <input
                value={form.city ?? ''}
                onChange={(e) => update('city', e.target.value || null)}
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-slate-400 focus:outline-none"
                placeholder="Bogotá, Medellín..."
              />
            </Field>
            <div className="sm:col-span-2">
              <Field label="Dirección">
                <input
                  value={form.address ?? ''}
                  onChange={(e) => update('address', e.target.value || null)}
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-slate-400 focus:outline-none"
                  placeholder="Calle 123 # 45-67, Oficina 8"
                />
              </Field>
            </div>
            <Field label="Sitio web">
              <input
                value={form.website ?? ''}
                onChange={(e) => update('website', e.target.value || null)}
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-slate-400 focus:outline-none"
                placeholder="https://empresa.com"
              />
            </Field>
          </div>
        </div>

        {/* Reportes */}
        <div className="rounded-xl border border-slate-200 bg-white p-6">
          <div className="flex items-center gap-2 mb-5">
            <Palette className="h-4 w-4 text-slate-500" />
            <h3 className="font-semibold text-slate-900">Identidad visual en reportes</h3>
          </div>
          <div className="grid grid-cols-1 gap-4">
            <Field label="Color corporativo" hint="Se usa en encabezados de reportes PDF y HTML">
              <div className="flex items-center gap-3">
                <input
                  type="color"
                  value={form.reportColor ?? '#1e3a5f'}
                  onChange={(e) => update('reportColor', e.target.value)}
                  className="h-10 w-16 cursor-pointer rounded-lg border border-slate-200 p-1"
                />
                <input
                  value={form.reportColor ?? '#1e3a5f'}
                  onChange={(e) => update('reportColor', e.target.value)}
                  className="flex-1 rounded-lg border border-slate-200 px-3 py-2 text-sm font-mono focus:border-slate-400 focus:outline-none"
                  placeholder="#1e3a5f"
                />
                {/* Preview */}
                <div
                  className="h-10 flex-1 rounded-lg flex items-center justify-center text-white text-xs font-semibold"
                  style={{ backgroundColor: form.reportColor ?? '#1e3a5f' }}
                >
                  Vista previa
                </div>
              </div>
            </Field>
            <Field label="Pie de página en reportes" hint="Aparece al final de cada reporte generado">
              <textarea
                value={form.reportFooter ?? ''}
                onChange={(e) => update('reportFooter', e.target.value || null)}
                rows={3}
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-slate-400 focus:outline-none resize-none"
                placeholder="Ej: Constructora Santa Isabel S.A.S. · NIT 900.123.456-7 · Tel: +57 300 123 4567"
              />
            </Field>
          </div>
        </div>
      </div>

      {/* Right column — Preview + Save */}
      <div className="space-y-4">

        {/* Logo preview */}
        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <h4 className="text-xs font-semibold text-slate-500 mb-3 uppercase tracking-wider">Vista previa</h4>
          <div
            className="rounded-lg p-4 mb-3"
            style={{ backgroundColor: form.reportColor ?? '#1e3a5f' }}
          >
            {form.logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={form.logoUrl} alt="Logo" className="h-10 object-contain" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
            ) : (
              <div className="flex items-center gap-2">
                <div className="h-10 w-10 rounded-lg bg-white/20 flex items-center justify-center">
                  <Building2 className="h-5 w-5 text-white" />
                </div>
                <div>
                  <p className="text-sm font-bold text-white leading-tight">{form.name || 'Nombre empresa'}</p>
                  <p className="text-[10px] text-white/70">{form.taxId || 'NIT'}</p>
                </div>
              </div>
            )}
          </div>
          <div className="space-y-1.5 text-xs text-slate-600">
            {form.address && <div className="flex gap-1.5"><MapPin className="h-3 w-3 text-slate-400 shrink-0 mt-0.5" />{form.address}</div>}
            {form.phone   && <div className="flex gap-1.5"><Phone  className="h-3 w-3 text-slate-400 shrink-0 mt-0.5" />{form.phone}</div>}
            {form.website && <div className="flex gap-1.5"><Globe  className="h-3 w-3 text-slate-400 shrink-0 mt-0.5" />{form.website}</div>}
          </div>
          {form.reportFooter && (
            <div className="mt-3 border-t border-slate-100 pt-3">
              <p className="text-[10px] text-slate-400 text-center">{form.reportFooter}</p>
            </div>
          )}
        </div>

        {/* Save button */}
        <button
          onClick={save}
          disabled={saving || !dirty}
          className={cn(
            'w-full flex items-center justify-center gap-2 rounded-xl py-3 text-sm font-semibold transition-all',
            dirty
              ? 'bg-slate-900 text-white hover:bg-slate-800 shadow-sm'
              : 'bg-slate-100 text-slate-400 cursor-not-allowed',
          )}
        >
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          {saving ? 'Guardando…' : 'Guardar cambios'}
        </button>
      </div>
    </div>
  );
}
