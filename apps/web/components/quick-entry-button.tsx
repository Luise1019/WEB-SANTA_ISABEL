'use client';

import { useState } from 'react';
import { Plus, X, BookOpen, FileText, AlertCircle, ShieldCheck, TrendingDown, TrendingUp } from 'lucide-react';
import Link from 'next/link';
import { useParams } from 'next/navigation';

const ACTIONS = [
  { icon: BookOpen,    label: 'Nueva entrada bitácora',   href: (id: string) => `/dashboard/projects/${id}/logbook`,    color: 'bg-blue-500' },
  { icon: TrendingUp,  label: 'Nuevo ingreso de caja',    href: (id: string) => `/dashboard/projects/${id}/cashflow`,   color: 'bg-green-500' },
  { icon: TrendingDown,label: 'Nuevo egreso de caja',     href: (id: string) => `/dashboard/projects/${id}/cashflow`,   color: 'bg-red-500' },
  { icon: FileText,    label: 'Nuevo contrato',            href: (id: string) => `/dashboard/projects/${id}/contracts`, color: 'bg-violet-500' },
  { icon: AlertCircle, label: 'Nueva no conformidad',     href: (id: string) => `/dashboard/projects/${id}/quality`,   color: 'bg-amber-500' },
  { icon: ShieldCheck, label: 'Nuevo reporte SST',        href: (id: string) => `/dashboard/projects/${id}/safety`,    color: 'bg-teal-500' },
];

export function QuickEntryButton() {
  const [open, setOpen] = useState(false);
  const params = useParams();
  const projectId = typeof params?.id === 'string' ? params.id : '';

  return (
    <>
      {/* Overlay */}
      {open && (
        <div
          className="fixed inset-0 z-40 bg-black/30 backdrop-blur-sm"
          onClick={() => setOpen(false)}
        />
      )}

      {/* Action items */}
      <div
        className={`fixed bottom-20 right-6 z-50 flex flex-col-reverse gap-2 transition-all duration-300 ${
          open ? 'opacity-100 translate-y-0 pointer-events-auto' : 'opacity-0 translate-y-4 pointer-events-none'
        }`}
      >
        {ACTIONS.map((action, i) => {
          const Icon = action.icon;
          const href = projectId ? action.href(projectId) : '#';
          return (
            <Link
              key={i}
              href={href}
              onClick={() => setOpen(false)}
              style={{ transitionDelay: open ? `${i * 40}ms` : '0ms' }}
              className={`flex items-center gap-3 rounded-full px-4 py-2.5 text-sm font-medium text-white shadow-lg transition-all duration-200 hover:scale-105 ${action.color}`}
            >
              <Icon className="h-4 w-4 shrink-0" />
              <span className="whitespace-nowrap">{action.label}</span>
            </Link>
          );
        })}
      </div>

      {/* FAB button */}
      <button
        onClick={() => setOpen((v) => !v)}
        className={`fixed bottom-6 right-6 z-50 flex h-14 w-14 items-center justify-center rounded-full shadow-xl transition-all duration-300 hover:scale-110 ${
          open
            ? 'bg-slate-700 rotate-45'
            : 'bg-blue-600 hover:bg-blue-700'
        }`}
        aria-label="Acciones rápidas"
      >
        {open ? (
          <X className="h-6 w-6 text-white" />
        ) : (
          <Plus className="h-6 w-6 text-white" />
        )}
      </button>
    </>
  );
}
