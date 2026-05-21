'use client';

import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type Theme = 'light' | 'dark' | 'system';

type ThemeState = {
  theme: Theme;
  resolved: 'light' | 'dark';
  setTheme: (t: Theme) => void;
  hydrate: () => void;
};

/**
 * Theme store con persist en localStorage.
 *
 * `theme` puede ser 'light' | 'dark' | 'system'.
 * `resolved` siempre es 'light' o 'dark' (lo que efectivamente se aplica).
 *
 * Llamar `hydrate()` una vez en el layout cliente para:
 *   1. Aplicar la clase 'dark' al <html> según el theme actual.
 *   2. Escuchar cambios de prefers-color-scheme cuando theme === 'system'.
 */
function resolveTheme(t: Theme): 'light' | 'dark' {
  if (t === 'system') {
    if (typeof window === 'undefined') return 'light';
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }
  return t;
}

function applyTheme(t: 'light' | 'dark') {
  if (typeof document === 'undefined') return;
  document.documentElement.classList.toggle('dark', t === 'dark');
  document.documentElement.style.colorScheme = t;
}

export const useTheme = create<ThemeState>()(
  persist(
    (set, get) => ({
      theme: 'system',
      resolved: 'light',
      setTheme: (t) => {
        const resolved = resolveTheme(t);
        applyTheme(resolved);
        set({ theme: t, resolved });
      },
      hydrate: () => {
        const t = get().theme;
        const resolved = resolveTheme(t);
        applyTheme(resolved);
        set({ resolved });

        // Escuchar cambios del SO cuando el usuario eligió 'system'
        if (typeof window !== 'undefined' && t === 'system') {
          const mq = window.matchMedia('(prefers-color-scheme: dark)');
          const handler = () => {
            const next = resolveTheme('system');
            applyTheme(next);
            set({ resolved: next });
          };
          mq.addEventListener('change', handler);
        }
      },
    }),
    { name: 'santaisabel.theme' },
  ),
);
