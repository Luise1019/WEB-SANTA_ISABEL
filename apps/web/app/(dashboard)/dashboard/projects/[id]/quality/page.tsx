'use client';

import { useState } from 'react';
import { AlertCircle, Plus, CheckCircle2, Clock, XCircle, ClipboardList } from 'lucide-react';
import { ModuleHeader } from '@/components/module-header';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

type NCR = {
  id: string;
  code: string;
  title: string;
  location: string;
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  status: 'OPEN' | 'IN_PROGRESS' | 'CLOSED' | 'REJECTED';
  reportedDate: string;
  closureDate?: string;
  responsible: string;
  description: string;
};

const MOCK_NCRS: NCR[] = [
  { id: '1', code: 'NCR-001', title: 'Fisuras en muro divisorio piso 3', location: 'Piso 3, Apto 302', severity: 'HIGH', status: 'IN_PROGRESS', reportedDate: '2026-05-10', responsible: 'Residente obra', description: 'Se detectaron fisuras de 2mm en muro divisorio entre unidades 301 y 302.' },
  { id: '2', code: 'NCR-002', title: 'Recubrimiento insuficiente acero', location: 'Piso 4, viga V-4A', severity: 'CRITICAL', status: 'OPEN', reportedDate: '2026-05-15', responsible: 'Director técnico', description: 'Recubrimiento de acero longitudinal 15mm vs 25mm requeridos por NSR-10.' },
  { id: '3', code: 'NCR-003', title: 'Pendiente incorrecta cubierta', location: 'Terraza cubierta', severity: 'MEDIUM', status: 'CLOSED', reportedDate: '2026-04-20', closureDate: '2026-05-05', responsible: 'Residente obra', description: 'Pendiente 1% vs 2% mínimo. Corregido con mortero de nivelación.' },
];

const SEVERITY_CONFIG = {
  LOW: { label: 'Baja', color: 'bg-slate-100 text-slate-600' },
  MEDIUM: { label: 'Media', color: 'bg-amber-100 text-amber-700' },
  HIGH: { label: 'Alta', color: 'bg-orange-100 text-orange-700' },
  CRITICAL: { label: 'Crítica', color: 'bg-red-100 text-red-700' },
};

const STATUS_CONFIG = {
  OPEN: { label: 'Abierta', color: 'bg-red-100 text-red-700', icon: XCircle },
  IN_PROGRESS: { label: 'En corrección', color: 'bg-blue-100 text-blue-700', icon: Clock },
  CLOSED: { label: 'Cerrada', color: 'bg-green-100 text-green-700', icon: CheckCircle2 },
  REJECTED: { label: 'Rechazada', color: 'bg-slate-100 text-slate-500', icon: XCircle },
};

export default function QualityPage({ params }: { params: { id: string } }) {
  const [ncrs] = useState<NCR[]>(MOCK_NCRS);
  const [filter, setFilter] = useState<'ALL' | NCR['status']>('ALL');

  const filtered = filter === 'ALL' ? ncrs : ncrs.filter(n => n.status === filter);
  const open = ncrs.filter(n => n.status === 'OPEN').length;
  const inProgress = ncrs.filter(n => n.status === 'IN_PROGRESS').length;
  const closed = ncrs.filter(n => n.status === 'CLOSED').length;

  return (
    <div className="space-y-6">
      <ModuleHeader
        title="NCR — Control de Calidad"
        description="No Conformidades y seguimiento de correcciones"
        infoText="Las No Conformidades (NCR) registran desviaciones respecto a especificaciones técnicas, planos o normas (NSR-10, NTC). Cada NCR tiene un responsable, fecha límite y evidencia fotográfica de cierre."
        actions={
          <Button size="sm">
            <Plus className="mr-1 h-4 w-4" />
            Nueva NCR
          </Button>
        }
      />

      {/* Stats */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { label: 'Total NCRs', value: String(ncrs.length), color: 'text-foreground' },
          { label: 'Abiertas', value: String(open), color: 'text-red-600' },
          { label: 'En corrección', value: String(inProgress), color: 'text-blue-600' },
          { label: 'Cerradas', value: String(closed), color: 'text-green-600' },
        ].map(({ label, value, color }) => (
          <Card key={label}>
            <CardContent className="pt-4 pb-3">
              <p className="text-xs text-muted-foreground">{label}</p>
              <p className={`mt-1 text-2xl font-bold ${color}`}>{value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Module in development */}
      <Card className="border-dashed border-amber-200 bg-amber-50/50">
        <CardContent className="flex items-center gap-3 pt-4 pb-4">
          <ClipboardList className="h-8 w-8 text-amber-400 shrink-0" />
          <div>
            <p className="text-sm font-medium text-amber-800">Módulo en desarrollo</p>
            <p className="text-xs text-amber-600 mt-0.5">
              Próximamente: adjuntar fotos de no conformidad y cierre, vincular a tarea del cronograma, reporte de indicadores ISO 9001, historial de auditorías.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Filters */}
      <div className="flex gap-1 flex-wrap">
        {(['ALL', 'OPEN', 'IN_PROGRESS', 'CLOSED'] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
              filter === f ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:bg-muted/80'
            }`}
          >
            {f === 'ALL' ? 'Todas' : STATUS_CONFIG[f].label}
          </button>
        ))}
      </div>

      {/* NCR list */}
      <div className="space-y-3">
        {filtered.map((ncr) => {
          const { label: sevLabel, color: sevColor } = SEVERITY_CONFIG[ncr.severity];
          const { label: stLabel, color: stColor, icon: StIcon } = STATUS_CONFIG[ncr.status];
          return (
            <Card key={ncr.id} className="hover:shadow-md transition-shadow">
              <CardContent className="pt-4 pb-4">
                <div className="flex items-start gap-3">
                  <StIcon className={`h-5 w-5 shrink-0 mt-0.5 ${ncr.status === 'OPEN' ? 'text-red-500' : ncr.status === 'IN_PROGRESS' ? 'text-blue-500' : 'text-green-500'}`} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <span className="text-xs font-mono text-muted-foreground">{ncr.code}</span>
                      <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${sevColor}`}>{sevLabel}</span>
                      <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${stColor}`}>{stLabel}</span>
                    </div>
                    <p className="text-sm font-semibold mb-0.5">{ncr.title}</p>
                    <p className="text-xs text-muted-foreground mb-1">📍 {ncr.location} · 👤 {ncr.responsible}</p>
                    <p className="text-xs text-muted-foreground">{ncr.description}</p>
                    <div className="flex gap-3 mt-2 text-xs text-muted-foreground">
                      <span>Reportada: {new Date(ncr.reportedDate + 'T00:00:00').toLocaleDateString('es-CO')}</span>
                      {ncr.closureDate && <span>Cerrada: {new Date(ncr.closureDate + 'T00:00:00').toLocaleDateString('es-CO')}</span>}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
