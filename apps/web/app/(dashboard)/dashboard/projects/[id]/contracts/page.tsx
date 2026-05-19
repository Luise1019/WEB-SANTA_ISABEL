'use client';

import { useState } from 'react';
import { FileText, Plus, CheckCircle, Clock, AlertCircle, Building2, DollarSign } from 'lucide-react';
import { ModuleHeader } from '@/components/module-header';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

type Contract = {
  id: string;
  vendor: string;
  concept: string;
  totalValue: number;
  paidValue: number;
  status: 'ACTIVE' | 'COMPLETED' | 'PENDING';
  startDate: string;
  endDate: string;
};

const MOCK_CONTRACTS: Contract[] = [
  { id: '1', vendor: 'Construamos SAS', concept: 'Obra civil estructura', totalValue: 850_000_000, paidValue: 340_000_000, status: 'ACTIVE', startDate: '2026-01-15', endDate: '2026-12-30' },
  { id: '2', vendor: 'Instalaciones Eléctricas Ltda', concept: 'Instalaciones eléctricas y voz/datos', totalValue: 95_000_000, paidValue: 0, status: 'PENDING', startDate: '2026-06-01', endDate: '2026-11-30' },
  { id: '3', vendor: 'Acabados Premium', concept: 'Pisos, enchapes y pintura', totalValue: 185_000_000, paidValue: 185_000_000, status: 'COMPLETED', startDate: '2025-10-01', endDate: '2026-03-31' },
];

function formatCOP(v: number) {
  return new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', notation: 'compact', maximumFractionDigits: 1 }).format(v);
}

const STATUS_CONFIG = {
  ACTIVE: { label: 'En ejecución', color: 'bg-blue-100 text-blue-700', icon: Clock },
  COMPLETED: { label: 'Finalizado', color: 'bg-green-100 text-green-700', icon: CheckCircle },
  PENDING: { label: 'Por iniciar', color: 'bg-amber-100 text-amber-700', icon: AlertCircle },
};

export default function ContractsPage({ params }: { params: { id: string } }) {
  const [contracts] = useState<Contract[]>(MOCK_CONTRACTS);

  const totalContracted = contracts.reduce((s, c) => s + c.totalValue, 0);
  const totalPaid = contracts.reduce((s, c) => s + c.paidValue, 0);
  const totalPending = totalContracted - totalPaid;

  return (
    <div className="space-y-6">
      <ModuleHeader
        title="Contratos y Proveedores"
        description="Gestión de contratos, órdenes de compra y actas de pago"
        infoText="Administra contratos con contratistas y proveedores. Registra valores, avances de pago, retenciones y garantías. Genera actas de pago y órdenes de compra."
        actions={
          <Button size="sm">
            <Plus className="mr-1 h-4 w-4" />
            Nuevo contrato
          </Button>
        }
      />

      {/* KPIs */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { label: 'Contratos activos', value: String(contracts.filter(c => c.status === 'ACTIVE').length), color: 'text-blue-600', icon: Building2 },
          { label: 'Total contratado', value: formatCOP(totalContracted), color: 'text-foreground', icon: FileText },
          { label: 'Total pagado', value: formatCOP(totalPaid), color: 'text-green-600', icon: CheckCircle },
          { label: 'Por pagar', value: formatCOP(totalPending), color: 'text-amber-600', icon: DollarSign },
        ].map(({ label, value, color, icon: Icon }) => (
          <Card key={label}>
            <CardContent className="pt-4 pb-3">
              <div className="flex items-center gap-1.5 mb-1">
                <Icon className={`h-3.5 w-3.5 ${color}`} />
                <p className="text-xs text-muted-foreground">{label}</p>
              </div>
              <p className={`text-lg font-bold ${color}`}>{value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Module in development banner */}
      <Card className="border-dashed border-violet-200 bg-violet-50/50">
        <CardContent className="flex items-center gap-3 pt-4 pb-4">
          <FileText className="h-8 w-8 text-violet-400 shrink-0" />
          <div>
            <p className="text-sm font-medium text-violet-800">Módulo en desarrollo</p>
            <p className="text-xs text-violet-600 mt-0.5">
              Próximamente: actas de pago, retenciones automáticas, órdenes de compra, alertas de vencimiento de pólizas y garantías.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Contracts table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Contratos ({contracts.length})</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b">
                <tr className="text-left text-xs text-muted-foreground">
                  <th className="py-2 pr-3 font-medium">Proveedor</th>
                  <th className="py-2 pr-3 font-medium">Concepto</th>
                  <th className="py-2 pr-3 text-right font-medium">Valor total</th>
                  <th className="py-2 pr-3 text-right font-medium">Pagado</th>
                  <th className="py-2 pr-3 text-right font-medium">% Avance</th>
                  <th className="py-2 font-medium">Estado</th>
                </tr>
              </thead>
              <tbody>
                {contracts.map((c) => {
                  const pct = c.totalValue > 0 ? Math.round((c.paidValue / c.totalValue) * 100) : 0;
                  const { label, color } = STATUS_CONFIG[c.status];
                  return (
                    <tr key={c.id} className="border-b last:border-0 hover:bg-muted/20">
                      <td className="py-2.5 pr-3 font-medium">{c.vendor}</td>
                      <td className="py-2.5 pr-3 text-muted-foreground text-xs">{c.concept}</td>
                      <td className="py-2.5 pr-3 text-right font-mono">{formatCOP(c.totalValue)}</td>
                      <td className="py-2.5 pr-3 text-right font-mono text-green-700">{formatCOP(c.paidValue)}</td>
                      <td className="py-2.5 pr-3">
                        <div className="flex items-center justify-end gap-2">
                          <div className="w-16 h-1.5 rounded-full bg-muted overflow-hidden">
                            <div className="h-full bg-blue-500 rounded-full" style={{ width: `${pct}%` }} />
                          </div>
                          <span className="text-xs font-medium w-8 text-right">{pct}%</span>
                        </div>
                      </td>
                      <td className="py-2.5">
                        <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${color}`}>{label}</span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
