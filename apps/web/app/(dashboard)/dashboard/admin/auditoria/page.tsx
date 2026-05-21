'use client';

import {
  Activity, ChevronLeft, ChevronRight, Filter, Loader2, RefreshCw, Search, ShieldCheck,
} from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';

import { api } from '@/lib/api-client';
import { cn } from '@/lib/utils';

// ── Types ─────────────────────────────────────────────────────────────────────

type LogEntry = {
  id: string;
  action: string;
  entityType: string;
  entityId: string | null;
  diff: unknown;
  ip: string | null;
  createdAt: string;
  user: { id: string; fullName: string; email: string; role: string } | null;
};

type LogPage = {
  data: LogEntry[];
  total: number;
  page: number;
  pages: number;
};

type Stats = {
  totalToday: number;
  totalWeek: number;
  byModule: { entityType: string; _count: { _all: number } }[];
};

// ── Constants ─────────────────────────────────────────────────────────────────

const ACTION_COLORS: Record<string, string> = {
  CREATE: 'bg-emerald-100 text-emerald-700',
  UPDATE: 'bg-blue-100 text-blue-700',
  DELETE: 'bg-red-100 text-red-700',
  LOGIN:  'bg-slate-100 text-slate-600',
  EXPORT: 'bg-violet-100 text-violet-700',
  IMPORT: 'bg-amber-100 text-amber-700',
};

const ENTITY_LABELS: Record<string, string> = {
  BudgetItem:     'Presupuesto',
  Chapter:        'Capítulo',
  Project:        'Proyecto',
  User:           'Usuario',
  LogbookEntry:   'Bitácora',
  CashFlowEntry:  'Caja',
  Contract:       'Contrato',
  ChangeOrder:    'Cambio',
  QualityIssue:   'Calidad',
  SafetyReport:   'SST',
  FeasibilityAnalysis: 'Prefactibilidad',
};

function actionColor(action: string) {
  const key = Object.keys(ACTION_COLORS).find((k) => action.toUpperCase().includes(k));
  return key ? ACTION_COLORS[key] : 'bg-gray-100 text-gray-600';
}

function Avatar({ name, size = 7 }: { name: string; size?: number }) {
  const colors = ['bg-teal-500','bg-blue-500','bg-violet-500','bg-rose-500','bg-amber-500'];
  const color = colors[name.charCodeAt(0) % colors.length];
  return (
    <div className={cn(`h-${size} w-${size} flex shrink-0 items-center justify-center rounded-full text-[10px] font-bold text-white`, color)}>
      {name.charAt(0).toUpperCase()}
    </div>
  );
}

// ── DiffViewer ────────────────────────────────────────────────────────────────

function DiffViewer({ diff }: { diff: unknown }): React.ReactElement | null {
  if (diff === null || diff === undefined) return null;
  let display: string;
  try {
    display = JSON.stringify(diff, null, 2);
  } catch {
    display = String(diff);
  }
  return (
    <pre className="mt-2 max-h-40 overflow-auto rounded-lg bg-slate-900 p-3 text-[10px] text-slate-300 font-mono">
      {display}
    </pre>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function AuditoriaPage() {
  const [logs, setLogs]         = useState<LogPage | null>(null);
  const [stats, setStats]       = useState<Stats | null>(null);
  const [loading, setLoading]   = useState(true);
  const [expanded, setExpanded] = useState<string | null>(null);

  // Filters
  const [page, setPage]             = useState(1);
  const [search, setSearch]         = useState('');
  const [entityType, setEntityType] = useState('');
  const [action, setAction]         = useState('');
  const [from, setFrom]             = useState('');
  const [to, setTo]                 = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, string> = { page: String(page), limit: '30' };
      if (action)     params.action     = action;
      if (entityType) params.entityType = entityType;
      if (from)       params.from       = new Date(from).toISOString();
      if (to)         params.to         = new Date(to + 'T23:59:59').toISOString();

      const [logsRes, statsRes] = await Promise.all([
        api.getAuditLogs(params),
        api.getAuditStats(),
      ]);
      setLogs(logsRes as LogPage);
      setStats(statsRes as Stats);
    } catch {
      toast.error('Error al cargar auditoría');
    } finally {
      setLoading(false);
    }
  }, [page, action, entityType, from, to]);

  useEffect(() => { load(); }, [load]);

  // Reset page on filter change
  useEffect(() => { setPage(1); }, [action, entityType, from, to]);

  const filtered = (logs?.data ?? []).filter((log) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      log.action.toLowerCase().includes(q) ||
      log.entityType.toLowerCase().includes(q) ||
      (log.user?.fullName ?? '').toLowerCase().includes(q)
    );
  });

  return (
    <div className="space-y-6">

      {/* Stats strip */}
      {stats && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="rounded-xl border border-slate-200 bg-white px-4 py-3">
            <p className="text-2xl font-bold text-slate-900">{stats.totalToday}</p>
            <p className="text-xs text-slate-500">Acciones hoy</p>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white px-4 py-3">
            <p className="text-2xl font-bold text-slate-900">{stats.totalWeek}</p>
            <p className="text-xs text-slate-500">Esta semana</p>
          </div>
          {stats.byModule.slice(0, 2).map((m) => (
            <div key={m.entityType} className="rounded-xl border border-slate-200 bg-white px-4 py-3">
              <p className="text-2xl font-bold text-slate-900">{m._count._all}</p>
              <p className="text-xs text-slate-500">{ENTITY_LABELS[m.entityType] ?? m.entityType}</p>
            </div>
          ))}
        </div>
      )}

      {/* Filters */}
      <div className="rounded-xl border border-slate-200 bg-white p-4">
        <div className="flex items-center gap-2 mb-3">
          <Filter className="h-4 w-4 text-slate-400" />
          <span className="text-sm font-semibold text-slate-700">Filtros</span>
          <button
            onClick={() => { setAction(''); setEntityType(''); setFrom(''); setTo(''); setSearch(''); }}
            className="ml-auto text-xs text-slate-400 hover:text-slate-600"
          >
            Limpiar
          </button>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <div className="relative sm:col-span-2 lg:col-span-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar..."
              className="w-full rounded-lg border border-slate-200 py-2 pl-8 pr-3 text-sm focus:border-slate-400 focus:outline-none"
            />
          </div>
          <select
            value={action}
            onChange={(e) => setAction(e.target.value)}
            className="rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-slate-400 focus:outline-none"
          >
            <option value="">Todas las acciones</option>
            {Object.keys(ACTION_COLORS).map((a) => (
              <option key={a} value={a}>{a}</option>
            ))}
          </select>
          <select
            value={entityType}
            onChange={(e) => setEntityType(e.target.value)}
            className="rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-slate-400 focus:outline-none"
          >
            <option value="">Todos los módulos</option>
            {Object.entries(ENTITY_LABELS).map(([val, label]) => (
              <option key={val} value={val}>{label}</option>
            ))}
          </select>
          <div className="flex gap-2">
            <input type="date" value={from} onChange={(e) => setFrom(e.target.value)}
              className="flex-1 rounded-lg border border-slate-200 px-2 py-2 text-sm focus:border-slate-400 focus:outline-none" />
            <input type="date" value={to} onChange={(e) => setTo(e.target.value)}
              className="flex-1 rounded-lg border border-slate-200 px-2 py-2 text-sm focus:border-slate-400 focus:outline-none" />
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
        <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-slate-400" />
            <span className="text-sm font-semibold text-slate-700">Registro de actividad</span>
            {logs && <span className="text-xs text-slate-400">({logs.total} entradas)</span>}
          </div>
          <button onClick={load} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 transition-colors">
            <RefreshCw className={cn('h-4 w-4', loading && 'animate-spin')} />
          </button>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-slate-400">
            <Activity className="h-8 w-8 mb-2" />
            <p className="text-sm">Sin registros de actividad</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {filtered.map((log) => (
              <div key={log.id}>
                <button
                  onClick={() => setExpanded(expanded === log.id ? null : log.id)}
                  className="w-full flex items-start gap-3 px-4 py-3 hover:bg-slate-50 transition-colors text-left"
                >
                  {/* Avatar */}
                  <Avatar name={log.user?.fullName ?? '?'} />

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-sm text-slate-900 truncate">
                        {log.user?.fullName ?? 'Sistema'}
                      </span>
                      <span className={cn('rounded-full px-2 py-0.5 text-[10px] font-bold', actionColor(log.action))}>
                        {log.action}
                      </span>
                      <span className="text-xs text-slate-500">
                        {ENTITY_LABELS[log.entityType] ?? log.entityType}
                        {log.entityId && <span className="font-mono ml-1 opacity-60">#{log.entityId.slice(-8)}</span>}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 mt-0.5">
                      <span className="text-[11px] text-slate-400">
                        {new Date(log.createdAt).toLocaleString('es-CO', {
                          day: '2-digit', month: 'short', year: 'numeric',
                          hour: '2-digit', minute: '2-digit',
                        })}
                      </span>
                      {log.ip && <span className="text-[10px] text-slate-400 font-mono">{log.ip}</span>}
                    </div>
                  </div>

                  <ChevronRight className={cn(
                    'h-4 w-4 text-slate-300 shrink-0 transition-transform mt-0.5',
                    expanded === log.id && 'rotate-90',
                  )} />
                </button>

                {/* Expanded diff */}
                {expanded === log.id && !!log.diff && (
                  <div className="px-4 pb-3 ml-10">
                    <p className="text-[10px] font-semibold text-slate-400 mb-1 uppercase tracking-wider">Cambios registrados</p>
                    <DiffViewer diff={log.diff} />
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Pagination */}
        {logs && logs.pages > 1 && (
          <div className="flex items-center justify-between border-t border-slate-100 px-4 py-3">
            <span className="text-xs text-slate-500">
              Página {logs.page} de {logs.pages}
            </span>
            <div className="flex gap-2">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className="flex items-center gap-1 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <ChevronLeft className="h-3.5 w-3.5" /> Anterior
              </button>
              <button
                onClick={() => setPage((p) => Math.min(logs.pages, p + 1))}
                disabled={page === logs.pages}
                className="flex items-center gap-1 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Siguiente <ChevronRight className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
