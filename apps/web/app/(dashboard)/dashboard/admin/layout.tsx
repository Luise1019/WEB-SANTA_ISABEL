'use client';

import {
  Activity,
  Building2,
  ChevronRight,
  Settings2,
  Shield,
  SlidersHorizontal,
  Users,
} from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

import { useAuth } from '@/lib/auth-store';
import { cn } from '@/lib/utils';

const TABS = [
  { href: '/dashboard/admin/usuarios',   label: 'Usuarios',    icon: Users,            desc: 'Crear, editar y gestionar accesos' },
  { href: '/dashboard/admin/empresa',    label: 'Empresa',     icon: Building2,        desc: 'Razón social, logo y contacto' },
  { href: '/dashboard/admin/parametros', label: 'Parámetros',  icon: SlidersHorizontal,desc: 'AIU, tasas, factor prestacional' },
  { href: '/dashboard/admin/auditoria',  label: 'Auditoría',   icon: Activity,         desc: 'Trazabilidad de acciones' },
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router   = useRouter();
  const role     = useAuth((s) => s.user?.role);

  // Solo GERENTE puede acceder al panel de admin
  useEffect(() => {
    if (role && role !== 'GERENTE') router.replace('/dashboard');
  }, [role, router]);

  if (role && role !== 'GERENTE') return null;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start gap-4">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-800 shadow-sm">
          <Shield className="h-5 w-5 text-slate-300" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-slate-900">Administración</h1>
          <p className="text-sm text-slate-500">
            Gestiona usuarios, parámetros de la empresa y auditoría del sistema
          </p>
        </div>
        <div className="ml-auto hidden sm:flex items-center gap-1.5 rounded-full border border-slate-200 bg-slate-50 px-3 py-1">
          <Settings2 className="h-3.5 w-3.5 text-slate-500" />
          <span className="text-xs font-medium text-slate-600">Solo Administradores</span>
        </div>
      </div>

      {/* Tab navigation */}
      <div className="border-b border-slate-200">
        <nav className="flex gap-0 overflow-x-auto scrollbar-hide -mb-px">
          {TABS.map((tab) => {
            const Icon = tab.icon;
            const active = pathname.startsWith(tab.href);
            return (
              <Link
                key={tab.href}
                href={tab.href}
                className={cn(
                  'group flex items-center gap-2 border-b-2 px-4 py-3 text-sm font-medium transition-all whitespace-nowrap',
                  active
                    ? 'border-slate-800 text-slate-900'
                    : 'border-transparent text-slate-500 hover:border-slate-300 hover:text-slate-700',
                )}
              >
                <Icon className={cn(
                  'h-4 w-4 transition-colors',
                  active ? 'text-slate-800' : 'text-slate-400 group-hover:text-slate-600',
                )} />
                {tab.label}
              </Link>
            );
          })}
        </nav>
      </div>

      {/* Page content */}
      <div>{children}</div>
    </div>
  );
}
