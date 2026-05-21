'use client';

import {
  AlertTriangle,
  BarChart3,
  Banknote,
  BookOpen,
  Building2,
  Calendar,
  CalendarClock,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ClipboardCheck,
  ClipboardList,
  DollarSign,
  Download,
  FileCheck2,
  FileText,
  FolderOpen,
  GitBranch,
  Home,
  LayoutDashboard,
  LineChart,
  LogOut,
  Menu,
  Shield,
  ShieldAlert,
  ShieldCheck,
  TrendingUp,
  Users,
  Wallet,
  X,
} from 'lucide-react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Toaster } from 'sonner';

import { ProjectContextLoader } from '@/components/project-context-loader';
import { QuickEntryButton } from '@/components/quick-entry-button';
import { api as apiClient } from '@/lib/api-client';
import { useAuth } from '@/lib/auth-store';
import { useProjectStore } from '@/lib/project-store';
import { useSidebarStore } from '@/lib/sidebar-store';
import { cn } from '@/lib/utils';

// ── Types ────────────────────────────────────────────────────────────────────

type SidebarStats = {
  budgetProgress: number;    // % ejecutado del presupuesto (0-100)
  scheduleProgress: number;  // % avance cronograma (0-100)
  overallProgress: number;   // % avance global del proyecto (0-100)
  budgetStatus: 'green' | 'yellow' | 'red'; // semáforo presupuestal
  alertsByModule: Partial<Record<string, number>>; // sub -> count de alertas
};

// ── Config ───────────────────────────────────────────────────────────────────

const NAV_MAIN = [
  { href: '/dashboard',          label: 'Inicio',    icon: Home,       exact: true,  shortcut: 'G H', adminOnly: false },
  { href: '/dashboard/projects', label: 'Proyectos', icon: FolderOpen, exact: false, shortcut: 'G P', adminOnly: false },
  { href: '/dashboard/admin',    label: 'Admin',     icon: Shield,     exact: false, shortcut: 'G A', adminOnly: true  },
];

type ModuleEntry = {
  sub: string;
  label: string;
  icon: React.ElementType;
  group: string;
  iconColor: string;
  bgActive: string;
  barColor: string;
  tip: string;
  showProgress?: boolean;
};

const PROJECT_MODULES: ModuleEntry[] = [
  // ── 1. Visión ──────────────────────────────────────────────────────────────
  {
    sub: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, group: 'Visión',
    iconColor: 'text-teal-400', bgActive: 'bg-teal-400/12', barColor: 'bg-teal-400',
    tip: 'KPIs · SPI/CPI · Alertas en tiempo real',
  },
  // ── 2. Planificación ───────────────────────────────────────────────────────
  {
    sub: 'feasibility', label: 'Prefactibilidad', icon: TrendingUp, group: 'Planificación',
    iconColor: 'text-blue-400', bgActive: 'bg-blue-400/12', barColor: 'bg-blue-400',
    tip: 'TIR · VPN · Payback · Escenarios',
  },
  {
    sub: 'budget', label: 'Presupuesto', icon: Wallet, group: 'Planificación',
    iconColor: 'text-emerald-400', bgActive: 'bg-emerald-400/12', barColor: 'bg-emerald-400',
    tip: 'Capítulos · AIU · APUs · Análisis de precios', showProgress: true,
  },
  {
    sub: 'schedule', label: 'Cronograma', icon: CalendarClock, group: 'Planificación',
    iconColor: 'text-violet-400', bgActive: 'bg-violet-400/12', barColor: 'bg-violet-400',
    tip: 'Gantt · CPM · Valor Ganado · Línea base', showProgress: true,
  },
  {
    sub: 'sales', label: 'Ventas', icon: Users, group: 'Planificación',
    iconColor: 'text-rose-400', bgActive: 'bg-rose-400/12', barColor: 'bg-rose-400',
    tip: 'Torres · Unidades · Reservas · Promesas',
  },
  // ── 3. Ejecución ───────────────────────────────────────────────────────────
  {
    sub: 'cashflow', label: 'Flujo de caja', icon: Banknote, group: 'Ejecución',
    iconColor: 'text-green-400', bgActive: 'bg-green-400/12', barColor: 'bg-green-400',
    tip: 'Ingresos/Egresos · Crédito constructor · Curva S',
  },
  {
    sub: 'contracts', label: 'Contratos', icon: FileCheck2, group: 'Ejecución',
    iconColor: 'text-orange-400', bgActive: 'bg-orange-400/12', barColor: 'bg-orange-400',
    tip: 'Proveedores · Actas de pago · Órdenes de compra',
  },
  {
    sub: 'logbook', label: 'Bitácora', icon: BookOpen, group: 'Ejecución',
    iconColor: 'text-sky-400', bgActive: 'bg-sky-400/12', barColor: 'bg-sky-400',
    tip: 'Registro diario · Personal · Clima · Fotos',
  },
  // ── 4. Control ─────────────────────────────────────────────────────────────
  {
    sub: 'changes', label: 'Cambios', icon: GitBranch, group: 'Control',
    iconColor: 'text-amber-400', bgActive: 'bg-amber-400/12', barColor: 'bg-amber-400',
    tip: 'Órdenes de cambio · Aprobaciones · Impacto',
  },
  {
    sub: 'quality', label: 'Calidad NCR', icon: ClipboardCheck, group: 'Control',
    iconColor: 'text-red-400', bgActive: 'bg-red-400/12', barColor: 'bg-red-400',
    tip: 'No Conformidades · ISO 9001 · Seguimiento',
  },
  {
    sub: 'safety', label: 'SST', icon: ShieldAlert, group: 'Control',
    iconColor: 'text-cyan-400', bgActive: 'bg-cyan-400/12', barColor: 'bg-cyan-400',
    tip: 'Seguridad · Incidentes · EPPs · SG-SST',
  },
  // ── 5. Reportes ────────────────────────────────────────────────────────────
  {
    sub: 'reports', label: 'Reportes', icon: BarChart3, group: 'Reportes',
    iconColor: 'text-slate-400', bgActive: 'bg-slate-400/12', barColor: 'bg-slate-500',
    tip: 'CSV · HTML · PDF · Presupuesto · Bitácora',
  },
];

// Grupos con su color de acento
const GROUP_CONFIG: Record<string, { accent: string; dot: string }> = {
  'Visión':        { accent: 'text-teal-400',    dot: 'bg-teal-400'    },
  'Planificación': { accent: 'text-blue-400',    dot: 'bg-blue-400'    },
  'Ejecución':     { accent: 'text-emerald-400', dot: 'bg-emerald-400' },
  'Control':       { accent: 'text-amber-400',   dot: 'bg-amber-400'   },
  'Reportes':      { accent: 'text-slate-400',   dot: 'bg-slate-400'   },
};

const STATUS_DOT: Record<string, string> = {
  EJECUCION:       'bg-green-500',
  FACTIBILIDAD:    'bg-blue-500',
  PREFACTIBILIDAD: 'bg-slate-400',
  CIERRE:          'bg-amber-500',
  ARCHIVADO:       'bg-gray-500',
};

const STATUS_LABEL: Record<string, string> = {
  EJECUCION:       'En ejecución',
  FACTIBILIDAD:    'Factibilidad',
  PREFACTIBILIDAD: 'Prefactibilidad',
  CIERRE:          'En cierre',
  ARCHIVADO:       'Archivado',
};

const AVATAR_COLORS: Record<string, string> = {
  A:'bg-teal-600',B:'bg-blue-600',C:'bg-cyan-600',D:'bg-indigo-600',
  E:'bg-emerald-600',F:'bg-fuchsia-600',G:'bg-green-600',H:'bg-orange-600',
  I:'bg-purple-600',J:'bg-rose-600',K:'bg-sky-600',L:'bg-lime-600',
  M:'bg-amber-600',N:'bg-pink-600',O:'bg-red-600',P:'bg-violet-600',
};
function avatarColor(name?: string) {
  const ch = (name ?? 'A').charAt(0).toUpperCase();
  return AVATAR_COLORS[ch] ?? 'bg-slate-600';
}

const MODULE_LABELS: Record<string, string> = {
  feasibility:'Prefactibilidad', budget:'Presupuesto', schedule:'Cronograma',
  cashflow:'Flujo de caja', sales:'Ventas', changes:'Cambios',
  dashboard:'Dashboard', reports:'Reportes', logbook:'Bitácora',
  contracts:'Contratos', quality:'Calidad NCR', safety:'SST',
};

// ── NavItem (main nav) ────────────────────────────────────────────────────────

function NavItem({
  href, label, icon: Icon, exact, shortcut, collapsed,
}: {
  href: string; label: string; icon: React.ElementType;
  exact?: boolean; shortcut?: string; collapsed: boolean;
}) {
  const pathname = usePathname();
  const active = exact ? pathname === href : pathname === href || pathname.startsWith(`${href}/`);

  return (
    <Link
      href={href}
      title={collapsed ? label : (shortcut ? `${label} (${shortcut})` : label)}
      className={cn(
        'group relative flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-all duration-150',
        collapsed && 'justify-center px-2',
        active
          ? 'border-l-2 border-teal-400 bg-white/10 pl-[10px] text-white shadow-sm'
          : 'text-slate-400 hover:bg-white/5 hover:text-slate-200',
      )}
    >
      <Icon className={cn('h-4 w-4 shrink-0', active ? 'text-teal-400' : '')} />
      {!collapsed && (
        <>
          <span className="flex-1">{label}</span>
          {shortcut && (
            <span className="hidden rounded bg-white/10 px-1 py-0.5 text-[9px] font-mono text-slate-500 group-hover:inline">
              {shortcut}
            </span>
          )}
        </>
      )}
      {collapsed && (
        <div className="pointer-events-none absolute left-full ml-2 z-50 whitespace-nowrap rounded-md bg-slate-800 border border-white/10 px-2.5 py-1.5 text-xs font-medium text-white opacity-0 shadow-lg transition-opacity group-hover:opacity-100">
          {label}
        </div>
      )}
    </Link>
  );
}

// ── ModuleNavItem ─────────────────────────────────────────────────────────────

function ModuleNavItem({
  href, label, icon: Icon, tip, collapsed,
  iconColor, bgActive, barColor,
  badge, progress,
}: {
  href: string; label: string; icon: React.ElementType; tip?: string; collapsed: boolean;
  iconColor: string; bgActive: string; barColor: string;
  badge?: number; progress?: number | null;
}) {
  const pathname = usePathname();
  const active = pathname === href || pathname.startsWith(`${href}/`);

  return (
    <Link
      href={href}
      title={collapsed ? (tip ?? label) : undefined}
      className={cn(
        'group relative flex flex-col rounded-lg px-2.5 py-1.5 transition-all duration-150',
        collapsed && 'items-center px-2 py-2',
        active ? [bgActive, 'border-l-2 border-current pl-[8px]', iconColor] : 'hover:bg-white/5',
      )}
    >
      {/* Main row */}
      <div className={cn('flex items-center gap-2.5 w-full', collapsed && 'justify-center')}>
        {/* Icon with glow on active */}
        <div className={cn(
          'flex h-6 w-6 shrink-0 items-center justify-center rounded-md transition-all',
          active ? cn('bg-current/15', 'ring-1 ring-current/30') : 'bg-transparent',
        )}>
          <Icon className={cn(
            'h-3.5 w-3.5 shrink-0 transition-colors',
            active ? iconColor : 'text-slate-500 group-hover:text-slate-300',
          )} />
        </div>

        {!collapsed && (
          <>
            <span className={cn(
              'flex-1 text-[13px] font-medium transition-colors',
              active ? 'text-white' : 'text-slate-400 group-hover:text-slate-200',
            )}>
              {label}
            </span>
            {/* Badge */}
            {badge != null && badge > 0 && (
              <span className={cn(
                'ml-auto flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[10px] font-bold text-white',
                barColor,
              )}>
                {badge > 9 ? '9+' : badge}
              </span>
            )}
          </>
        )}

        {/* Badge collapsed */}
        {collapsed && badge != null && badge > 0 && (
          <span className={cn(
            'absolute -top-0.5 -right-0.5 flex h-3.5 min-w-3.5 items-center justify-center rounded-full text-[8px] font-bold text-white',
            barColor,
          )}>
            {badge > 9 ? '9+' : badge}
          </span>
        )}
      </div>

      {/* Mini progress bar (only when expanded and has progress) */}
      {!collapsed && progress != null && (
        <div className="mt-1.5 ml-8 mr-0.5">
          <div className="flex items-center justify-between mb-0.5">
            <span className="text-[9px] text-slate-600">Avance</span>
            <span className={cn('text-[9px] font-semibold', iconColor)}>{Math.round(progress)}%</span>
          </div>
          <div className="h-1 w-full overflow-hidden rounded-full bg-white/8">
            <div
              className={cn('h-full rounded-full transition-all duration-500', barColor, 'opacity-80')}
              style={{ width: `${Math.min(100, Math.max(0, progress))}%` }}
            />
          </div>
        </div>
      )}

      {/* Tooltip collapsed */}
      {collapsed && (
        <div className="pointer-events-none absolute left-full ml-2 z-50 whitespace-nowrap rounded-md bg-slate-800 border border-white/10 px-2.5 py-1.5 text-xs font-medium text-white opacity-0 shadow-lg transition-opacity group-hover:opacity-100">
          {label}
          {tip && <div className="text-[10px] text-slate-400 mt-0.5 max-w-48 whitespace-normal">{tip}</div>}
          {progress != null && (
            <div className="mt-1.5 flex items-center gap-1.5">
              <div className="h-1 w-20 overflow-hidden rounded-full bg-white/20">
                <div className={cn('h-full rounded-full', barColor)} style={{ width: `${progress}%` }} />
              </div>
              <span className="text-[10px] text-slate-300">{Math.round(progress)}%</span>
            </div>
          )}
        </div>
      )}
    </Link>
  );
}

// ── CollapsibleGroup ─────────────────────────────────────────────────────────

function CollapsibleGroup({
  group, open, onToggle, collapsed, children, alertCount,
}: {
  group: string; open: boolean; onToggle: () => void; collapsed: boolean;
  children: React.ReactNode; alertCount: number;
}) {
  const cfg = GROUP_CONFIG[group];

  return (
    <div className="mt-2">
      {!collapsed ? (
        <button
          onClick={onToggle}
          className="group flex w-full items-center gap-2 px-3 py-1 rounded-md hover:bg-white/5 transition-colors"
        >
          {/* Accent dot */}
          <div className={cn('h-1.5 w-1.5 shrink-0 rounded-full', cfg?.dot ?? 'bg-slate-500')} />
          <span className="flex-1 text-left text-[9px] font-bold uppercase tracking-widest text-slate-600 group-hover:text-slate-500 transition-colors">
            {group}
          </span>
          {/* Group alert count */}
          {alertCount > 0 && (
            <span className={cn('text-[9px] font-bold px-1 py-0.5 rounded-full text-white', cfg?.dot ?? 'bg-slate-500')}>
              {alertCount}
            </span>
          )}
          <ChevronDown className={cn(
            'h-3 w-3 text-slate-600 transition-transform duration-200',
            !open && '-rotate-90',
          )} />
        </button>
      ) : (
        /* En modo colapsado: solo la línea separadora con dot */
        <div className="mx-2 flex items-center gap-1.5 py-1">
          <div className={cn('h-px flex-1 bg-white/10')} />
          <div className={cn('h-1.5 w-1.5 shrink-0 rounded-full opacity-50', cfg?.dot ?? 'bg-slate-500')} />
          <div className={cn('h-px flex-1 bg-white/10')} />
        </div>
      )}

      {/* Items — animación suave */}
      <div className={cn(
        'overflow-hidden transition-all duration-200 ease-in-out',
        open ? 'max-h-[500px] opacity-100' : 'max-h-0 opacity-0 pointer-events-none',
        !collapsed && 'pl-1',
      )}>
        <div className="space-y-0.5 py-0.5">
          {children}
        </div>
      </div>
    </div>
  );
}

// ── ProjectSwitcher ───────────────────────────────────────────────────────────

function ProjectSwitcher({
  activeProject, recentProjects, collapsed, stats,
}: {
  activeProject: { id: string; name: string; code: string; status: string } | null;
  recentProjects: Array<{ id: string; name: string; code: string; status: string }>;
  collapsed: boolean;
  stats: SidebarStats | null;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  if (!activeProject) return null;

  const others = recentProjects.filter((p) => p.id !== activeProject.id);
  const budgetColor = stats
    ? stats.budgetStatus === 'green' ? 'text-emerald-400'
    : stats.budgetStatus === 'yellow' ? 'text-amber-400'
    : 'text-red-400'
    : 'text-slate-500';

  return (
    <div ref={ref} className="relative px-1">
      <button
        onClick={() => setOpen((v) => !v)}
        className={cn(
          'w-full flex items-center gap-2.5 rounded-xl px-2.5 py-2.5 text-left',
          'border border-white/8 bg-white/5 hover:bg-white/8 transition-all',
          open && 'bg-white/8 border-white/15',
          collapsed && 'justify-center px-2',
        )}
        title={collapsed ? activeProject.name : undefined}
      >
        {/* Project avatar */}
        <div className="h-7 w-7 shrink-0 rounded-lg bg-gradient-to-br from-teal-600/40 to-cyan-700/40 border border-teal-500/30 flex items-center justify-center">
          <span className="text-[11px] font-bold text-teal-300">
            {activeProject.name.charAt(0)}
          </span>
        </div>

        {!collapsed && (
          <>
            <div className="min-w-0 flex-1">
              <p className="truncate text-[12px] font-semibold text-slate-200 leading-tight">
                {activeProject.name}
              </p>
              <div className="flex items-center gap-1.5 mt-0.5">
                <div className={cn('h-1.5 w-1.5 rounded-full shrink-0', STATUS_DOT[activeProject.status] ?? 'bg-slate-400')} />
                <p className="text-[10px] text-slate-500">
                  {STATUS_LABEL[activeProject.status] ?? activeProject.status}
                </p>
              </div>
            </div>
            <ChevronDown className={cn('h-3 w-3 text-slate-500 transition-transform shrink-0', open && 'rotate-180')} />
          </>
        )}
      </button>

      {/* Overall progress + budget status (only expanded) */}
      {!collapsed && stats && stats.overallProgress > 0 && (
        <div className="mx-1 mt-1.5 rounded-lg border border-white/8 bg-white/4 px-2.5 py-2">
          <div className="flex items-center justify-between mb-1">
            <span className="text-[9px] text-slate-500 font-medium uppercase tracking-wider">Avance global</span>
            <div className="flex items-center gap-2">
              {/* Budget status chip */}
              <span className={cn('text-[9px] font-semibold', budgetColor)}>
                {stats.budgetStatus === 'green' ? '● Presupuesto OK'
                 : stats.budgetStatus === 'yellow' ? '▲ Alerta ppto.'
                 : '✕ Sobre ppto.'}
              </span>
            </div>
          </div>
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/10">
            <div
              className="h-full rounded-full bg-gradient-to-r from-teal-500 to-cyan-400 transition-all duration-700"
              style={{ width: `${Math.min(100, stats.overallProgress)}%` }}
            />
          </div>
          <p className="text-right text-[10px] font-semibold text-teal-400 mt-0.5">
            {Math.round(stats.overallProgress)}%
          </p>
        </div>
      )}

      {/* Dropdown */}
      {open && (
        <div className={cn(
          'absolute z-50 rounded-xl border border-white/10 bg-slate-800/95 backdrop-blur-sm shadow-2xl py-2 min-w-52',
          collapsed ? 'left-full ml-2 top-0' : 'left-0 right-0 top-full mt-1',
        )}>
          <div className="px-3 pb-1">
            <p className="text-[9px] font-bold uppercase tracking-widest text-slate-500">Proyecto activo</p>
          </div>
          <div className="mx-2 mb-2 flex items-center gap-2 rounded-lg bg-teal-900/30 border border-teal-700/30 px-2.5 py-2">
            <div className={cn('h-2 w-2 rounded-full shrink-0 animate-pulse', STATUS_DOT[activeProject.status] ?? 'bg-slate-400')} />
            <div className="min-w-0 flex-1">
              <p className="text-xs font-semibold text-teal-200 truncate">{activeProject.name}</p>
              <p className="text-[10px] text-teal-600 font-mono">{activeProject.code}</p>
            </div>
          </div>

          {others.length > 0 && (
            <>
              <div className="px-3 pb-1 pt-1">
                <p className="text-[9px] font-bold uppercase tracking-widest text-slate-500">Recientes</p>
              </div>
              {others.map((p) => (
                <Link
                  key={p.id}
                  href={`/dashboard/projects/${p.id}/dashboard`}
                  onClick={() => setOpen(false)}
                  className="flex items-center gap-2.5 mx-1 px-2.5 py-2 rounded-lg hover:bg-white/5 transition-colors"
                >
                  <div className={cn('h-1.5 w-1.5 rounded-full shrink-0', STATUS_DOT[p.status] ?? 'bg-slate-400')} />
                  <div className="min-w-0">
                    <p className="text-xs font-medium text-slate-200 truncate">{p.name}</p>
                    <p className="text-[10px] text-slate-500 font-mono">{p.code}</p>
                  </div>
                </Link>
              ))}
            </>
          )}

          <div className="border-t border-white/10 mt-1 pt-1 mx-1">
            <Link
              href="/dashboard/projects"
              onClick={() => setOpen(false)}
              className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs text-slate-400 hover:bg-white/5 hover:text-slate-200 transition-colors"
            >
              <FolderOpen className="h-3.5 w-3.5" />
              Ver todos los proyectos
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Layout ────────────────────────────────────────────────────────────────────

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const router   = useRouter();
  const pathname = usePathname();

  const accessToken = useAuth((s) => s.accessToken);
  const user        = useAuth((s) => s.user);
  const clear       = useAuth((s) => s.clear);

  const collapsed     = useSidebarStore((s) => s.collapsed);
  const toggleSidebar = useSidebarStore((s) => s.toggle);

  const activeProject  = useProjectStore((s) => s.activeProject);
  const recentProjects = useProjectStore((s) => s.recentProjects);

  const [mobileOpen, setMobileOpen] = useState(false);

  // Stats for mini-progress and badges (fetched per project)
  const [stats, setStats] = useState<SidebarStats | null>(null);

  // Collapsible groups — persist en localStorage
  const [openGroups, setOpenGroups] = useState<Set<string>>(() => {
    if (typeof window === 'undefined') return new Set(Object.keys(GROUP_CONFIG));
    try {
      const stored = localStorage.getItem('sb-groups');
      return stored ? new Set(JSON.parse(stored)) : new Set(Object.keys(GROUP_CONFIG));
    } catch {
      return new Set(Object.keys(GROUP_CONFIG));
    }
  });

  const toggleGroup = useCallback((group: string) => {
    setOpenGroups((prev) => {
      const next = new Set(prev);
      if (next.has(group)) next.delete(group);
      else next.add(group);
      try { localStorage.setItem('sb-groups', JSON.stringify([...next])); } catch { /* noop */ }
      return next;
    });
  }, []);

  useEffect(() => {
    if (!accessToken) router.replace('/login');
  }, [accessToken, router]);

  // Detect project context
  const projectMatch = pathname.match(/\/dashboard\/projects\/([^/]+)/);
  const inProject    = !!projectMatch;
  const projectId    = projectMatch?.[1];

  // Fetch sidebar stats when project changes
  useEffect(() => {
    if (!projectId || !accessToken) return;
    let cancelled = false;

    (async () => {
      try {
        const raw = await apiClient.getDashboardSummary(projectId) as Record<string, unknown>;
        if (cancelled) return;

        const budget = Number(raw.costoDirecto ?? 0);
        const budgetPlan = Number(raw.presupuestoTotal ?? raw.presupuesto ?? 0);
        const spi = Number(raw.spi ?? 0);
        const avance = Number(raw.avanceFisico ?? raw.avance ?? 0);

        const budgetRatio = budgetPlan > 0 ? budget / budgetPlan : 0;
        const budgetStatus: SidebarStats['budgetStatus'] =
          budgetRatio < 0.9 ? 'green' : budgetRatio < 1.05 ? 'yellow' : 'red';

        const alertsByModule: Partial<Record<string, number>> = {};
        const alerts = raw.alertas as Array<{ type: string; module?: string }> ?? [];
        alerts.forEach((a) => {
          const m = a.module ?? 'quality';
          alertsByModule[m] = (alertsByModule[m] ?? 0) + 1;
        });

        setStats({
          budgetProgress: Math.min(100, budgetRatio * 100),
          scheduleProgress: Math.min(100, avance * 100),
          overallProgress: Math.min(100, (spi > 0 ? spi * 50 + avance * 50 : avance * 100)),
          budgetStatus,
          alertsByModule,
        });
      } catch {
        // No stats — sidebar funciona sin ellas
      }
    })();

    return () => { cancelled = true; };
  }, [projectId, accessToken]);

  if (!accessToken) return null;

  // Breadcrumb
  const segments = pathname.split('/').filter(Boolean);
  const moduleKey = segments.find((s) => MODULE_LABELS[s]);
  const moduleLabel = moduleKey ? MODULE_LABELS[moduleKey] : undefined;

  const sidebarW = collapsed ? 'w-[58px]' : 'w-64';

  // Build unique groups
  const groups = [...new Set(PROJECT_MODULES.map((m) => m.group))];

  return (
    <div className="flex min-h-screen bg-slate-50">
      {inProject && projectId && <ProjectContextLoader projectId={projectId} />}

      {/* Mobile overlay */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/60 backdrop-blur-[2px] md:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* ── Sidebar ──────────────────────────────────────────────────────── */}
      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-50 flex flex-col bg-slate-900 text-slate-100 shadow-2xl',
          'transition-all duration-300 ease-in-out md:relative md:z-auto',
          sidebarW,
          mobileOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0',
        )}
      >
        {/* ── Brand header ────────────────────────────────────────────────── */}
        <div className={cn(
          'relative flex items-center overflow-hidden border-b border-white/8 px-4 py-3.5 gap-3',
          collapsed && 'justify-center px-2',
        )}>
          {/* dot pattern */}
          <div className="pointer-events-none absolute inset-0 opacity-[0.03]"
            style={{ backgroundImage: 'radial-gradient(circle, #ffffff 1px, transparent 1px)', backgroundSize: '16px 16px' }} />
          <div className="relative flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-teal-500 to-cyan-600 shadow-md shadow-teal-900/50">
            <Building2 className="h-4.5 w-4.5 text-white" style={{ width: 18, height: 18 }} />
          </div>
          {!collapsed && (
            <div className="relative min-w-0 flex-1">
              <p className="truncate text-sm font-bold leading-none text-white tracking-tight">Santa Isabel</p>
              <p className="mt-0.5 truncate text-[10px] text-slate-500">Gestión Inmobiliaria</p>
            </div>
          )}
          <button
            onClick={() => setMobileOpen(false)}
            className="relative ml-auto text-slate-500 hover:text-slate-300 md:hidden"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* ── Scrollable nav ──────────────────────────────────────────────── */}
        <div className="flex-1 overflow-y-auto scrollbar-thin scrollbar-track-transparent scrollbar-thumb-white/10 px-2 py-3 space-y-0.5">

          {/* Main nav */}
          {NAV_MAIN.filter((item) => !item.adminOnly || user?.role === 'GERENTE').map((item) => (
            <NavItem key={item.href} {...item} collapsed={collapsed} />
          ))}

          {/* Project context */}
          {inProject && projectId && (
            <>
              <div className="my-2 border-t border-white/8" />

              {/* Project switcher */}
              <ProjectSwitcher
                activeProject={activeProject}
                recentProjects={recentProjects}
                collapsed={collapsed}
                stats={stats}
              />

              {/* Module groups */}
              {groups.map((group) => {
                const modules = PROJECT_MODULES.filter((m) => m.group === group);
                const groupAlerts = modules.reduce((sum, m) => sum + (stats?.alertsByModule[m.sub] ?? 0), 0);

                return (
                  <CollapsibleGroup
                    key={group}
                    group={group}
                    open={openGroups.has(group)}
                    onToggle={() => toggleGroup(group)}
                    collapsed={collapsed}
                    alertCount={groupAlerts}
                  >
                    {modules.map((mod) => {
                      const progress =
                        mod.showProgress
                          ? mod.sub === 'budget'
                            ? (stats?.budgetProgress ?? null)
                            : (stats?.scheduleProgress ?? null)
                          : null;

                      return (
                        <ModuleNavItem
                          key={mod.sub}
                          href={`/dashboard/projects/${projectId}/${mod.sub}`}
                          label={mod.label}
                          icon={mod.icon}
                          tip={mod.tip}
                          collapsed={collapsed}
                          iconColor={mod.iconColor}
                          bgActive={mod.bgActive}
                          barColor={mod.barColor}
                          badge={stats?.alertsByModule[mod.sub] ?? 0}
                          progress={progress}
                        />
                      );
                    })}
                  </CollapsibleGroup>
                );
              })}
            </>
          )}
        </div>

        {/* ── Footer: user + collapse ─────────────────────────────────────── */}
        <div className="border-t border-white/8 p-2 space-y-1">
          {/* User row */}
          <div className={cn(
            'flex items-center gap-2 rounded-lg px-2 py-1.5',
            collapsed && 'justify-center px-0',
          )}>
            <div
              className={cn(
                'flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white shadow-sm',
                avatarColor(user?.fullName),
              )}
              title={collapsed ? (user?.fullName ?? 'Admin') : undefined}
            >
              {user?.fullName?.charAt(0)?.toUpperCase() ?? 'A'}
            </div>
            {!collapsed && (
              <div className="min-w-0 flex-1">
                <p className="truncate text-[12px] font-semibold text-slate-200">{user?.fullName ?? 'Admin'}</p>
                <p className="truncate text-[10px] text-slate-500">{user?.email ?? ''}</p>
              </div>
            )}
            <button
              onClick={() => { clear(); router.replace('/login'); }}
              className="rounded-md p-1.5 text-slate-500 transition-colors hover:bg-red-900/30 hover:text-red-400"
              title="Cerrar sesión"
            >
              <LogOut className="h-3.5 w-3.5" />
            </button>
          </div>

          {/* Collapse toggle (desktop) */}
          <button
            onClick={toggleSidebar}
            className="hidden md:flex w-full items-center justify-center gap-2 rounded-lg py-1.5 px-3 text-xs text-slate-600 hover:bg-white/5 hover:text-slate-400 transition-colors"
            title={collapsed ? 'Expandir sidebar' : 'Colapsar sidebar'}
          >
            {collapsed
              ? <ChevronRight className="h-3.5 w-3.5" />
              : <><ChevronLeft className="h-3.5 w-3.5" /><span>Colapsar</span></>
            }
          </button>
        </div>
      </aside>

      {/* ── Main content ─────────────────────────────────────────────────── */}
      <div className="flex flex-1 flex-col overflow-hidden min-w-0">

        {/* Top bar */}
        <header className="flex h-14 shrink-0 items-center gap-3 border-b bg-white px-4 shadow-sm md:px-6">
          <button
            className="rounded-md p-1.5 text-slate-400 transition-colors hover:bg-slate-100 md:hidden"
            onClick={() => setMobileOpen(true)}
          >
            <Menu className="h-5 w-5" />
          </button>

          {/* Breadcrumb */}
          <nav className="flex items-center gap-1 text-sm text-slate-400 min-w-0">
            <Link href="/dashboard" className="transition-colors hover:text-slate-700 shrink-0">
              Inicio
            </Link>
            {pathname.includes('/projects') && (
              <>
                <ChevronRight className="h-3.5 w-3.5 shrink-0" />
                <Link href="/dashboard/projects" className="transition-colors hover:text-slate-700 shrink-0">
                  Proyectos
                </Link>
              </>
            )}
            {inProject && (
              <>
                <ChevronRight className="h-3.5 w-3.5 shrink-0" />
                <Link
                  href={`/dashboard/projects/${projectId}`}
                  className="font-medium text-slate-700 transition-colors hover:text-slate-900 truncate max-w-[180px]"
                  title={activeProject?.name}
                >
                  {activeProject?.id === projectId && activeProject
                    ? (activeProject.name.length > 22 ? activeProject.name.substring(0, 22) + '…' : activeProject.name)
                    : (activeProject?.code ?? 'Proyecto')
                  }
                </Link>
              </>
            )}
            {moduleLabel && (
              <>
                <ChevronRight className="h-3.5 w-3.5 shrink-0" />
                <span className="font-semibold text-slate-900 truncate">{moduleLabel}</span>
              </>
            )}
          </nav>

          {/* Right: project status + budget status */}
          <div className="ml-auto flex items-center gap-2">
            {inProject && activeProject && activeProject.id === projectId && (
              <div className="hidden sm:flex items-center gap-1.5 rounded-full border border-slate-200 bg-slate-50 px-3 py-1">
                <div className={cn('h-1.5 w-1.5 rounded-full animate-pulse', STATUS_DOT[activeProject.status] ?? 'bg-slate-400')} />
                <span className="text-xs font-medium text-slate-600">
                  {STATUS_LABEL[activeProject.status] ?? activeProject.status}
                </span>
              </div>
            )}
            {stats && (
              <div className={cn(
                'hidden sm:flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium',
                stats.budgetStatus === 'green'
                  ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                  : stats.budgetStatus === 'yellow'
                  ? 'border-amber-200 bg-amber-50 text-amber-700'
                  : 'border-red-200 bg-red-50 text-red-700',
              )}>
                {stats.budgetStatus === 'green' ? '✓ Presupuesto'
                 : stats.budgetStatus === 'yellow' ? '▲ Alerta presupuesto'
                 : '✕ Sobre presupuesto'}
              </div>
            )}
          </div>
        </header>

        <main className="flex-1 overflow-auto p-4 md:p-6">{children}</main>
        <QuickEntryButton />
      </div>

      <Toaster position="top-right" richColors closeButton />
    </div>
  );
}
