import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

const KPI_PLACEHOLDERS = [
  { label: 'Rentabilidad', value: '—', hint: 'Pendiente M9' },
  { label: 'Margen neto', value: '—', hint: 'Pendiente M9' },
  { label: 'Valor / m²', value: '—', hint: 'Pendiente M9' },
  { label: 'Costo / m²', value: '—', hint: 'Pendiente M9' },
];

export default function DashboardPage() {
  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-muted-foreground">Resumen ejecutivo de los proyectos activos.</p>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {KPI_PLACEHOLDERS.map((kpi) => (
          <Card key={kpi.label}>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">{kpi.label}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{kpi.value}</div>
              <p className="text-xs text-muted-foreground mt-1">{kpi.hint}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Roadmap</CardTitle>
        </CardHeader>
        <CardContent>
          <ol className="space-y-2 text-sm">
            <li>• M1 — Monorepo, auth, RBAC, CI/CD (en curso).</li>
            <li>• M2 — Projects + users + audit + UI shell.</li>
            <li>• M3-M4 — Presupuesto (APU, AIU, baseline).</li>
            <li>• M5 — Importador XLSX (Santa Isabel).</li>
            <li>• M6 — Cronograma + CPM + Gantt + curva S.</li>
            <li>• M7 — Ventas + planes de pago.</li>
            <li>• M8 — Flujo de caja + crédito constructor.</li>
            <li>• M9 — Cambios + dashboard con KPIs y alertas.</li>
            <li>• M10 — Reportes PDF + hardening.</li>
          </ol>
        </CardContent>
      </Card>
    </div>
  );
}
