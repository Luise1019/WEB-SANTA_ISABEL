'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect } from 'react';

import { Button } from '@/components/ui/button';
import { useAuth } from '@/lib/auth-store';

const NAV = [
  { href: '/dashboard', label: 'Dashboard' },
  { href: '/dashboard/projects', label: 'Proyectos' },
  { href: '/dashboard/budget', label: 'Presupuesto' },
  { href: '/dashboard/schedule', label: 'Cronograma' },
  { href: '/dashboard/cashflow', label: 'Flujo de caja' },
  { href: '/dashboard/sales', label: 'Ventas' },
  { href: '/dashboard/changes', label: 'Cambios' },
  { href: '/dashboard/reports', label: 'Reportes' },
] as const;

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const accessToken = useAuth((s) => s.accessToken);
  const clear = useAuth((s) => s.clear);

  useEffect(() => {
    if (!accessToken) router.replace('/login');
  }, [accessToken, router]);

  if (!accessToken) return null;

  return (
    <div className="min-h-screen flex">
      <aside className="w-60 border-r bg-muted/30 p-4 flex flex-col">
        <div className="px-2 py-3 font-bold text-lg">Santa Isabel</div>
        <nav className="space-y-1 flex-1">
          {NAV.map((item) => {
            const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={
                  'block px-3 py-2 rounded-md text-sm hover:bg-accent hover:text-accent-foreground ' +
                  (active ? 'bg-accent text-accent-foreground font-medium' : '')
                }
              >
                {item.label}
              </Link>
            );
          })}
        </nav>
        <Button
          variant="ghost"
          size="sm"
          className="justify-start"
          onClick={() => {
            clear();
            router.replace('/login');
          }}
        >
          Cerrar sesión
        </Button>
      </aside>
      <main className="flex-1 p-8 overflow-auto">{children}</main>
    </div>
  );
}
