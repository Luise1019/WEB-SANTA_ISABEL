'use client';

import type { LucideIcon } from 'lucide-react';

import { cn } from '@/lib/utils';

/**
 * Estado vacío consistente — para listas, tablas, dashboards sin datos.
 *
 * Uso:
 *   <EmptyState
 *     icon={Inbox}
 *     title="Sin movimientos"
 *     description="Aún no hay entradas en este módulo."
 *     action={<Button>Crear primer registro</Button>}
 *   />
 */
export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  className,
  size = 'md',
}: {
  icon?: LucideIcon;
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
  size?: 'sm' | 'md' | 'lg';
}) {
  const sizing = {
    sm: { wrap: 'py-8', icon: 'h-8 w-8', title: 'text-sm', desc: 'text-xs' },
    md: { wrap: 'py-12', icon: 'h-10 w-10', title: 'text-base', desc: 'text-sm' },
    lg: { wrap: 'py-20', icon: 'h-12 w-12', title: 'text-lg', desc: 'text-sm' },
  }[size];

  return (
    <div className={cn('flex flex-col items-center justify-center text-center', sizing.wrap, className)}>
      {Icon && (
        <div className="mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-muted text-muted-foreground">
          <Icon className={sizing.icon} aria-hidden />
        </div>
      )}
      <h3 className={cn('font-semibold text-foreground', sizing.title)}>{title}</h3>
      {description && (
        <p className={cn('mt-1 max-w-sm text-muted-foreground', sizing.desc)}>{description}</p>
      )}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
