'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  AlertTriangle, BookOpen, Calendar, ChevronDown, ChevronRight,
  ChevronUp, ClipboardList, Cloud, Download, Eye, FileText,
  HardHat, Loader2, Package, Plus, Search, Shield,
  Sun, Thermometer, Trash2, Users, X, Zap,
} from 'lucide-react';
import { useCallback, useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';

import { ModuleHeader } from '@/components/module-header';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { api } from '@/lib/api-client';

import { buildEntryReport, buildRangeReport, buildVisitsReport, openReport } from './report';
import {
  DELAY_META, EQUIPMENT_OPTIONS, ROLE_OPTIONS, SHIFT_META, UNIT_OPTIONS, WEATHER_META,
  fmtDate, fmtDateShort, totalPersonHours, totalPersonnel, uid,
} from './types';
import type {
  DelayType, LogbookActivity, LogbookDelay, LogbookEntry, LogbookEquipment,
  LogbookListResponse, LogbookMaterial, LogbookPersonnel, LogbookPhoto,
  LogbookTechnicalVisit, ShiftType, WeatherCondition,
} from './types';

// ─── Photo Upload ──────────────────────────────────────────────────────────────

function PhotoUpload({ photos, onChange }: { photos: LogbookPhoto[]; onChange: (p: LogbookPhoto[]) => void }) {
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFiles = (files: FileList | null) => {
    if (!files) return;
    const MAX = 10 * 1024 * 1024;
    const valid = Array.from(files).filter((f) => {
      if (f.size > MAX) { toast.error(`${f.name} supera los 10 MB`); return false; }
      if (!f.type.startsWith('image/')) { toast.error(`${f.name} no es una imagen`); return false; }
      return true;
    });
    const tasks = valid.map((file) => new Promise<LogbookPhoto>((resolve) => {
      const reader = new FileReader();
      reader.onload = (e) => resolve({
        url:       '',
        dataUrl:   e.target?.result as string,
        caption:   file.name.replace(/\.[^.]+$/, '').replace(/_/g, ' '),
        takenAt:   new Date().toISOString(),
        mimeType:  file.type,
        sizeBytes: file.size,
        order:     photos.length,
      });
      reader.readAsDataURL(file);
    }));
    Promise.all(tasks).then((n) => onChange([...photos, ...n]));
  };

  return (
    <div className="space-y-3">
      <div
        onClick={() => inputRef.current?.click()}
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => { e.preventDefault(); handleFiles(e.dataTransfer.files); }}
        className="flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-slate-200 bg-slate-50 px-4 py-8 transition hover:border-blue-400 hover:bg-blue-50"
      >
        <span className="text-3xl mb-2">📷</span>
        <p className="text-sm font-medium text-slate-600">
          Arrastra fotos o <span className="text-blue-600 underline">selecciona desde el dispositivo</span>
        </p>
        <p className="mt-1 text-xs text-slate-400">JPG, PNG · Máx. 10 MB por foto</p>
        <input ref={inputRef} type="file" accept="image/*" multiple className="hidden"
          onChange={(e) => handleFiles(e.target.files)} />
      </div>
      {photos.length > 0 && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {photos.map((p, idx) => (
            <div key={idx} className="group relative rounded-lg overflow-hidden border bg-white shadow-sm">
              <div className="relative aspect-video bg-slate-100">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={p.dataUrl ?? p.url} alt={p.caption ?? ''} className="h-full w-full object-cover" />
                <button type="button" onClick={() => onChange(photos.filter((_, i) => i !== idx))}
                  className="absolute right-1 top-1 rounded-full bg-red-500 p-1 text-white opacity-0 shadow transition group-hover:opacity-100">
                  <X className="h-3 w-3" />
                </button>
              </div>
              <div className="px-2 py-1.5">
                <input type="text" value={p.caption ?? ''} placeholder="Descripción…"
                  onChange={(e) => onChange(photos.map((ph, i) => i === idx ? { ...ph, caption: e.target.value } : ph))}
                  className="w-full bg-transparent text-[11px] outline-none placeholder:text-slate-400" />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Accordion section ─────────────────────────────────────────────────────────

function Section({ icon, title, count, children, defaultOpen = false }: {
  icon: React.ReactNode; title: string; count?: number;
  children: React.ReactNode; defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="rounded-xl border overflow-hidden">
      <button type="button" onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-3 bg-slate-50 px-4 py-3 text-left font-medium hover:bg-slate-100 transition">
        <span className="text-slate-600">{icon}</span>
        <span className="flex-1 text-sm font-semibold text-slate-800">{title}</span>
        {count != null && (
          <span className="rounded-full bg-blue-100 px-2 py-0.5 text-xs font-bold text-blue-700">{count}</span>
        )}
        {open ? <ChevronUp className="h-4 w-4 text-slate-400" /> : <ChevronDown className="h-4 w-4 text-slate-400" />}
      </button>
      {open && <div className="p-4 space-y-3">{children}</div>}
    </div>
  );
}

// ─── Entry Form ────────────────────────────────────────────────────────────────

function EntryForm({ projectId, entry, onClose }: {
  projectId: string; entry?: LogbookEntry; onClose: () => void;
}) {
  const qc = useQueryClient();

  // Header state
  const [date,         setDate]         = useState(entry?.date?.slice(0, 10) ?? new Date().toISOString().slice(0, 10));
  const [shift,        setShift]        = useState<ShiftType>(entry?.shift ?? 'FULL');
  const [weather,      setWeather]      = useState<WeatherCondition>(entry?.weather ?? 'SUNNY');
  const [tempC,        setTempC]        = useState(entry?.temperatureC != null ? String(entry.temperatureC) : '');
  const [humidity,     setHumidity]     = useState(entry?.humidity != null ? String(entry.humidity) : '');
  const [wind,         setWind]         = useState(entry?.windSpeedKmh != null ? String(entry.windSpeedKmh) : '');
  const [weatherDesc,  setWeatherDesc]  = useState(entry?.weatherDesc ?? '');
  const [generalNotes, setGeneralNotes] = useState(entry?.generalNotes ?? '');
  const [safetyNotes,  setSafetyNotes]  = useState(entry?.safetyNotes ?? '');
  const [qualityNotes, setQualityNotes] = useState(entry?.qualityNotes ?? '');
  const [authorName,   setAuthorName]   = useState(entry?.authorName ?? 'Residente de obra');
  const [authorRole,   setAuthorRole]   = useState(entry?.authorRole ?? 'Residente de obra');

  // Lists state
  const [photos,    setPhotos]    = useState<LogbookPhoto[]>(entry?.photos ?? []);
  const [personnel, setPersonnel] = useState<LogbookPersonnel[]>(entry?.personnel ?? [
    { role: 'Maestro de obra', count: 1, hoursWorked: 8 },
    { role: 'Oficiales',       count: 4, hoursWorked: 8 },
    { role: 'Auxiliares / Ayudantes', count: 8, hoursWorked: 8 },
  ]);
  const [equipment,  setEquipment]  = useState<LogbookEquipment[]>(entry?.equipment ?? []);
  const [materials,  setMaterials]  = useState<LogbookMaterial[]>(entry?.materials ?? []);
  const [activities, setActivities] = useState<LogbookActivity[]>(entry?.activities ?? []);
  const [visits,     setVisits]     = useState<LogbookTechnicalVisit[]>(entry?.technicalVisits ?? []);
  const [delays,     setDelays]     = useState<LogbookDelay[]>(entry?.delays ?? []);

  const isEdit = Boolean(entry);

  const mutation = useMutation({
    mutationFn: (status: 'DRAFT' | 'FINAL') => {
      const body = {
        date, shift, weather, weatherDesc: weatherDesc || undefined,
        temperatureC: tempC ? Number(tempC) : undefined,
        humidity: humidity ? Number(humidity) : undefined,
        windSpeedKmh: wind ? Number(wind) : undefined,
        generalNotes, safetyNotes: safetyNotes || undefined,
        qualityNotes: qualityNotes || undefined,
        authorName, authorRole, status,
        photos:    photos.map((p, i) => ({ ...p, url: p.url || '', order: i })),
        personnel, equipment, materials,
        activities: activities.map((a, i) => ({ ...a, order: i })),
        technicalVisits: visits,
        delays,
      };
      return isEdit
        ? api.updateLogbookEntry(projectId, entry!.id, body)
        : api.createLogbookEntry(projectId, body);
    },
    onSuccess: (_, status) => {
      void qc.invalidateQueries({ queryKey: ['logbook', projectId] });
      void qc.invalidateQueries({ queryKey: ['logbook-stats', projectId] });
      toast.success(status === 'FINAL' ? 'Bitácora finalizada' : 'Borrador guardado');
      onClose();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const canSave = date.trim() && generalNotes.trim() && authorName.trim();

  // Helper builders
  const addPersonnel   = () => setPersonnel((p) => [...p, { role: 'Oficiales', count: 1, hoursWorked: 8 }]);
  const addEquipment   = () => setEquipment((e) => [...e, { type: 'Mezcladora de concreto', quantity: 1, hoursOperated: 8 }]);
  const addMaterial    = () => setMaterials((m) => [...m, { name: '', quantity: 1, unit: 'm³' }]);
  const addActivity    = () => setActivities((a) => [...a, { description: '', order: a.length }]);
  const addVisit       = () => setVisits((v) => [...v, { specialistName: '', specialty: '', visitReason: '' }]);
  const addDelay       = () => setDelays((d) => [...d, { type: 'OTHER' as DelayType, description: '' }]);

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/50 p-4">
      <div className="mx-auto max-w-3xl rounded-2xl bg-white shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between rounded-t-2xl bg-gradient-to-r from-blue-700 to-blue-900 px-6 py-4">
          <div className="flex items-center gap-3 text-white">
            <BookOpen className="h-5 w-5" />
            <h2 className="text-base font-bold">{isEdit ? 'Editar bitácora' : 'Nueva bitácora'}</h2>
          </div>
          <button type="button" onClick={onClose} className="rounded-full p-1 text-white/70 hover:text-white hover:bg-white/10">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="max-h-[80vh] overflow-y-auto p-6 space-y-4">

          {/* Datos generales */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div className="space-y-1">
              <Label className="text-xs">Fecha</Label>
              <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Turno</Label>
              <select value={shift} onChange={(e) => setShift(e.target.value as ShiftType)}
                className="h-10 w-full rounded-md border px-3 text-sm bg-background">
                {(Object.keys(SHIFT_META) as ShiftType[]).map((s) =>
                  <option key={s} value={s}>{SHIFT_META[s].label}</option>
                )}
              </select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Temperatura (°C)</Label>
              <Input type="number" value={tempC} onChange={(e) => setTempC(e.target.value)} placeholder="22" min="-10" max="50" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Humedad (%)</Label>
              <Input type="number" value={humidity} onChange={(e) => setHumidity(e.target.value)} placeholder="65" min="0" max="100" />
            </div>
          </div>

          {/* Clima */}
          <div className="space-y-2">
            <Label className="text-xs">Condición climática</Label>
            <div className="flex flex-wrap gap-2">
              {(Object.keys(WEATHER_META) as WeatherCondition[]).map((w) => {
                const wm = WEATHER_META[w];
                return (
                  <button key={w} type="button" onClick={() => setWeather(w)}
                    className={`flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition ${
                      weather === w ? 'border-blue-500 bg-blue-50 text-blue-700 ring-2 ring-blue-300' : 'border-slate-200 hover:border-slate-300'
                    }`}>
                    <span>{wm.emoji}</span> {wm.label}
                  </button>
                );
              })}
            </div>
            <Input value={weatherDesc} onChange={(e) => setWeatherDesc(e.target.value)}
              placeholder="Descripción adicional del clima (opcional)…" className="text-sm" />
          </div>

          {/* Autor */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs">Nombre del responsable</Label>
              <Input value={authorName} onChange={(e) => setAuthorName(e.target.value)} placeholder="Nombre completo" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Cargo</Label>
              <Input value={authorRole} onChange={(e) => setAuthorRole(e.target.value)} placeholder="Residente de obra" />
            </div>
          </div>

          {/* Anotaciones */}
          <Section icon={<FileText className="h-4 w-4" />} title="Anotaciones generales" defaultOpen>
            <textarea rows={4} value={generalNotes} onChange={(e) => setGeneralNotes(e.target.value)}
              placeholder="Describe las actividades principales del día, novedades y observaciones generales…"
              className="w-full rounded-md border px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-400" />
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="space-y-1">
                <Label className="text-xs text-green-700">🦺 Notas de seguridad (SST)</Label>
                <textarea rows={2} value={safetyNotes} onChange={(e) => setSafetyNotes(e.target.value)}
                  placeholder="Incidentes, capacitaciones, EPPs verificados…"
                  className="w-full rounded-md border border-green-200 bg-green-50 px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-green-400" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-amber-700">✅ Control de calidad</Label>
                <textarea rows={2} value={qualityNotes} onChange={(e) => setQualityNotes(e.target.value)}
                  placeholder="Ensayos realizados, aprobaciones, no conformidades…"
                  className="w-full rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-amber-400" />
              </div>
            </div>
          </Section>

          {/* Actividades */}
          <Section icon={<Zap className="h-4 w-4" />} title="Actividades ejecutadas" count={activities.length}>
            {activities.map((a, i) => (
              <div key={i} className="rounded-lg border p-3 space-y-2 bg-slate-50">
                <div className="flex gap-2">
                  <textarea rows={2} value={a.description} placeholder="Descripción de la actividad…"
                    onChange={(e) => setActivities(activities.map((x, j) => j === i ? { ...x, description: e.target.value } : x))}
                    className="flex-1 rounded border px-2 py-1.5 text-sm resize-none focus:outline-none focus:ring-1 focus:ring-blue-300" />
                  <button type="button" onClick={() => setActivities(activities.filter((_, j) => j !== i))}
                    className="self-start rounded p-1 text-red-400 hover:text-red-600"><X className="h-4 w-4" /></button>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <div><Label className="text-xs">Ubicación</Label>
                    <Input value={a.location ?? ''} onChange={(e) => setActivities(activities.map((x, j) => j === i ? { ...x, location: e.target.value } : x))} placeholder="Ej. Piso 4 Eje A-D" className="text-xs h-8" /></div>
                  <div><Label className="text-xs">Cuadrilla</Label>
                    <Input value={a.crew ?? ''} onChange={(e) => setActivities(activities.map((x, j) => j === i ? { ...x, crew: e.target.value } : x))} placeholder="Ej. Concreto" className="text-xs h-8" /></div>
                  <div><Label className="text-xs">% Avance</Label>
                    <Input type="number" min="0" max="100" value={a.progressPct ?? ''} onChange={(e) => setActivities(activities.map((x, j) => j === i ? { ...x, progressPct: e.target.value ? Number(e.target.value) : undefined } : x))} placeholder="75" className="text-xs h-8" /></div>
                </div>
              </div>
            ))}
            <Button type="button" variant="outline" size="sm" onClick={addActivity} className="w-full">
              <Plus className="mr-1 h-3 w-3" /> Agregar actividad
            </Button>
          </Section>

          {/* Personal */}
          <Section icon={<Users className="h-4 w-4" />} title="Personal en obra" count={totalPersonnel(personnel)}>
            <div className="space-y-2">
              {personnel.map((p, i) => (
                <div key={i} className="grid grid-cols-12 gap-2 items-end">
                  <div className="col-span-4 space-y-0.5">
                    {i === 0 && <Label className="text-[10px] text-slate-500">Cargo</Label>}
                    <select value={p.role} onChange={(e) => setPersonnel(personnel.map((x, j) => j === i ? { ...x, role: e.target.value } : x))}
                      className="h-9 w-full rounded border px-2 text-xs bg-background">
                      {ROLE_OPTIONS.map((r) => <option key={r} value={r}>{r}</option>)}
                    </select>
                  </div>
                  <div className="col-span-3 space-y-0.5">
                    {i === 0 && <Label className="text-[10px] text-slate-500">Nombre (opcional)</Label>}
                    <Input value={p.name ?? ''} onChange={(e) => setPersonnel(personnel.map((x, j) => j === i ? { ...x, name: e.target.value } : x))} placeholder="Nombre" className="h-9 text-xs" />
                  </div>
                  <div className="col-span-2 space-y-0.5">
                    {i === 0 && <Label className="text-[10px] text-slate-500">Cant.</Label>}
                    <Input type="number" min="1" value={p.count} onChange={(e) => setPersonnel(personnel.map((x, j) => j === i ? { ...x, count: Number(e.target.value) } : x))} className="h-9 text-xs text-center" />
                  </div>
                  <div className="col-span-2 space-y-0.5">
                    {i === 0 && <Label className="text-[10px] text-slate-500">Horas</Label>}
                    <Input type="number" min="0" max="24" step="0.5" value={p.hoursWorked} onChange={(e) => setPersonnel(personnel.map((x, j) => j === i ? { ...x, hoursWorked: Number(e.target.value) } : x))} className="h-9 text-xs text-center" />
                  </div>
                  <button type="button" onClick={() => setPersonnel(personnel.filter((_, j) => j !== i))}
                    className="col-span-1 self-center text-red-400 hover:text-red-600"><X className="h-4 w-4" /></button>
                </div>
              ))}
            </div>
            <div className="flex items-center justify-between">
              <Button type="button" variant="outline" size="sm" onClick={addPersonnel}>
                <Plus className="mr-1 h-3 w-3" /> Agregar rol
              </Button>
              <span className="text-xs text-slate-500">
                Total: <b>{totalPersonnel(personnel)} personas</b> · <b>{totalPersonHours(personnel).toFixed(1)} horas-hombre</b>
              </span>
            </div>
          </Section>

          {/* Equipos */}
          <Section icon={<HardHat className="h-4 w-4" />} title="Equipos y maquinaria" count={equipment.length}>
            <div className="space-y-2">
              {equipment.map((e, i) => (
                <div key={i} className="grid grid-cols-12 gap-2 items-end">
                  <div className="col-span-5 space-y-0.5">
                    {i === 0 && <Label className="text-[10px]">Equipo</Label>}
                    <select value={e.type} onChange={(ev) => setEquipment(equipment.map((x, j) => j === i ? { ...x, type: ev.target.value } : x))}
                      className="h-9 w-full rounded border px-2 text-xs bg-background">
                      {EQUIPMENT_OPTIONS.map((o) => <option key={o} value={o}>{o}</option>)}
                    </select>
                  </div>
                  <div className="col-span-2 space-y-0.5">
                    {i === 0 && <Label className="text-[10px]">Cant.</Label>}
                    <Input type="number" min="1" value={e.quantity} onChange={(ev) => setEquipment(equipment.map((x, j) => j === i ? { ...x, quantity: Number(ev.target.value) } : x))} className="h-9 text-xs text-center" />
                  </div>
                  <div className="col-span-2 space-y-0.5">
                    {i === 0 && <Label className="text-[10px]">Horas</Label>}
                    <Input type="number" min="0" max="24" step="0.5" value={e.hoursOperated} onChange={(ev) => setEquipment(equipment.map((x, j) => j === i ? { ...x, hoursOperated: Number(ev.target.value) } : x))} className="h-9 text-xs text-center" />
                  </div>
                  <div className="col-span-2 space-y-0.5">
                    {i === 0 && <Label className="text-[10px]">Operador</Label>}
                    <Input value={e.operator ?? ''} onChange={(ev) => setEquipment(equipment.map((x, j) => j === i ? { ...x, operator: ev.target.value } : x))} placeholder="Nombre" className="h-9 text-xs" />
                  </div>
                  <button type="button" onClick={() => setEquipment(equipment.filter((_, j) => j !== i))}
                    className="col-span-1 self-center text-red-400 hover:text-red-600"><X className="h-4 w-4" /></button>
                </div>
              ))}
            </div>
            <Button type="button" variant="outline" size="sm" onClick={addEquipment} className="w-full">
              <Plus className="mr-1 h-3 w-3" /> Agregar equipo
            </Button>
          </Section>

          {/* Materiales */}
          <Section icon={<Package className="h-4 w-4" />} title="Materiales utilizados" count={materials.length}>
            <div className="space-y-2">
              {materials.map((m, i) => (
                <div key={i} className="grid grid-cols-12 gap-2 items-end">
                  <div className="col-span-4 space-y-0.5">
                    {i === 0 && <Label className="text-[10px]">Material</Label>}
                    <Input value={m.name} onChange={(e) => setMaterials(materials.map((x, j) => j === i ? { ...x, name: e.target.value } : x))} placeholder="Ej. Concreto 3000 PSI" className="h-9 text-xs" />
                  </div>
                  <div className="col-span-2 space-y-0.5">
                    {i === 0 && <Label className="text-[10px]">Cantidad</Label>}
                    <Input type="number" min="0" step="0.01" value={m.quantity} onChange={(e) => setMaterials(materials.map((x, j) => j === i ? { ...x, quantity: Number(e.target.value) } : x))} className="h-9 text-xs text-right" />
                  </div>
                  <div className="col-span-2 space-y-0.5">
                    {i === 0 && <Label className="text-[10px]">Unidad</Label>}
                    <select value={m.unit} onChange={(e) => setMaterials(materials.map((x, j) => j === i ? { ...x, unit: e.target.value } : x))}
                      className="h-9 w-full rounded border px-2 text-xs bg-background">
                      {UNIT_OPTIONS.map((u) => <option key={u} value={u}>{u}</option>)}
                    </select>
                  </div>
                  <div className="col-span-3 space-y-0.5">
                    {i === 0 && <Label className="text-[10px]">Proveedor</Label>}
                    <Input value={m.supplier ?? ''} onChange={(e) => setMaterials(materials.map((x, j) => j === i ? { ...x, supplier: e.target.value } : x))} placeholder="Proveedor" className="h-9 text-xs" />
                  </div>
                  <button type="button" onClick={() => setMaterials(materials.filter((_, j) => j !== i))}
                    className="col-span-1 self-center text-red-400 hover:text-red-600"><X className="h-4 w-4" /></button>
                </div>
              ))}
            </div>
            <Button type="button" variant="outline" size="sm" onClick={addMaterial} className="w-full">
              <Plus className="mr-1 h-3 w-3" /> Agregar material
            </Button>
          </Section>

          {/* Visitas técnicas */}
          <Section icon={<ClipboardList className="h-4 w-4" />} title="Visitas técnicas" count={visits.length}>
            {visits.map((v, i) => (
              <div key={i} className="rounded-lg border p-3 space-y-2 bg-indigo-50/40">
                <div className="flex justify-between items-start">
                  <p className="text-xs font-semibold text-indigo-700">Visita #{i + 1}</p>
                  <button type="button" onClick={() => setVisits(visits.filter((_, j) => j !== i))}
                    className="text-red-400 hover:text-red-600"><X className="h-4 w-4" /></button>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div><Label className="text-xs">Especialista</Label>
                    <Input value={v.specialistName} onChange={(e) => setVisits(visits.map((x, j) => j === i ? { ...x, specialistName: e.target.value } : x))} placeholder="Nombre completo" className="h-8 text-xs" /></div>
                  <div><Label className="text-xs">Empresa</Label>
                    <Input value={v.company ?? ''} onChange={(e) => setVisits(visits.map((x, j) => j === i ? { ...x, company: e.target.value } : x))} placeholder="Empresa / Firma" className="h-8 text-xs" /></div>
                  <div><Label className="text-xs">Especialidad</Label>
                    <Input value={v.specialty} onChange={(e) => setVisits(visits.map((x, j) => j === i ? { ...x, specialty: e.target.value } : x))} placeholder="Ej. Interventoría estructural" className="h-8 text-xs" /></div>
                  <div><Label className="text-xs">Próxima visita</Label>
                    <Input type="date" value={v.nextVisitDate ?? ''} onChange={(e) => setVisits(visits.map((x, j) => j === i ? { ...x, nextVisitDate: e.target.value } : x))} className="h-8 text-xs" /></div>
                </div>
                <div><Label className="text-xs">Motivo de la visita</Label>
                  <textarea rows={2} value={v.visitReason} onChange={(e) => setVisits(visits.map((x, j) => j === i ? { ...x, visitReason: e.target.value } : x))} placeholder="Describe el motivo…" className="w-full rounded border px-2 py-1.5 text-xs resize-none focus:outline-none focus:ring-1 focus:ring-indigo-300" /></div>
                <div className="grid grid-cols-2 gap-2">
                  <div><Label className="text-xs">Hallazgos</Label>
                    <textarea rows={2} value={v.findings ?? ''} onChange={(e) => setVisits(visits.map((x, j) => j === i ? { ...x, findings: e.target.value } : x))} placeholder="Hallazgos y observaciones…" className="w-full rounded border px-2 py-1.5 text-xs resize-none focus:outline-none focus:ring-1 focus:ring-indigo-300" /></div>
                  <div><Label className="text-xs">Instrucciones</Label>
                    <textarea rows={2} value={v.instructions ?? ''} onChange={(e) => setVisits(visits.map((x, j) => j === i ? { ...x, instructions: e.target.value } : x))} placeholder="Instrucciones impartidas…" className="w-full rounded border px-2 py-1.5 text-xs resize-none focus:outline-none focus:ring-1 focus:ring-indigo-300" /></div>
                </div>
              </div>
            ))}
            <Button type="button" variant="outline" size="sm" onClick={addVisit} className="w-full">
              <Plus className="mr-1 h-3 w-3" /> Agregar visita técnica
            </Button>
          </Section>

          {/* Retrasos */}
          <Section icon={<AlertTriangle className="h-4 w-4" />} title="Retrasos e inconvenientes" count={delays.length}>
            {delays.map((d, i) => (
              <div key={i} className="rounded-lg border border-red-200 p-3 space-y-2 bg-red-50/40">
                <div className="flex justify-between items-start">
                  <select value={d.type} onChange={(e) => setDelays(delays.map((x, j) => j === i ? { ...x, type: e.target.value as DelayType } : x))}
                    className="h-8 rounded border px-2 text-xs bg-background">
                    {(Object.keys(DELAY_META) as DelayType[]).map((t) =>
                      <option key={t} value={t}>{DELAY_META[t].label}</option>
                    )}
                  </select>
                  <button type="button" onClick={() => setDelays(delays.filter((_, j) => j !== i))}
                    className="text-red-400 hover:text-red-600"><X className="h-4 w-4" /></button>
                </div>
                <textarea rows={2} value={d.description} onChange={(e) => setDelays(delays.map((x, j) => j === i ? { ...x, description: e.target.value } : x))} placeholder="Descripción del retraso…" className="w-full rounded border px-2 py-1.5 text-xs resize-none focus:outline-none focus:ring-1 focus:ring-red-300" />
                <div className="grid grid-cols-2 gap-2">
                  <div><Label className="text-xs">Acción tomada</Label>
                    <Input value={d.actionTaken ?? ''} onChange={(e) => setDelays(delays.map((x, j) => j === i ? { ...x, actionTaken: e.target.value } : x))} placeholder="Acción correctiva…" className="h-8 text-xs" /></div>
                  <div><Label className="text-xs">Impacto (días)</Label>
                    <Input type="number" min="0" step="0.5" value={d.impactDays ?? ''} onChange={(e) => setDelays(delays.map((x, j) => j === i ? { ...x, impactDays: e.target.value ? Number(e.target.value) : undefined } : x))} placeholder="0.5" className="h-8 text-xs" /></div>
                </div>
              </div>
            ))}
            <Button type="button" variant="outline" size="sm" onClick={addDelay} className="w-full">
              <Plus className="mr-1 h-3 w-3" /> Registrar retraso
            </Button>
          </Section>

          {/* Fotos */}
          <Section icon={<span className="text-base">📷</span>} title="Registro fotográfico" count={photos.length}>
            <PhotoUpload photos={photos} onChange={setPhotos} />
          </Section>

        </div>

        {/* Footer actions */}
        <div className="flex items-center justify-between gap-3 rounded-b-2xl border-t bg-slate-50 px-6 py-4">
          <Button type="button" variant="outline" onClick={onClose} disabled={mutation.isPending}>Cancelar</Button>
          <div className="flex gap-2">
            <Button type="button" variant="outline" disabled={!canSave || mutation.isPending}
              onClick={() => mutation.mutate('DRAFT')}>
              {mutation.isPending ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : null}
              💾 Guardar borrador
            </Button>
            <Button type="button" disabled={!canSave || mutation.isPending}
              onClick={() => mutation.mutate('FINAL')}
              className="bg-blue-700 hover:bg-blue-800">
              {mutation.isPending ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : null}
              ✅ Guardar y finalizar
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Entry Card ────────────────────────────────────────────────────────────────

function EntryCard({ entry, projectId, projectName, onEdit }: {
  entry: LogbookEntry; projectId: string; projectName: string; onEdit: (e: LogbookEntry) => void;
}) {
  const qc = useQueryClient();
  const [expanded, setExpanded] = useState(false);
  const wm = WEATHER_META[entry.weather];
  const totPax = totalPersonnel(entry.personnel);
  const totHrs = totalPersonHours(entry.personnel);

  const deleteMut = useMutation({
    mutationFn: () => api.deleteLogbookEntry(projectId, entry.id),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['logbook', projectId] });
      void qc.invalidateQueries({ queryKey: ['logbook-stats', projectId] });
      toast.success('Entrada eliminada');
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const handleDelete = () => {
    if (!confirm('¿Eliminar esta entrada de bitácora? Esta acción no se puede deshacer.')) return;
    deleteMut.mutate();
  };

  return (
    <Card className="overflow-hidden transition hover:shadow-md">
      <div className="flex items-stretch">
        {/* Color bar */}
        <div className={`w-1.5 shrink-0 ${entry.status === 'FINAL' ? 'bg-green-500' : 'bg-amber-400'}`} />
        <div className="flex-1 p-0">
          <div className="flex items-start justify-between p-4 pb-3 gap-3">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-base font-bold text-slate-800">{fmtDateShort(entry.date)}</span>
                <span className={`text-lg`}>{wm.emoji}</span>
                <span className={`text-xs font-medium ${wm.color}`}>{wm.label}</span>
                {entry.temperatureC != null && (
                  <span className="text-xs text-slate-500 flex items-center gap-0.5">
                    <Thermometer className="h-3 w-3" />{entry.temperatureC}°C
                  </span>
                )}
                <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                  entry.status === 'FINAL' ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'
                }`}>
                  {entry.status === 'FINAL' ? '✓ Final' : '✏ Borrador'}
                </span>
              </div>
              <p className="mt-1 text-xs text-slate-500">{SHIFT_META[entry.shift].label} · {entry.authorRole}: {entry.authorName}</p>
              <p className="mt-1.5 text-sm text-slate-700 line-clamp-2">{entry.generalNotes}</p>
            </div>
            <div className="flex shrink-0 gap-1">
              <button type="button" onClick={() => openReport(buildEntryReport(entry, projectName))}
                className="rounded-lg border p-1.5 text-slate-400 hover:text-blue-600 hover:border-blue-300 transition" title="Generar PDF">
                <FileText className="h-4 w-4" />
              </button>
              <button type="button" onClick={() => onEdit(entry)}
                className="rounded-lg border p-1.5 text-slate-400 hover:text-slate-700 transition" title="Editar">
                ✏
              </button>
              <button type="button" onClick={handleDelete}
                className="rounded-lg border p-1.5 text-slate-400 hover:text-red-600 hover:border-red-300 transition" title="Eliminar">
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          </div>

          {/* Badges row */}
          <div className="flex flex-wrap gap-2 px-4 pb-3">
            {totPax > 0 && <span className="rounded-full bg-blue-50 px-2 py-0.5 text-[11px] text-blue-700">👷 {totPax} personas · {totHrs.toFixed(0)}h-h</span>}
            {(entry._count?.activities ?? entry.activities.length) > 0 && <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] text-emerald-700">⚡ {entry._count?.activities ?? entry.activities.length} actividades</span>}
            {(entry._count?.technicalVisits ?? entry.technicalVisits.length) > 0 && <span className="rounded-full bg-indigo-50 px-2 py-0.5 text-[11px] text-indigo-700">🔍 {entry._count?.technicalVisits ?? entry.technicalVisits.length} visitas</span>}
            {(entry._count?.delays ?? entry.delays.length) > 0 && <span className="rounded-full bg-red-50 px-2 py-0.5 text-[11px] text-red-700">⚠️ {entry._count?.delays ?? entry.delays.length} retrasos</span>}
            {(entry._count?.photos ?? entry.photos.length) > 0 && <span className="rounded-full bg-purple-50 px-2 py-0.5 text-[11px] text-purple-700">📷 {entry._count?.photos ?? entry.photos.length} fotos</span>}
          </div>

          {/* Expand / photos preview */}
          {entry.photos.length > 0 && (
            <div className="flex gap-1.5 px-4 pb-3">
              {entry.photos.slice(0, 4).map((p, i) => (
                // eslint-disable-next-line @next/next/no-img-element
                <img key={i} src={p.dataUrl ?? p.url} alt={p.caption ?? ''} className="h-14 w-14 rounded-md object-cover border" />
              ))}
              {entry.photos.length > 4 && <div className="flex h-14 w-14 items-center justify-center rounded-md bg-slate-100 text-xs font-bold text-slate-500">+{entry.photos.length - 4}</div>}
            </div>
          )}

          {/* Expand toggle */}
          {(entry.activities.length > 0 || entry.technicalVisits.length > 0 || entry.delays.length > 0) && (
            <button type="button" onClick={() => setExpanded((v) => !v)}
              className="flex w-full items-center justify-center gap-1 border-t px-4 py-2 text-xs text-slate-500 hover:bg-slate-50 transition">
              {expanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
              {expanded ? 'Ocultar detalles' : 'Ver detalles completos'}
            </button>
          )}

          {expanded && (
            <div className="border-t p-4 space-y-4 bg-slate-50/60">
              {entry.activities.length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-slate-600 mb-1.5">⚡ Actividades</p>
                  <ul className="space-y-1">
                    {entry.activities.map((a, i) => (
                      <li key={i} className="flex items-start gap-2 text-xs text-slate-700">
                        <ChevronRight className="h-3 w-3 mt-0.5 shrink-0 text-slate-400" />
                        <span>{a.description}{a.progressPct != null ? ` (${a.progressPct}%)` : ''}{a.location ? ` — ${a.location}` : ''}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {entry.technicalVisits.length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-slate-600 mb-1.5">🔍 Visitas técnicas</p>
                  {entry.technicalVisits.map((v, i) => (
                    <div key={i} className="rounded-md border border-indigo-100 bg-indigo-50/40 px-3 py-2 mb-1.5">
                      <p className="text-xs font-semibold text-indigo-800">{v.specialistName} <span className="font-normal text-indigo-600">· {v.specialty}</span></p>
                      <p className="text-xs text-slate-600 mt-0.5">{v.visitReason}</p>
                      {v.findings && <p className="text-xs text-slate-500 mt-0.5"><b>Hallazgos:</b> {v.findings}</p>}
                    </div>
                  ))}
                </div>
              )}
              {entry.delays.length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-slate-600 mb-1.5">⚠️ Retrasos</p>
                  {entry.delays.map((d, i) => (
                    <div key={i} className="rounded-md border border-red-100 bg-red-50/40 px-3 py-2 mb-1.5">
                      <div className="flex items-center gap-2 mb-0.5">
                        <span className={`text-[10px] rounded-full px-1.5 py-0.5 font-bold ${DELAY_META[d.type].color}`}>{DELAY_META[d.type].label}</span>
                        {d.impactDays != null && <span className="text-[10px] text-slate-500">{d.impactDays} día(s)</span>}
                      </div>
                      <p className="text-xs text-slate-700">{d.description}</p>
                      {d.actionTaken && <p className="text-xs text-slate-500 mt-0.5"><b>Acción:</b> {d.actionTaken}</p>}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </Card>
  );
}

// ─── Main Page ─────────────────────────────────────────────────────────────────

export default function LogbookPage({ params }: { params: { id: string } }) {
  const projectId   = params.id;
  const projectName = 'Proyecto';

  const [search,    setSearch]    = useState('');
  const [dateFrom,  setDateFrom]  = useState('');
  const [dateTo,    setDateTo]    = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'DRAFT' | 'FINAL'>('ALL');
  const [page,      setPage]      = useState(1);
  const [showForm,  setShowForm]  = useState(false);
  const [editEntry, setEditEntry] = useState<LogbookEntry | undefined>();
  const [reportRange, setReportRange] = useState({ from: '', to: '' });
  const [showReportModal, setShowReportModal] = useState(false);

  const queryParams = useMemo(() => {
    const p: Record<string, string> = { page: String(page), limit: '20' };
    if (search.trim()) p.search = search.trim();
    if (dateFrom)      p.dateFrom = dateFrom;
    if (dateTo)        p.dateTo   = dateTo;
    if (statusFilter !== 'ALL') p.status = statusFilter;
    return p;
  }, [search, dateFrom, dateTo, statusFilter, page]);

  const listQ = useQuery({
    queryKey: ['logbook', projectId, queryParams],
    queryFn:  () => api.listLogbook(projectId, queryParams) as unknown as Promise<LogbookListResponse>,
  });

  const statsQ = useQuery({
    queryKey: ['logbook-stats', projectId],
    queryFn:  () => api.getLogbookStats(projectId),
  });

  const entries = (listQ.data?.data ?? []) as LogbookEntry[];
  const stats   = statsQ.data as { total: number; drafts: number; finals: number; lastEntry?: unknown } | undefined;

  const handleEdit = useCallback((e: LogbookEntry) => {
    setEditEntry(e);
    setShowForm(true);
  }, []);

  const handleNewEntry = () => { setEditEntry(undefined); setShowForm(true); };

  const handleRangeReport = () => {
    const from = reportRange.from || dateFrom;
    const to   = reportRange.to   || dateTo;
    if (!from || !to) { toast.error('Selecciona fecha inicio y fin'); return; }
    openReport(buildRangeReport(entries, projectName, from, to));
    setShowReportModal(false);
  };

  const handleVisitsReport = () => {
    if (!entries.some((e) => e.technicalVisits.length > 0)) {
      toast.error('No hay visitas técnicas en el período actual');
      return;
    }
    openReport(buildVisitsReport(entries, projectName));
  };

  return (
    <div className="space-y-6">
      <ModuleHeader
        title="Bitácora de Obra"
        description="Registro diario de actividades, personal, equipos, materiales y visitas técnicas"
        infoText="Registra cada jornada de trabajo con clima, actividades, personal y documentación fotográfica. Genera reportes profesionales en HTML."
        actions={
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => setShowReportModal(true)}>
              <Download className="mr-1.5 h-4 w-4" /> Reportes
            </Button>
            <Button size="sm" onClick={handleNewEntry} className="bg-blue-700 hover:bg-blue-800">
              <Plus className="mr-1.5 h-4 w-4" /> Nueva bitácora
            </Button>
          </div>
        }
      />

      {/* Stats */}
      {stats && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            { label: 'Total jornadas', value: stats.total,  color: 'from-blue-600 to-blue-800' },
            { label: 'Finalizadas',    value: stats.finals, color: 'from-green-600 to-green-800' },
            { label: 'Borradores',     value: stats.drafts, color: 'from-amber-500 to-amber-700' },
            { label: 'Este mes',       value: entries.filter((e) => e.date.startsWith(new Date().toISOString().slice(0, 7))).length, color: 'from-violet-600 to-violet-800' },
          ].map(({ label, value, color }) => (
            <div key={label} className={`rounded-xl bg-gradient-to-br ${color} p-4 text-white`}>
              <p className="text-2xl font-bold">{value}</p>
              <p className="text-xs opacity-75 mt-0.5 uppercase tracking-wide">{label}</p>
            </div>
          ))}
        </div>
      )}

      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative flex-1 min-w-48">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
              <Input value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }}
                placeholder="Buscar en bitácoras…" className="pl-9" />
            </div>
            <Input type="date" value={dateFrom} onChange={(e) => { setDateFrom(e.target.value); setPage(1); }} className="w-40" title="Desde" />
            <Input type="date" value={dateTo}   onChange={(e) => { setDateTo(e.target.value);   setPage(1); }} className="w-40" title="Hasta" />
            <div className="flex rounded-lg border overflow-hidden">
              {(['ALL', 'FINAL', 'DRAFT'] as const).map((s) => (
                <button key={s} onClick={() => { setStatusFilter(s); setPage(1); }}
                  className={`px-3 py-1.5 text-xs font-medium transition ${statusFilter === s ? 'bg-blue-600 text-white' : 'bg-white text-slate-600 hover:bg-slate-50'}`}>
                  {s === 'ALL' ? 'Todos' : s === 'FINAL' ? '✓ Final' : '✏ Borrador'}
                </button>
              ))}
            </div>
            {(search || dateFrom || dateTo) && (
              <button onClick={() => { setSearch(''); setDateFrom(''); setDateTo(''); setPage(1); }}
                className="text-xs text-slate-500 hover:text-slate-700 underline">Limpiar</button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* List */}
      {listQ.isLoading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
        </div>
      ) : entries.length === 0 ? (
        <div className="flex flex-col items-center py-16 text-center">
          <BookOpen className="h-12 w-12 text-slate-300 mb-3" />
          <p className="text-slate-500 font-medium">No hay entradas de bitácora</p>
          <p className="text-sm text-slate-400 mt-1">
            {search || dateFrom || dateTo ? 'Prueba con otros filtros' : 'Crea la primera bitácora del día'}
          </p>
          {!search && !dateFrom && !dateTo && (
            <Button size="sm" className="mt-4" onClick={handleNewEntry}>
              <Plus className="mr-1.5 h-4 w-4" /> Nueva bitácora
            </Button>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {entries.map((e) => (
            <EntryCard key={e.id} entry={e} projectId={projectId} projectName={projectName} onEdit={handleEdit} />
          ))}
        </div>
      )}

      {/* Pagination */}
      {listQ.data && listQ.data.pages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <Button variant="outline" size="sm" onClick={() => setPage((p) => p - 1)} disabled={page <= 1}>Anterior</Button>
          <span className="text-sm text-slate-500">Página {page} de {listQ.data.pages}</span>
          <Button variant="outline" size="sm" onClick={() => setPage((p) => p + 1)} disabled={page >= listQ.data.pages}>Siguiente</Button>
        </div>
      )}

      {/* Entry Form Modal */}
      {showForm && (
        <EntryForm projectId={projectId} entry={editEntry} onClose={() => { setShowForm(false); setEditEntry(undefined); }} />
      )}

      {/* Report Modal */}
      {showReportModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <Card className="w-full max-w-md shadow-2xl">
            <CardHeader className="pb-2">
              <div className="flex justify-between items-center">
                <CardTitle className="text-base flex items-center gap-2"><Download className="h-4 w-4" /> Generar reportes</CardTitle>
                <button onClick={() => setShowReportModal(false)} className="text-slate-400 hover:text-slate-600"><X className="h-5 w-5" /></button>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-2">
                <div><Label className="text-xs">Desde</Label>
                  <Input type="date" value={reportRange.from} onChange={(e) => setReportRange((r) => ({ ...r, from: e.target.value }))} /></div>
                <div><Label className="text-xs">Hasta</Label>
                  <Input type="date" value={reportRange.to} onChange={(e) => setReportRange((r) => ({ ...r, to: e.target.value }))} /></div>
              </div>
              <div className="space-y-2">
                <Button className="w-full justify-start" variant="outline" onClick={handleRangeReport}>
                  <FileText className="mr-2 h-4 w-4 text-blue-600" /> Reporte por rango de fechas
                </Button>
                <Button className="w-full justify-start" variant="outline" onClick={handleVisitsReport}>
                  <Eye className="mr-2 h-4 w-4 text-indigo-600" /> Reporte visitas técnicas
                </Button>
                {entries.length === 1 && entries[0] && (
                  <Button className="w-full justify-start" variant="outline"
                    onClick={() => { openReport(buildEntryReport(entries[0]!, projectName)); setShowReportModal(false); }}>
                    <FileText className="mr-2 h-4 w-4 text-green-600" /> Reporte entrada individual
                  </Button>
                )}
              </div>
              <p className="text-xs text-slate-400 text-center">Los reportes se abren en una nueva pestaña (HTML imprimible)</p>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
