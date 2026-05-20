import * as XLSX from 'xlsx';
import type {
  SantaIsabelImportPreview,
  FeasibilityCostItemInput,
  FeasibilityCashFlowInput,
  FeasibilityCostCategory,
} from '@santaisabel/shared';

type Row = (string | number | boolean | Date | null)[];
type Matrix = Row[];

// ─── Utilities ───────────────────────────────────────────────────────────────

/**
 * Normalize a cell value for text matching:
 * - lowercase
 * - NFD decomposition + strip combining diacritics (proper Unicode range)
 * - superscript ² → 2, ³ → 3
 * - collapse multiple spaces
 */
const normalize = (v: unknown): string =>
  String(v ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')   // combining diacritics (é→e, etc.)
    .replace(/²/g, '2')           // ² → 2  (critical: M² cells)
    .replace(/³/g, '3')           // ³ → 3
    .replace(/\s+/g, ' ')
    .trim();

const isNumeric = (v: unknown): boolean => {
  if (v === null || v === undefined || v === '') return false;
  if (typeof v === 'number') return Number.isFinite(v);
  const n = Number(String(v).replace(/[,\s$]/g, ''));
  return Number.isFinite(n);
};

const toNumber = (v: unknown): number | null => {
  if (v === null || v === undefined || v === '') return null;
  if (typeof v === 'number') return Number.isFinite(v) ? v : null;
  const n = Number(String(v).replace(/[,\s$]/g, ''));
  return Number.isFinite(n) ? n : null;
};

const toStr = (v: number | null): string | null =>
  v === null ? null : v.toFixed(2);

const sheetToMatrix = (sheet: XLSX.WorkSheet): Matrix =>
  XLSX.utils.sheet_to_json(sheet, { header: 1, defval: null, raw: true }) as Matrix;

/** Find index of first cell in row matching predicate */
const findInRow = (row: Row, predicate: (cell: string) => boolean): number =>
  row.findIndex((c) => c !== null && c !== undefined && predicate(normalize(c)));

/** Return first numeric value at or after column `from` in a row */
const firstNumericFrom = (row: Row, from: number): { value: number; col: number } | null => {
  for (let i = from; i < row.length; i++) {
    if (isNumeric(row[i])) {
      const n = toNumber(row[i]);
      if (n !== null) return { value: n, col: i };
    }
  }
  return null;
};

/** Collect all numeric values in a row after column `from` */
const numsAfter = (row: Row, from: number): number[] => {
  const out: number[] = [];
  for (let i = from; i < row.length; i++) {
    const n = toNumber(row[i]);
    if (n !== null) out.push(n);
  }
  return out;
};

// ─── Metadata extraction (top section of CREDICORP sheet) ────────────────────
/**
 * The CREDICORP sheet has a metadata block in the first ~12 rows:
 *
 *   Row 4:  Promotor | <name>  |  Cuota Inicial | 25%  |  Valor Ventas | 20,522,570
 *   Row 6:  Proyecto | <name>  |  M² Construid  | 3,632.85  |  Crédito Constr | 0
 *   Row 8:  Fecha    | <date>  |  M² Vendible   | 5,253.72  |  Pto Equilibrio | ...
 *   Row 10: Ciudad   | Pereira |  Vlr M² Vendib | $3,906,293|  Sist.Construc  | ...
 *   Row 12: # Total Unidades | 124 | Estrato | 3 | Parqueaderos | Cubierto
 *
 * Strategy: scan ALL cells; when a label cell matches, look rightward for the value.
 */
function parseMetadata(
  matrix: Matrix,
  warnings: string[],
): SantaIsabelImportPreview['analysis'] {
  const analysis: SantaIsabelImportPreview['analysis'] = { discountRate: '12' };

  type FieldDef = {
    /** Regex tested against normalized cell text */
    match: RegExp;
    assign: (val: string | number) => void;
    /** If true, allow value from a non-adjacent cell (value may be 2-3 columns away) */
    wide?: boolean;
  };

  const fields: FieldDef[] = [
    {
      match: /^promotor$/,
      assign: (v) => { analysis.promoter = String(v).trim().slice(0, 200); },
    },
    {
      // "# Total Unidades", "Total Unidades", "Numero de Unidades"
      match: /total\s+unidades|numero\s+(de\s+)?unidades/,
      assign: (v) => { const n = toNumber(v); if (n !== null) analysis.totalUnits = Math.round(n); },
    },
    {
      // "# M² Vendible", "M2 Vendible", "Area Vendible" — ² already normalized to 2
      match: /m2\s*vendible|area\s+vendible/,
      assign: (v) => { const n = toNumber(v); if (n !== null) analysis.saleableAreaM2 = n.toString(); },
    },
    {
      // "# M² Construid", "M2 Construido"
      match: /m2\s*construid|area\s+construid/,
      assign: (v) => { const n = toNumber(v); if (n !== null) analysis.builtAreaM2 = n.toString(); },
    },
    {
      // "Vlr M² Vendib", "Valor M2", "Precio M2"
      match: /vlr\s+m2|valor\s+m2|precio\s+m2|vr\s*\.?\s*m2/,
      assign: (v) => { const n = toNumber(v); if (n !== null) analysis.pricePerM2 = n.toString(); },
    },
    {
      // "Valor Ventas", "Valor Total Ventas", "Ingresos Totales", "Total Ventas"
      match: /valor\s+ventas|valor\s+total\s+ventas|ingresos\s+totales|total\s+ventas/,
      assign: (v) => { const n = toNumber(v); if (n !== null) analysis.totalSales = n.toString(); },
    },
    {
      // "Cuota Inicial" — value may be 0.25 (decimal) or 25 (percent)
      match: /cuota\s+inicial/,
      assign: (v) => {
        const n = toNumber(v);
        if (n !== null) analysis.initialPaymentPct = (n > 0 && n <= 1 ? n * 100 : n).toString();
      },
    },
    {
      // "Pto Equilibrio", "Punto de Equilibrio", "Pto. Equilibrio"
      match: /pto\.?\s+equilibrio|punto\s+(de\s+)?equilibrio/,
      assign: (v) => { const n = toNumber(v); if (n !== null) analysis.breakEvenUnits = Math.round(n); },
    },
    {
      match: /^estrato$/,
      assign: (v) => { const n = toNumber(v); if (n !== null && n >= 1 && n <= 6) analysis.stratum = Math.round(n); },
    },
    {
      // "Sistema Constructivo", "Sist. Constructivo"
      match: /sistema\s*(de\s*)?construc|sist\.?\s*construc/,
      assign: (v) => { analysis.constructionSystem = String(v).trim().slice(0, 200); },
    },
  ];

  const matched = new Set<number>(); // indices of already-matched fields

  for (const row of matrix) {
    if (!row) continue;
    for (let colIdx = 0; colIdx < row.length; colIdx++) {
      const cell = row[colIdx];
      if (cell === null || cell === undefined) continue;
      const norm = normalize(cell);
      if (!norm || norm.length < 2) continue;

      for (let fi = 0; fi < fields.length; fi++) {
        if (matched.has(fi)) continue;
        const f = fields[fi]!;
        if (!f.match.test(norm)) continue;

        // Look for the value in the same row, starting from next column
        for (let j = colIdx + 1; j < Math.min(colIdx + 5, row.length); j++) {
          const v = row[j];
          if (v !== null && v !== undefined && v !== '') {
            f.assign(typeof v === 'number' ? v : String(v));
            matched.add(fi);
            break;
          }
        }
      }
    }
  }

  if (!analysis.totalSales) {
    warnings.push('No se detectó "Valor Ventas" — verifique que la hoja tenga ese encabezado');
  }
  if (!analysis.totalUnits) {
    warnings.push('No se detectó "# Total Unidades"');
  }

  return analysis;
}

// ─── Cost table (ESTRUCTURA DE COSTOS) ───────────────────────────────────────
/**
 * CREDICORP cost table layout (rows ~14–39):
 *
 *   Row ~14: "Aportes a través de" (header)
 *   Row ~15: "" | "Fideicomiso" | "Constructor" | (empty/TOTAL) | "% SOBRE VENTAS"
 *   Row ~16: "LOTE"              | 1,949,644    | 0            | 1,949,644     | 9.50%
 *   Row ~17: "URBANISMO"         | 1,605,462    | 9,784        | 1,615,245     | 7.87%
 *   ...
 *
 * Strategy:
 *  1. Find the row with "ESTRUCTURA DE COSTOS" or detect fideicomiso/constructor headers
 *  2. Identify columns: labelCol, fideicomisoCol, constructorCol, totalCol, pctCol
 *  3. Scan subsequent rows for the 6 main cost categories
 */
function parseCostTable(
  matrix: Matrix,
  warnings: string[],
): FeasibilityCostItemInput[] {
  const costItems: FeasibilityCostItemInput[] = [];

  // Detect the header row (contains "fideicomiso" or "constructor")
  let headerRowIdx = -1;
  let fideicomisoCol = -1;
  let constructorCol = -1;
  let totalCol = -1;
  let pctCol = -1;
  let labelCol = 1; // default: col B (index 1)

  for (let r = 0; r < Math.min(matrix.length, 25); r++) {
    const row = matrix[r];
    if (!row) continue;
    const norms = row.map((c) => normalize(c));

    const fIdx = norms.findIndex((c) => /fideicomiso|fideic/.test(c));
    const cIdx = norms.findIndex((c) => /^constructor$|constructora/.test(c));
    const tIdx = norms.findIndex((c) => /^total$/.test(c));
    const pIdx = norms.findIndex((c) => /sobre\s+ventas|%\s*ventas/.test(c));

    if (fIdx !== -1 && cIdx !== -1) {
      headerRowIdx = r;
      fideicomisoCol = fIdx;
      constructorCol = cIdx;
      if (tIdx !== -1) totalCol = tIdx;
      if (pIdx !== -1) pctCol = pIdx;
      // label column is typically one before fideicomiso, or col 1
      labelCol = Math.max(0, fIdx - 1);
      break;
    }
  }

  // If header not found, use default CREDICORP column layout: B=label, C=fideicomiso, D=constructor, E=total, F=pct
  if (headerRowIdx === -1) {
    warnings.push('No se encontró fila de encabezado Fideicomiso/Constructor — usando columnas por defecto (B,C,D,E,F)');
    labelCol = 1;
    fideicomisoCol = 2;
    constructorCol = 3;
    totalCol = 4;
    pctCol = 5;
    // Find where the cost section starts by looking for "estructura de costos" or "lote"
    for (let r = 0; r < matrix.length; r++) {
      const row = matrix[r];
      if (!row) continue;
      if (row.some((c) => /estructura\s+de\s+costos/i.test(normalize(c)))) {
        headerRowIdx = r;
        break;
      }
    }
    if (headerRowIdx === -1) headerRowIdx = 12; // fallback: start from row 12
  }

  // Category matchers (tested against normalized label cell)
  const categoryMatchers: { regex: RegExp; cat: FeasibilityCostCategory; concept: string }[] = [
    { regex: /\blote\b/,                                  cat: 'LOTE',       concept: 'Lote' },
    { regex: /\burbanismo\b/,                             cat: 'URBANISMO',  concept: 'Urbanismo' },
    { regex: /costos?\s*directos?|edificaci/,             cat: 'DIRECTO',    concept: 'Costos directos (edificación)' },
    { regex: /costos?\s*indirectos?/,                     cat: 'INDIRECTO',  concept: 'Costos indirectos' },
    { regex: /costos?\s*financieros?/,                    cat: 'FINANCIERO', concept: 'Costos financieros' },
    { regex: /costos?\s*(de\s+)?ventas?/,                 cat: 'VENTAS',     concept: 'Costos de ventas' },
  ];

  const seen = new Set<FeasibilityCostCategory>();
  let order = 0;

  for (let r = headerRowIdx + 1; r < matrix.length; r++) {
    const row = matrix[r];
    if (!row) continue;

    // Get label from labelCol; also check adjacent cols in case of merged cells
    let labelCell: string | null = null;
    for (let lc = Math.max(0, labelCol - 1); lc <= Math.min(labelCol + 1, row.length - 1); lc++) {
      const v = row[lc];
      if (v !== null && v !== undefined && v !== '') {
        const s = normalize(v);
        if (s.length > 0) { labelCell = s; break; }
      }
    }
    if (!labelCell) continue;

    const matcher = categoryMatchers.find((m) => m.regex.test(labelCell!));
    if (!matcher) continue;
    if (seen.has(matcher.cat)) continue;

    // Extract values from specific columns
    const readCol = (idx: number): number | null => {
      if (idx < 0 || idx >= row.length) return null;
      return toNumber(row[idx]);
    };

    let fideicomiso = readCol(fideicomisoCol);
    let constructorVal = readCol(constructorCol);
    let total = readCol(totalCol);
    let pct = readCol(pctCol);

    // Fallback: if specific cols empty, collect all numerics after label
    if (total === null && fideicomiso === null) {
      const nums = numsAfter(row, labelCol + 1);
      if (nums.length === 0) continue;
      if (nums.length === 1) {
        total = nums[0]!;
      } else if (nums.length === 2) {
        total = nums[0]!;
        pct = nums[1]!;
      } else if (nums.length === 3) {
        fideicomiso = nums[0]!;
        constructorVal = nums[1]!;
        total = nums[2]!;
      } else {
        fideicomiso = nums[0]!;
        constructorVal = nums[1]!;
        total = nums[2]!;
        pct = nums[3]!;
      }
    }

    // If still no total, derive from fideicomiso + constructor
    if (total === null) {
      if (fideicomiso !== null || constructorVal !== null) {
        total = (fideicomiso ?? 0) + (constructorVal ?? 0);
      } else {
        continue;
      }
    }

    // Normalize pct: Excel stores 9.5% as 0.095 when cell is formatted as %
    if (pct !== null) {
      pct = pct > 0 && pct <= 1 ? pct * 100 : pct;
    }

    costItems.push({
      category: matcher.cat,
      concept: matcher.concept,
      fideicomisoValue: toStr(fideicomiso),
      constructorValue: toStr(constructorVal),
      totalValue: total.toFixed(2),
      pctOfSales: toStr(pct),
      order: order++,
    });
    seen.add(matcher.cat);
  }

  if (costItems.length === 0) {
    warnings.push(
      'No se detectó la tabla ESTRUCTURA DE COSTOS en la hoja prefactibilidad CREDICORP. ' +
      'Verifique que la hoja tenga las filas LOTE, URBANISMO, COSTOS DIRECTOS, etc.',
    );
  } else if (costItems.length < 4) {
    warnings.push(
      `Solo se detectaron ${costItems.length} filas de costos (se esperan 6). ` +
      'Puede haber texto diferente en algunas filas.',
    );
  }

  return costItems;
}

// ─── Cash flow ────────────────────────────────────────────────────────────────
const MONTH_NAMES: Record<string, number> = {
  ene: 1, enero: 1, jan: 1, january: 1,
  feb: 2, febrero: 2, february: 2,
  mar: 3, marzo: 3, march: 3,
  abr: 4, abril: 4, apr: 4, april: 4,
  may: 5, mayo: 5,
  jun: 6, junio: 6, june: 6,
  jul: 7, julio: 7, july: 7,
  ago: 8, agosto: 8, aug: 8, august: 8,
  sep: 9, sept: 9, septiembre: 9, september: 9,
  oct: 10, octubre: 10, october: 10,
  nov: 11, noviembre: 11, november: 11,
  dic: 12, diciembre: 12, dec: 12, december: 12,
};

function parseMonthHeader(cell: unknown): { year: number; month: number } | null {
  if (cell === null || cell === undefined) return null;
  if (cell instanceof Date) {
    return { year: cell.getFullYear(), month: cell.getMonth() + 1 };
  }
  const s = normalize(cell);
  if (!s) return null;

  // "ene-26", "ene 2026", "enero 2026"
  const m1 = s.match(/^([a-z]+)[\s\-\/\.]+(\d{2,4})$/);
  if (m1 && m1[1] !== undefined && m1[2] !== undefined && MONTH_NAMES[m1[1]] !== undefined) {
    const month = MONTH_NAMES[m1[1]] as number;
    let year = Number(m1[2]);
    if (year < 100) year += 2000;
    return { year, month };
  }

  // "01/26", "01/2026"
  const m2 = s.match(/^(\d{1,2})[\-\/](\d{2,4})$/);
  if (m2 && m2[1] !== undefined && m2[2] !== undefined) {
    const month = Number(m2[1]);
    let year = Number(m2[2]);
    if (year < 100) year += 2000;
    if (month >= 1 && month <= 12) return { year, month };
  }

  // "2026-01"
  const m3 = s.match(/^(\d{4})[\-\/](\d{1,2})$/);
  if (m3 && m3[1] !== undefined && m3[2] !== undefined) {
    const year = Number(m3[1]);
    const month = Number(m3[2]);
    if (month >= 1 && month <= 12) return { year, month };
  }

  return null;
}

function parseCashFlow(matrix: Matrix, warnings: string[]): FeasibilityCashFlowInput[] {
  // Find header row: row with ≥ 3 parseable month cells
  let headerRowIdx = -1;
  let monthCols: { col: number; year: number; month: number }[] = [];

  // Strategy 1: single row with full "ene-26" style headers
  for (let r = 0; r < matrix.length; r++) {
    const row = matrix[r];
    if (!row) continue;
    const cols: { col: number; year: number; month: number }[] = [];
    for (let c = 0; c < row.length; c++) {
      const parsed = parseMonthHeader(row[c]);
      if (parsed) cols.push({ col: c, ...parsed });
    }
    if (cols.length >= 3) {
      headerRowIdx = r;
      monthCols = cols;
      break;
    }
  }

  // Strategy 2: two-row header — one row has years (e.g. 2026, 2027) and the next has month names
  // CREDICORP format: Row N has year numbers at span-start positions, Row N+1 has month name strings
  if (headerRowIdx === -1) {
    for (let r = 0; r < matrix.length - 1; r++) {
      const yearRow = matrix[r];
      const monthRow = matrix[r + 1];
      if (!yearRow || !monthRow) continue;

      // Check if yearRow has year numbers (2020-2040) and monthRow has month name strings
      const yearPositions: { col: number; year: number }[] = [];
      for (let c = 0; c < yearRow.length; c++) {
        const v = yearRow[c];
        if (typeof v === 'number' && v >= 2020 && v <= 2040) {
          yearPositions.push({ col: c, year: v });
        }
      }

      const monthPositions: { col: number; month: number }[] = [];
      for (let c = 0; c < monthRow.length; c++) {
        const norm = normalize(monthRow[c]);
        if (norm && MONTH_NAMES[norm] !== undefined) {
          monthPositions.push({ col: c, month: MONTH_NAMES[norm] as number });
        }
        // Also check short forms like "ene", "feb" embedded in longer strings
        const shortMatch = norm.match(/^(ene|feb|mar|abr|may|jun|jul|ago|sep|sept|oct|nov|dic)/);
        if (shortMatch && shortMatch[1] && MONTH_NAMES[shortMatch[1]] !== undefined) {
          if (!monthPositions.find((m) => m.col === c)) {
            monthPositions.push({ col: c, month: MONTH_NAMES[shortMatch[1]!] as number });
          }
        }
      }

      if (yearPositions.length >= 1 && monthPositions.length >= 3) {
        // Assign year to each month column: each month belongs to the most-recent year at or before its column
        const cols: { col: number; year: number; month: number }[] = [];
        for (const mp of monthPositions) {
          // Find the last year position whose col ≤ mp.col
          let assignedYear = yearPositions[0]?.year ?? new Date().getFullYear();
          for (const yp of yearPositions) {
            if (yp.col <= mp.col) assignedYear = yp.year;
          }
          cols.push({ col: mp.col, year: assignedYear, month: mp.month });
        }
        if (cols.length >= 3) {
          headerRowIdx = r + 1; // data starts after month row
          monthCols = cols;
          break;
        }
      }
    }
  }

  if (headerRowIdx === -1) {
    warnings.push('No se pudo parsear el flujo de caja — no se encontró fila de encabezado de meses');
    return [];
  }

  const conceptMap: { regex: RegExp; field: keyof Omit<FeasibilityCashFlowInput, 'year' | 'month'> }[] = [
    { regex: /caja\s+inicial|saldo\s+inicial/,         field: 'initialBalance' },
    { regex: /cuota\s+inicial/,                         field: 'salesInitialPayment' },
    { regex: /saldo\s+venta|saldo\s+escritur|venta\s+final|saldo\s+de\s+venta/, field: 'salesFinalPayment' },
    { regex: /recursos?\s+propios/,                     field: 'ownResources' },
    { regex: /credito\s+construcc|credito\s+const/,     field: 'constructionCredit' },
    { regex: /costos?\s*directos?/,                     field: 'directCosts' },
    { regex: /costos?\s*indirectos?/,                   field: 'indirectCosts' },
    { regex: /costos?\s*financieros?/,                  field: 'financialCosts' },
    { regex: /caja\s+final|saldo\s+final/,              field: 'finalBalance' },
  ];

  const byMonth = new Map<string, FeasibilityCashFlowInput>();
  for (const mc of monthCols) {
    byMonth.set(`${mc.year}-${mc.month}`, {
      year: mc.year,
      month: mc.month,
      initialBalance: '0', salesInitialPayment: '0', salesFinalPayment: '0',
      ownResources: '0', constructionCredit: '0',
      directCosts: '0', indirectCosts: '0', financialCosts: '0',
      finalBalance: '0',
    });
  }

  for (let r = headerRowIdx + 1; r < matrix.length; r++) {
    const row = matrix[r];
    if (!row) continue;

    // Find the label: first textual (non-numeric) non-empty cell
    let label = '';
    for (let c = 0; c < row.length; c++) {
      const cell = row[c];
      if (cell !== null && cell !== undefined && !isNumeric(cell) && String(cell).trim()) {
        label = normalize(cell);
        break;
      }
    }
    if (!label) continue;

    const mapping = conceptMap.find((m) => m.regex.test(label));
    if (!mapping) continue;

    for (const mc of monthCols) {
      const val = toNumber(row[mc.col]);
      if (val !== null) {
        const obj = byMonth.get(`${mc.year}-${mc.month}`);
        if (obj) (obj[mapping.field] as string) = Math.abs(val).toFixed(2);
      }
    }
  }

  const result = Array.from(byMonth.values()).sort((a, b) =>
    a.year !== b.year ? a.year - b.year : a.month - b.month,
  );

  if (result.length === 0) {
    warnings.push('El flujo de caja no produjo filas — verifique el formato de la hoja FLUJO DE CAJA');
  }

  return result;
}

// ─── Budget (Pres. Edificio) ──────────────────────────────────────────────────
type BudgetItem = {
  code: string;
  description: string;
  unit: string;
  quantity: string;
  unitCost: string;
  costType?: 'MANO_OBRA' | 'MATERIAL' | 'EQUIPO' | 'FUNGIBLE' | 'OTRO';
};
type Subchapter = { code: string; name: string; items: BudgetItem[] };
type Chapter = { code: string; name: string; subchapters: Subchapter[] };

function inferCostType(chapterName: string): BudgetItem['costType'] {
  const n = normalize(chapterName);
  if (/mano\s+de\s+obra|administraci|honorari/.test(n)) return 'MANO_OBRA';
  if (/equipo|maquinaria/.test(n)) return 'EQUIPO';
  return 'MATERIAL';
}

function parseBudget(matrix: Matrix, warnings: string[]): { chapters: Chapter[]; totalDirectCost: string } {
  const chapters: Chapter[] = [];
  let currentChapter: Chapter | null = null;
  let currentSub: Subchapter | null = null;
  let total = 0;

  // Detect column positions from header row
  let codeCol = 0, descCol = 1, unitCol = 2, qtyCol = 3, ucCol = 4, totalCol = 5;
  for (let r = 0; r < Math.min(matrix.length, 30); r++) {
    const row = matrix[r];
    if (!row) continue;
    const norm = row.map((c) => normalize(c));
    const dIdx = norm.findIndex((c) => /descripci|item|actividad/.test(c));
    // Fix: accept "UNID." → "unid." in addition to existing patterns
    const uIdx = norm.findIndex((c) => /^und$|^unidad$|^un\.?$|^unds?$|^unid\.?$/.test(c));
    const qIdx = norm.findIndex((c) => /^cantidad$|^cant\.?$/.test(c));
    // Fix: accept "VR. UNIT." → "vr. unit." (remove requirement for "ar" suffix)
    const ucIdx = norm.findIndex((c) => /(valor|precio|vr\.?)\s*unit/.test(c));
    const tIdx = norm.findIndex((c) => /(valor|vr\.?)\s*(total|parcial)/.test(c));
    if (dIdx !== -1 && qIdx !== -1 && ucIdx !== -1) {
      descCol = dIdx;
      // Fix: code column is typically just before description
      codeCol = Math.max(0, dIdx - 1);
      if (uIdx !== -1) unitCol = uIdx;
      qtyCol = qIdx;
      ucCol = ucIdx;
      if (tIdx !== -1) totalCol = tIdx;
      break;
    }
  }

  for (const row of matrix) {
    if (!row || row.every((c) => c === null || c === undefined || String(c).trim() === '')) continue;

    // Fix: read code from detected column (not hardcoded col 0)
    const codeRaw = row[codeCol];
    const code = codeRaw === null || codeRaw === undefined ? '' : String(codeRaw).trim();
    const descRaw = row[descCol];
    const desc = descRaw === null || descRaw === undefined ? '' : String(descRaw).trim();

    const qty = toNumber(row[qtyCol]);
    const uc = toNumber(row[ucCol]);
    const rowTotal = toNumber(row[totalCol]);

    // Item row: has qty AND unit cost
    if (qty !== null && uc !== null && desc) {
      if (!currentChapter) {
        currentChapter = { code: 'CAP-AUTO', name: 'Sin capítulo', subchapters: [] };
        chapters.push(currentChapter);
      }
      if (!currentSub) {
        currentSub = { code: `${currentChapter.code}.1`, name: 'General', items: [] };
        currentChapter.subchapters.push(currentSub);
      }
      const unitVal = row[unitCol];
      const unit = unitVal === null || unitVal === undefined ? 'UND' : String(unitVal).trim() || 'UND';
      const itemCode = code || `${currentSub.code}.${currentSub.items.length + 1}`;
      currentSub.items.push({
        code: itemCode.slice(0, 50),
        description: desc.slice(0, 500),
        unit: unit.slice(0, 20),
        quantity: qty.toString(),
        unitCost: uc.toString(),
        costType: inferCostType(currentChapter.name),
      });
      if (rowTotal !== null) total += rowTotal;
      else total += qty * uc;
      continue;
    }

    // Chapter / subchapter: row that didn't qualify as an item
    // (qty===null || uc===null guaranteed here since item block already `continue`d)
    if (desc) {
      // Fix: use proper Roman numeral detection (I, II, III, IV, V, VI…)
      // Regex validates the MDCLXVI character set; a valid Roman numeral won't contain B/A/D/etc.
      const romanRegex = /^M{0,4}(CM|CD|D?C{0,3})(XC|XL|L?X{0,3})(IX|IV|V?I{0,3})$/i;
      const isRoman = code.length > 0 && romanRegex.test(code);

      // Fix: letter (optionally followed by digits) → subchapter (A1, B, B7, D6)
      // Must NOT be a pure Roman numeral (e.g., "I" would match /^[A-Z]$/ but is Roman)
      const isAlphaNum = /^[A-Z][0-9]*$/i.test(code) && code.length > 0 && !isRoman;

      // Legacy dotted numeric subchapter code (1.1, 2.3)
      const isSubcode = /^\d+\.\d+/.test(code);

      // Description starts with "capítulo" keyword
      const isChapterDesc = /^cap(\.|itulo)?\s*[ivx\d]+/i.test(desc);

      if (isRoman || isChapterDesc) {
        // Skip "TOTAL ..." rows that reuse a chapter code (they are subtotal summary rows)
        const isSummaryRow = /^total\b|^incidencia\b|^gran\s+total/i.test(desc);
        if (isSummaryRow && chapters.some((c) => c.code === (code || ''))) {
          continue; // skip subtotal row — don't create duplicate chapter
        }
        currentChapter = {
          code: (code || `CAP-${chapters.length + 1}`).slice(0, 20),
          name: desc.slice(0, 200),
          subchapters: [],
        };
        chapters.push(currentChapter);
        currentSub = null;
      } else if ((isAlphaNum || isSubcode) && currentChapter) {
        currentSub = { code: code.slice(0, 20), name: desc.slice(0, 200), items: [] };
        currentChapter.subchapters.push(currentSub);
      } else if (code && currentChapter) {
        // Any other coded row (e.g. numeric "1","2") under a chapter → subchapter
        currentSub = { code: code.slice(0, 20), name: desc.slice(0, 200), items: [] };
        currentChapter.subchapters.push(currentSub);
      }
    }
  }

  if (chapters.length === 0) {
    warnings.push('No se detectaron capítulos en la hoja de presupuesto — verifique el formato');
  }

  return { chapters, totalDirectCost: total.toFixed(2) };
}

// ─── Costos Administración ────────────────────────────────────────────────────
function parseAdministration(matrix: Matrix): Chapter | null {
  const items: BudgetItem[] = [];
  let order = 0;
  for (const row of matrix) {
    if (!row) continue;
    const labelCell = row.find(
      (c) => c !== null && c !== undefined && !isNumeric(c) && String(c).trim().length > 2,
    );
    if (!labelCell) continue;
    const label = String(labelCell).trim();
    if (/cargo|rol|concepto|honorari|admin/i.test(normalize(label))) continue; // skip headers
    const nums: number[] = [];
    for (const c of row) {
      const n = toNumber(c);
      if (n !== null && n > 0) nums.push(n);
    }
    if (nums.length < 2) continue;
    const monthly = nums[0] ?? 0;
    const months = nums[1] ?? 1;
    if (monthly <= 0 || months <= 0) continue;
    order++;
    items.push({
      code: `ADM-${order}`,
      description: label.slice(0, 500),
      unit: 'MES',
      quantity: months.toString(),
      unitCost: monthly.toString(),
      costType: 'MANO_OBRA',
    });
  }
  if (items.length === 0) return null;
  return {
    code: 'CAP-ADMIN',
    name: 'ADMINISTRACIÓN',
    subchapters: [{ code: 'ADMIN.1', name: 'Honorarios', items }],
  };
}

// ─── Main entry ───────────────────────────────────────────────────────────────
export function parseSantaIsabelXls(buffer: Buffer): SantaIsabelImportPreview {
  const warnings: string[] = [];

  let wb: XLSX.WorkBook;
  try {
    wb = XLSX.read(buffer, { type: 'buffer', cellDates: true, cellNF: true });
  } catch (err) {
    return {
      analysis: { discountRate: '12' },
      costItems: [],
      cashFlow: [],
      budget: { chapters: [], totalDirectCost: '0' },
      warnings: [`Error al leer el archivo: ${String(err)}. Asegúrese de que sea un archivo .xls o .xlsx válido.`],
    };
  }

  // Log sheet names for debugging
  const sheetNamesList = wb.SheetNames.join(', ');

  const findSheet = (frag: string): XLSX.WorkSheet | null => {
    const normFrag = normalize(frag);
    const name = wb.SheetNames.find((n) => normalize(n).includes(normFrag));
    return name ? (wb.Sheets[name] ?? null) : null;
  };

  const credicorpSheet = findSheet('prefactibilidad') ?? findSheet('credicorp') ?? findSheet('prefact');
  const cashflowSheet  = findSheet('flujo de caja')  ?? findSheet('flujo')    ?? findSheet('cashflow');
  const budgetSheet    = findSheet('pres. edificio')  ?? findSheet('edificio') ?? findSheet('presupuesto') ?? findSheet('pres ');
  const adminSheet     = findSheet('costos administraci') ?? findSheet('administraci') ?? findSheet('admin');

  let analysis: SantaIsabelImportPreview['analysis'] = { discountRate: '12' };
  let costItems: FeasibilityCostItemInput[] = [];
  let cashFlow: FeasibilityCashFlowInput[] = [];
  let budget: { chapters: Chapter[]; totalDirectCost: string } = { chapters: [], totalDirectCost: '0' };

  if (credicorpSheet) {
    const matrix = sheetToMatrix(credicorpSheet);
    analysis  = parseMetadata(matrix, warnings);
    costItems = parseCostTable(matrix, warnings);
  } else {
    warnings.push(
      `Hoja "prefactibilidad CREDICORP" no encontrada. ` +
      `Hojas disponibles: ${sheetNamesList}. ` +
      `El nombre de la hoja debe contener "prefactibilidad" o "credicorp".`,
    );
  }

  if (cashflowSheet) {
    cashFlow = parseCashFlow(sheetToMatrix(cashflowSheet), warnings);
  } else {
    warnings.push(
      `Hoja "FLUJO DE CAJA" no encontrada. ` +
      `Hojas disponibles: ${sheetNamesList}.`,
    );
  }

  if (budgetSheet) {
    budget = parseBudget(sheetToMatrix(budgetSheet), warnings);
  } else {
    warnings.push(
      `Hoja de presupuesto no encontrada. ` +
      `Hojas disponibles: ${sheetNamesList}.`,
    );
  }

  if (adminSheet) {
    const adminChapter = parseAdministration(sheetToMatrix(adminSheet));
    if (adminChapter) {
      budget.chapters.push(adminChapter);
    } else {
      warnings.push('Hoja COSTOS ADMINISTRACIÓN PROYECTO no produjo filas válidas');
    }
  }

  return { analysis, costItems, cashFlow, budget, warnings };
}
