import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { FeasibilityCostCategory } from '@prisma/client';

import { PrismaService } from '../prisma/prisma.service';

/**
 * Google Drive integration for import/export.
 *
 * Supports two modes:
 * 1. OAuth flow — user connects their Google account, we read/write to their Drive
 * 2. Direct upload/download — user uploads files from their machine, we process them
 *
 * The direct mode works without any Google credentials configured.
 */
@Injectable()
export class DriveService {
  private readonly logger = new Logger(DriveService.name);
  private readonly clientId?: string;
  private readonly clientSecret?: string;
  private readonly redirectUri?: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {
    this.clientId = this.config.get<string>('GOOGLE_CLIENT_ID');
    this.clientSecret = this.config.get<string>('GOOGLE_CLIENT_SECRET');
    this.redirectUri = this.config.get<string>('GOOGLE_REDIRECT_URI');
  }

  get isOAuthConfigured(): boolean {
    return !!(this.clientId && this.clientSecret && this.redirectUri);
  }

  /** Generate OAuth URL for connecting Google Drive */
  getAuthUrl(): string {
    if (!this.isOAuthConfigured) {
      throw new BadRequestException(
        'Google Drive no configurado. Agregue GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET y GOOGLE_REDIRECT_URI en .env',
      );
    }
    const params = new URLSearchParams({
      client_id: this.clientId!,
      redirect_uri: this.redirectUri!,
      response_type: 'code',
      scope: [
        'https://www.googleapis.com/auth/drive.file',
        'https://www.googleapis.com/auth/spreadsheets.readonly',
      ].join(' '),
      access_type: 'offline',
      prompt: 'consent',
    });
    return `https://accounts.google.com/o/oauth2/v2/auth?${params}`;
  }

  /** Exchange authorization code for tokens */
  async handleCallback(code: string): Promise<{ accessToken: string; refreshToken?: string }> {
    if (!this.isOAuthConfigured) {
      throw new BadRequestException('Google Drive no configurado');
    }

    const res = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: this.clientId!,
        client_secret: this.clientSecret!,
        redirect_uri: this.redirectUri!,
        grant_type: 'authorization_code',
      }),
    });

    if (!res.ok) {
      const err = await res.text();
      this.logger.error(`Google OAuth error: ${err}`);
      throw new BadRequestException('Error al conectar Google Drive');
    }

    const data = (await res.json()) as { access_token: string; refresh_token?: string };
    return {
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
    };
  }

  // ── Export: Project data → CSV/JSON ──────────────────────────────────────────

  /** Export project budget as CSV */
  async exportBudgetCsv(projectId: string): Promise<string> {
    const chapters = await this.prisma.chapter.findMany({
      where: { projectId },
      include: {
        subchapters: {
          include: {
            items: { orderBy: { order: 'asc' } },
          },
          orderBy: { order: 'asc' },
        },
      },
      orderBy: { order: 'asc' },
    });

    const rows: string[] = [
      'Capitulo,Subcapitulo,Item,Codigo,Descripcion,Unidad,Cantidad,Vr Unitario,Vr Total',
    ];

    for (const ch of chapters) {
      for (const sub of ch.subchapters) {
        for (const item of sub.items) {
          const total = Number(item.quantity) * Number(item.unitCost);
          rows.push(
            [
              this.csvEscape(ch.name),
              this.csvEscape(sub.name),
              this.csvEscape(item.code ?? ''),
              this.csvEscape(item.code ?? ''),
              this.csvEscape(item.description),
              this.csvEscape(item.unit ?? ''),
              Number(item.quantity).toFixed(2),
              Number(item.unitCost).toFixed(0),
              total.toFixed(0),
            ].join(','),
          );
        }
      }
    }
    return rows.join('\n');
  }

  /** Export feasibility analysis as CSV */
  async exportFeasibilityCsv(projectId: string): Promise<string> {
    const analysis = await this.prisma.feasibilityAnalysis.findFirst({
      where: { projectId },
      include: {
        costItems: { orderBy: { order: 'asc' } },
        cashFlow: { orderBy: { month: 'asc' } },
      },
    });

    if (!analysis) return 'No hay análisis de prefactibilidad para este proyecto';

    const rows: string[] = [
      '--- ESTRUCTURA DE COSTOS ---',
      'Categoria,Concepto,Fideicomiso,Constructor,Total,% Ventas',
    ];

    for (const ci of analysis.costItems) {
      rows.push(
        [
          this.csvEscape(ci.category),
          this.csvEscape(ci.concept),
          Number(ci.fideicomisoValue ?? 0).toFixed(0),
          Number(ci.constructorValue ?? 0).toFixed(0),
          Number(ci.totalValue).toFixed(0),
          ci.pctOfSales ? `${Number(ci.pctOfSales).toFixed(2)}%` : '',
        ].join(','),
      );
    }

    rows.push(
      '',
      '--- FLUJO DE CAJA ---',
      'Anio,Mes,Saldo Inicial,Cuota Inicial,Saldo Final Venta,Recursos Propios,Credito Constructor,Costos Directos,Costos Indirectos,Costos Financieros,Saldo Final',
    );
    for (const cf of analysis.cashFlow) {
      rows.push(
        [
          cf.year,
          cf.month,
          Number(cf.initialBalance).toFixed(0),
          Number(cf.salesInitialPayment).toFixed(0),
          Number(cf.salesFinalPayment).toFixed(0),
          Number(cf.ownResources).toFixed(0),
          Number(cf.constructionCredit).toFixed(0),
          Number(cf.directCosts).toFixed(0),
          Number(cf.indirectCosts).toFixed(0),
          Number(cf.financialCosts).toFixed(0),
          Number(cf.finalBalance).toFixed(0),
        ].join(','),
      );
    }

    return rows.join('\n');
  }

  /** Export project cashflow as CSV */
  async exportCashflowCsv(projectId: string): Promise<string> {
    const analysis = await this.prisma.feasibilityAnalysis.findFirst({
      where: { projectId },
      include: { cashFlow: { orderBy: { month: 'asc' } } },
    });

    if (!analysis) return 'Anio,Mes,Saldo Inicial,Saldo Final';

    const rows: string[] = [
      'Anio,Mes,Saldo Inicial,Cuota Inicial,Saldo Final Venta,Recursos Propios,Credito Constructor,Costos Directos,Costos Indirectos,Costos Financieros,Saldo Final',
    ];
    for (const cf of analysis.cashFlow) {
      rows.push(
        [
          cf.year,
          cf.month,
          Number(cf.initialBalance).toFixed(0),
          Number(cf.salesInitialPayment).toFixed(0),
          Number(cf.salesFinalPayment).toFixed(0),
          Number(cf.ownResources).toFixed(0),
          Number(cf.constructionCredit).toFixed(0),
          Number(cf.directCosts).toFixed(0),
          Number(cf.indirectCosts).toFixed(0),
          Number(cf.financialCosts).toFixed(0),
          Number(cf.finalBalance).toFixed(0),
        ].join(','),
      );
    }
    return rows.join('\n');
  }

  /** Export full project summary as JSON */
  async exportProjectJson(projectId: string): Promise<Record<string, unknown>> {
    const project = await this.prisma.project.findUniqueOrThrow({
      where: { id: projectId },
      include: {
        chapters: {
          include: {
            subchapters: {
              include: { items: { orderBy: { order: 'asc' } } },
              orderBy: { order: 'asc' },
            },
          },
          orderBy: { order: 'asc' },
        },
      },
    });

    const feasibility = await this.prisma.feasibilityAnalysis.findFirst({
      where: { projectId },
      include: {
        costItems: { orderBy: { order: 'asc' } },
        cashFlow: { orderBy: { month: 'asc' } },
        scenarios: true,
      },
    });

    return {
      exportDate: new Date().toISOString(),
      version: '1.0',
      project: {
        name: project.name,
        code: project.code,
        city: project.city,
        status: project.status,
        startDate: project.startDate,
        expectedEndDate: project.expectedEndDate,
      },
      budget: {
        chapters: project.chapters.map((ch) => ({
          name: ch.name,
          code: ch.code,
          subchapters: ch.subchapters.map((sub) => ({
            name: sub.name,
            code: sub.code,
            items: sub.items.map((item) => ({
              code: item.code,
              description: item.description,
              unit: item.unit,
              quantity: Number(item.quantity),
              unitCost: Number(item.unitCost),
              totalCost: Number(item.quantity) * Number(item.unitCost),
            })),
          })),
        })),
      },
      feasibility: feasibility
        ? {
            totalUnits: feasibility.totalUnits,
            totalSales: feasibility.totalSales ? Number(feasibility.totalSales) : null,
            costItems: feasibility.costItems.map((ci) => ({
              category: ci.category,
              concept: ci.concept,
              fideicomiso: Number(ci.fideicomisoValue ?? 0),
              constructor: Number(ci.constructorValue ?? 0),
              total: Number(ci.totalValue),
            })),
            cashFlow: feasibility.cashFlow.map((cf) => ({
              year: cf.year,
              month: cf.month,
              initialBalance: Number(cf.initialBalance),
              salesInitialPayment: Number(cf.salesInitialPayment),
              salesFinalPayment: Number(cf.salesFinalPayment),
              ownResources: Number(cf.ownResources),
              constructionCredit: Number(cf.constructionCredit),
              directCosts: Number(cf.directCosts),
              indirectCosts: Number(cf.indirectCosts),
              financialCosts: Number(cf.financialCosts),
              finalBalance: Number(cf.finalBalance),
            })),
          }
        : null,
    };
  }

  // ── Import: CSV → Database ───────────────────────────────────────────────────

  /** Parse CSV string into rows */
  parseCsv(csv: string): string[][] {
    return csv
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => line.length > 0)
      .map((line) => {
        const cells: string[] = [];
        let current = '';
        let inQuotes = false;
        for (const char of line) {
          if (char === '"') {
            inQuotes = !inQuotes;
          } else if (char === ',' && !inQuotes) {
            cells.push(current.trim());
            current = '';
          } else {
            current += char;
          }
        }
        cells.push(current.trim());
        return cells;
      });
  }

  /** Import budget items from CSV */
  async importBudgetFromCsv(
    projectId: string,
    csvContent: string,
    organizationId: string,
  ): Promise<{ imported: number; skipped: number; errors: string[] }> {
    const rows = this.parseCsv(csvContent);
    if (rows.length < 2) {
      throw new BadRequestException('El CSV debe tener al menos un encabezado y una fila de datos');
    }

    // Skip header row
    const header = rows[0]!.map((h) => h.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, ''));
    const dataRows = rows.slice(1);

    // Auto-detect column indices
    const colMap = {
      chapter: header.findIndex((h) => h.includes('capitulo') || h.includes('chapter')),
      subchapter: header.findIndex((h) => h.includes('subcapitulo') || h.includes('subchapter')),
      description: header.findIndex(
        (h) => h.includes('descripcion') || h.includes('item') || h.includes('description'),
      ),
      unit: header.findIndex(
        (h) => h.includes('unidad') || h.includes('unit') || h.includes('und'),
      ),
      quantity: header.findIndex(
        (h) => h.includes('cantidad') || h.includes('quantity') || h.includes('cant'),
      ),
      unitCost: header.findIndex(
        (h) => h.includes('unitario') || h.includes('unit cost') || h.includes('vr unit'),
      ),
      code: header.findIndex((h) => h.includes('codigo') || h.includes('code')),
    };

    if (colMap.description === -1) {
      throw new BadRequestException('No se encontró columna de Descripcion/Item en el CSV');
    }

    let imported = 0;
    let skipped = 0;
    const errors: string[] = [];

    // Group by chapter → subchapter
    const chapterMap = new Map<
      string,
      Map<
        string,
        Array<{
          code?: string;
          description: string;
          unit: string;
          quantity: number;
          unitCost: number;
        }>
      >
    >();

    for (let i = 0; i < dataRows.length; i++) {
      const row = dataRows[i]!;
      try {
        const chapterName = colMap.chapter >= 0 ? (row[colMap.chapter] ?? 'General') : 'General';
        const subchapterName =
          colMap.subchapter >= 0 ? (row[colMap.subchapter] ?? 'General') : 'General';
        const description = row[colMap.description] ?? '';
        if (!description) {
          skipped++;
          continue;
        }

        const unit = colMap.unit >= 0 ? (row[colMap.unit] ?? 'GL') : 'GL';
        const quantity = colMap.quantity >= 0 ? this.parseNumber(row[colMap.quantity] ?? '0') : 1;
        const unitCost = colMap.unitCost >= 0 ? this.parseNumber(row[colMap.unitCost] ?? '0') : 0;
        const code = colMap.code >= 0 ? row[colMap.code] : undefined;

        if (!chapterMap.has(chapterName)) chapterMap.set(chapterName, new Map());
        const subs = chapterMap.get(chapterName)!;
        if (!subs.has(subchapterName)) subs.set(subchapterName, []);
        subs.get(subchapterName)!.push({ code, description, unit, quantity, unitCost });
      } catch (err) {
        errors.push(`Fila ${i + 2}: ${err instanceof Error ? err.message : 'Error desconocido'}`);
        skipped++;
      }
    }

    // Write to database in a transaction
    await this.prisma.$transaction(async (tx) => {
      let chapterOrder = 0;
      for (const [chapterName, subs] of chapterMap) {
        const chapter = await tx.chapter.create({
          data: {
            projectId,
            name: chapterName,
            code: `CAP-${++chapterOrder}`,
            order: chapterOrder,
          },
        });

        let subOrder = 0;
        for (const [subName, items] of subs) {
          const subchapter = await tx.subchapter.create({
            data: {
              chapterId: chapter.id,
              name: subName,
              code: `${chapter.code}.${++subOrder}`,
              order: subOrder,
            },
          });

          for (let j = 0; j < items.length; j++) {
            const item = items[j]!;
            await tx.budgetItem.create({
              data: {
                subchapterId: subchapter.id,
                code: item.code ?? `${subchapter.code}.${j + 1}`,
                description: item.description,
                unit: item.unit,
                quantity: item.quantity,
                unitCost: item.unitCost,
                totalCost: item.quantity * item.unitCost,
                order: j,
              },
            });
            imported++;
          }
        }
      }
    });

    return { imported, skipped, errors };
  }

  /** Import feasibility cost items from CSV */
  async importFeasibilityCostsCsv(
    projectId: string,
    csvContent: string,
  ): Promise<{ imported: number; errors: string[] }> {
    const rows = this.parseCsv(csvContent);
    if (rows.length < 2) {
      throw new BadRequestException('El CSV debe tener encabezado y datos');
    }

    const header = rows[0]!.map((h) => h.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, ''));
    const dataRows = rows.slice(1);

    const colMap = {
      category: header.findIndex((h) => h.includes('categoria') || h.includes('category')),
      concept: header.findIndex((h) => h.includes('concepto') || h.includes('concept')),
      fideicomiso: header.findIndex((h) => h.includes('fideicomiso') || h.includes('fid')),
      constructor: header.findIndex((h) => h.includes('constructor') || h.includes('con')),
      total: header.findIndex((h) => h.includes('total')),
    };

    if (colMap.concept === -1 && colMap.total === -1) {
      throw new BadRequestException('CSV debe tener al menos columnas Concepto y Total');
    }

    // Get or create analysis
    let analysis = await this.prisma.feasibilityAnalysis.findFirst({ where: { projectId } });
    if (!analysis) {
      analysis = await this.prisma.feasibilityAnalysis.create({
        data: { projectId, totalUnits: 0 },
      });
    }

    // Delete existing cost items and replace
    await this.prisma.feasibilityCostItem.deleteMany({
      where: { analysisId: analysis.id },
    });

    let imported = 0;
    const errors: string[] = [];

    for (let i = 0; i < dataRows.length; i++) {
      const row = dataRows[i]!;
      try {
        const rawCategory = colMap.category >= 0 ? (row[colMap.category] ?? 'DIRECTO') : 'DIRECTO';
        const concept = colMap.concept >= 0 ? (row[colMap.concept] ?? '') : '';
        if (!concept) continue;

        const fid = colMap.fideicomiso >= 0 ? this.parseNumber(row[colMap.fideicomiso] ?? '0') : 0;
        const con = colMap.constructor >= 0 ? this.parseNumber(row[colMap.constructor] ?? '0') : 0;
        const total = colMap.total >= 0 ? this.parseNumber(row[colMap.total] ?? '0') : fid + con;

        const validCategories = Object.values(FeasibilityCostCategory);
        const categoryUpper = rawCategory.toUpperCase() as FeasibilityCostCategory;
        const category = validCategories.includes(categoryUpper)
          ? categoryUpper
          : FeasibilityCostCategory.DIRECTO;

        await this.prisma.feasibilityCostItem.create({
          data: {
            analysisId: analysis.id,
            category,
            concept,
            fideicomisoValue: fid > 0 ? fid.toString() : null,
            constructorValue: con > 0 ? con.toString() : null,
            totalValue: total.toString(),
            order: i,
          },
        });
        imported++;
      } catch (err) {
        errors.push(`Fila ${i + 2}: ${err instanceof Error ? err.message : 'Error'}`);
      }
    }

    return { imported, errors };
  }

  // ── Helpers ──────────────────────────────────────────────────────────────────

  private csvEscape(val: string): string {
    if (val.includes(',') || val.includes('"') || val.includes('\n')) {
      return `"${val.replace(/"/g, '""')}"`;
    }
    return val;
  }

  private parseNumber(val: string): number {
    // Handle COP format: 1.234.567,89 or 1,234,567.89
    const cleaned = val.replace(/[$\s]/g, '');
    // If has both . and , — detect COP vs USD format
    if (cleaned.includes('.') && cleaned.includes(',')) {
      const lastDot = cleaned.lastIndexOf('.');
      const lastComma = cleaned.lastIndexOf(',');
      if (lastComma > lastDot) {
        // COP: 1.234.567,89
        return Number(cleaned.replace(/\./g, '').replace(',', '.'));
      } else {
        // USD: 1,234,567.89
        return Number(cleaned.replace(/,/g, ''));
      }
    }
    // If only commas, could be thousands separator or decimal
    if (cleaned.includes(',') && !cleaned.includes('.')) {
      const parts = cleaned.split(',');
      if (parts.length === 2 && parts[1]!.length <= 2) {
        // Decimal: 1234,56
        return Number(cleaned.replace(',', '.'));
      }
      // Thousands: 1,234,567
      return Number(cleaned.replace(/,/g, ''));
    }
    return Number(cleaned) || 0;
  }
}
