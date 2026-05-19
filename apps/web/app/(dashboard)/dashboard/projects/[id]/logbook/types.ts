// ── Tipos del módulo Bitácora de Obra ─────────────────────────────────────────

export type WeatherCondition =
  | 'SUNNY' | 'PARTLY_CLOUDY' | 'CLOUDY' | 'RAINY' | 'STORM' | 'WINDY' | 'FOGGY';

export type LogbookStatus = 'DRAFT' | 'FINAL';
export type ShiftType     = 'MORNING' | 'AFTERNOON' | 'FULL';
export type DelayType     = 'WEATHER' | 'MATERIALS' | 'EQUIPMENT' | 'LABOR' | 'ADMINISTRATIVE' | 'OTHER';

export interface LogbookPhoto {
  id?:       string;
  url:       string;
  dataUrl?:  string;
  caption?:  string;
  takenAt?:  string;
  lat?:      number;
  lng?:      number;
  sizeBytes?: number;
  mimeType:  string;
  order:     number;
}

export interface LogbookPersonnel {
  id?:          string;
  role:         string;
  name?:        string;
  count:        number;
  hoursWorked:  number;
  company?:     string;
  observations?: string;
}

export interface LogbookEquipment {
  id?:           string;
  type:          string;
  quantity:      number;
  hoursOperated: number;
  operator?:     string;
  observations?: string;
}

export interface LogbookMaterial {
  id?:      string;
  name:     string;
  quantity: number;
  unit:     string;
  supplier?: string;
  notes?:   string;
}

export interface LogbookActivity {
  id?:           string;
  description:   string;
  progressPct?:  number;
  crew?:         string;
  location?:     string;
  observations?: string;
  order:         number;
}

export interface LogbookTechnicalVisit {
  id?:            string;
  specialistName: string;
  company?:       string;
  specialty:      string;
  visitReason:    string;
  findings?:      string;
  instructions?:  string;
  nextVisitDate?: string;
}

export interface LogbookDelay {
  id?:         string;
  type:        DelayType;
  description: string;
  actionTaken?: string;
  impactDays?:  number;
  responsible?: string;
}

export interface LogbookEntry {
  id:             string;
  projectId:      string;
  date:           string;
  status:         LogbookStatus;
  weather:        WeatherCondition;
  weatherDesc?:   string;
  temperatureC?:  number | null;
  humidity?:      number | null;
  windSpeedKmh?:  number | null;
  shift:          ShiftType;
  generalNotes:   string;
  safetyNotes?:   string;
  qualityNotes?:  string;
  authorName:     string;
  authorRole:     string;
  createdAt:      string;
  updatedAt:      string;
  photos:         LogbookPhoto[];
  personnel:      LogbookPersonnel[];
  equipment:      LogbookEquipment[];
  materials:      LogbookMaterial[];
  activities:     LogbookActivity[];
  technicalVisits: LogbookTechnicalVisit[];
  delays:         LogbookDelay[];
  _count?: {
    photos: number; activities: number; technicalVisits: number; delays: number;
  };
}

export interface LogbookListResponse {
  data:  LogbookEntry[];
  total: number;
  page:  number;
  limit: number;
  pages: number;
}

// ── Constantes ────────────────────────────────────────────────────────────────

export const WEATHER_META: Record<WeatherCondition, { label: string; emoji: string; color: string; bg: string }> = {
  SUNNY:        { label: 'Despejado',      emoji: '☀️',  color: 'text-yellow-600', bg: 'bg-yellow-50 border-yellow-200' },
  PARTLY_CLOUDY:{ label: 'Parcialmente nublado', emoji: '⛅', color: 'text-blue-500',   bg: 'bg-blue-50 border-blue-200' },
  CLOUDY:       { label: 'Nublado',        emoji: '☁️',  color: 'text-slate-500',  bg: 'bg-slate-50 border-slate-200' },
  RAINY:        { label: 'Lluvioso',       emoji: '🌧️', color: 'text-blue-600',   bg: 'bg-blue-50 border-blue-200' },
  STORM:        { label: 'Tormenta',       emoji: '⛈️', color: 'text-red-600',    bg: 'bg-red-50 border-red-200' },
  WINDY:        { label: 'Ventoso',        emoji: '💨',  color: 'text-teal-600',  bg: 'bg-teal-50 border-teal-200' },
  FOGGY:        { label: 'Neblina/Bruma',  emoji: '🌫️', color: 'text-gray-500',  bg: 'bg-gray-50 border-gray-200' },
};

export const SHIFT_META: Record<ShiftType, { label: string; hours: string }> = {
  MORNING:   { label: 'Turno mañana',     hours: '6:00 – 14:00' },
  AFTERNOON: { label: 'Turno tarde',      hours: '14:00 – 22:00' },
  FULL:      { label: 'Jornada completa', hours: '6:00 – 18:00' },
};

export const DELAY_META: Record<DelayType, { label: string; color: string }> = {
  WEATHER:        { label: 'Clima',            color: 'bg-blue-100 text-blue-700' },
  MATERIALS:      { label: 'Materiales',       color: 'bg-orange-100 text-orange-700' },
  EQUIPMENT:      { label: 'Equipos',          color: 'bg-purple-100 text-purple-700' },
  LABOR:          { label: 'Mano de obra',     color: 'bg-yellow-100 text-yellow-700' },
  ADMINISTRATIVE: { label: 'Administrativo',   color: 'bg-gray-100 text-gray-700' },
  OTHER:          { label: 'Otro',             color: 'bg-red-100 text-red-700' },
};

export const ROLE_OPTIONS = [
  'Director de obra', 'Residente de obra', 'Inspector', 'Interventor',
  'Maestro de obra', 'Oficiales', 'Auxiliares / Ayudantes',
  'Topógrafo', 'Electricista', 'Plomero / Fontanero', 'Soldador',
  'Operador de equipo', 'Celador / Vigilante', 'Otro',
];

export const EQUIPMENT_OPTIONS = [
  'Mezcladora de concreto', 'Bomba estacionaria de concreto', 'Vibrador de concreto',
  'Grúa torre', 'Montacargas', 'Placa vibroapisonadora', 'Retroexcavadora',
  'Miniexcavadora', 'Compactadora de suelos', 'Andamios metálicos',
  'Andamio colgante', 'Sierra circular', 'Taladro industrial', 'Compresor',
  'Generador eléctrico', 'Bomba de agua', 'Otro',
];

export const UNIT_OPTIONS = ['m³', 'm²', 'm', 'kg', 'ton', 'L', 'gl', 'und', 'bolsa', 'lámina', 'varilla', 'ml'];

// ── Helpers ───────────────────────────────────────────────────────────────────

export function uid() {
  return Math.random().toString(36).slice(2, 10);
}

export function fmtDate(d: string): string {
  return new Date(d.includes('T') ? d : d + 'T12:00:00').toLocaleDateString('es-CO', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  });
}

export function fmtDateShort(d: string): string {
  return new Date(d.includes('T') ? d : d + 'T12:00:00').toLocaleDateString('es-CO', {
    day: '2-digit', month: 'short', year: 'numeric',
  });
}

export function totalPersonnel(p: LogbookPersonnel[]): number {
  return p.reduce((s, r) => s + r.count, 0);
}

export function totalPersonHours(p: LogbookPersonnel[]): number {
  return p.reduce((s, r) => s + r.count * r.hoursWorked, 0);
}
