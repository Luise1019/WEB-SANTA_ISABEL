import {
  EASTER_RELATIVE_HOLIDAYS,
  EMILIANI_HOLIDAYS,
  FIXED_HOLIDAYS,
} from '@santaisabel/shared';

/**
 * Algoritmo de Butcher para calcular el domingo de Pascua de un año dado (calendario gregoriano).
 */
function easterSunday(year: number): Date {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(Date.UTC(year, month - 1, day));
}

function shiftToMonday(date: Date): Date {
  const dow = date.getUTCDay();
  if (dow === 1) return date;
  const daysToAdd = dow === 0 ? 1 : 8 - dow;
  const shifted = new Date(date);
  shifted.setUTCDate(shifted.getUTCDate() + daysToAdd);
  return shifted;
}

export type ColombianHolidayEntry = { date: Date; name: string; emiliani: boolean };

export function colombianHolidaysForYear(year: number): ColombianHolidayEntry[] {
  const out: ColombianHolidayEntry[] = [];

  for (const h of FIXED_HOLIDAYS) {
    out.push({
      date: new Date(Date.UTC(year, h.month - 1, h.day)),
      name: h.name,
      emiliani: false,
    });
  }

  for (const h of EMILIANI_HOLIDAYS) {
    const original = new Date(Date.UTC(year, h.month - 1, h.day));
    out.push({ date: shiftToMonday(original), name: h.name, emiliani: true });
  }

  const easter = easterSunday(year);
  for (const r of EASTER_RELATIVE_HOLIDAYS) {
    const original = new Date(easter);
    original.setUTCDate(original.getUTCDate() + r.offset);
    const date = r.emiliani ? shiftToMonday(original) : original;
    out.push({ date, name: r.name, emiliani: r.emiliani });
  }

  return out.sort((a, b) => a.date.getTime() - b.date.getTime());
}

export function colombianHolidaysRange(startYear: number, endYear: number): ColombianHolidayEntry[] {
  const all: ColombianHolidayEntry[] = [];
  for (let y = startYear; y <= endYear; y++) {
    all.push(...colombianHolidaysForYear(y));
  }
  return all;
}
