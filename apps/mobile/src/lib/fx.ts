/**
 * Exchange-rate lookup (spec: Multi-currency). The rate is fetched when a
 * non-base currency is picked, shown editable, and LOCKED on save by being
 * stored on the expense. Frankfurter (ECB reference rates, no key) with a
 * fallback host; results are cached in memory for 10 minutes. Returns null
 * when both hosts fail so the caller keeps the typed-rate fallback.
 */
const TTL_MS = 10 * 60 * 1000;
const cache = new Map<string, { rate: number; at: number }>();

export type FxQuote = { rate: number; fetchedAt: Date; cached: boolean };

export async function fetchRate(from: string, to: string): Promise<FxQuote | null> {
  if (from === to) return { rate: 1, fetchedAt: new Date(), cached: false };
  const key = `${from}->${to}`;
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < TTL_MS) return { rate: hit.rate, fetchedAt: new Date(hit.at), cached: true };
  const hosts = [`https://api.frankfurter.dev/v1/latest?base=${from}&symbols=${to}`, `https://api.frankfurter.app/latest?base=${from}&symbols=${to}`];
  for (const url of hosts) {
    try {
      const r = await fetch(url);
      if (!r.ok) continue;
      const j = (await r.json()) as { rates?: Record<string, number> };
      const rate = j.rates?.[to];
      if (typeof rate === "number" && Number.isFinite(rate) && rate > 0) {
        cache.set(key, { rate, at: Date.now() });
        return { rate, fetchedAt: new Date(), cached: false };
      }
    } catch { /* try the next host */ }
  }
  return null;
}

export function formatFetchedAt(d: Date): string {
  return d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}
