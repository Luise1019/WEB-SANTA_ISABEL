'use client';

import {
  BarChart3,
  BookOpen,
  Building2,
  Calendar,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  DollarSign,
  Download,
  FileText,
  FolderOpen,
  Home,
  LineChart,
  LogOut,
  Menu,
  ShieldCheck,
  TrendingUp,
  Users,
  X,
} from 'lucide-react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { Toaster } from 'sonner';

import { ProjectContextLoader } from '@/components/project-context-loader';
import { QuickEntryButton } from '@/components/quick-entry-button';
import { useAuth } from '@/lib/auth-store';
import { useProjectStore } from '@/lib/project-store';
import { useSidebarStore } from '@/lib/sidebar-store';
import { cn } from '@/lib/utils';

// ── Nav config ─────────────────────────────────────────────────────────────

const NAV_MAIN = [
  { href: '/dashboard',          label: 'Inicio',    icon: Home,       exact: true,  shortcut: 'G H' },
  { href: '/dashboard/projects', label: 'Proyectos', icon: FolderOpen, exact: false, shortcut: 'G P' },
];

// Orden jerárquico: Visión → Planificación → Ejecución → Control → Cierre
const PROJECT_MODULES = [
  // ── 1. Visión general ──────────────────────────────────────────
  { sub: 'dashboard',   label: 'Dashboard',       icon: BarChart3,     tip: 'KPIs · SPI/CPI · Alertas en tiempo real', group: 'Visión' },
  // ── 2. Planificación financiera ────────────────────────────────
  { sub: 'feasibility', label: 'Prefactibilidad', icon: LineChart,     tip: 'TIR · VPN · Payback · Escenarios', group: 'Planificación' },
  { sub: 'budget',      label: 'Presupuesto',     icon: DollarSign,    tip: 'Capítulos · AIU · APUs · Análisis de precios', group: 'Planificación' },
  { sub: 'schedule',    label: 'Cronograma',      icon: Calendar,      tip: 'Gantt · CPM · Valor Ganado · Línea base', group: 'Planificación' },
  { sub: 'sales',       label: 'Ventas',          icon: Users,         tip: 'Torres · Unidades · Reservas · Promesas', group: 'Planificación' },
  // ── 3. Ejecución y campo ───────────────────────────────────────
  { sub: 'cashflow',    label: 'Flujo de caja',   icon: TrendingUp,    tip: 'Ingresos/Egresos · Crédito constructor · Curva S', group: 'Ejecución' },
  { sub: 'contracts',   label: 'Contratos',       icon: FileText,      tip: 'Proveedores · Actas de pago · Órdenes de compra', group: 'Ejecución' },
  { sub: 'logbook',     label: 'Bitácora',        icon: BookOpen,      tip: 'Registro diario · Personal · Clima · Fotos', group: 'Ejecución' },
  // ── 4. Control de calidad y HSE ────────────────────────────────
  { sub: 'changes',     label: 'Cambios',         icon: Building2,     tip: 'Órdenes de cambio · Aprobaciones · Impacto', group: 'Control' },
  { sub: 'quality',     label: 'Calidad NCR',     icon: ClipboardList, tip: 'No Conformidades · ISO 9001 · Seguimiento', group: 'Control' },
  { sub: 'safety',      label: 'SST',             icon: ShieldCheck,   tip: 'Seguridad · Incidentes · EPPs · SG-SST', group: 'Control' },
  // ── 5. Reportes y cierre ───────────────────────────────────────
  { sub: 'reports',     label: 'Reportes',        icon: Download,      tip: 'CSV · HTML · Presupuesto · Cronograma · Bitácora', group: 'Reportes' },
];

const STATUS_DOT: Record<string, string> = {
  EJECUCION:       'bg-green-500',
  FACTIBILIDAD:    'bg-blue-500',
  PREFACTIBILIDAD: 'bg-slate-400',
  CIERRE:          'bg-amber-500',
  ARCHIVADO:       'bg-gray-400',
};

// Avatar color
const AVATAR_COLORS: Record<string, string> = {
  A:'bg-teal-600',B:'bg-blue-600',C:'bg-cyan-600',D:'bg-indigo-600',
  E:'bg-emerald-600',F:'bg-fuchsia-600',G:'bg-green-600',H:'bg-orange-600',
  I:'bg-purple-600',J:'bg-rose-600',K:'bg-sky-600',L:'bg-lime-600',M:'bg-amber-600',
};
function avatarColor(name?: string) {
  const ch = (name ?? 'A').charAt(0).toUpperCase();
  return AVATAR_COLORS[ch] ?? 'bg-slate-600';
}

// ── NavItem ────────────────────────────────────────────────────────────────

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
      title={collapsed ? `${label}${shortcut ? ` (${shortcut})` : ''}` : (shortcut ? `${label} (${shortcut})` : label)}
      className={cn(
        'group relative flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-all duration-150',
        collapsed ? 'justify-center px-2' : '',
        active
          ? 'border-l-2 border-teal-400 bg-white/10 text-white shadow-sm'
          : 'text-slate-400 hover:bg-white/5 hover:text-slate-200',
        active && !collapsed && 'pl-[10px]',
      )}
    >
      <Icon className={cn('h-4 w-4 shrink-0', active ? 'text-teal-400' : '')} />
      {!collapsed && (
        <>
          <span className="flex-1">{label}</span>
          {shortcut && (
            <span className="hidden rounded bg-white/10 px-1 py-0.5 text-[9px] font-mono text-slate-400 group-hover:inline">
              {shortcut}
            </span>
          )}
          {active && <ChevronRight className="ml-auto h-3 w-3 text-teal-400 opacity-70" />}
        </>
      )}
      {/* Tooltip en modo colapsado */}
      {collapsed && (
        <div className="pointer-events-none absolute left-full ml-2 z-50 whitespace-nowrap rounded-md bg-slate-800 border border-white/10 px-2.5 py-1.5 text-xs font-medium text-white opacity-0 shadow-lg transition-opacity group-hover:opacity-100">
          {label}
          {shortcut && <span className="ml-1.5 opacity-50">{shortcut}</span>}
        </div>
      )}
    </Link>
  );
}

// ── ModuleNavItem ──────────────────────────────────────────────────────────

function ModuleNavItem({
  href, label, icon: Icon, tip, collapsed,
}: {
  href: string; label: string; icon: React.ElementType; tip?: string; collapsed: boolean;
}) {
  const pathname = usePathname();
  const active = pathname === href || pathname.startsWith(`${href}/`);

  return (
    <Link
      href={href}
      title={collapsed ? (tip ?? label) : (tip ?? label)}
      className={cn(
        'group relative flex items-center gap-2.5 rounded-lg py-1.5 text-sm font-medium transition-all duration-150',
        collapsed ? 'justify-center px-2' : 'pl-9 pr-3',
        active
          ? 'border-l-2 border-teal-400 bg-white/10 text-white'
          : 'text-slate-400 hover:bg-white/5 hover:text-slate-200',
        active && !collapsed && 'pl-[34px]',
      )}
    >
      <Icon className={cn('h-3.5 w-3.5 shrink-0', active ? 'text-teal-400' : '')} />
      {!collapsed && (
        <>
          <span className="flex-1 text-[13px]">{label}</span>
          {active && <ChevronRight className="h-3 w-3 text-teal-400 opacity-60" />}
        </>
      )}
      {collapsed && (
        <div className="pointer-events-none absolute left-full ml-2 z-50 whitespace-nowrap rounded-md bg-slate-800 border border-white/10 px-2.5 py-1.5 text-xs font-medium text-white opacity-0 shadow-lg transition-opacity group-hover:opacity-100">
          {label}
          {tip && <div className="text-[10px] text-slate-400 mt-0.5">{tip}</div>}
        </div>
      )}
    </Link>
  );
}

// ── Project Switcher ───────────────────────────────────────────────────────

function ProjectSwitcher({
  activeProject, recentProjects, collapsed,
}: {
  activeProject: { id: string; name: string; code: string; status: string } | null;
  recentProjects: Array<{ id: string; name: string; code: string; status: string }>;
  collapsed: boolean;
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

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className={cn(
          'w-full flex items-center gap-2.5 rounded-lg px-3 py-2 text-left transition-all hover:bg-white/5',
          open && 'bg-white/5',
          collapsed && 'justify-center px-2',
        )}
        title={collapsed ? activeProject.name : undefined}
      >
        <div className={cn('h-6 w-6 shrink-0 rounded-md bg-teal-600/20 border border-teal-500/30 flex items-center justify-center')}>
          <span className="text-[10px] font-bold text-teal-400">
            {activeProject.code.charAt(0)}
          </span>
        </div>
        {!collapsed && (
          <>
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs font-semibold text-slate-200 leading-tight">
                {activeProject.name}
              </p>
              <p className="text-[10px] text-slate-500 font-mono">{activeProject.code}</p>
            </div>
            <ChevronRight className={cn('h-3 w-3 text-slate-500 transition-transform', open && 'rotate-90')} />
          </>
        )}
        {collapsed && (
          <div className="pointer-events-none absolute left-full ml-2 z-50 whitespace-nowrap rounded-md bg-slate-800 border border-white/10 px-2.5 py-1.5 text-xs font-medium text-white opacity-0 shadow-lg transition-opacity group-hover:opacity-100">
            {activeProject.name}
          </div>
        )}
      </button>

      {open && (
        <div className={cn(
          'absolute z-50 rounded-xl border border-white/10 bg-slate-800 shadow-xl py-2 min-w-52',
          collapsed ? 'left-full ml-2 top-0' : 'left-0 right-0 top-full mt-1',
        )}>
          <div className="px-3 pb-1.5 pt-0.5">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">Proyecto actual</p>
          </div>
          <div className="mx-2 mb-2 flex items-center gap-2 rounded-lg bg-teal-900/30 border border-teal-700/30 px-2.5 py-2">
            <div className={cn('h-1.5 w-1.5 rounded-full shrink-0', STATUS_DOT[activeProject.status] ?? 'bg-slate-400')} />
            <p className="text-xs font-semibold text-teal-200 truncate">{activeProject.name}</p>
          </div>

          {others.length > 0 && (
            <>
              <div className="px-3 pb-1 pt-1">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">Recientes</p>
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

// ── Layout ─────────────────────────────────────────────────────────────────

const MODULE_LABELS: Record<string, string> = {
  feasibility: 'Prefactibilidad',
  budget:      'Presupuesto',
  schedule:    'Cronograma',
  cashflow:    'Flujo de caja',
  sales:       'Ventas',
  changes:     'Cambios',
  dashboard:   'Dashboard',
  reports:     'Reportes',
  logbook:     'Bitácora',
  contracts:   'Contratos',
  quality:     'Calidad NCR',
  safety:      'SST',
};

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const router   = useRouter();
  const pathname = usePathname();

  const accessToken = useAuth((s) => s.accessToken);
  const user        = useAuth((s) => s.user);
  const clear       = useAuth((s) => s.clear);

  const collapsed      = useSidebarStore((s) => s.collapsed);
  const toggleSidebar  = useSidebarStore((s) => s.toggle);

  const activeProject  = useProjectStore((s) => s.activeProject);
  const recentProjects = useProjectStore((s) => s.recentProjects);

  // Mobile sidebar state
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    if (!accessToken) router.replace('/login');
  }, [accessToken, router]);

  if (!accessToken) return null;

  // Detect project context
  const projectMatch = pathname.match(/\/dashboard\/projects\/([^/]+)/);
  const inProject    = !!projectMatch;
  const projectId    = projectMatch?.[1];

  // Breadcrumb sub-page detection
  const segments = pathname.split('/').filter(Boolean);
  const moduleKey = segments.find((s) => MODULE_LABELS[s]);
  const moduleLabel = moduleKey ? MODULE_LABELS[moduleKey] : undefined;

  const sidebarW = collapsed ? 'w-[58px]' : 'w-64';

  return (
    <div className="flex min-h-screen bg-slate-50">
      {/* ── Cargar proyecto activo en caché ─────────────────────────────── */}
      {inProject && projectId && <ProjectContextLoader projectId={projectId} />}

      {/* ── Mobile overlay ──────────────────────────────────────────────── */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 md:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* ── Sidebar ─────────────────────────────────────────────────────── */}
      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-50 flex flex-col bg-slate-900 text-slate-100 shadow-xl transition-all duration-300 ease-in-out md:relative md:z-auto',
          sidebarW,
          mobileOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0',
        )}
      >
        {/* Brand header */}
        <div className={cn(
          'relative flex items-center overflow-hidden border-b border-white/10 px-4 py-4 gap-3',
          collapsed && 'justify-center px-2',
        )}>
          <div className="pointer-events-none absolute inset-0 opacity-[0.04]"
            style={{ backgroundImage: 'radial-gradient(circle, #ffffff 1px, transparent 1px)', backgroundSize: '16px 16px' }} />
          <div className="relative flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-teal-500 to-cyan-600 shadow-sm">
            <Building2 className="h-5 w-5 text-white" />
          </div>
          {!collapsed && (
            <div className="relative min-w-0 flex-1">
              <p className="truncate text-sm font-bold leading-none text-white">Santa Isabel</p>
              <p className="mt-0.5 truncate text-[11px] text-slate-400">Gestión Inmobiliaria</p>
            </div>
          )}
          {/* Close button mobile */}
          <button
            onClick={() => setMobileOpen(false)}
            className="relative ml-auto text-slate-500 hover:text-slate-300 md:hidden"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Nav */}
        <div className="flex-1 overflow-y-auto px-2 py-4 space-y-0.5">

          {/* Main nav */}
          {NAV_MAIN.map((item) => (
            <NavItem key={item.href} {...item} collapsed={collapsed} />
          ))}

          {/* Project switcher + module nav */}
          {inProject && projectId && (
            <>
              <div className="my-3 border-t border-white/10" />

              {/* Project switcher */}
              <ProjectSwitcher
                activeProject={activeProject}
                recentProjects={recentProjects}
                collapsed={collapsed}
              />

              {/* Module links — grouped */}
              <div className="space-y-0.5">
                {(() => {
                  let lastGroup = '';
                  return PROJECT_MODULES.map(({ sub, label, icon, tip, group }) => {
                    const showHeader = group && group !== lastGroup;
                    lastGroup = group ?? lastGroup;
                    return (
                      <div key={sub}>
                        {showHeader && !collapsed && (
                          <div className="mb-0.5 mt-2.5 flex items-center gap-2 px-3">
                            <div className="flex-1 h-px bg-white/8" />
                            <p className="text-[9px] font-bold uppercase tracking-widest text-slate-600 shrink-0">
                              {group}
                            </p>
                            <div className="flex-1 h-px bg-white/8" />
                          </div>
                        )}
                        {showHeader && collapsed && (
                          <div className="my-1.5 mx-2 h-px bg-white/10" />
                        )}
                        <ModuleNavItem
                          href={`/dashboard/projects/${projectId}/${sub}`}
                          label={label}
                          icon={icon}
                          tip={tip}
                          collapsed={collapsed}
                        />
                      </div>
                    );
                  });
                })()}
              </div>
            </>
          )}
        </div>

        {/* User + collapse toggle */}
        <div className="border-t border-white/10 p-2 space-y-1">
          {/* User row */}
          <div className={cn('flex items-center gap-2.5 rounded-lg px-2 py-2', collapsed && 'justify-center px-0')}>
            <div
              className={cn(
                'flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-bold text-white',
                avatarColor(user?.fullName),
              )}
              title={collapsed ? (user?.fullName ?? 'Admin') : undefined}
            >
              {user?.fullName?.charAt(0)?.toUpperCase() ?? 'A'}
            </div>
            {!collapsed && (
              <div className="min-w-0 flex-1">
                <p className="truncate text-xs font-semibold text-slate-200">{user?.fullName ?? 'Admin'}</p>
                <p className="truncate text-[11px] text-slate-500">{user?.email ?? ''}</p>
              </div>
            )}
            <button
              onClick={() => { clear(); router.replace('/login'); }}
              className="rounded-md p-1.5 text-slate-500 transition-colors hover:bg-red-900/30 hover:text-red-400"
              title="Cerrar sesión"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>

          {/* Collapse toggle (desktop) */}
          <button
            onClick={toggleSidebar}
            className="hidden md:flex w-full items-center justify-center gap-2 rounded-lg py-1.5 px-3 text-xs text-slate-500 hover:bg-white/5 hover:text-slate-300 transition-colors"
            title={collapsed ? 'Expandir sidebar' : 'Colapsar sidebar'}
          >
            {collapsed
              ? <ChevronRight className="h-4 w-4" />
              : <><ChevronLeft className="h-4 w-4" /><span>Colapsar</span></>
            }
          </button>
        </div>
      </aside>

      {/* ── Main content ────────────────────────────────────────────────── */}
      <div className="flex flex-1 flex-col overflow-hidden min-w-0">

        {/* Top bar */}
        <header className="flex h-14 shrink-0 items-center gap-3 border-b bg-white px-4 shadow-sm md:px-6">
          {/* Mobile hamburger */}
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
                  className="font-medium text-slate-700 transition-colors hover:text-slate-900 truncate max-w-[160px]"
                  title={activeProject?.name}
                >
                  {/* Nombre real del proyecto desde el store, con fallback */}
                  {activeProject?.id === projectId && activeProject
                    ? (activeProject.name.length > 22
                        ? activeProject.name.substring(0, 22) + '…'
                        : activeProject.name)
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

          {/* Right side — status chip del proyecto activo */}
          <div className="ml-auto flex items-center gap-3">
            {inProject && activeProject && activeProject.id === projectId && (
              <div className="hidden sm:flex items-center gap-1.5 rounded-full border border-slate-200 bg-slate-50 px-3 py-1">
                <div className={cn('h-1.5 w-1.5 rounded-full', STATUS_DOT[activeProject.status] ?? 'bg-slate-400')} />
                <span className="text-xs font-medium text-slate-600">
                  {activeProject.status === 'EJECUCION' ? 'En ejecución'
                   : activeProject.status === 'FACTIBILIDAD' ? 'Factibilidad'
                   : activeProject.status === 'PREFACTIBILIDAD' ? 'Prefactibilidad'
                   : activeProject.status === 'CIERRE' ? 'Cierre'
                   : activeProject.status}
                </span>
              </div>
            )}
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-auto p-4 md:p-6">{children}</main>
        <QuickEntryButton />
      </div>

      <Toaster position="top-right" richColors closeButton />
    </div>
  );
}
