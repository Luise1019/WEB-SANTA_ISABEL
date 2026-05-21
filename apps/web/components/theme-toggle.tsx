'use client';

import { Monitor, Moon, Sun } from 'lucide-react';
import { useEffect } from 'react';

import { useTheme, type Theme } from '@/lib/theme-store';
import { cn } from '@/lib/utils';

type ThemeOption = { value: Theme; label: string; Icon: typeof Sun };

const OPTIONS: ThemeOption[] = [
  { value: 'light', label: 'Claro', Icon: Sun },
  { value: 'dark', label: 'Oscuro', Icon: Moon },
  { value: 'system', label: 'Sistema', Icon: Monitor },
];

/**
 * Toggle de tema (light / dark / system) — selector segmentado de 3 opciones.
 *
 * Variantes:
 *  - `compact` (default): solo íconos, ideal para sidebar colapsada
 *  - `expanded`: íconos + label, ideal para sidebar expandida o settings
 */
export function ThemeToggle({ variant = 'compact' }: { variant?: 'compact' | 'expanded' }) {
  const { theme, setTheme, hydrate } = useTheme();

  useEffect(() => {
    hydrate();
  }, [hydrate]);

  return (
    <div
      role="radiogroup"
      aria-label="Tema de la aplicación"
      className="inline-flex items-center gap-0.5 rounded-lg border border-border bg-card p-0.5"
    >
      {OPTIONS.map(({ value, label, Icon }) => {
        const active = theme === value;
        return (
          <button
            key={value}
            type="button"
            role="radio"
            aria-checked={active}
            aria-label={label}
            title={label}
            onClick={() => setTheme(value)}
            className={cn(
              'inline-flex items-center justify-center gap-1.5 rounded-md transition-colors',
              variant === 'compact' ? 'h-7 w-7' : 'h-8 px-2.5',
              active
                ? 'bg-primary text-primary-foreground shadow-sm'
                : 'text-muted-foreground hover:bg-accent hover:text-foreground',
            )}
          >
            <Icon className="h-3.5 w-3.5" aria-hidden />
            {variant === 'expanded' && <span className="text-xs font-medium">{label}</span>}
          </button>
        );
      })}
    </div>
  );
}
