/**
 * Festivos en Colombia.
 * - Fijos: 1-ene, 1-may, 20-jul, 7-ago, 8-dic, 25-dic.
 * - Lunarizados (Ley Emiliani 51 de 1983): trasladados al lunes siguiente.
 *   Reyes (6-ene), San José (19-mar), Pedro y Pablo (29-jun), Asunción (15-ago),
 *   Día de la Raza (12-oct), Todos los Santos (1-nov), Independencia Cartagena (11-nov).
 * - Movibles religiosos: Jueves y Viernes Santo, Ascensión, Corpus Christi, Sagrado Corazón.
 *
 * Las migraciones de Prisma sembrarán festivos 2020-2040 calculados dinámicamente.
 * Aquí solo exponemos las reglas para reutilizarlas en cálculos de fecha.
 */

export type ColombianHoliday = {
  name: string;
  /** mes (1-12), día (1-31). Si es lunarizado, se traslada al lunes siguiente. */
  month: number;
  day: number;
  emiliani: boolean;
};

export const FIXED_HOLIDAYS: ColombianHoliday[] = [
  { name: 'Año Nuevo', month: 1, day: 1, emiliani: false },
  { name: 'Día del Trabajo', month: 5, day: 1, emiliani: false },
  { name: 'Día de la Independencia', month: 7, day: 20, emiliani: false },
  { name: 'Batalla de Boyacá', month: 8, day: 7, emiliani: false },
  { name: 'Inmaculada Concepción', month: 12, day: 8, emiliani: false },
  { name: 'Navidad', month: 12, day: 25, emiliani: false },
];

export const EMILIANI_HOLIDAYS: ColombianHoliday[] = [
  { name: 'Reyes Magos', month: 1, day: 6, emiliani: true },
  { name: 'Día de San José', month: 3, day: 19, emiliani: true },
  { name: 'San Pedro y San Pablo', month: 6, day: 29, emiliani: true },
  { name: 'Asunción de la Virgen', month: 8, day: 15, emiliani: true },
  { name: 'Día de la Raza', month: 10, day: 12, emiliani: true },
  { name: 'Todos los Santos', month: 11, day: 1, emiliani: true },
  { name: 'Independencia de Cartagena', month: 11, day: 11, emiliani: true },
];

/**
 * Festivos religiosos movibles relativos a Pascua.
 * Offset en días desde domingo de Resurrección.
 */
export const EASTER_RELATIVE_HOLIDAYS = [
  { name: 'Jueves Santo', offset: -3, emiliani: false },
  { name: 'Viernes Santo', offset: -2, emiliani: false },
  { name: 'Ascensión del Señor', offset: 43, emiliani: true },
  { name: 'Corpus Christi', offset: 64, emiliani: true },
  { name: 'Sagrado Corazón', offset: 71, emiliani: true },
] as const;
