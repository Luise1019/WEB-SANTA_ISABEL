'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus, Save, Trash2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { api } from '@/lib/api-client';

type CostItem = {
  id: string;
  category: string;
  concept: string;
  fideicomisoValue: string | null;
  constructorValue: string | null;
  totalValue: string;
  pctOfSales: string | null;
  order: number;
};

type EditableItem = {
  key: string; // temp key for new rows
  id?: string;
  category: string;
  concept: string;
  fideicomisoValue: string;
  constructorValue: string;
  totalValue: string;
  pctOfSales: string;
  order: number;
  isNew?: boolean;
};

const CATEGORIES = [
  { value: 'LOTE', label: 'Lote' },
  { value: 'URBANISMO', label: 'Urbanismo' },
  { value: 'DIRECTO', label: 'Directos' },
  { value: 'INDIRECTO', label: 'Indirectos' },
  { value: 'FINANCIERO', label: 'Financiero' },
  { value: 'VENTAS', label: 'Ventas' },
];

const CAT_COLOR: Record<string, string> = {
  LOTE: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300',
  URBANISMO: 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300',
  DIRECTO: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
  INDIRECTO: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300',
  FINANCIERO: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300',
  VENTAS: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300',
};

const fmtCOP = (v: string) => {
  const n = Number(v);
  if (!v || isNaN(n)) return '';
  return n.toLocaleString('es-CO', { minimumFractionDigits: 0 });
};

let keyCounter = 0;
const newKey = () => `new-${++keyCounter}`;

export default function FeasibilityCostsPage({ params }: { params: { id: string } }) {
  const { id } = params;
  const qc = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ['feasibility', id],
    queryFn: () => api.getFeasibility(id),
  });

  const [items, setItems] = useState<EditableItem[]>([]);
  const [dirty, setDirty] = useState(false);

  const fd = data as unknown as
    | { costItems?: CostItem[]; analysis?: { totalSales?: string | null } }
    | undefined;

  useEffect(() => {
    if (fd?.costItems) {
      setItems(
        fd.costItems
          .sort((a, b) => a.order - b.order)
          .map((c) => ({
            key: c.id,
            id: c.id,
            category: c.category,
            concept: c.concept,
            fideicomisoValue: c.fideicomisoValue ?? '',
            constructorValue: c.constructorValue ?? '',
            totalValue: c.totalValue,
            pctOfSales: c.pctOfSales ?? '',
            order: c.order,
          })),
      );
      setDirty(false);
    }
  }, [fd]);

  const saveMutation = useMutation({
    mutationFn: (rows: EditableItem[]) =>
      api.replaceFeasibilityCostItems(
        id,
        rows.map((r, idx) => ({
          category: r.category,
          concept: r.concept,
          fideicomisoValue: r.fideicomisoValue || null,
          constructorValue: r.constructorValue || null,
          totalValue: r.totalValue || '0',
          pctOfSales: r.pctOfSales || null,
          order: idx,
        })),
      ),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['feasibility', id] });
      setDirty(false);
      toast.success('Estructura de costos guardada');
    },
    onError: () => toast.error('Error al guardar'),
  });

  const updateItem = (key: string, field: keyof EditableItem, value: string) => {
    setItems((prev) =>
      prev.map((item) => {
        if (item.key !== key) return item;
        const updated = { ...item, [field]: value };
        // Auto-compute totalValue from fideicomiso + constructor
        if (field === 'fideicomisoValue' || field === 'constructorValue') {
          const f = Number(field === 'fideicomisoValue' ? value : updated.fideicomisoValue) || 0;
          const c = Number(field === 'constructorValue' ? value : updated.constructorValue) || 0;
          updated.totalValue = String(f + c);
        }
        // Auto-compute pctOfSales
        const totalSales = Number(fd?.analysis?.totalSales ?? 0);
        if (totalSales > 0 && updated.totalValue) {
          updated.pctOfSales = ((Number(updated.totalValue) / totalSales) * 100).toFixed(2);
        }
        return updated;
      }),
    );
    setDirty(true);
  };

  const addRow = (category: string) => {
    setItems((prev) => [
      ...prev,
      {
        key: newKey(),
        category,
        concept: '',
        fideicomisoValue: '',
        constructorValue: '',
        totalValue: '0',
        pctOfSales: '',
        order: prev.length,
        isNew: true,
      },
    ]);
    setDirty(true);
  };

  const removeRow = (key: string) => {
    setItems((prev) => prev.filter((i) => i.key !== key));
    setDirty(true);
  };

  // Group by category
  const grouped: Record<string, EditableItem[]> = {};
  for (const item of items) {
    grouped[item.category] = grouped[item.category] ?? [];
    grouped[item.category]!.push(item);
  }

  const totalByCol = {
    fideicomiso: items.reduce((s, i) => s + (Number(i.fideicomisoValue) || 0), 0),
    constructor: items.reduce((s, i) => s + (Number(i.constructorValue) || 0), 0),
    total: items.reduce((s, i) => s + (Number(i.totalValue) || 0), 0),
  };
  const totalSales = Number(fd?.analysis?.totalSales ?? 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold">Estructura de costos</h1>
          <p className="text-sm text-muted-foreground">
            Fideicomiso vs Constructor — Formato CREDICORP
          </p>
        </div>
        <Button
          onClick={() => saveMutation.mutate(items)}
          disabled={!dirty || saveMutation.isPending}
          className="bg-teal-600 hover:bg-teal-700"
          size="sm"
        >
          <Save className="h-4 w-4 mr-1.5" />
          {saveMutation.isPending ? 'Guardando…' : 'Guardar cambios'}
        </Button>
      </div>

      {isLoading ? (
        <div className="h-64 animate-pulse rounded-xl bg-muted" />
      ) : (
        <div className="space-y-4">
          {CATEGORIES.map(({ value, label }) => {
            const rows = grouped[value] ?? [];
            const catTotal = rows.reduce((s, r) => s + (Number(r.totalValue) || 0), 0);
            return (
              <Card key={value}>
                <CardHeader className="py-3 px-4 flex-row items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span
                      className={`text-xs font-semibold px-2 py-0.5 rounded-full ${CAT_COLOR[value] ?? 'bg-gray-100'}`}
                    >
                      {label}
                    </span>
                    <span className="text-sm font-mono text-muted-foreground">
                      {catTotal > 0 ? `$${catTotal.toLocaleString('es-CO')}` : ''}
                    </span>
                  </div>
                  <Button variant="ghost" size="sm" onClick={() => addRow(value)}>
                    <Plus className="h-4 w-4 mr-1" /> Agregar
                  </Button>
                </CardHeader>
                {rows.length > 0 && (
                  <CardContent className="p-0">
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead className="bg-muted/30 text-xs text-muted-foreground">
                          <tr>
                            <th className="text-left px-4 py-2 font-medium">Concepto</th>
                            <th className="text-right px-3 py-2 font-medium">Fideicomiso</th>
                            <th className="text-right px-3 py-2 font-medium">Constructor</th>
                            <th className="text-right px-3 py-2 font-medium">Total</th>
                            <th className="text-right px-3 py-2 font-medium">% Ventas</th>
                            <th className="w-8 px-2" />
                          </tr>
                        </thead>
                        <tbody>
                          {rows.map((row) => (
                            <tr key={row.key} className="border-t hover:bg-muted/20">
                              <td className="px-4 py-1.5">
                                <input
                                  className="w-full bg-transparent outline-none placeholder:text-muted-foreground/50"
                                  placeholder="Concepto…"
                                  value={row.concept}
                                  onChange={(e) => updateItem(row.key, 'concept', e.target.value)}
                                />
                              </td>
                              <td className="px-3 py-1.5">
                                <input
                                  className="w-full text-right bg-transparent outline-none font-mono"
                                  placeholder="0"
                                  value={row.fideicomisoValue}
                                  onChange={(e) =>
                                    updateItem(row.key, 'fideicomisoValue', e.target.value)
                                  }
                                />
                              </td>
                              <td className="px-3 py-1.5">
                                <input
                                  className="w-full text-right bg-transparent outline-none font-mono"
                                  placeholder="0"
                                  value={row.constructorValue}
                                  onChange={(e) =>
                                    updateItem(row.key, 'constructorValue', e.target.value)
                                  }
                                />
                              </td>
                              <td className="px-3 py-1.5 text-right font-mono text-muted-foreground">
                                {fmtCOP(row.totalValue)}
                              </td>
                              <td className="px-3 py-1.5 text-right font-mono text-muted-foreground">
                                {row.pctOfSales ? `${Number(row.pctOfSales).toFixed(1)}%` : '—'}
                              </td>
                              <td className="px-2 py-1.5">
                                <button
                                  onClick={() => removeRow(row.key)}
                                  className="text-muted-foreground hover:text-destructive transition-colors"
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </CardContent>
                )}
              </Card>
            );
          })}

          {/* Totals */}
          <Card className="bg-muted/50">
            <CardContent className="p-4">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <tbody>
                    <tr className="font-bold text-base">
                      <td className="py-1">TOTAL COSTOS</td>
                      <td className="py-1 text-right font-mono px-3">
                        ${totalByCol.fideicomiso.toLocaleString('es-CO')}
                      </td>
                      <td className="py-1 text-right font-mono px-3">
                        ${totalByCol.constructor.toLocaleString('es-CO')}
                      </td>
                      <td className="py-1 text-right font-mono px-3">
                        ${totalByCol.total.toLocaleString('es-CO')}
                      </td>
                      <td className="py-1 text-right font-mono px-3">
                        {totalSales > 0
                          ? `${((totalByCol.total / totalSales) * 100).toFixed(1)}%`
                          : '—'}
                      </td>
                      <td className="w-8" />
                    </tr>
                    {totalSales > 0 && (
                      <tr className="text-green-700 font-semibold">
                        <td className="py-1">MARGEN BRUTO</td>
                        <td colSpan={3} className="py-1 text-right font-mono px-3">
                          ${(totalSales - totalByCol.total).toLocaleString('es-CO')}
                        </td>
                        <td className="py-1 text-right font-mono px-3">
                          {((1 - totalByCol.total / totalSales) * 100).toFixed(1)}%
                        </td>
                        <td className="w-8" />
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
