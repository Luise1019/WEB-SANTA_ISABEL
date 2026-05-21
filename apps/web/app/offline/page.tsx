'use client';

import { RefreshCw, WifiOff } from 'lucide-react';

export default function OfflinePage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <div className="w-full max-w-md text-center">
        <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-2xl bg-muted text-muted-foreground">
          <WifiOff className="h-10 w-10" aria-hidden />
        </div>
        <h1 className="text-2xl font-bold text-foreground tracking-tight">
          Estás sin conexión
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          No hay conexión a Internet. Las páginas que ya visitaste siguen disponibles desde el caché.
          Vuelve a intentarlo cuando recuperes señal.
        </p>

        <div className="mt-6 flex flex-col sm:flex-row gap-2 justify-center">
          <button
            onClick={() => window.location.reload()}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground transition-colors hover:opacity-90"
          >
            <RefreshCw className="h-4 w-4" aria-hidden />
            Reintentar
          </button>
          <button
            onClick={() => window.history.back()}
            className="inline-flex items-center justify-center gap-2 rounded-xl border border-border bg-card px-4 py-2.5 text-sm font-medium text-foreground transition-colors hover:bg-accent"
          >
            Volver
          </button>
        </div>

        <p className="mt-8 text-[11px] text-muted-foreground">
          Algunas funciones (subir fotos, crear registros) se reintentarán automáticamente cuando vuelva la conexión.
        </p>
      </div>
    </div>
  );
}
