'use client';

import { Download, FileUp, Loader2 } from 'lucide-react';
import { useRef, useState } from 'react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { api } from '@/lib/api-client';
import { cn } from '@/lib/utils';

type ExportType = 'budget' | 'feasibility' | 'cashflow' | 'project';
type ImportType = 'budget' | 'feasibility-costs';

const EXPORT_OPTIONS: { type: ExportType; label: string; desc: string; format: string }[] = [
  { type: 'budget', label: 'Presupuesto', desc: 'Capitulos, subcapitulos e items', format: 'CSV' },
  { type: 'feasibility', label: 'Prefactibilidad', desc: 'Costos + flujo de caja', format: 'CSV' },
  { type: 'cashflow', label: 'Flujo de caja', desc: 'Ingresos y egresos mensuales', format: 'CSV' },
  {
    type: 'project',
    label: 'Proyecto completo',
    desc: 'Toda la data del proyecto',
    format: 'JSON',
  },
];

const IMPORT_OPTIONS: { type: ImportType; label: string; desc: string; accept: string }[] = [
  {
    type: 'budget',
    label: 'Presupuesto (CSV)',
    desc: 'Columnas: Capitulo, Subcapitulo, Descripcion, Unidad, Cantidad, Vr Unitario',
    accept: '.csv',
  },
  {
    type: 'feasibility-costs',
    label: 'Costos prefactibilidad (CSV)',
    desc: 'Columnas: Categoria, Concepto, Fideicomiso, Constructor, Total',
    accept: '.csv',
  },
];

export function DrivePanel({ projectId }: { projectId: string }) {
  const [exporting, setExporting] = useState<ExportType | null>(null);
  const [importing, setImporting] = useState<ImportType | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [importType, setImportType] = useState<ImportType>('budget');

  const handleExport = async (type: ExportType) => {
    setExporting(type);
    try {
      let res: Response;
      switch (type) {
        case 'budget':
          res = await api.driveExportBudgetCsv(projectId);
          break;
        case 'feasibility':
          res = await api.driveExportFeasibilityCsv(projectId);
          break;
        case 'cashflow':
          res = await api.driveExportCashflowCsv(projectId);
          break;
        case 'project':
          res = await api.driveExportProjectJson(projectId);
          break;
      }

      if (!res.ok) {
        toast.error('Error al exportar');
        return;
      }

      const blob = await res.blob();
      const disposition = res.headers.get('Content-Disposition');
      const filename =
        disposition?.match(/filename="?([^"]+)"?/)?.[1] ??
        `export.${type === 'project' ? 'json' : 'csv'}`;

      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);

      toast.success(`${EXPORT_OPTIONS.find((o) => o.type === type)?.label} exportado`);
    } catch {
      toast.error('Error al exportar');
    } finally {
      setExporting(null);
    }
  };

  const handleImportClick = (type: ImportType) => {
    setImportType(type);
    fileInputRef.current?.click();
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = ''; // reset for re-upload

    setImporting(importType);
    try {
      let result: { imported: number; skipped?: number; errors: string[] };
      if (importType === 'budget') {
        result = await api.driveImportBudget(projectId, file);
      } else {
        result = await api.driveImportFeasibilityCosts(projectId, file);
      }

      if (result.errors.length > 0) {
        toast.warning(`Importados: ${result.imported} | Errores: ${result.errors.length}`, {
          description: result.errors.slice(0, 3).join('; '),
          duration: 8000,
        });
      } else {
        toast.success(`${result.imported} registros importados correctamente`);
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error al importar');
    } finally {
      setImporting(null);
    }
  };

  return (
    <div className="space-y-4">
      {/* Export */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Download className="h-4 w-4 text-primary" />
            Exportar datos
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {EXPORT_OPTIONS.map((opt) => (
              <button
                key={opt.type}
                onClick={() => handleExport(opt.type)}
                disabled={exporting !== null}
                className={cn(
                  'flex items-start gap-3 rounded-lg border p-3 text-left transition-all',
                  'hover:border-primary/50 hover:bg-primary/5',
                  'disabled:opacity-50 disabled:cursor-not-allowed',
                )}
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold">{opt.label}</span>
                    <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] font-mono text-muted-foreground">
                      {opt.format}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">{opt.desc}</p>
                </div>
                {exporting === opt.type ? (
                  <Loader2 className="h-4 w-4 animate-spin text-primary shrink-0 mt-0.5" />
                ) : (
                  <Download className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
                )}
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Import */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <FileUp className="h-4 w-4 text-primary" />
            Importar datos desde CSV
          </CardTitle>
        </CardHeader>
        <CardContent>
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv"
            onChange={handleFileChange}
            className="hidden"
          />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {IMPORT_OPTIONS.map((opt) => (
              <button
                key={opt.type}
                onClick={() => handleImportClick(opt.type)}
                disabled={importing !== null}
                className={cn(
                  'flex items-start gap-3 rounded-lg border border-dashed p-3 text-left transition-all',
                  'hover:border-primary/50 hover:bg-primary/5',
                  'disabled:opacity-50 disabled:cursor-not-allowed',
                )}
              >
                <div className="flex-1 min-w-0">
                  <span className="text-sm font-semibold">{opt.label}</span>
                  <p className="text-xs text-muted-foreground mt-0.5">{opt.desc}</p>
                </div>
                {importing === opt.type ? (
                  <Loader2 className="h-4 w-4 animate-spin text-primary shrink-0 mt-0.5" />
                ) : (
                  <FileUp className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
                )}
              </button>
            ))}
          </div>
          <p className="text-xs text-muted-foreground mt-3">
            Formatos aceptados: CSV (separado por comas). Compatible con Google Sheets: Archivo
            &rarr; Descargar &rarr; CSV.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
