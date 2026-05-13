import Link from 'next/link';

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
  return (
    <div className="min-h-screen flex">
      <aside className="w-60 border-r bg-muted/30 p-4 space-y-1">
        <div className="px-2 py-3 font-bold text-lg">Santa Isabel</div>
        <nav className="space-y-1">
          {NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="block px-3 py-2 rounded-md text-sm hover:bg-accent hover:text-accent-foreground"
            >
              {item.label}
            </Link>
          ))}
        </nav>
      </aside>
      <main className="flex-1 p-8">{children}</main>
    </div>
  );
}
