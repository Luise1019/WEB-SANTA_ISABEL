'use client';

import { ExternalLink, Loader2 } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';

type Props = {
  /** Función que hace fetch y retorna Response con HTML */
  fetcher: () => Promise<Response>;
  /** Texto del botón */
  label?: string;
  /** Tamaño del botón */
  size?: 'sm' | 'default' | 'lg';
  /** Variante */
  variant?: 'default' | 'outline' | 'ghost';
  className?: string;
};

/** Botón que genera un reporte HTML en el backend y lo abre en nueva pestaña */
export function ReportHtmlButton({ fetcher, label = 'Ver reporte HTML', size = 'sm', variant = 'outline', className }: Props) {
  const [loading, setLoading] = useState(false);

  const handleClick = async () => {
    setLoading(true);
    try {
      const res = await fetcher();
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error((body as { message?: string }).message ?? `Error ${res.status}`);
      }
      const html = await res.text();
      const blob = new Blob([html], { type: 'text/html' });
      const url  = URL.createObjectURL(blob);
      window.open(url, '_blank');
      setTimeout(() => URL.revokeObjectURL(url), 15_000);
      toast.success('Reporte abierto en nueva pestaña');
    } catch (e) {
      toast.error(`Error al generar reporte: ${(e as Error).message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Button size={size} variant={variant} onClick={handleClick} disabled={loading} className={className}>
      {loading
        ? <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
        : <ExternalLink className="h-3.5 w-3.5 mr-1.5" />
      }
      {label}
    </Button>
  );
}
