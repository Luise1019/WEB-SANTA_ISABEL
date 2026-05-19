'use client';

import { ShieldCheck, Plus, AlertTriangle, Users, HardHat, Activity } from 'lucide-react';
import { ModuleHeader } from '@/components/module-header';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

type Incident = {
  id: string;
  date: string;
  type: 'ACCIDENT' | 'NEAR_MISS' | 'CONDITION';
  severity: 'LOW' | 'MEDIUM' | 'HIGH';
  description: string;
  affectedPerson?: string;
  status: 'OPEN' | 'CLOSED';
};

const MOCK_INCIDENTS: Incident[] = [
  { id: '1', date: '2026-05-12', type: 'NEAR_MISS', severity: 'MEDIUM', description: 'Caída de objeto (ladrillo) desde piso 5. No hubo lesionados. Se implementó malla de seguridad.', status: 'CLOSED' },
  { id: '2', date: '2026-04-28', type: 'CONDITION', severity: 'HIGH', description: 'Andamio sin trabe en piso 3, riesgo de volcamiento. Suspendido hasta corrección.', status: 'CLOSED' },
];

const TYPE_LABELS: Record<string, string> = {
  ACCIDENT: 'Accidente',
  NEAR_MISS: 'Casi accidente',
  CONDITION: 'Condición insegura',
};

const KPI_DATA = [
  { label: 'Días sin accidentes', value: '47', icon: ShieldCheck, color: 'text-green-600' },
  { label: 'Incidentes este mes', value: '0', icon: AlertTriangle, color: 'text-amber-500' },
  { label: 'Personal con ARL', value: '24/24', icon: Users, color: 'text-blue-600' },
  { label: 'EPPs entregados', value: '96', icon: HardHat, color: 'text-teal-600' },
];

export default function SafetyPage({ params }: { params: { id: string } }) {
  return (
    <div className="space-y-6">
      <ModuleHeader
        title="SST — Seguridad y Salud"
        description="Seguridad y Salud en el Trabajo · Indicadores · Incidentes · EPPs"
        infoText="Gestiona la seguridad en obra conforme a la Resolución 0312 de 2019 y el SG-SST. Registra incidentes, casi accidentes, condiciones inseguras, entrega de EPPs e inspecciones periódicas."
        actions={
          <Button size="sm">
            <Plus className="mr-1 h-4 w-4" />
            Nuevo reporte
          </Button>
        }
      />

      {/* KPIs */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {KPI_DATA.map(({ label, value, icon: Icon, color }) => (
          <Card key={label}>
            <CardContent className="pt-4 pb-3">
              <div className="flex items-center gap-1.5 mb-1">
                <Icon className={`h-4 w-4 ${color}`} />
                <p className="text-xs text-muted-foreground">{label}</p>
              </div>
              <p className={`text-xl font-bold ${color}`}>{value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Development banner */}
      <Card className="border-dashed border-teal-200 bg-teal-50/50">
        <CardContent className="flex items-center gap-3 pt-4 pb-4">
          <Activity className="h-8 w-8 text-teal-400 shrink-0" />
          <div>
            <p className="text-sm font-medium text-teal-800">Módulo en desarrollo</p>
            <p className="text-xs text-teal-600 mt-0.5">
              Próximamente: registro de entrega EPPs con firma, inspecciones de seguridad semanales, indicadores de accidentalidad (IF, IS, ILI), charlas de 5 minutos y matriz de riesgos.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Incidents */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Historial de incidentes</CardTitle>
        </CardHeader>
        <CardContent>
          {MOCK_INCIDENTS.length === 0 ? (
            <div className="flex h-32 items-center justify-center">
              <div className="text-center">
                <ShieldCheck className="h-8 w-8 text-green-500 mx-auto mb-2" />
                <p className="text-sm font-medium text-green-700">¡Sin incidentes registrados!</p>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              {MOCK_INCIDENTS.map((inc) => (
                <div key={inc.id} className="flex items-start gap-3 rounded-lg border p-3">
                  <AlertTriangle className={`h-4 w-4 shrink-0 mt-0.5 ${inc.severity === 'HIGH' ? 'text-red-500' : inc.severity === 'MEDIUM' ? 'text-amber-500' : 'text-slate-400'}`} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="text-xs font-medium">{TYPE_LABELS[inc.type]}</span>
                      <span className={`text-xs rounded-full px-2 py-0.5 ${inc.status === 'CLOSED' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                        {inc.status === 'CLOSED' ? 'Cerrado' : 'Abierto'}
                      </span>
                      <span className="text-xs text-muted-foreground">{new Date(inc.date + 'T00:00:00').toLocaleDateString('es-CO')}</span>
                    </div>
                    <p className="text-sm text-muted-foreground">{inc.description}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
