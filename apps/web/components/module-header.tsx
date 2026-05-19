'use client';

import { Info, X } from 'lucide-react';
import { useEffect, useState } from 'react';

interface ModuleHeaderProps {
  title: string;
  description: string;
  actions?: React.ReactNode;
  /** Optional dismissible tip shown in an info banner */
  infoText?: string;
  /** localStorage key to track dismissal (defaults to slugified title) */
  infoDismissKey?: string;
  icon?: React.ElementType;
  iconColor?: string;
}

export function ModuleHeader({
  title,
  description,
  actions,
  infoText,
  infoDismissKey,
  icon: Icon,
  iconColor = 'text-primary',
}: ModuleHeaderProps) {
  const storageKey = infoDismissKey ?? `module-tip-dismissed-${title.toLowerCase().replace(/\s+/g, '-')}`;
  const [tipVisible, setTipVisible] = useState(false);

  useEffect(() => {
    if (infoText) {
      const dismissed = localStorage.getItem(storageKey);
      setTipVisible(!dismissed);
    }
  }, [infoText, storageKey]);

  function dismiss() {
    localStorage.setItem(storageKey, '1');
    setTipVisible(false);
  }

  return (
    <div className="space-y-3">
      {/* Header row */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          {Icon && (
            <div className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-muted ${iconColor}`}>
              <Icon className="h-5 w-5" />
            </div>
          )}
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">{title}</h1>
            <p className="mt-0.5 text-sm text-muted-foreground">{description}</p>
          </div>
        </div>
        {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
      </div>

      {/* Dismissible info banner */}
      {infoText && tipVisible && (
        <div className="flex items-start gap-3 rounded-xl border border-blue-200 bg-blue-50 px-4 py-3">
          <Info className="mt-0.5 h-4 w-4 shrink-0 text-blue-500" />
          <p className="flex-1 text-sm text-blue-800">{infoText}</p>
          <button
            onClick={dismiss}
            className="rounded p-0.5 text-blue-400 transition-colors hover:bg-blue-100 hover:text-blue-700"
            title="Cerrar"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}
    </div>
  );
}
