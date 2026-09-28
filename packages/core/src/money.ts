/**
 * Money is integer cents everywhere (spec: Data model). Nothing in this
 * package touches floats except formatting for display.
 */

export type Cents = number;

export function assertCents(n: number, what = "amount"): asserts n is Cents {
  if (!Number.isInteger(n)) throw new RangeError(`${what} must be integer cents, got ${n}`);
}

/**
 * Divide `total` cents into `n` whole-cent parts that sum exactly to `total`.
 * The first `total mod n` parts get one extra cent; the caller decides who
 * takes them (splits give leftovers to the payer).
 */
export function divideEvenly(total: Cents, n: number): Cents[] {
  assertCents(total, "total");
  if (!Number.isInteger(n) || n <= 0) throw new RangeError(`n must be a positive integer, got ${n}`);
  const base = Math.trunc(total / n);
  const remainder = total - base * n;
  const out: Cents[] = [];
  for (let i = 0; i < n; i++) out.push(base + (i < Math.abs(remainder) ? Math.sign(remainder) : 0));
  return out;
}

/**
 * Split `total` in proportion to `weights` (any non-negative numbers), whole
 * cents, summing exactly to `total`. Largest-remainder method so no share is
 * more than a cent off its exact value; ties go to earlier entries.
 */
export function divideByWeights(total: Cents, weights: number[]): Cents[] {
  assertCents(total, "total");
  const sum = weights.reduce((s, w) => s + w, 0);
  if (weights.length === 0) throw new RangeError("weights must not be empty");
  if (weights.some((w) => w < 0 || !Number.isFinite(w))) throw new RangeError("weights must be finite and non-negative");
  if (sum <= 0) throw new RangeError("weights must sum to more than zero");
  const exact = weights.map((w) => (total * w) / sum);
  const floors = exact.map((e) => Math.floor(e));
  let left = total - floors.reduce((s, f) => s + f, 0);
  const order = exact.map((e, i) => ({ i, frac: e - Math.floor(e) })).sort((a, b) => b.frac - a.frac || a.i - b.i);
  const out = [...floors];
  for (const { i } of order) {
    if (left <= 0) break;
    out[i]! += 1;
    left -= 1;
  }
  return out;
}

export function sumCents(values: Iterable<Cents>): Cents {
  let s = 0;
  for (const v of values) s += v;
  return s;
}

/** "$84.50" / "-$12.00"; other currencies fall back to the ISO code prefix. */
export function formatCents(cents: Cents, currency = "USD", locale = "en-US"): string {
  try {
    return new Intl.NumberFormat(locale, { style: "currency", currency, minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(cents / 100);
  } catch {
    const sign = cents < 0 ? "-" : "";
    return `${sign}${currency} ${(Math.abs(cents) / 100).toFixed(2)}`;
  }
}

/** "84.50" - Venmo's amount parameter, exact, two decimals, no symbol. */
export function centsToDecimalString(cents: Cents): string {
  assertCents(cents);
  const abs = Math.abs(cents);
  return `${cents < 0 ? "-" : ""}${Math.trunc(abs / 100)}.${String(abs % 100).padStart(2, "0")}`;
}

/** Parse "84.5", "84.50", "1,200" or "$84.50" into cents; null when not a number. */
export function parseToCents(input: string): Cents | null {
  const cleaned = input.replace(/[^0-9.\-]/g, "");
  if (!cleaned || cleaned === "-" || cleaned === ".") return null;
  const n = Number(cleaned);
  if (!Number.isFinite(n)) return null;
  return Math.round(n * 100);
}
