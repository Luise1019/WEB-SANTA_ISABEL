'use client';

import type { LucideIcon } from 'lucide-react';

import { cn } from '@/lib/utils';

/**
 * Header consistente para páginas del dashboard.
 *
 * Uso:
 *   <PageHeader
 *     icon={Wallet}
 *     title="Presupuesto"
 *     description="Gestión de capítulos, ítems y APUs"
 *     actions={<Button>Nuevo</Button>}
 *   />
 */
export function PageHeader({
  icon: Icon,
  title,
  description,
  actions,
  className,
}: {
  icon?: LucideIcon;
  title: string;
  description?: string;
  actions?: React.ReactNode;
  className?: string;
}) {
  return (
    <header className={cn('flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between', className)}>
      <div className="flex items-start gap-3 min-w-0">
        {Icon && (
          <div className="hidden sm:flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <Icon className="h-5 w-5" aria-hidden />
          </div>
        )}
        <div className="min-w-0">
          <h1 className="text-xl sm:text-2xl font-bold text-foreground tracking-tight truncate">
            {title}
          </h1>
          {description && (
            <p className="mt-0.5 text-sm text-muted-foreground line-clamp-2">{description}</p>
          )}
        </div>
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2 shrink-0">{actions}</div>}
    </header>
  );
}
