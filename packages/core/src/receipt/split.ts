/**
 * Itemized receipt splitting (RECEIPT_SPLIT_PROMPT, Part 2). Pure, no I/O, integer
 * cents in and out. AI reads, this calculates: the app, the web guest view and the
 * receipt-save function all run exactly this code.
 *
 * Leftover cent rule (everywhere here): every share is rounded DOWN; all leftover
 * cents go to the account holder. If the holder isn't part of that split they go to
 * the first participant in trip-member order. Every split adds up to the bill.
 */
import { ZERO, add, asRat, cmp, div, floorRat, fromNumber, isPos, isZero, mul, rat, sub, sumRat, toNumber, type Rat } from "./rational";

import type { Cents } from "../money";
export type { Cents };
export type PersonId = string;

export type ItemKind = "food" | "drink" | "alcohol" | "other";
export type ChargeKind = "tax" | "service_charge" | "auto_gratuity" | "other_fee" | "discount";
export type AppliesTo = "all" | "food" | "alcohol" | "unknown";
export type TipMode = "percent" | "custom" | "none";

export type SplitItem = { id: string; name: string; quantity: number; lineTotalCents: Cents; kind?: ItemKind | null };
export type SplitCharge = { id?: string; kind: ChargeKind; label?: string | null; amountCents: Cents; appliesTo?: AppliesTo | null; itemId?: string | null };
export type SplitReceipt = {
  items: SplitItem[];
  charges: SplitCharge[];
  /** The printed subtotal. Falls back to the sum of the lines (after item discounts). */
  subtotalCents?: Cents | null;
  /** VAT-inclusive receipts: tax lines are informational, the food is the total. */
  taxIncluded?: boolean | null;
};
export type TipChoice = { mode: TipMode; percent?: number | null; customCents?: Cents | null };
/** claims[itemId][personId] = units. Single-unit dishes carry equal-share weights (1 each). */
export type Claims = Record<string, Record<PersonId, number>>;

export type Share = { personId: PersonId; foodCents: Cents; taxCents: Cents; feesCents: Cents; tipCents: Cents; discountCents: Cents; totalCents: Cents };
export type Totals = { subtotalCents: Cents; taxCents: Cents; feesCents: Cents; discountCents: Cents; tipCents: Cents; grandCents: Cents; taxIncluded: boolean };

export const UNIT_EPS = 1e-6;

function assertCents(n: number, what: string): void {
  if (!Number.isInteger(n)) throw new RangeError(`${what} must be integer cents, got ${n}`);
}

/* ─────────────────────────── allocate ─────────────────────────── */

/**
 * Split `total` cents by `weights` (integers, decimals or exact fractions). Every share
 * is floored; the leftover cents go to weights[holderIndex] when that weight is > 0,
 * else to the first index with a positive weight. Sum of the result === total.
 * A negative total (a discount) is allocated on its magnitude and negated.
 */
export function allocate(total: Cents, weights: (number | Rat)[], holderIndex = 0): Cents[] {
  assertCents(total, "total");
  if (total < 0) return allocate(-total, weights, holderIndex).map((c) => -c);
  const ws = weights.map(asRat);
  if (ws.some((w) => w.n < 0n)) throw new RangeError("weights must be non-negative");
  const sum = sumRat(ws);
  if (isZero(sum)) return ws.map(() => 0);
  const T = rat(BigInt(total));
  const out = ws.map((w) => Number(floorRat(div(mul(T, w), sum))));
  const left = total - out.reduce((a, b) => a + b, 0);
  const holder = holderIndex >= 0 && holderIndex < ws.length && isPos(ws[holderIndex]!) ? holderIndex : ws.findIndex(isPos);
  out[holder]! += left;
  return out;
}

/* ─────────────────────────── tip and totals ─────────────────────────── */

/** Tip is on the food subtotal, before tax. percent → round(subtotal × p / 100). */
export function computeTip(subtotal: Cents, mode: TipMode, percent?: number | null, custom?: Cents | null): Cents {
  assertCents(subtotal, "subtotal");
  if (mode === "none") return 0;
  if (mode === "custom") { const c = custom ?? 0; assertCents(c, "custom tip"); return Math.max(0, c); }
  return Math.round((subtotal * (percent ?? 0)) / 100);
}

/** Tip as a percentage of the food, one decimal ("18.1"). */
export function tipPercentOf(tipCents: Cents, subtotal: Cents): string {
  if (subtotal <= 0) return "0.0";
  return ((tipCents / subtotal) * 100).toFixed(1);
}

/** Items with any item-tied discount folded into the line total. */
export function effectiveItems(receipt: SplitReceipt): SplitItem[] {
  const byItem: Record<string, Cents> = {};
  for (const c of receipt.charges) if (c.kind === "discount" && c.itemId) byItem[c.itemId] = (byItem[c.itemId] ?? 0) - Math.abs(c.amountCents);
  return receipt.items.map((it) => ({ ...it, lineTotalCents: it.lineTotalCents + (byItem[it.id] ?? 0) }));
}

export function itemsSubtotal(receipt: SplitReceipt): Cents {
  return effectiveItems(receipt).reduce((s, it) => s + it.lineTotalCents, 0);
}

/** The receipt's money lines as the engine sees them, plus the chosen tip. */
export function receiptTotals(receipt: SplitReceipt, tip: TipChoice): Totals {
  const taxIncluded = !!receipt.taxIncluded;
  const subtotalCents = receipt.subtotalCents ?? itemsSubtotal(receipt);
  assertCents(subtotalCents, "subtotal");
  const taxCents = taxIncluded ? 0 : receipt.charges.filter((c) => c.kind === "tax").reduce((s, c) => s + c.amountCents, 0);
  const feesCents = receipt.charges.filter((c) => c.kind === "service_charge" || c.kind === "auto_gratuity" || c.kind === "other_fee").reduce((s, c) => s + c.amountCents, 0);
  const discountCents = receipt.charges.filter((c) => c.kind === "discount" && !c.itemId).reduce((s, c) => s - Math.abs(c.amountCents), 0);
  const tipCents = computeTip(subtotalCents, tip.mode, tip.percent, tip.customCents);
  return { subtotalCents, taxCents, feesCents, discountCents, tipCents, grandCents: subtotalCents + taxCents + feesCents + discountCents + tipCents, taxIncluded };
}

/* ─────────────────────────── even ─────────────────────────── */

function holderIdx(people: PersonId[], holder: PersonId): number {
  const i = people.indexOf(holder);
  return i < 0 ? 0 : i;
}

function mkShares(people: PersonId[], food: Cents[], tax: Cents[], fees: Cents[], tip: Cents[], discount: Cents[], total?: Cents[]): Share[] {
  return people.map((personId, i) => ({
    personId,
    foodCents: food[i]!, taxCents: tax[i]!, feesCents: fees[i]!, tipCents: tip[i]!, discountCents: discount[i]!,
    totalCents: total ? total[i]! : food[i]! + tax[i]! + fees[i]! + tip[i]! + discount[i]!,
  }));
}

/** Everyone pays the same: allocate(grand, ones, holder). Chips use the same rule per component. */
export function splitEven(receipt: SplitReceipt, tip: TipChoice, participants: PersonId[], holder: PersonId): Share[] {
  if (participants.length === 0) return [];
  const t = receiptTotals(receipt, tip);
  const ones = participants.map(() => 1);
  const h = holderIdx(participants, holder);
  return mkShares(participants,
    allocate(t.subtotalCents, ones, h), allocate(t.taxCents, ones, h), allocate(t.feesCents, ones, h), allocate(t.tipCents, ones, h), allocate(t.discountCents, ones, h),
    allocate(t.grandCents, ones, h));
}

/* ─────────────────────────── exact ─────────────────────────── */

export type ExactResult = { shares: Share[] } | { remaining: Cents };

/**
 * Each person's total is exactly what was entered. Food, tax and fees are shown in
 * proportion to the amounts; tip is whatever is left of each total.
 * `remaining` > 0 means short of the grand total, < 0 means over.
 */
export function splitExact(amounts: Record<PersonId, Cents>, receipt: SplitReceipt, tip: TipChoice, holder: PersonId, participants?: PersonId[]): ExactResult {
  const people = participants ?? Object.keys(amounts);
  const t = receiptTotals(receipt, tip);
  const amt = people.map((p) => { const a = amounts[p] ?? 0; assertCents(a, `amount for ${p}`); if (a < 0) throw new RangeError("amounts can't be negative"); return a; });
  const sum = amt.reduce((a, b) => a + b, 0);
  if (sum !== t.grandCents) return { remaining: t.grandCents - sum };
  const h = holderIdx(people, holder);
  const food = allocate(t.subtotalCents, amt, h), tax = allocate(t.taxCents, amt, h), fees = allocate(t.feesCents, amt, h), disc = allocate(t.discountCents, amt, h);
  const tipC = amt.map((a, i) => a - food[i]! - tax[i]! - fees[i]! - disc[i]!);
  return { shares: mkShares(people, food, tax, fees, tipC, disc, amt) };
}

/** "Split what's left evenly" on the exact screen: adds allocate(remaining, ones, holder) to everyone. */
export function fillRemainingEvenly(amounts: Record<PersonId, Cents>, remaining: Cents, participants: PersonId[], holder: PersonId): Record<PersonId, Cents> {
  if (remaining <= 0) return { ...amounts };
  const add = allocate(remaining, participants.map(() => 1), holderIdx(participants, holder));
  const out = { ...amounts };
  participants.forEach((p, i) => { out[p] = (out[p] ?? 0) + add[i]!; });
  return out;
}

/* ─────────────────────────── by item ─────────────────────────── */

export type ItemStatus = {
  item: SplitItem;
  claimers: PersonId[];
  /** Units still unclaimed (0 when fully claimed within 1e-6). */
  leftUnits: number;
  /** What's unclaimed, in cents (rounded, for display). */
  leftCents: Cents;
  fullyClaimed: boolean;
  /** Price of one unit (multi-unit lines). */
  unitCents: Cents;
  /** Cost per claimer when shared equally (single-unit lines). */
  eachCents: Cents;
  /** Exact cost per claimer. */
  cost: Record<PersonId, Rat>;
  left: Rat;
};

function claimersOf(c: Record<PersonId, number> | undefined): PersonId[] {
  return Object.keys(c ?? {}).filter((p) => (c![p] ?? 0) > UNIT_EPS);
}

/** Per-item claim state: who has it, what's left, what it costs each claimer (exact). */
export function itemStatus(item: SplitItem, claims: Record<PersonId, number> | undefined, participants?: PersonId[]): ItemStatus {
  const c = claims ?? {};
  const ids = claimersOf(c).filter((p) => !participants || participants.includes(p));
  const line = rat(BigInt(item.lineTotalCents));
  const units = ids.map((p) => fromNumber(c[p]!));
  const used = sumRat(units);
  const cost: Record<PersonId, Rat> = {};
  let left: Rat;
  if (item.quantity <= 1) {
    // equal shares among claimers, whatever weights they carry
    left = ids.length ? ZERO : line;
    ids.forEach((p, i) => { cost[p] = div(mul(line, units[i]!), used); });
  } else {
    const qty = rat(BigInt(item.quantity));
    const usedN = toNumber(used);
    const full = Math.abs(item.quantity - usedN) < UNIT_EPS || usedN > item.quantity;
    const denom = full ? used : qty;           // fully claimed: normalise so the parts are exact
    left = full ? ZERO : sub(line, div(mul(line, used), qty));
    if (cmp(left, ZERO) < 0) left = ZERO;
    ids.forEach((p, i) => { cost[p] = div(mul(line, units[i]!), denom); });
  }
  const leftUnits = item.quantity <= 1 ? (ids.length ? 0 : 1) : Math.max(0, item.quantity - toNumber(used));
  const fullyClaimed = isZero(left);
  const unitCents = item.quantity > 1 ? Math.round(item.lineTotalCents / item.quantity) : item.lineTotalCents;
  const eachCents = ids.length ? Math.round(item.lineTotalCents / ids.length) : item.lineTotalCents;
  return { item, claimers: ids, leftUnits: fullyClaimed ? 0 : leftUnits, leftCents: Number(floorRat(add(left, rat(1n, 2n)))), fullyClaimed, unitCents, eachCents, cost, left };
}

type Weights = { food: Rat[]; alcohol: Rat[]; nonAlcohol: Rat[]; unclaimed: Rat };

function foodWeights(items: SplitItem[], claims: Claims, participants: PersonId[]): Weights {
  const food = participants.map(() => ZERO), alcohol = participants.map(() => ZERO), nonAlcohol = participants.map(() => ZERO);
  let unclaimed = ZERO;
  for (const it of items) {
    const st = itemStatus(it, claims[it.id], participants);
    unclaimed = add(unclaimed, st.left);
    participants.forEach((p, i) => {
      const c = st.cost[p]; if (!c) return;
      food[i] = add(food[i]!, c);
      if (it.kind === "alcohol") alcohol[i] = add(alcohol[i]!, c); else nonAlcohol[i] = add(nonAlcohol[i]!, c);
    });
  }
  return { food, alcohol, nonAlcohol, unclaimed };
}

function taxWeights(w: Weights, appliesTo: AppliesTo | null | undefined): Rat[] {
  const pick = appliesTo === "alcohol" ? w.alcohol : appliesTo === "food" ? w.nonAlcohol : w.food;
  return pick.some(isPos) ? pick : w.food;
}

export type ByItemResult = { shares: Share[] } | { unclaimedFoodCents: Cents };

/**
 * Dishes to people. Shared dishes divide by their claimed units; tax, fees and tip
 * follow each person's share of the food (an alcohol-only tax line follows the
 * alcohol). Returns what's still unclaimed when the receipt isn't fully assigned.
 */
export function splitByItem(receipt: SplitReceipt, claims: Claims, tip: TipChoice, participants: PersonId[], holder: PersonId): ByItemResult {
  const items = effectiveItems(receipt);
  const w = foodWeights(items, claims, participants);
  if (!isZero(w.unclaimed)) return { unclaimedFoodCents: Number(floorRat(add(w.unclaimed, rat(1n, 2n)))) };
  const t = receiptTotals(receipt, tip);
  const h = holderIdx(participants, holder);
  // a fully comped meal has no food weight at all: the rest then splits evenly
  const base = w.food.some(isPos) ? w.food : participants.map(() => rat(1n));
  const food = allocate(t.subtotalCents, base, h);
  const tax = participants.map(() => 0);
  if (!t.taxIncluded) for (const c of receipt.charges) {
    if (c.kind !== "tax") continue;
    const tw = taxWeights(w, c.appliesTo);
    allocate(c.amountCents, tw.some(isPos) ? tw : base, h).forEach((v, i) => { tax[i]! += v; });
  }
  const fees = participants.map(() => 0);
  for (const c of receipt.charges) {
    if (c.kind !== "service_charge" && c.kind !== "auto_gratuity" && c.kind !== "other_fee") continue;
    allocate(c.amountCents, base, h).forEach((v, i) => { fees[i]! += v; });
  }
  const disc = participants.map(() => 0);
  for (const c of receipt.charges) {
    if (c.kind !== "discount" || c.itemId) continue;
    allocate(-Math.abs(c.amountCents), base, h).forEach((v, i) => { disc[i]! += v; });
  }
  const tipC = allocate(t.tipCents, base, h);
  return { shares: mkShares(participants, food, tax, fees, tipC, disc) };
}

export type ByItemProgress = {
  allClaimed: boolean;
  unclaimedFoodCents: Cents;
  /** Running totals while claiming: food as claimed so far, tax/fees/tip in proportion to the claimed fraction. */
  perPerson: Record<PersonId, { foodCents: Cents; taxCents: Cents; feesCents: Cents; tipCents: Cents; discountCents: Cents; totalCents: Cents; pctOfFood: number }>;
  shares: Share[] | null;
  totals: Totals;
};

/** What the Split-by-item sheet shows while tapping: exact shares once everything is claimed. */
export function byItemProgress(receipt: SplitReceipt, claims: Claims, tip: TipChoice, participants: PersonId[], holder: PersonId): ByItemProgress {
  const t = receiptTotals(receipt, tip);
  const done = splitByItem(receipt, claims, tip, participants, holder);
  const perPerson: ByItemProgress["perPerson"] = {};
  if ("shares" in done) {
    for (const s of done.shares) perPerson[s.personId] = { ...s, pctOfFood: t.subtotalCents > 0 ? (s.foodCents / t.subtotalCents) * 100 : 0 };
    return { allClaimed: true, unclaimedFoodCents: 0, perPerson, shares: done.shares, totals: t };
  }
  const items = effectiveItems(receipt);
  const w = foodWeights(items, claims, participants);
  const h = holderIdx(participants, holder);
  const claimedFrac = t.subtotalCents > 0 ? Math.max(0, Math.min(1, (t.subtotalCents - done.unclaimedFoodCents) / t.subtotalCents)) : 0;
  const scale = (c: Cents) => Math.round(c * claimedFrac);
  const food = w.food.map((x) => Math.round(toNumber(x)));
  const tax = allocate(scale(t.taxCents), w.food, h), fees = allocate(scale(t.feesCents), w.food, h), tipC = allocate(scale(t.tipCents), w.food, h), disc = allocate(scale(t.discountCents), w.food, h);
  participants.forEach((p, i) => {
    const total = food[i]! + tax[i]! + fees[i]! + tipC[i]! + disc[i]!;
    perPerson[p] = { foodCents: food[i]!, taxCents: tax[i]!, feesCents: fees[i]!, tipCents: tipC[i]!, discountCents: disc[i]!, totalCents: total, pctOfFood: t.subtotalCents > 0 ? (toNumber(w.food[i]!) / t.subtotalCents) * 100 : 0 };
  });
  return { allClaimed: false, unclaimedFoodCents: done.unclaimedFoodCents, perPerson, shares: null, totals: t };
}

/* ─────────────────────────── claim gestures ─────────────────────────── */

function cleaned(c: Record<PersonId, number>): Record<PersonId, number> {
  const out: Record<PersonId, number> = {};
  for (const k of Object.keys(c)) if ((c[k] ?? 0) > UNIT_EPS) out[k] = c[k]!;
  return out;
}

/**
 * One tap on an item with person P active. Single-unit: toggles P. Multi-unit: P takes
 * one more unit while ≥ 1 is unclaimed, the fraction that's left when < 1 is, and
 * drops out when nothing is left.
 */
export function tapItem(item: SplitItem, claims: Claims, person: PersonId): Claims {
  const c = { ...(claims[item.id] ?? {}) };
  if (item.quantity <= 1) {
    if (c[person]) delete c[person]; else c[person] = 1;
  } else {
    const used = Object.values(c).reduce((a, b) => a + b, 0);
    const rem = item.quantity - used;
    if (rem >= 1 - UNIT_EPS) c[person] = (c[person] ?? 0) + 1;
    else if (rem > UNIT_EPS) c[person] = (c[person] ?? 0) + rem;
    else if (c[person]) delete c[person];
  }
  return { ...claims, [item.id]: cleaned(c) };
}

/** Tap with "Everyone" active: an equal share for all, or cleared if it already is one. */
export function tapItemEveryone(item: SplitItem, claims: Claims, participants: PersonId[]): Claims {
  const c = claims[item.id] ?? {};
  const n = participants.length;
  const share = item.quantity <= 1 ? 1 : item.quantity / n;
  const allEven = n > 0 && participants.every((p) => Math.abs((c[p] ?? 0) - share) < UNIT_EPS) && Object.keys(cleaned(c)).length === n;
  const next: Record<PersonId, number> = {};
  if (!allEven) participants.forEach((p) => { next[p] = share; });
  return { ...claims, [item.id]: next };
}

/** "Split the rest evenly" between `selected`: fills only what's unclaimed. */
export function splitRestEvenly(items: SplitItem[], claims: Claims, selected: PersonId[]): Claims {
  const k = selected.length;
  if (k === 0) return claims;
  const next: Claims = { ...claims };
  for (const it of items) {
    const st = itemStatus(it, claims[it.id]);
    if (st.fullyClaimed) continue;
    const c = { ...(claims[it.id] ?? {}) };
    if (it.quantity <= 1) selected.forEach((p) => { c[p] = 1; });
    else {
      const used = Object.values(c).reduce((a, b) => a + b, 0);
      const each = (it.quantity - used) / k;
      selected.forEach((p) => { c[p] = (c[p] ?? 0) + each; });
    }
    next[it.id] = c;
  }
  return next;
}

/** Default pick for the split-the-rest sheet: everyone who hasn't claimed anything yet, else everyone. */
export function defaultRestSelection(items: SplitItem[], claims: Claims, participants: PersonId[]): PersonId[] {
  const has = new Set<PersonId>();
  for (const it of items) for (const p of claimersOf(claims[it.id])) has.add(p);
  const fresh = participants.filter((p) => !has.has(p));
  return fresh.length ? fresh : [...participants];
}

/** The person with the smallest positive food share (the Summary's worked example). */
export function smallestFoodShare(shares: Share[]): Share | null {
  const pos = shares.filter((s) => s.foodCents > 0);
  if (!pos.length) return null;
  return pos.reduce((a, b) => (b.foodCents < a.foodCents ? b : a));
}

/** How the bill splits as a whole; tells the Summary which method fits a stored expense. */
export function isReceiptSplit(splitType: string): splitType is "equal" | "exact" | "itemized" {
  return splitType === "equal" || splitType === "exact" || splitType === "itemized";
}
