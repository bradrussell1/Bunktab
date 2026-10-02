import { CATEGORIES, categoryLabel, formatCents } from "@bunktab/core";
import { activeMembers, paidBy, type Expense, type TripData } from "./trips";

/**
 * Derived figures for the recap, history and feed decorations (spec: Trip
 * recap; Edit and delete history). Pure functions over TripData; money is
 * base cents throughout.
 */

/** Two-letter glyph per top-level category, for the feed rows. */
export const CATEGORY_GLYPH: Record<string, string> = {
  travel: "TR", dining: "DI", groceries: "GR", alcohol: "BW", transportation: "TP", recreation: "RC", other: "OT",
};

export function biggestExpense(d: TripData): Expense | null {
  return d.expenses.reduce<Expense | null>((best, e) => (!best || e.base_amount_cents > best.base_amount_cents ? e : best), null);
}

export function topCategory(d: TripData): { key: string; label: string; cents: number } | null {
  let best: { key: string; label: string; cents: number } | null = null;
  for (const c of CATEGORIES) {
    const cents = d.expenses.filter((e) => e.category === c.key).reduce((s, e) => s + e.base_amount_cents, 0);
    if (cents > 0 && (!best || cents > best.cents)) best = { key: c.key, label: c.label, cents };
  }
  return best;
}

export function frontedMost(d: TripData): { user_id: string; cents: number } | null {
  let best: { user_id: string; cents: number } | null = null;
  for (const m of activeMembers(d)) {
    const cents = paidBy(d, m.user_id);
    if (cents > 0 && (!best || cents > best.cents)) best = { user_id: m.user_id, cents };
  }
  return best;
}

/** True when the member appears on no expense as payer or share (spec: Members → removable). */
export function hasNoExpenses(d: TripData, userId: string): boolean {
  return !d.expenses.some((e) => e.expense_payers.some((p) => p.user_id === userId) || e.expense_shares.some((s) => s.user_id === userId));
}

/* ---------- history ---------- */

export type HistoryRow = { id: number; trip_id: string; expense_id: string | null; actor_id: string | null; action: string; before_json: Record<string, unknown> | null; after_json: Record<string, unknown> | null; at: string };

export const ACTION_LABEL: Record<string, string> = {
  "expense.create": "added an expense",
  "expense.update": "edited an expense",
  "expense.delete": "deleted an expense",
  "member.remove": "removed a member",
  "closeout.override": "closed out without everyone Done",
  "done.set": "tapped Done",
  "done.clear": "cleared Done",
};

const CENT_FIELDS = new Set(["amount_cents", "tip_cents", "base_amount_cents"]);
const HIDDEN = new Set(["id", "trip_id", "created_by", "created_at", "updated_at", "deleted_at", "receipt_url"]);
const FIELD_LABEL: Record<string, string> = {
  description: "Description", category: "Category", subcategory: "Subcategory", amount_cents: "Amount", tip_cents: "Tip",
  currency: "Currency", fx_rate: "Rate", base_amount_cents: "Amount (base)", split_type: "Split", nights: "Nights",
};

function show(field: string, v: unknown, currency: string): string {
  if (v === null || v === undefined || v === "") return "—";
  if (CENT_FIELDS.has(field) && typeof v === "number") return formatCents(v, field === "base_amount_cents" ? currency : String(currency));
  if (field === "category") return categoryLabel(String(v), null);
  if (field === "subcategory") return CATEGORIES.flatMap((c) => c.subcategories).find((s) => s.key === v)?.label ?? String(v);
  return String(v);
}

/** Changed top-level fields between two snapshots, in display form. */
export function diffFields(before: Record<string, unknown> | null, after: Record<string, unknown> | null, baseCurrency: string): { field: string; from: string; to: string }[] {
  const keys = new Set([...Object.keys(before ?? {}), ...Object.keys(after ?? {})]);
  const out: { field: string; from: string; to: string }[] = [];
  const cur = String((after ?? before)?.currency ?? baseCurrency);
  for (const k of keys) {
    if (HIDDEN.has(k)) continue;
    const a = before?.[k], b = after?.[k];
    if (JSON.stringify(a) === JSON.stringify(b)) continue;
    out.push({ field: FIELD_LABEL[k] ?? k, from: show(k, a, k === "base_amount_cents" ? baseCurrency : cur), to: show(k, b, k === "base_amount_cents" ? baseCurrency : cur) });
  }
  return out;
}

export function relativeTime(iso: string, now = Date.now()): string {
  const s = Math.max(0, Math.round((now - Date.parse(iso)) / 1000));
  if (s < 60) return "just now";
  const m = Math.round(s / 60); if (m < 60) return `${m}m ago`;
  const h = Math.round(m / 60); if (h < 24) return `${h}h ago`;
  const d = Math.round(h / 24); if (d < 14) return `${d}d ago`;
  return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}
