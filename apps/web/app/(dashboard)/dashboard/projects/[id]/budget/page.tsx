'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ChevronDown, ChevronRight, Plus, Settings } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { api } from '@/lib/api-client';

// ─── Types ───────────────────────────────────────────────────
type ItemRow = {
  id: string;
  code: string;
  description: string;
  unit: string;
  quantity: string;
  unitCostCalc: string;
  totalCalc: string;
};

type SubchapterRow = {
  id: string;
  code: string;
  name: string;
  items: ItemRow[];
  subtotal: string;
};

type ChapterRow = {
  id: string;
  code: string;
  name: string;
  subchapters: SubchapterRow[];
  total: string;
};

type Summary = {
  chapters: ChapterRow[];
  directCost: string;
  aiuAmount: string;
  ivaAmount: string;
  totalCost: string;
  aiuConfig: {
    administracionPct: string;
    imprevistosPct: string;
    utilidadPct: string;
    ivaUtilidadPct: string;
  };
};

// ─── Helpers ─────────────────────────────────────────────────
function formatCOP(value: string | number) {
  return new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    maximumFractionDigits: 0,
  }).format(Number(value));
}

// ─── AIU Dialog ──────────────────────────────────────────────
function AIUPanel({
  projectId,
  config,
}: {
  projectId: string;
  config: Summary['aiuConfig'];
}) {
  const qc = useQueryClient();
  const [adm, setAdm] = useState(config.administracionPct ?? '10');
  const [imp, setImp] = useState(config.imprevistosPct ?? '5');
  const [uti, setUti] = useState(config.utilidadPct ?? '5');
  const [iva, setIva] = useState(config.ivaUtilidadPct ?? '19');

  const mutation = useMutation({
    mutationFn: () =>
      api.upsertAIU(projectId, {
        administracionPct: adm,
        imprevistosPct: imp,
        utilidadPct: uti,
        ivaUtilidadPct: iva,
        appliesToIndirect: false,
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['budget-summary', projectId] }),
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Settings className="h-4 w-4" />
          Configuración AIU
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            { label: 'Administración (%)', value: adm, set: setAdm },
            { label: 'Imprevistos (%)', value: imp, set: setImp },
            { label: 'Utilidad (%)', value: uti, set: setUti },
            { label: 'IVA utilidad (%)', value: iva, set: setIva },
          ].map(({ label, value, set }) => (
            <div key={label} className="space-y-1">
              <Label className="text-xs">{label}</Label>
              <Input
                type="number"
                min="0"
                max="100"
                step="0.01"
                value={value}
                onChange={(e) => set(e.target.value)}
                className="h-8 text-sm"
              />
            </div>
          ))}
        </div>
        <Button
          size="sm"
          className="mt-3"
          disabled={mutation.isPending}
          onClick={() => mutation.mutate()}
        >
          Guardar AIU
        </Button>
      </CardContent>
    </Card>
  );
}

// ─── Chapter Row ─────────────────────────────────────────────
function ChapterRow({ chapter }: { chapter: ChapterRow }) {
  const [open, setOpen] = useState(true);
  const hasItems = chapter.subchapters.some((s) => s.items.length > 0);

  return (
    <>
      <tr
        className="cursor-pointer bg-muted/40 font-semibold hover:bg-muted/60"
        onClick={() => setOpen((o) => !o)}
      >
        <td className="py-2 pl-2 pr-4" colSpan={5}>
          <span className="flex items-center gap-1">
            {open ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
            {chapter.code} — {chapter.name}
          </span>
        </td>
        <td className="py-2 pr-3 text-right font-mono text-sm">{formatCOP(chapter.total)}</td>
      </tr>
      {open &&
        chapter.subchapters.map((sub) => (
          <SubchapterRows key={sub.id} sub={sub} />
        ))}
      {open && !hasItems && (
        <tr>
          <td colSpan={6} className="py-1 pl-8 text-xs text-muted-foreground">
            Sin ítems aún.
          </td>
        </tr>
      )}
    </>
  );
}

function SubchapterRows({ sub }: { sub: SubchapterRow }) {
  return (
    <>
      <tr className="bg-muted/20 text-sm font-medium">
        <td className="py-1.5 pl-6 pr-4" colSpan={5}>
          {sub.code} {sub.name}
        </td>
        <td className="py-1.5 pr-3 text-right font-mono text-xs text-muted-foreground">
          {formatCOP(sub.subtotal)}
        </td>
      </tr>
      {sub.items.map((item) => (
        <tr key={item.id} className="border-b text-xs hover:bg-muted/10">
          <td className="py-1.5 pl-10 pr-2 font-mono">{item.code}</td>
          <td className="py-1.5 pr-4">{item.description}</td>
          <td className="py-1.5 pr-4 text-center">{item.unit}</td>
          <td className="py-1.5 pr-4 text-right">{Number(item.quantity).toLocaleString('es-CO')}</td>
          <td className="py-1.5 pr-4 text-right">{formatCOP(item.unitCostCalc)}</td>
          <td className="py-1.5 pr-3 text-right font-medium">{formatCOP(item.totalCalc)}</td>
        </tr>
      ))}
    </>
  );
}

// ─── Main Page ───────────────────────────────────────────────
export default function BudgetPage({ params }: { params: { id: string } }) {
  const { id: projectId } = params;

  const { data, isLoading, error } = useQuery({
    queryKey: ['budget-summary', projectId],
    queryFn: () => api.getBudgetSummary(projectId),
  });

  const summary = data as unknown as Summary | undefined;

  return (
    <div className="space-y-6">
      <header className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Presupuesto</h1>
          <p className="text-muted-foreground">Estructura de capítulos, ítems y análisis AIU.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" asChild>
            <Link href={`/dashboard/projects/${projectId}/budget/resources`}>
              <Plus className="mr-1 h-4 w-4" />
              Recursos
            </Link>
          </Button>
          <Button asChild>
            <Link href={`/dashboard/projects/${projectId}/budget/items/new`}>
              <Plus className="mr-1 h-4 w-4" />
              Nuevo ítem
            </Link>
          </Button>
        </div>
      </header>

      {/* AIU Config */}
      {summary && <AIUPanel projectId={projectId} config={summary.aiuConfig} />}

      {/* Budget Table */}
      <Card>
        <CardHeader>
          <CardTitle>Estructura presupuestal</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading && <p className="text-sm">Cargando presupuesto…</p>}
          {error && (
            <p className="text-sm text-destructive">
              Error al cargar presupuesto. Verifica que la API esté disponible.
            </p>
          )}
          {summary && (
            <>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="border-b">
                    <tr className="text-left text-xs text-muted-foreground">
                      <th className="py-2 pl-2 pr-4 font-medium">Código</th>
                      <th className="py-2 pr-4 font-medium">Descripción</th>
                      <th className="py-2 pr-4 text-center font-medium">Und</th>
                      <th className="py-2 pr-4 text-right font-medium">Cantidad</th>
                      <th className="py-2 pr-4 text-right font-medium">Vr. Unit</th>
                      <th className="py-2 pr-3 text-right font-medium">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {summary.chapters.map((ch) => (
                      <ChapterRow key={ch.id} chapter={ch} />
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Totals */}
              <div className="mt-4 space-y-1 border-t pt-4 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Costo directo</span>
                  <span className="font-mono">{formatCOP(summary.directCost)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">AIU</span>
                  <span className="font-mono">{formatCOP(summary.aiuAmount)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">IVA s/utilidad</span>
                  <span className="font-mono">{formatCOP(summary.ivaAmount)}</span>
                </div>
                <div className="flex justify-between border-t pt-2 text-base font-bold">
                  <span>TOTAL PRESUPUESTO</span>
                  <span className="font-mono text-primary">{formatCOP(summary.totalCost)}</span>
                </div>
              </div>
            </>
          )}
          {summary && summary.chapters.every((c) => c.subchapters.every((s) => s.items.length === 0)) && (
            <p className="mt-4 text-sm text-muted-foreground">
              Los capítulos están vacíos. Crea subcapítulos e ítems, o importa desde Excel.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
