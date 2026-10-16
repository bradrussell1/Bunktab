/**
 * The model's receipt JSON → integer cents, plus the reconciliation checks
 * (RECEIPT_SPLIT_PROMPT, Part 3 steps 5–6). Shared by the receipt-parse Edge
 * Function and the local eval harness, so both judge a read the same way.
 * Shape validation (types, enums) happens with Zod in the function before this
 * runs; this file assumes the shape and checks the arithmetic.
 */
import type { AppliesTo, ChargeKind, ItemKind } from "./split";

export const EXTRACTION_SCHEMA_VERSION = "1";

export type ExtractedItem = { raw_text: string; name: string; quantity: number; unit_price: string | null; line_total: string; kind: ItemKind; modifiers: { text: string; amount: string | null }[]; is_void: boolean; confidence: "high" | "medium" | "low" };
export type Extraction = {
  readable: boolean;
  merchant: string | null;
  date: string | null;
  currency: string | null;
  items: ExtractedItem[];
  subtotal: string | null;
  tax_lines: { label: string; amount: string; applies_to: AppliesTo }[];
  fees: { label: string; amount: string; kind: "service_charge" | "auto_gratuity" | "other_fee" }[];
  discounts: { label: string; amount: string; item_index: number | null }[];
  total: string | null;
  tip_printed: string | null;
  tax_included_in_prices: boolean;
  confidence: "high" | "medium" | "low";
  notes: string | null;
};

/** "12.50" → 1250, "-3.00" → -300, "1,234.5" → 123450. null for anything that isn't a decimal. */
export function decimalToCents(s: string | null | undefined): number | null {
  if (s == null) return null;
  const t = String(s).trim().replace(/[,$€£\s]/g, "").replace(/^\((.*)\)$/, "-$1").replace(/−/g, "-");
  if (!/^-?\d+(\.\d{1,2})?$/.test(t)) return null;
  const neg = t.startsWith("-");
  const [w, f = ""] = t.replace("-", "").split(".");
  const cents = Number(w) * 100 + Number((f + "00").slice(0, 2));
  return neg ? -cents : cents;
}

export type NormalizedItem = { position: number; name: string; rawText: string; quantity: number; lineTotalCents: number; kind: ItemKind; confidence: "high" | "medium" | "low"; isVoid: boolean };
export type NormalizedCharge = { kind: ChargeKind; label: string; amountCents: number; appliesTo: AppliesTo; itemIndex: number | null; position: number };
export type Normalized = {
  merchant: string | null; date: string | null; currency: string | null;
  items: NormalizedItem[]; charges: NormalizedCharge[];
  subtotalCents: number | null; taxCents: number; feesCents: number; discountsCents: number; printedTotalCents: number | null; tipPrintedCents: number | null;
  taxIncluded: boolean;
  /** Decimal strings the model returned that weren't parseable. */
  problems: string[];
};

export class ExtractionError extends Error {
  constructor(message: string, public readonly code: "UNREADABLE" | "BAD_AMOUNT" | "NO_ITEMS") { super(message); this.name = "ExtractionError"; }
}

/** Decimal strings → cents, voids dropped from the arithmetic, discounts normalised negative. */
export function normalizeExtraction(x: Extraction): Normalized {
  if (!x.readable) throw new ExtractionError("unreadable", "UNREADABLE");
  const problems: string[] = [];
  const items: NormalizedItem[] = [];
  x.items.forEach((it, i) => {
    const cents = decimalToCents(it.line_total);
    if (cents == null) { problems.push(`item ${i}: line_total "${it.line_total}"`); return; }
    const q = Number.isInteger(it.quantity) && it.quantity >= 1 ? it.quantity : Math.max(1, Math.round(it.quantity || 1));
    items.push({ position: i, name: it.name?.trim() || it.raw_text?.trim() || `Line ${i + 1}`, rawText: it.raw_text ?? "", quantity: q, lineTotalCents: cents, kind: it.kind ?? "other", confidence: it.confidence ?? "medium", isVoid: !!it.is_void || cents < 0 && /void/i.test(it.raw_text ?? "") });
  });
  if (!items.length) throw new ExtractionError("no line items read", "NO_ITEMS");
  const charges: NormalizedCharge[] = [];
  let pos = 0;
  for (const t of x.tax_lines) {
    const c = decimalToCents(t.amount); if (c == null) { problems.push(`tax "${t.label}": ${t.amount}`); continue; }
    charges.push({ kind: "tax", label: t.label, amountCents: c, appliesTo: t.applies_to ?? "all", itemIndex: null, position: pos++ });
  }
  for (const f of x.fees) {
    const c = decimalToCents(f.amount); if (c == null) { problems.push(`fee "${f.label}": ${f.amount}`); continue; }
    charges.push({ kind: f.kind, label: f.label, amountCents: c, appliesTo: "all", itemIndex: null, position: pos++ });
  }
  for (const d of x.discounts) {
    const c = decimalToCents(d.amount); if (c == null) { problems.push(`discount "${d.label}": ${d.amount}`); continue; }
    const idx = d.item_index != null && d.item_index >= 0 && d.item_index < x.items.length ? d.item_index : null;
    charges.push({ kind: "discount", label: d.label, amountCents: -Math.abs(c), appliesTo: "all", itemIndex: idx, position: pos++ });
  }
  const taxIncluded = !!x.tax_included_in_prices;
  const taxCents = taxIncluded ? 0 : charges.filter((c) => c.kind === "tax").reduce((s, c) => s + c.amountCents, 0);
  const feesCents = charges.filter((c) => c.kind !== "tax" && c.kind !== "discount").reduce((s, c) => s + c.amountCents, 0);
  const discountsCents = charges.filter((c) => c.kind === "discount").reduce((s, c) => s + c.amountCents, 0);
  return {
    merchant: x.merchant?.trim() || null, date: x.date && /^\d{4}-\d{2}-\d{2}$/.test(x.date) ? x.date : null, currency: x.currency?.toUpperCase() ?? null,
    items, charges, subtotalCents: decimalToCents(x.subtotal), taxCents, feesCents, discountsCents, printedTotalCents: decimalToCents(x.total), tipPrintedCents: decimalToCents(x.tip_printed),
    taxIncluded, problems,
  };
}

export type Reconciliation = {
  ok: boolean;
  /** items (+ item-tied discounts) vs the printed subtotal; null when no subtotal was printed */
  subtotalDiffCents: number | null;
  /** subtotal + tax + fees − other discounts vs the printed total; null when no total was printed */
  totalDiffCents: number | null;
  /** The subtotal the engine will use (printed, or the sum of the lines). */
  subtotalCents: number;
  /** The grand total before tip the engine will use. */
  totalCents: number;
  /** Index of the line most likely to be misread, when something doesn't add up. */
  suspectPosition: number | null;
  reasons: string[];
};

/** items + item discounts = subtotal (±2¢ a line, max ±10¢); subtotal + tax + fees − other discounts = total (±1¢). */
export function reconcile(n: Normalized): Reconciliation {
  const live = n.items.filter((it) => !it.isVoid || it.lineTotalCents < 0);
  const itemDiscounts = n.charges.filter((c) => c.kind === "discount" && c.itemIndex != null).reduce((s, c) => s + c.amountCents, 0);
  const otherDiscounts = n.charges.filter((c) => c.kind === "discount" && c.itemIndex == null).reduce((s, c) => s + c.amountCents, 0);
  const itemsSum = live.reduce((s, it) => s + it.lineTotalCents, 0) + itemDiscounts;
  const reasons: string[] = [];
  let subtotalDiff: number | null = null;
  if (n.subtotalCents != null) {
    subtotalDiff = itemsSum - n.subtotalCents;
    const tol = Math.min(10, 2 * Math.max(1, live.length));
    if (Math.abs(subtotalDiff) > tol) reasons.push(`items add to ${itemsSum}, subtotal printed ${n.subtotalCents}`);
  }
  const subtotal = n.subtotalCents ?? itemsSum;
  const computedTotal = subtotal + n.taxCents + n.feesCents + otherDiscounts;
  let totalDiff: number | null = null;
  if (n.printedTotalCents != null) {
    totalDiff = computedTotal - n.printedTotalCents;
    if (Math.abs(totalDiff) > 1) reasons.push(`subtotal + tax + fees = ${computedTotal}, total printed ${n.printedTotalCents}`);
  } else reasons.push("no printed total");
  const ok = reasons.length === 0 && n.problems.length === 0;
  let suspect: number | null = null;
  if (!ok && subtotalDiff != null && subtotalDiff !== 0) {
    // the line whose amount is closest to the gap, else the lowest-confidence line
    const gap = Math.abs(subtotalDiff);
    const byGap = [...live].sort((a, b) => Math.abs(Math.abs(a.lineTotalCents) - gap) - Math.abs(Math.abs(b.lineTotalCents) - gap));
    const low = live.find((it) => it.confidence === "low");
    suspect = (low ?? byGap[0])?.position ?? null;
  } else if (!ok) {
    suspect = live.find((it) => it.confidence === "low")?.position ?? null;
  }
  return { ok, subtotalDiffCents: subtotalDiff, totalDiffCents: totalDiff, subtotalCents: subtotal, totalCents: n.printedTotalCents ?? computedTotal, suspectPosition: suspect, reasons: [...reasons, ...n.problems] };
}
