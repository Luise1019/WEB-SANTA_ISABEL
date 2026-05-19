/**
 * Motor de cálculo de Prefactibilidad Inmobiliaria — Modelo CREDICORP
 * Basado en: EJEMPLO.xlsx / hoja "prefactibilidad CREDICORP"
 * Cifras internas en COP completo. UI muestra en miles (÷1000).
 *
 * Correcciones aplicadas vs. Excel original:
 * 1. Eliminadas referencias circulares (Punto de Equilibrio).
 * 2. M² Vendibles = M² Construido × factor (configurable).
 * 3. Crédito Constructor = % sobre Total Usos (configurable).
 * 4. Fuentes cuadran exactamente con Total Usos.
 * 5. Todos los ítems de costo son editables.
 */

// ─── Primitivos ───────────────────────────────────────────────────────────────

export interface CostItem {
  fid: number;  // COP — Fideicomiso
  con: number;  // COP — Constructor
}

export const ci = (fid = 0, con = 0): CostItem => ({ fid, con });

// ─── Entradas del modelo ─────────────────────────────────────────────────────

export interface FeasibilityInputs {
  // ── Datos generales
  promoter:           string;
  projectName:        string;
  city:               string;
  totalUnits:         number;
  stratum:            number;
  parkingType:        string;
  constructionSystem: string;
  builtAreaM2:        number;
  /** Ratio m² vendibles / m² construido. Excel: 5253.72 / 3632.85 ≈ 1.4468 */
  saleableFactorPct:  number;
  /** Valor total de ventas en COP */
  totalSales:         number;

  // ── Parámetros de fuentes
  /** % de ventas recibido como cuota inicial durante construcción (0.20 = 20%) */
  initialPaymentPct: number;
  /** % del Total Usos financiado con crédito constructor (0.566 ≈ 56.6%) */
  creditPct:         number;
  /** Otras fuentes adicionales en COP */
  otherSources:      number;

  // ── LOTE
  /** % de ventas asignado al lote (0.095 = 9.5%) */
  lotePct: number;

  // ── URBANISMO
  urbanismo: CostItem;

  // ── COSTOS DIRECTOS (EDIFICACIONES)
  directos: CostItem;

  // ── COSTOS INDIRECTOS (9 ítems)
  honorariosAdmin:   CostItem;  // Honorarios Administración y Construcción
  disenoEstudios:    CostItem;  // Diseño, Estudios Técnicos, Asesorías
  interventoria:     CostItem;  // Interventoría y Supervisión Estructural
  licencias:         CostItem;  // Licencias (Urbanismo, Construcción, Ambiental)
  seguros:           CostItem;  // Seguros
  derechosImpuestos: CostItem;  // Derechos e Impuestos
  conexionServicios: CostItem;  // Conexión de Servicios
  imprevistos:       CostItem;  // Imprevistos
  previsionAlza:     CostItem;  // Previsión al Alza

  // ── COSTOS FINANCIEROS (2 ítems)
  fiducia:          CostItem;  // Fiducia
  interesesCredito: CostItem;  // Intereses Crédito (Constructor, Puentes)

  // ── COSTOS DE VENTAS (5 ítems)
  honorariosVentas:     CostItem;  // Honorarios de Ventas
  honorariosGerencia:   CostItem;  // Honorarios de Gerencia
  disenoArquitectonico: CostItem;  // Honorarios Diseño/Arquitectónicos
  publicidad:           CostItem;  // Promoción y Publicidad
  notariales:           CostItem;  // Notariales (Escrituración, Transferencia lote)
}

// ─── Resultados del modelo ────────────────────────────────────────────────────

export interface LineResult {
  fid:      number;  // COP Fideicomiso
  con:      number;  // COP Constructor
  total:    number;  // COP Total
  pctSales: number;  // fracción sobre ventas (0.095 = 9.5%)
}

export interface FeasibilityResults {
  // Derivados generales
  saleableAreaM2: number;
  pricePerM2:     number;

  // Estructura de costos
  lote:      LineResult;
  urbanismo: LineResult;
  directos:  LineResult;

  indirectos: {
    honorariosAdmin:   LineResult;
    disenoEstudios:    LineResult;
    interventoria:     LineResult;
    licencias:         LineResult;
    seguros:           LineResult;
    derechosImpuestos: LineResult;
    conexionServicios: LineResult;
    imprevistos:       LineResult;
    previsionAlza:     LineResult;
    subtotal:          LineResult;
  };

  financieros: {
    fiducia:          LineResult;
    interesesCredito: LineResult;
    subtotal:         LineResult;
  };

  ventasCostos: {
    honorariosVentas:     LineResult;
    honorariosGerencia:   LineResult;
    disenoArquitectonico: LineResult;
    publicidad:           LineResult;
    notariales:           LineResult;
    subtotal:             LineResult;
  };

  // Totales
  totalUsos:    LineResult;
  totalSales:   number;
  utilidad:     number;   // COP
  utilidadPct:  number;   // fracción
  utilidadMiles: number;  // COP / 1000 (como muestra el Excel)

  // Resumen
  totalCostSinLote: number;

  // Fuentes
  cuotasIniciales:    number;
  creditoConstructor: number;
  aportesSocios:      number;
  totalFuentes:       number;
  balance:            number;  // debe ser ≈ 0

  // Indicadores
  breakEvenUnits: number;   // unidades necesarias para cubrir costos
  breakEvenPct:   number;   // fracción de unidades (0.88 = 88%)
  roi:            number;   // utilidad / totalUsos × 100
  pricePerUnit:   number;   // COP / unidad
  costPerUnit:    number;   // COP / unidad
}

// ─── Motor de cálculo ─────────────────────────────────────────────────────────

function lr(fid: number, con: number, ventas: number): LineResult {
  const total = fid + con;
  return { fid, con, total, pctSales: ventas > 0 ? total / ventas : 0 };
}

function sumLr(items: LineResult[], ventas: number): LineResult {
  const fid   = items.reduce((s, i) => s + i.fid, 0);
  const con   = items.reduce((s, i) => s + i.con, 0);
  return lr(fid, con, ventas);
}

export function calculate(inp: FeasibilityInputs): FeasibilityResults {
  const v = inp.totalSales;

  // ── Derivados generales ──────────────────────────────────────────────────
  const saleableAreaM2 = inp.builtAreaM2 * inp.saleableFactorPct;
  const pricePerM2     = saleableAreaM2 > 0 ? v / saleableAreaM2 : 0;

  // ── LOTE (% sobre ventas) ────────────────────────────────────────────────
  const lote = lr(v * inp.lotePct, 0, v);

  // ── URBANISMO ────────────────────────────────────────────────────────────
  const urbanismo = lr(inp.urbanismo.fid, inp.urbanismo.con, v);

  // ── COSTOS DIRECTOS ──────────────────────────────────────────────────────
  const directos = lr(inp.directos.fid, inp.directos.con, v);

  // ── COSTOS INDIRECTOS ────────────────────────────────────────────────────
  const honorariosAdmin   = lr(inp.honorariosAdmin.fid,   inp.honorariosAdmin.con,   v);
  const disenoEstudios    = lr(inp.disenoEstudios.fid,    inp.disenoEstudios.con,    v);
  const interventoria     = lr(inp.interventoria.fid,     inp.interventoria.con,     v);
  const licencias         = lr(inp.licencias.fid,         inp.licencias.con,         v);
  const seguros           = lr(inp.seguros.fid,           inp.seguros.con,           v);
  const derechosImpuestos = lr(inp.derechosImpuestos.fid, inp.derechosImpuestos.con, v);
  const conexionServicios = lr(inp.conexionServicios.fid, inp.conexionServicios.con, v);
  const imprevistos       = lr(inp.imprevistos.fid,       inp.imprevistos.con,       v);
  const previsionAlza     = lr(inp.previsionAlza.fid,     inp.previsionAlza.con,     v);
  const indSubtotal = sumLr(
    [honorariosAdmin, disenoEstudios, interventoria, licencias, seguros,
     derechosImpuestos, conexionServicios, imprevistos, previsionAlza], v,
  );

  // ── COSTOS FINANCIEROS ───────────────────────────────────────────────────
  const fiducia          = lr(inp.fiducia.fid,          inp.fiducia.con,          v);
  const interesesCredito = lr(inp.interesesCredito.fid, inp.interesesCredito.con, v);
  const finSubtotal = sumLr([fiducia, interesesCredito], v);

  // ── COSTOS DE VENTAS ─────────────────────────────────────────────────────
  const honorariosVentas     = lr(inp.honorariosVentas.fid,     inp.honorariosVentas.con,     v);
  const honorariosGerencia   = lr(inp.honorariosGerencia.fid,   inp.honorariosGerencia.con,   v);
  const disenoArquitectonico = lr(inp.disenoArquitectonico.fid, inp.disenoArquitectonico.con, v);
  const publicidad           = lr(inp.publicidad.fid,           inp.publicidad.con,           v);
  const notariales           = lr(inp.notariales.fid,           inp.notariales.con,           v);
  const vtSubtotal = sumLr(
    [honorariosVentas, honorariosGerencia, disenoArquitectonico, publicidad, notariales], v,
  );

  // ── TOTAL USOS ───────────────────────────────────────────────────────────
  const totalUsos = sumLr(
    [lote, urbanismo, directos, indSubtotal, finSubtotal, vtSubtotal], v,
  );

  // ── UTILIDAD ─────────────────────────────────────────────────────────────
  const utilidad     = v - totalUsos.total;
  const utilidadPct  = v > 0 ? utilidad / v : 0;
  const utilidadMiles = utilidad / 1000;

  // ── RESUMEN ──────────────────────────────────────────────────────────────
  const totalCostSinLote = totalUsos.total - lote.total;

  // ── FUENTES ──────────────────────────────────────────────────────────────
  // Cuotas iniciales = % de ventas cobrado durante construcción
  const cuotasIniciales = v * inp.initialPaymentPct;

  // Crédito constructor = % del total de usos
  const creditoConstructor = totalUsos.total * inp.creditPct;

  // Aporte socios = residuo para cuadrar (garantiza balance = 0)
  const aportesSocios = Math.max(
    0,
    totalUsos.total - cuotasIniciales - creditoConstructor - inp.otherSources,
  );

  const totalFuentes = cuotasIniciales + creditoConstructor + aportesSocios + inp.otherSources;
  const balance      = totalFuentes - totalUsos.total;  // ≈ 0

  // ── INDICADORES ──────────────────────────────────────────────────────────
  const pricePerUnit   = inp.totalUnits > 0 ? v / inp.totalUnits : 0;
  const costPerUnit    = inp.totalUnits > 0 ? totalUsos.total / inp.totalUnits : 0;
  const breakEvenUnits = pricePerUnit > 0 ? Math.ceil(totalUsos.total / pricePerUnit) : 0;
  const breakEvenPct   = inp.totalUnits > 0 ? breakEvenUnits / inp.totalUnits : 0;
  const roi            = totalUsos.total > 0 ? (utilidad / totalUsos.total) * 100 : 0;

  return {
    saleableAreaM2, pricePerM2,
    lote, urbanismo, directos,
    indirectos: {
      honorariosAdmin, disenoEstudios, interventoria, licencias, seguros,
      derechosImpuestos, conexionServicios, imprevistos, previsionAlza,
      subtotal: indSubtotal,
    },
    financieros: { fiducia, interesesCredito, subtotal: finSubtotal },
    ventasCostos: {
      honorariosVentas, honorariosGerencia, disenoArquitectonico,
      publicidad, notariales, subtotal: vtSubtotal,
    },
    totalUsos, totalSales: v,
    utilidad, utilidadPct, utilidadMiles,
    totalCostSinLote,
    cuotasIniciales, creditoConstructor, aportesSocios, totalFuentes, balance,
    breakEvenUnits, breakEvenPct, roi, pricePerUnit, costPerUnit,
  };
}

// ─── Valores por defecto (EJEMPLO.xlsx) ──────────────────────────────────────

export const DEFAULT_INPUTS: FeasibilityInputs = {
  promoter:           'CONSTRUCTORA 1A',
  projectName:        'TORRE DE SANTA ISABEL',
  city:               'Pereira',
  totalUnits:         124,
  stratum:            3,
  parkingType:        'Cubierto',
  constructionSystem: 'Muros en Concreto Industrializado',
  builtAreaM2:        3632.85,
  saleableFactorPct:  1.4468,      // 5253.72 / 3632.85
  totalSales:         20_522_570_000,

  initialPaymentPct:  0.20,         // 20% de ventas como cuota inicial
  creditPct:          0.566,        // 56.6% de usos via crédito constructor
  otherSources:       0,

  lotePct:    0.095,
  urbanismo:  ci(1_605_461_699, 9_783_772),
  directos:   ci(9_273_812_000, 0),

  honorariosAdmin:   ci(657_000_000, 0),
  disenoEstudios:    ci(0, 260_545_000),
  interventoria:     ci(128_500_000, 0),
  licencias:         ci(0, 75_300_000),
  seguros:           ci(59_540_000, 0),
  derechosImpuestos: ci(64_000_000, 25_712_000),
  conexionServicios: ci(22_889_000, 0),
  imprevistos:       ci(194_586_000, 0),
  previsionAlza:     ci(571_844_000, 0),

  fiducia:          ci(122_148_952, 33_313_340),
  interesesCredito: ci(2_003_003_000, 0),

  honorariosVentas:     ci(462_816_000, 155_939_460),
  honorariosGerencia:   ci(304_760_000, 0),
  disenoArquitectonico: ci(0, 30_000_000),
  publicidad:           ci(0, 21_931_000),
  notariales:           ci(81_370_000, 0),
};

// ─── Utilidades de formato ────────────────────────────────────────────────────

/** Formatea COP en millones con 1 decimal: $9.273,8M */
export function fmtM(cop: number): string {
  if (cop === 0) return '—';
  const m = cop / 1_000_000;
  return new Intl.NumberFormat('es-CO', {
    style: 'currency', currency: 'COP', notation: 'compact',
    maximumFractionDigits: 1,
  }).format(cop);
}

/** Formatea COP en miles para la tabla principal: 9.273.812 */
export function fmtMiles(cop: number): string {
  const miles = Math.round(cop / 1000);
  return new Intl.NumberFormat('es-CO').format(miles);
}

/** Formatea porcentaje con 2 decimales: 9,50% */
export function fmtPct(fraction: number): string {
  return `${(fraction * 100).toFixed(2)}%`;
}
