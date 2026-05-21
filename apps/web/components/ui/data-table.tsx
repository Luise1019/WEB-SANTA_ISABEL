'use client';

import { ChevronDown, ChevronUp, Loader2 } from 'lucide-react';
import { useMemo, useState } from 'react';

import { cn } from '@/lib/utils';

import { EmptyState } from './empty-state';

/**
 * Tabla de datos genérica con sort cliente, loading, empty state, alineación por columna.
 *
 * Uso:
 *   <DataTable
 *     data={users}
 *     columns={[
 *       { key: 'fullName', header: 'Nombre', cell: (u) => u.fullName },
 *       { key: 'role', header: 'Rol', cell: (u) => <Badge>{u.role}</Badge>, sortable: false },
 *     ]}
 *     loading={isLoading}
 *     getRowKey={(u) => u.id}
 *     emptyTitle="Sin usuarios"
 *   />
 */

export type Column<T> = {
  key: string;
  header: React.ReactNode;
  cell: (row: T) => React.ReactNode;
  /** Valor primitivo para sort. Si se omite y `sortable` es true, usa cell como string. */
  sortValue?: (row: T) => string | number | Date | null | undefined;
  sortable?: boolean;
  align?: 'left' | 'center' | 'right';
  className?: string;
  width?: string;
};

export function DataTable<T>({
  data,
  columns,
  loading,
  getRowKey,
  onRowClick,
  emptyTitle = 'Sin registros',
  emptyDescription,
  emptyIcon,
  className,
}: {
  data: T[];
  columns: Column<T>[];
  loading?: boolean;
  getRowKey: (row: T, index: number) => string;
  onRowClick?: (row: T) => void;
  emptyTitle?: string;
  emptyDescription?: string;
  emptyIcon?: React.ComponentProps<typeof EmptyState>['icon'];
  className?: string;
}) {
  const [sortKey, setSortKey] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');

  const sorted = useMemo(() => {
    if (!sortKey) return data;
    const col = columns.find((c) => c.key === sortKey);
    if (!col?.sortable) return data;
    const getter = col.sortValue ?? ((r: T) => String(col.cell(r) ?? ''));
    return [...data].sort((a, b) => {
      const va = getter(a);
      const vb = getter(b);
      if (va == null && vb == null) return 0;
      if (va == null) return 1;
      if (vb == null) return -1;
      const cmp = va < vb ? -1 : va > vb ? 1 : 0;
      return sortDir === 'asc' ? cmp : -cmp;
    });
  }, [data, columns, sortKey, sortDir]);

  function toggleSort(key: string) {
    if (sortKey !== key) {
      setSortKey(key);
      setSortDir('asc');
    } else if (sortDir === 'asc') {
      setSortDir('desc');
    } else {
      setSortKey(null);
    }
  }

  return (
    <div className={cn('overflow-hidden rounded-xl border border-border bg-card', className)}>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="border-b border-border bg-muted/30">
            <tr>
              {columns.map((col) => (
                <th
                  key={col.key}
                  scope="col"
                  style={col.width ? { width: col.width } : undefined}
                  className={cn(
                    'px-4 py-2.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground',
                    col.align === 'right' && 'text-right',
                    col.align === 'center' && 'text-center',
                    col.align !== 'right' && col.align !== 'center' && 'text-left',
                    col.className,
                  )}
                >
                  {col.sortable ? (
                    <button
                      type="button"
                      onClick={() => toggleSort(col.key)}
                      className="inline-flex items-center gap-1 hover:text-foreground"
                    >
                      {col.header}
                      {sortKey === col.key &&
                        (sortDir === 'asc' ? (
                          <ChevronUp className="h-3 w-3" aria-hidden />
                        ) : (
                          <ChevronDown className="h-3 w-3" aria-hidden />
                        ))}
                    </button>
                  ) : (
                    col.header
                  )}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={columns.length} className="py-12 text-center text-muted-foreground">
                  <Loader2 className="mx-auto h-5 w-5 animate-spin" aria-hidden />
                </td>
              </tr>
            ) : sorted.length === 0 ? (
              <tr>
                <td colSpan={columns.length}>
                  <EmptyState icon={emptyIcon} title={emptyTitle} description={emptyDescription} />
                </td>
              </tr>
            ) : (
              sorted.map((row, i) => (
                <tr
                  key={getRowKey(row, i)}
                  onClick={onRowClick ? () => onRowClick(row) : undefined}
                  className={cn(
                    'border-b border-border last:border-0 transition-colors',
                    onRowClick && 'cursor-pointer hover:bg-muted/40',
                  )}
                >
                  {columns.map((col) => (
                    <td
                      key={col.key}
                      className={cn(
                        'px-4 py-2.5 text-foreground',
                        col.align === 'right' && 'text-right',
                        col.align === 'center' && 'text-center',
                        col.className,
                      )}
                    >
                      {col.cell(row)}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
