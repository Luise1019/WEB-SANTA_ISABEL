'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, CheckCircle2, FileSpreadsheet, Upload } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useCallback, useRef, useState } from 'react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { api } from '@/lib/api-client';

type PreviewData = {
  analysis?: {
    promoter?: string | null;
    totalUnits?: number | null;
    builtAreaM2?: string | null;
    saleableAreaM2?: string | null;
    totalSales?: string | null;
    tir?: string | null;
    discountRate?: string | null;
  };
  costItems?: Array<{ category: string; concept: string; totalValue: string }>;
  cashFlow?: Array<{ year: number; month: number; finalBalance: string }>;
  budget?: {
    chapters?: Array<{
      code: string;
      name: string;
      subchapters?: Array<{
        code: string;
        name: string;
        items?: Array<{ code: string; description: string; unit: string; quantity: string; unitCost: string }>;
      }>;
    }>;
    totalDirectCost?: string;
  };
  warnings?: string[];
};

const fmtCOP = (v?: string | null) => {
  if (!v) return '—';
  const n = Number(v);
  if (isNaN(n)) return '—';
  if (Math.abs(n) >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  return `$${n.toLocaleString('es-CO')}`;
};

const MONTHS_ES = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];

export default function FeasibilityImportPage({ params }: { params: { id: string } }) {
  const { id } = params;
  const router = useRouter();
  const qc = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [preview, setPreview] = useState<PreviewData | null>(null);
  const [fileName, setFileName] = useState<string>('');
  const [dragging, setDragging] = useState(false);

  const previewMutation = useMutation({
    mutationFn: (file: File) => api.importSantaIsabelPreview(id, file),
    onSuccess: (data) => {
      setPreview(data as unknown as PreviewData);
      toast.success('Archivo analizado. Revisa el preview antes de confirmar.');
    },
    onError: (e: Error) => toast.error(`Error: ${e.message}`),
  });

  const commitMutation = useMutation({
    mutationFn: () => api.importSantaIsabelCommit(id, preview as unknown as Record<string, unknown>),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['feasibility', id] });
      toast.success('Datos importados exitosamente');
      router.push(`/dashboard/projects/${id}/feasibility`);
    },
    onError: (e: Error) => toast.error(`Error al importar: ${e.message}`),
  });

  const handleFile = useCallback((file: File) => {
    if (!file.name.match(/\.(xls|xlsx)$/i)) {
      toast.error('Solo se aceptan archivos .xls o .xlsx');
      return;
    }
    setFileName(file.name);
    setPreview(null);
    previewMutation.mutate(file);
  }, []);  // eslint-disable-line react-hooks/exhaustive-deps

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragging(false);
      const file = e.dataTransfer.files[0];
      if (file) handleFile(file);
    },
    [handleFile],
  );

  const totalItems = preview?.budget?.chapters?.reduce(
    (s, ch) => s + (ch.subchapters?.reduce((ss, sc) => ss + (sc.items?.length ?? 0), 0) ?? 0),
    0,
  ) ?? 0;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold">Importar Excel Santa Isabel</h1>
        <p className="text-sm text-muted-foreground">
          Formato CREDICORP (.xls) — prefactibilidad, presupuesto y flujo de caja
        </p>
      </div>

      {/* Drop zone */}
      <div
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        onClick={() => fileInputRef.current?.click()}
        className={`cursor-pointer rounded-2xl border-2 border-dashed p-12 text-center transition-all ${
          dragging ? 'border-teal-400 bg-teal-50' : 'border-muted-foreground/30 hover:border-teal-400 hover:bg-teal-50/50'
        }`}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept=".xls,.xlsx"
          className="hidden"
          onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }}
        />
        <FileSpreadsheet className="h-12 w-12 mx-auto text-teal-500 mb-3" />
        <p className="font-semibold">Arrastra tu archivo Excel aquí</p>
        <p className="text-sm text-muted-foreground mt-1">o haz clic para seleccionarlo</p>
        <p className="text-xs text-muted-foreground mt-2">.xls / .xlsx — formato CREDICORP Santa Isabel</p>
        {previewMutation.isPending && (
          <p className="mt-3 text-sm text-teal-600 animate-pulse">Analizando {fileName}…</p>
        )}
      </div>

      {/* Preview */}
      {preview && (
        <div className="space-y-4">
          {/* Summary KPIs */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { label: 'Promotor', value: preview.analysis?.promoter ?? '—' },
              { label: 'Unidades', value: String(preview.analysis?.totalUnits ?? '—') },
              { label: 'Total ventas', value: fmtCOP(preview.analysis?.totalSales) },
              { label: 'Ítems presupuesto', value: String(totalItems) },
              { label: 'Área vendible', value: preview.analysis?.saleableAreaM2 ? `${Number(preview.analysis.saleableAreaM2).toLocaleString('es-CO')} m²` : '—' },
              { label: 'Meses flujo caja', value: String(preview.cashFlow?.length ?? 0) },
              { label: 'Ítems de costo', value: String(preview.costItems?.length ?? 0) },
              { label: 'Capítulos', value: String(preview.budget?.chapters?.length ?? 0) },
            ].map(({ label, value }) => (
              <Card key={label} className="bg-teal-50 border-teal-200">
                <CardContent className="p-3">
                  <p className="text-xs text-muted-foreground">{label}</p>
                  <p className="font-bold text-lg mt-0.5">{value}</p>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Warnings */}
          {preview.warnings && preview.warnings.length > 0 && (
            <Card className="border-amber-300 bg-amber-50">
              <CardHeader className="py-2 px-4">
                <CardTitle className="text-sm flex items-center gap-2 text-amber-700">
                  <AlertTriangle className="h-4 w-4" /> {preview.warnings.length} advertencia(s)
                </CardTitle>
              </CardHeader>
              <CardContent className="px-4 pb-3">
                <ul className="space-y-1">
                  {preview.warnings.map((w, i) => (
                    <li key={i} className="text-xs text-amber-800">• {w}</li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}

          {/* Cost items preview */}
          {preview.costItems && preview.costItems.length > 0 && (
            <Card>
              <CardHeader className="py-2 px-4">
                <CardTitle className="text-sm">Estructura de costos ({preview.costItems.length} ítems)</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <div className="max-h-48 overflow-y-auto">
                  <table className="w-full text-xs">
                    <thead className="bg-muted/40 sticky top-0">
                      <tr>
                        <th className="text-left px-3 py-2">Categoría</th>
                        <th className="text-left px-3 py-2">Concepto</th>
                        <th className="text-right px-3 py-2">Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {preview.costItems.map((c, i) => (
                        <tr key={i} className="border-t">
                          <td className="px-3 py-1.5 text-muted-foreground">{c.category}</td>
                          <td className="px-3 py-1.5">{c.concept}</td>
                          <td className="px-3 py-1.5 text-right font-mono">{fmtCOP(c.totalValue)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Cash flow preview */}
          {preview.cashFlow && preview.cashFlow.length > 0 && (
            <Card>
              <CardHeader className="py-2 px-4">
                <CardTitle className="text-sm">Flujo de caja ({preview.cashFlow.length} meses)</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <div className="max-h-32 overflow-y-auto">
                  <table className="w-full text-xs">
                    <thead className="bg-muted/40 sticky top-0">
                      <tr>
                        <th className="text-left px-3 py-2">Período</th>
                        <th className="text-right px-3 py-2">Saldo final</th>
                      </tr>
                    </thead>
                    <tbody>
                      {preview.cashFlow.map((r, i) => (
                        <tr key={i} className="border-t">
                          <td className="px-3 py-1.5">{MONTHS_ES[(r.month - 1) % 12]} {r.year}</td>
                          <td className={`px-3 py-1.5 text-right font-mono ${Number(r.finalBalance) >= 0 ? 'text-teal-700' : 'text-red-600'}`}>
                            {fmtCOP(r.finalBalance)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Budget preview */}
          {preview.budget?.chapters && preview.budget.chapters.length > 0 && (
            <Card>
              <CardHeader className="py-2 px-4">
                <div className="flex justify-between items-center">
                  <CardTitle className="text-sm">
                    Presupuesto — {preview.budget.chapters.length} capítulos · {totalItems} ítems
                  </CardTitle>
                  <span className="text-sm font-bold text-teal-700">
                    Total directo: {fmtCOP(preview.budget.totalDirectCost)}
                  </span>
                </div>
              </CardHeader>
              <CardContent className="p-0">
                <div className="max-h-48 overflow-y-auto">
                  <table className="w-full text-xs">
                    <thead className="bg-muted/40 sticky top-0">
                      <tr>
                        <th className="text-left px-3 py-2">Capítulo</th>
                        <th className="text-right px-3 py-2">Subcapítulos</th>
                        <th className="text-right px-3 py-2">Ítems</th>
                      </tr>
                    </thead>
                    <tbody>
                      {preview.budget.chapters.map((ch, i) => (
                        <tr key={i} className="border-t">
                          <td className="px-3 py-1.5 font-medium">{ch.code} {ch.name}</td>
                          <td className="px-3 py-1.5 text-right">{ch.subchapters?.length ?? 0}</td>
                          <td className="px-3 py-1.5 text-right">
                            {ch.subchapters?.reduce((s, sc) => s + (sc.items?.length ?? 0), 0) ?? 0}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Commit button */}
          <div className="flex items-center justify-between pt-2 border-t">
            <p className="text-sm text-muted-foreground flex items-center gap-1.5">
              <CheckCircle2 className="h-4 w-4 text-green-600" />
              Preview generado de <strong>{fileName}</strong>. Al confirmar se sobrescribirán los datos actuales.
            </p>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => { setPreview(null); setFileName(''); }}>
                Cancelar
              </Button>
              <Button
                className="bg-teal-600 hover:bg-teal-700"
                onClick={() => commitMutation.mutate()}
                disabled={commitMutation.isPending}
              >
                <Upload className="h-4 w-4 mr-1.5" />
                {commitMutation.isPending ? 'Importando…' : 'Confirmar importación'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
