'use client';

import { Download, Share2, X } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';

import { cn } from '@/lib/utils';

const DISMISS_KEY = 'santaisabel.installPrompt.dismissed';
const DISMISS_DAYS = 14;

// Tipo del evento que no está bien tipado en TS DOM
type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
};

/**
 * Banner discreto para instalar la PWA.
 *  - Android/desktop: captura `beforeinstallprompt`, muestra botón "Instalar"
 *  - iOS: detecta iOS Safari (no soporta el evento) y muestra instrucción "Compartir → Agregar a inicio"
 *  - Si el usuario descarta, queda silenciado por 14 días vía localStorage
 *  - Si la app ya está instalada (display: standalone), no aparece nunca
 */
export function InstallPrompt() {
  const [event, setEvent] = useState<BeforeInstallPromptEvent | null>(null);
  const [iosFlow, setIosFlow] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    // 1) Si ya está instalada, no mostrar nunca
    const isStandalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      (window.navigator as Navigator & { standalone?: boolean }).standalone === true;
    if (isStandalone) return;

    // 2) Respetar dismiss reciente
    const dismissedAt = Number(localStorage.getItem(DISMISS_KEY) || '0');
    if (dismissedAt && Date.now() - dismissedAt < DISMISS_DAYS * 86400000) return;

    // 3) Capturar beforeinstallprompt (Chrome/Edge/Android)
    const handler = (e: Event) => {
      e.preventDefault();
      setEvent(e as BeforeInstallPromptEvent);
      setOpen(true);
    };
    window.addEventListener('beforeinstallprompt', handler);

    // 4) Detectar iOS (Safari no dispara beforeinstallprompt)
    const ua = window.navigator.userAgent;
    const isIos = /iphone|ipad|ipod/i.test(ua);
    const isSafari = /^((?!chrome|android).)*safari/i.test(ua);
    if (isIos && isSafari) {
      // Pequeño delay para no interrumpir la primera carga
      const t = setTimeout(() => {
        setIosFlow(true);
        setOpen(true);
      }, 4000);
      return () => {
        clearTimeout(t);
        window.removeEventListener('beforeinstallprompt', handler);
      };
    }

    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const dismiss = useCallback(() => {
    localStorage.setItem(DISMISS_KEY, String(Date.now()));
    setOpen(false);
  }, []);

  const install = useCallback(async () => {
    if (!event) return;
    await event.prompt();
    const { outcome } = await event.userChoice;
    if (outcome === 'accepted') {
      setOpen(false);
    } else {
      dismiss();
    }
  }, [event, dismiss]);

  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-labelledby="install-prompt-title"
      className={cn(
        'fixed bottom-4 left-1/2 z-[60] -translate-x-1/2 w-[min(420px,calc(100vw-2rem))]',
        'rounded-2xl border border-border bg-card shadow-lg',
        'animate-in fade-in slide-in-from-bottom-4 duration-300',
      )}
    >
      <div className="flex items-start gap-3 p-4">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
          <Download className="h-5 w-5" aria-hidden />
        </div>
        <div className="min-w-0 flex-1">
          <h3 id="install-prompt-title" className="text-sm font-semibold text-foreground">
            Instala Santa Isabel
          </h3>
          {iosFlow ? (
            <p className="mt-0.5 text-xs text-muted-foreground">
              Toca <Share2 className="inline h-3 w-3 align-middle" /> y luego{' '}
              <span className="font-semibold">"Agregar a pantalla de inicio"</span> para abrir la app sin navegador.
            </p>
          ) : (
            <p className="mt-0.5 text-xs text-muted-foreground">
              Acceso rápido desde tu pantalla de inicio. Funciona offline para vistas ya cargadas.
            </p>
          )}
          <div className="mt-3 flex items-center gap-2">
            {!iosFlow && (
              <button
                onClick={install}
                className="rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground transition-colors hover:opacity-90"
              >
                Instalar
              </button>
            )}
            <button
              onClick={dismiss}
              className="rounded-lg px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
            >
              {iosFlow ? 'Entendido' : 'Ahora no'}
            </button>
          </div>
        </div>
        <button
          onClick={dismiss}
          aria-label="Cerrar"
          className="rounded-md p-1 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
        >
          <X className="h-4 w-4" aria-hidden />
        </button>
      </div>
    </div>
  );
}
