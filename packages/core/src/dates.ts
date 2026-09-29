/**
 * Date display for YYYY-MM-DD strings (the store keeps trip dates as
 * dates, not timestamps, so they never shift with the viewer's timezone).
 * `formatDateRange("2026-10-02","2026-10-05")` → "Oct 2 – 5, 2026";
 * across months "Oct 30 – Nov 2, 2026"; across years "Dec 30, 2026 – Jan 2, 2027".
 */
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function parts(iso: string): { y: number; m: number; d: number } | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  if (!m) return null;
  return { y: Number(m[1]), m: Number(m[2]) - 1, d: Number(m[3]) };
}

export function formatDate(iso: string, withYear = true): string {
  const p = parts(iso);
  if (!p) return iso;
  return `${MONTHS[p.m]} ${p.d}${withYear ? `, ${p.y}` : ""}`;
}

export function formatDateRange(start: string, end: string): string {
  const a = parts(start), b = parts(end);
  if (!a || !b) return `${start} – ${end}`;
  if (a.y !== b.y) return `${formatDate(start)} – ${formatDate(end)}`;
  if (a.m !== b.m) return `${MONTHS[a.m]} ${a.d} – ${MONTHS[b.m]} ${b.d}, ${a.y}`;
  if (a.d !== b.d) return `${MONTHS[a.m]} ${a.d} – ${b.d}, ${a.y}`;
  return formatDate(start);
}

/** Today as YYYY-MM-DD in the device's local calendar. */
export function todayIso(now = new Date()): string {
  const y = now.getFullYear(), m = String(now.getMonth() + 1).padStart(2, "0"), d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/* ---------- calendar math (create trip date picker) ---------- */

export const MONTH_NAMES = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
export const WEEKDAYS_SHORT = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];
const DAYS_LONG = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

/** Days since 1970-01-01 for a civil date (no Date objects, no timezone). */
function dayNumber(y: number, m: number, d: number): number {
  // m is 0-based; algorithm from Howard Hinnant's days_from_civil
  const yy = m < 2 ? y - 1 : y;
  const era = Math.floor(yy / 400);
  const yoe = yy - era * 400;
  const mp = (m + 10) % 12;
  const doy = Math.floor((153 * mp + 2) / 5) + d - 1;
  const doe = yoe * 365 + Math.floor(yoe / 4) - Math.floor(yoe / 100) + doy;
  return era * 146097 + doe - 719468;
}
function civil(n: number): { y: number; m: number; d: number } {
  const z = n + 719468;
  const era = Math.floor(z / 146097);
  const doe = z - era * 146097;
  const yoe = Math.floor((doe - Math.floor(doe / 1460) + Math.floor(doe / 36524) - Math.floor(doe / 146096)) / 365);
  const yy = yoe + era * 400;
  const doy = doe - (365 * yoe + Math.floor(yoe / 4) - Math.floor(yoe / 100));
  const mp = Math.floor((5 * doy + 2) / 153);
  const d = doy - Math.floor((153 * mp + 2) / 5) + 1;
  const m = mp < 10 ? mp + 2 : mp - 10;
  return { y: m < 2 ? yy + 1 : yy, m, d };
}
const iso = (y: number, m: number, d: number) => `${y}-${String(m + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;

/** Add whole days to a YYYY-MM-DD string. */
export function addDays(date: string, days: number): string {
  const p = parts(date);
  if (!p) return date;
  const c = civil(dayNumber(p.y, p.m, p.d) + days);
  return iso(c.y, c.m, c.d);
}

/** 0 = Sunday … 6 = Saturday. */
export function weekdayIndex(date: string): number {
  const p = parts(date);
  if (!p) return 0;
  return (((dayNumber(p.y, p.m, p.d) + 4) % 7) + 7) % 7; // 1970-01-01 was a Thursday
}
export function weekdayShort(date: string): string { return WEEKDAYS_SHORT[weekdayIndex(date)]!; }

/** "Fri, Oct 2, 2026" */
export function formatDateLong(date: string): string {
  const p = parts(date);
  if (!p) return date;
  return `${DAYS_LONG[weekdayIndex(date)]}, ${MONTHS[p.m]} ${p.d}, ${p.y}`;
}
/** "Fri Oct 2" */
export function formatDayShort(date: string): string {
  const p = parts(date);
  if (!p) return date;
  return `${DAYS_LONG[weekdayIndex(date)]} ${MONTHS[p.m]} ${p.d}`;
}

export type YearMonth = { year: number; month: number }; // month 0-based
export type GridCell = { iso: string; day: number; inMonth: boolean; isToday: boolean };

export function daysInMonth(year: number, month: number): number {
  return dayNumber(month === 11 ? year + 1 : year, (month + 1) % 12, 1) - dayNumber(year, month, 1);
}

/** 42 cells (6 rows × 7, Sunday first) covering the month, padded with neighbours. */
export function monthGrid(year: number, month: number, today = todayIso()): GridCell[] {
  const first = iso(year, month, 1);
  const lead = weekdayIndex(first);
  const start = addDays(first, -lead);
  const cells: GridCell[] = [];
  for (let i = 0; i < 42; i++) {
    const d = addDays(start, i);
    const p = parts(d)!;
    cells.push({ iso: d, day: p.d, inMonth: p.y === year && p.m === month, isToday: d === today });
  }
  return cells;
}

export function shiftMonth(ym: YearMonth, by: number): YearMonth {
  const idx = ym.year * 12 + ym.month + by;
  return { year: Math.floor(idx / 12), month: ((idx % 12) + 12) % 12 };
}
export function monthOf(date: string): YearMonth {
  const p = parts(date);
  return p ? { year: p.y, month: p.m } : monthOf(todayIso());
}
export function compareMonth(a: YearMonth, b: YearMonth): number { return a.year * 12 + a.month - (b.year * 12 + b.month); }
/** Keep a month within ±`range` months of `anchor` (the picker offers 6 back and 6 forward). */
export function clampMonth(ym: YearMonth, anchor: YearMonth, range = 6): YearMonth {
  const lo = shiftMonth(anchor, -range), hi = shiftMonth(anchor, range);
  if (compareMonth(ym, lo) < 0) return lo;
  if (compareMonth(ym, hi) > 0) return hi;
  return ym;
}
/** The 13 months the month-jump overlay offers. */
export function monthRange(anchor: YearMonth, range = 6): YearMonth[] {
  return Array.from({ length: range * 2 + 1 }, (_, i) => shiftMonth(anchor, i - range));
}
export function monthLabel(ym: YearMonth, withYear = true): string { return `${MONTH_NAMES[ym.month]}${withYear ? ` ${ym.year}` : ""}`; }
