'use client';

import {
  BarChart3,
  Building2,
  Calendar,
  ChevronRight,
  DollarSign,
  FileText,
  FolderOpen,
  Home,
  LogOut,
  TrendingUp,
  Users,
} from 'lucide-react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { Toaster } from 'sonner';

import { useAuth } from '@/lib/auth-store';

const NAV_MAIN = [
  { href: '/dashboard', label: 'Inicio', icon: Home, exact: true },
  { href: '/dashboard/projects', label: 'Proyectos', icon: FolderOpen },
];

const NAV_MODULES = [
  { href: '/dashboard/budget', label: 'Presupuesto', icon: DollarSign },
  { href: '/dashboard/schedule', label: 'Cronograma', icon: Calendar },
  { href: '/dashboard/cashflow', label: 'Flujo de caja', icon: TrendingUp },
  { href: '/dashboard/sales', label: 'Ventas', icon: Users },
  { href: '/dashboard/changes', label: 'Cambios', icon: FileText },
  { href: '/dashboard/reports', label: 'Reportes', icon: BarChart3 },
];

function NavItem({
  href,
  label,
  icon: Icon,
  exact,
}: {
  href: string;
  label: string;
  icon: React.ElementType;
  exact?: boolean;
}) {
  const pathname = usePathname();
  const active = exact ? pathname === href : pathname === href || pathname.startsWith(`${href}/`);

  return (
    <Link
      href={href}
      className={`group flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-all duration-150 ${
        active
          ? 'bg-primary text-primary-foreground shadow-sm'
          : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
      }`}
    >
      <Icon className="h-4 w-4 shrink-0" />
      <span>{label}</span>
      {active && <ChevronRight className="ml-auto h-3 w-3 opacity-60" />}
    </Link>
  );
}

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const accessToken = useAuth((s) => s.accessToken);
  const user = useAuth((s) => s.user);
  const clear = useAuth((s) => s.clear);

  useEffect(() => {
    if (!accessToken) router.replace('/login');
  }, [accessToken, router]);

  if (!accessToken) return null;

  // Detect if we're inside a project context
  const projectMatch = pathname.match(/\/dashboard\/projects\/([^/]+)/);
  const inProject = !!projectMatch;

  return (
    <div className="flex min-h-screen bg-background">
      {/* Sidebar */}
      <aside className="flex w-64 flex-col border-r bg-card">
        {/* Brand */}
        <div className="flex items-center gap-3 border-b px-4 py-4">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary text-primary-foreground shadow-sm">
            <Building2 className="h-5 w-5" />
          </div>
          <div>
            <p className="text-sm font-bold leading-none">Santa Isabel</p>
            <p className="mt-0.5 text-xs text-muted-foreground">Gestión Inmobiliaria</p>
          </div>
        </div>

        {/* Nav */}
        <div className="flex-1 overflow-y-auto px-3 py-4">
          <div className="space-y-1">
            {NAV_MAIN.map((item) => (
              <NavItem key={item.href} {...item} />
            ))}
          </div>

          {inProject && (
            <>
              <div className="my-4 border-t" />
              <p className="mb-2 px-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Módulos del proyecto
              </p>
              <div className="space-y-1">
                {[
                  { label: 'Presupuesto', icon: DollarSign, sub: 'budget' },
                  { label: 'Cronograma', icon: Calendar, sub: 'schedule' },
                  { label: 'Flujo de caja', icon: TrendingUp, sub: 'cashflow' },
                  { label: 'Ventas', icon: Users, sub: 'sales' },
                  { label: 'Cambios', icon: FileText, sub: 'changes' },
                  { label: 'Dashboard', icon: BarChart3, sub: 'dashboard' },
                ].map(({ label, icon: Icon, sub }) => {
                  const href = `/dashboard/projects/${projectMatch![1]}/${sub}`;
                  const active = pathname.startsWith(href);
                  return (
                    <Link
                      key={sub}
                      href={href}
                      className={`group flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-all duration-150 ${
                        active
                          ? 'bg-primary text-primary-foreground shadow-sm'
                          : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
                      }`}
                    >
                      <Icon className="h-4 w-4 shrink-0" />
                      <span>{label}</span>
                      {active && <ChevronRight className="ml-auto h-3 w-3 opacity-60" />}
                    </Link>
                  );
                })}
              </div>
            </>
          )}

          {!inProject && (
            <>
              <div className="my-4 border-t" />
              <p className="mb-2 px-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Global
              </p>
              <div className="space-y-1">
                {NAV_MODULES.map((item) => (
                  <NavItem key={item.href} {...item} />
                ))}
              </div>
            </>
          )}
        </div>

        {/* User section */}
        <div className="border-t p-3">
          <div className="flex items-center gap-3 rounded-lg px-2 py-2">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-bold text-primary">
              {user?.fullName?.charAt(0) ?? 'A'}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs font-semibold">{user?.fullName ?? 'Admin'}</p>
              <p className="truncate text-xs text-muted-foreground">{user?.email ?? ''}</p>
            </div>
            <button
              onClick={() => { clear(); router.replace('/login'); }}
              className="rounded-md p-1.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-colors"
              title="Cerrar sesión"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </div>
      </aside>

      {/* Main content */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Top bar */}
        <header className="flex h-14 shrink-0 items-center border-b bg-card px-6">
          <nav className="flex items-center gap-1 text-sm text-muted-foreground">
            <Link href="/dashboard" className="hover:text-foreground">Inicio</Link>
            {pathname.includes('/projects') && (
              <>
                <ChevronRight className="h-3.5 w-3.5" />
                <Link href="/dashboard/projects" className="hover:text-foreground">Proyectos</Link>
              </>
            )}
            {inProject && (
              <>
                <ChevronRight className="h-3.5 w-3.5" />
                <span className="text-foreground font-medium">SI-001</span>
              </>
            )}
          </nav>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-auto p-6">
          {children}
        </main>
      </div>

      <Toaster position="top-right" richColors closeButton />
    </div>
  );
}
