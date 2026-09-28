import { type Cents } from "./money";

/**
 * Multi-currency (spec: Feature specs → Multi-currency). Each trip has a base
 * currency; an expense can be in any currency; the rate is fetched and
 * LOCKED when the expense is saved and stored on it (fx_rate = base per one
 * unit of the expense currency). Balances and settlement are always in base
 * cents. Fetching the rate is I/O and lives in the server function; this is
 * the arithmetic.
 */

/** ISO 4217 codes the pickers offer first; any valid code is accepted. */
export const COMMON_CURRENCIES = ["USD", "EUR", "GBP", "CAD", "MXN", "JPY", "AUD", "CHF", "THB", "VND", "INR", "BRL", "CRC", "DOP"] as const;

export function isCurrencyCode(code: string): boolean {
  return /^[A-Z]{3}$/.test(code);
}

/** Convert expense-currency cents to base-currency cents at the locked rate. */
export function toBaseCents(amountCents: Cents, fxRate: number): Cents {
  if (!Number.isFinite(fxRate) || fxRate <= 0) throw new RangeError(`fx rate must be positive, got ${fxRate}`);
  return Math.round(amountCents * fxRate);
}

/** Convert each person's expense-currency cents to base cents so the base
 *  shares still sum to the base total (the remainder goes to the first key). */
export function convertSharesToBase(shares: Record<string, Cents>, fxRate: number): Record<string, Cents> {
  const ids = Object.keys(shares);
  const totalBase = toBaseCents(Object.values(shares).reduce((s, c) => s + c, 0), fxRate);
  const out: Record<string, Cents> = {};
  let acc = 0;
  ids.forEach((id, i) => {
    const v = i === ids.length - 1 ? totalBase - acc : toBaseCents(shares[id]!, fxRate);
    out[id] = v;
    acc += v;
  });
  return out;
}

/** "1 EUR = 1.0842 USD" for the expense row. */
export function describeRate(expenseCurrency: string, baseCurrency: string, fxRate: number): string {
  return `1 ${expenseCurrency} = ${fxRate.toFixed(4)} ${baseCurrency}`;
}
