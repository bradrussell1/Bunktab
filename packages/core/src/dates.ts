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
