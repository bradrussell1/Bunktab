import { type Cents } from "./money";

/**
 * Multi-currency (spec: Feature specs → Multi-currency). Each trip has a base
 * currency; an expense can be in any currency; the rate is fetched and
 * LOCKED when the expense is saved and stored on it (fx_rate = base per one
 * unit of the expense currency). Balances and settlement are always in base
 * cents. Fetching the rate is I/O and lives in the server function; this is
 * the arithmetic.
 */

/** The currencies the app offers (user decision 2026-10-01); USD is the default. The database enforces the same set. */
export const COMMON_CURRENCIES = ["USD", "EUR", "GBP", "MXN"] as const;

export function isCurrencyCode(code: string): boolean {
  return /^[A-Z]{3}$/.test(code);
}

/** Convert expense-currency cents to base-currency cents at the locked rate. */
export function toBaseCents(amountCents: Cents, fxRate: number): Cents {
  if (!Number.isFinite(fxRate) || fxRate <= 0) throw new RangeError(`fx rate must be positive, got ${fxRate}`);
  return Math.round(amountCents * fxRate);
}

/** Convert each person's expense-currency cents to base cents so the base
 *  shares still sum to the base total. Largest-remainder: everyone gets the
 *  floor of their exact base value, and the leftover cents go to the largest
 *  fractional parts (ties by key), so no share can go negative. */
export function convertSharesToBase(shares: Record<string, Cents>, fxRate: number): Record<string, Cents> {
  const ids = Object.keys(shares);
  const totalBase = toBaseCents(Object.values(shares).reduce((s, c) => s + c, 0), fxRate);
  const exact = ids.map((id) => ({ id, v: shares[id]! * fxRate }));
  const out: Record<string, Cents> = {};
  let acc = 0;
  for (const { id, v } of exact) { out[id] = Math.floor(v); acc += out[id]!; }
  let rem = totalBase - acc;
  const order = [...exact].sort((a, b) => (b.v - Math.floor(b.v)) - (a.v - Math.floor(a.v)) || a.id.localeCompare(b.id));
  for (let i = 0; rem > 0 && order.length; i = (i + 1) % order.length) { out[order[i]!.id]! += 1; rem -= 1; }
  return out;
}

/** "1 EUR = 1.0842 USD" for the expense row. */
export function describeRate(expenseCurrency: string, baseCurrency: string, fxRate: number): string {
  return `1 ${expenseCurrency} = ${fxRate.toFixed(4)} ${baseCurrency}`;
}
