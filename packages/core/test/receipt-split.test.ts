/**
 * Itemized receipt splitting: the El Faro golden tests (expected results to the cent
 * for all three methods), the leftover-cent rule, and property tests across random
 * receipts, 1–12 people and random claims (RECEIPT_SPLIT_PROMPT, Part 2).
 */
import fc from "fast-check";
import { describe, expect, it } from "vitest";
import fixture from "../../../design/receipt/fixtures/el-faro.json";
import {
  allocate,
  byItemProgress,
  computeTip,
  decimalToCents,
  defaultRestSelection,
  effectiveItems,
  fillRemainingEvenly,
  itemStatus,
  normalizeExtraction,
  receiptTotals,
  reconcile,
  splitByItem,
  splitEven,
  splitExact,
  splitRestEvenly,
  tapItem,
  tapItemEveryone,
  tipPercentOf,
  unitsToFraction,
  type Claims,
  type Extraction,
  type Share,
  type SplitReceipt,
} from "../src";

/* ───────────── the worked example ───────────── */

const receipt: SplitReceipt = {
  items: fixture.receipt.items.map((it) => ({ id: it.id, name: it.name, quantity: it.quantity, lineTotalCents: it.line_total_cents, kind: it.kind as "food" | "alcohol" })),
  charges: fixture.receipt.tax_lines.map((t) => ({ kind: "tax" as const, label: t.label, amountCents: t.amount_cents, appliesTo: "all" as const })),
  subtotalCents: fixture.receipt.subtotal_cents,
};
const people = fixture.participants; // you, pp, mc, jt
const tip20 = { mode: "percent" as const, percent: 20 };
const byId = (shares: Share[]) => Object.fromEntries(shares.map((s) => [s.personId, { food: s.foodCents, tax: s.taxCents, tip: s.tipCents, total: s.totalCents }]));
const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0);

describe("El Faro Cantina (golden)", () => {
  it("tip and grand total: 20% of $144.00 food = $28.80, total $184.68", () => {
    const t = receiptTotals(receipt, tip20);
    expect(t.subtotalCents).toBe(14400);
    expect(t.taxCents).toBe(1188);
    expect(t.tipCents).toBe(2880);
    expect(t.grandCents).toBe(fixture.grand_total_cents);
  });
  it("custom tip of $26.00 → $181.88 and 18.1% of food", () => {
    const t = receiptTotals(receipt, { mode: "custom", customCents: 2600 });
    expect(t.grandCents).toBe(fixture.custom_tip_example.expected_grand_total_cents);
    expect(tipPercentOf(t.tipCents, t.subtotalCents)).toBe(fixture.custom_tip_example.expected_percent_of_subtotal);
  });
  it("even: $46.17 each (36.00 / 2.97 / 7.20)", () => {
    expect(byId(splitEven(receipt, tip20, people, "you"))).toEqual(fixture.expected.even.shares);
  });
  it("exact: $50 / $50 / $50 / $34.68 with food and tax in proportion, tip the remainder", () => {
    const r = splitExact(fixture.expected.exact.amounts_cents, receipt, tip20, "you", people);
    expect("shares" in r).toBe(true);
    if ("shares" in r) expect(byId(r.shares)).toEqual(fixture.expected.exact.shares);
  });
  it("exact: short or over reports the remaining amount", () => {
    expect(splitExact({ you: 6000, pp: 5000, mc: 5000, jt: 0 }, receipt, tip20, "you", people)).toEqual({ remaining: 2468 });
    expect(splitExact({ you: 6000, pp: 6000, mc: 6000, jt: 2000 }, receipt, tip20, "you", people)).toEqual({ remaining: -1532 });
  });
  it("by item: Jordan has the guac + 1 Pacifico, the rest split evenly by You, Priya and Mike", () => {
    const start: Claims = { guac: { jt: 1 }, pac: { jt: 1 } };
    const partial = splitByItem(receipt, start, tip20, people, "you");
    expect(partial).toEqual({ unclaimedFoodCents: 12400 });
    const claims = splitRestEvenly(effectiveItems(receipt), start, fixture.expected.by_item.split_rest_evenly_between);
    const r = splitByItem(receipt, claims, tip20, people, "you");
    expect("shares" in r).toBe(true);
    if ("shares" in r) expect(byId(r.shares)).toEqual(fixture.expected.by_item.shares);
  });
  it("by item progress matches the board's running totals for the Jordan start state", () => {
    const p = byItemProgress(receipt, { guac: { jt: 1 }, pac: { jt: 1 } }, tip20, people, "you");
    expect(p.allClaimed).toBe(false);
    expect(p.unclaimedFoodCents).toBe(12400);
    expect(p.perPerson.jt).toMatchObject({ foodCents: 2000, taxCents: 165, tipCents: 400, totalCents: 2565 });
    expect(p.perPerson.jt!.pctOfFood.toFixed(1)).toBe("13.9");
    expect(p.perPerson.you!.totalCents).toBe(0);
  });
  it("split-the-rest takes three taps or fewer and defaults to whoever has nothing yet", () => {
    const start: Claims = { guac: { jt: 1 }, pac: { jt: 1 } };
    expect(defaultRestSelection(effectiveItems(receipt), start, people)).toEqual(["you", "pp", "mc"]);
    expect(defaultRestSelection(effectiveItems(receipt), { guac: { you: 1, pp: 1, mc: 1, jt: 1 } }, people)).toEqual(people);
  });
});

/* ───────────── allocate and the leftover cent ───────────── */

describe("allocate", () => {
  it("floors every share and hands the leftover to the holder", () => {
    expect(allocate(10_000, [1, 1, 1], 0)).toEqual([3334, 3333, 3333]);
    expect(allocate(10_000, [1, 1, 1], 2)).toEqual([3333, 3333, 3334]);
  });
  it("holder with zero weight: leftover goes to the first positive weight", () => {
    expect(allocate(10_000, [0, 1, 1], 0)).toEqual([0, 5000, 5000]);
    expect(allocate(10_001, [0, 1, 1], 0)).toEqual([0, 5001, 5000]);
  });
  it("fractional weights don't drift: 12400/3 three ways", () => {
    const w = [12400 / 3, 12400 / 3, 12400 / 3, 2000];
    expect(allocate(14400, w, 0)).toEqual([4134, 4133, 4133, 2000]);
    expect(allocate(300, [1 / 3, 1 / 3, 1 / 3], 0)).toEqual([100, 100, 100]);
  });
  it("negative totals (discounts) allocate on the magnitude", () => {
    expect(allocate(-301, [1, 1, 1], 1)).toEqual([-100, -101, -100]);
  });
  it("all-zero weights give zeros", () => {
    expect(allocate(500, [0, 0], 0)).toEqual([0, 0]);
  });
  it("recovers simple fractions from stored decimals", () => {
    expect(unitsToFraction(0.33333333)).toEqual({ n: 1n, d: 3n });
    expect(unitsToFraction(0.66666667)).toEqual({ n: 2n, d: 3n });
    expect(unitsToFraction(1.5)).toEqual({ n: 3n, d: 2n });
  });
});

describe("tip", () => {
  it("percent is on the food subtotal, rounded; custom and none pass through", () => {
    expect(computeTip(14400, "percent", 20)).toBe(2880);
    expect(computeTip(14401, "percent", 18)).toBe(2592);
    expect(computeTip(14400, "custom", null, 2600)).toBe(2600);
    expect(computeTip(14400, "none")).toBe(0);
  });
});

/* ───────────── gestures ───────────── */

describe("claim gestures", () => {
  const pac = { id: "pac", name: "Pacifico", quantity: 3, lineTotalCents: 1800 };
  const guac = { id: "guac", name: "Guac", quantity: 1, lineTotalCents: 1400 };
  it("single-unit items toggle", () => {
    let c = tapItem(guac, {}, "pp"); expect(c.guac).toEqual({ pp: 1 });
    c = tapItem(guac, c, "pp"); expect(c.guac).toEqual({});
  });
  it("multi-unit items hand out one unit at a time, then the fraction, then drop", () => {
    let c = tapItem(pac, {}, "jt"); expect(c.pac).toEqual({ jt: 1 });
    c = tapItem(pac, c, "jt"); expect(c.pac).toEqual({ jt: 2 });
    c = tapItem(pac, c, "pp"); expect(c.pac).toEqual({ jt: 2, pp: 1 });
    c = tapItem(pac, c, "pp"); expect(c.pac).toEqual({ jt: 2 });
    const half = splitRestEvenly([pac], { pac: { jt: 2.5 } }, ["pp", "mc"]);
    expect(half.pac).toEqual({ jt: 2.5, pp: 0.25, mc: 0.25 });
    expect(itemStatus(pac, half.pac).fullyClaimed).toBe(true);
  });
  it("Everyone sets an equal share, or clears when it already is one", () => {
    const all = tapItemEveryone(pac, {}, people);
    expect(all.pac).toEqual({ you: 0.75, pp: 0.75, mc: 0.75, jt: 0.75 });
    expect(tapItemEveryone(pac, all, people).pac).toEqual({});
    expect(tapItemEveryone(guac, { guac: { jt: 1 } }, people).guac).toEqual({ you: 1, pp: 1, mc: 1, jt: 1 });
  });
  it("item status reports sub-line facts", () => {
    const st = itemStatus(pac, { jt: 1 });
    expect(st).toMatchObject({ claimers: ["jt"], leftUnits: 2, leftCents: 1200, fullyClaimed: false, unitCents: 600 });
    const g = itemStatus(guac, { you: 1, pp: 1, mc: 1 });
    expect(g).toMatchObject({ eachCents: 467, fullyClaimed: true, leftCents: 0 });
  });
});

/* ───────────── exact helpers ───────────── */

describe("exact split helpers", () => {
  it("split what's left evenly adds allocate(remaining, ones, holder)", () => {
    expect(fillRemainingEvenly({ you: 6000, pp: 5000, mc: 5000, jt: 0 }, 2468, people, "you")).toEqual({ you: 6617, pp: 5617, mc: 5617, jt: 617 });
  });
});

/* ───────────── discounts, fees, alcohol tax, VAT ───────────── */

describe("charges", () => {
  const bar: SplitReceipt = {
    items: [
      { id: "a", name: "Burger", quantity: 1, lineTotalCents: 1500, kind: "food" },
      { id: "b", name: "IPA", quantity: 2, lineTotalCents: 1600, kind: "alcohol" },
      { id: "c", name: "Fries", quantity: 1, lineTotalCents: 600, kind: "food" },
    ],
    charges: [
      { kind: "tax", label: "Sales tax", amountCents: 200, appliesTo: "all" },
      { kind: "tax", label: "Liquor tax", amountCents: 160, appliesTo: "alcohol" },
      { kind: "service_charge", label: "Service 18%", amountCents: 666 },
      { kind: "discount", label: "Happy hour", amountCents: -400, itemId: "b" },
      { kind: "discount", label: "Coupon", amountCents: -300, itemId: null },
    ],
    subtotalCents: 3300, // 1500 + (1600 − 400) + 600
  };
  it("an item-tied discount reduces that line; other discounts allocate by food weight as negatives", () => {
    expect(effectiveItems(bar).find((i) => i.id === "b")!.lineTotalCents).toBe(1200);
    const t = receiptTotals(bar, { mode: "none" });
    expect(t).toMatchObject({ subtotalCents: 3300, taxCents: 360, feesCents: 666, discountCents: -300, tipCents: 0, grandCents: 4026 });
  });
  it("alcohol-only tax follows the alcohol; fees follow the food", () => {
    const r = splitByItem(bar, { a: { x: 1 }, b: { y: 2 }, c: { x: 1 } }, { mode: "none" }, ["x", "y"], "x");
    expect("shares" in r).toBe(true);
    if (!("shares" in r)) return;
    const [x, y] = r.shares;
    expect(x!.foodCents + y!.foodCents).toBe(3300);
    expect(y!.taxCents).toBe(160 + Math.floor((200 * 1200) / 3300)); // all the liquor tax plus their share of sales tax
    expect(x!.discountCents + y!.discountCents).toBe(-300);
    expect(sum(r.shares.map((s) => s.totalCents))).toBe(4026);
  });
  it("VAT-inclusive receipts: tax is 0 and the food is the total", () => {
    const vat: SplitReceipt = { items: [{ id: "a", name: "Tapas", quantity: 1, lineTotalCents: 2000 }], charges: [{ kind: "tax", label: "IVA 10%", amountCents: 182 }], subtotalCents: 2000, taxIncluded: true };
    const t = receiptTotals(vat, { mode: "percent", percent: 10 });
    expect(t).toMatchObject({ taxCents: 0, subtotalCents: 2000, grandCents: 2200 });
  });
});

/* ───────────── extraction normalisation and reconciliation ───────────── */

describe("extraction", () => {
  const base: Extraction = {
    readable: true, merchant: "El Faro Cantina", date: "2026-10-11", currency: "USD",
    items: fixture.receipt.items.map((it) => ({ raw_text: it.name.toUpperCase(), name: it.name, quantity: it.quantity, unit_price: null, line_total: (it.line_total_cents / 100).toFixed(2), kind: it.kind as "food", modifiers: [], is_void: false, confidence: "high" as const })),
    subtotal: "144.00", tax_lines: [{ label: "TAX 8.25%", amount: "11.88", applies_to: "all" }], fees: [], discounts: [], total: "155.88", tip_printed: null, tax_included_in_prices: false, confidence: "high", notes: null,
  };
  it("parses decimal strings as printed", () => {
    expect(decimalToCents("12.50")).toBe(1250);
    expect(decimalToCents("-3.00")).toBe(-300);
    expect(decimalToCents("1,234.5")).toBe(123450);
    expect(decimalToCents("(2.00)")).toBe(-200);
    expect(decimalToCents("abc")).toBeNull();
  });
  it("El Faro reconciles", () => {
    const n = normalizeExtraction(base);
    const r = reconcile(n);
    expect(r.ok).toBe(true);
    expect(r).toMatchObject({ subtotalDiffCents: 0, totalDiffCents: 0, subtotalCents: 14400, totalCents: 15588 });
  });
  it("a misread line fails reconciliation and is flagged", () => {
    const bad = { ...base, items: base.items.map((it, i) => (i === 2 ? { ...it, line_total: "61.00", confidence: "low" as const } : it)) };
    const r = reconcile(normalizeExtraction(bad));
    expect(r.ok).toBe(false);
    expect(r.suspectPosition).toBe(2);
  });
  it("unreadable throws", () => {
    expect(() => normalizeExtraction({ ...base, readable: false })).toThrow(/unreadable/);
  });
});

/* ───────────── property tests ───────────── */

const arbItem = (i: number) => fc.record({
  quantity: fc.integer({ min: 1, max: 4 }),
  lineTotalCents: fc.integer({ min: 1, max: 20_000 }),
  kind: fc.constantFrom("food", "drink", "alcohol", "other"),
}).map((x) => ({ id: `i${i}`, name: `Item ${i}`, ...x }));

const arbReceipt = fc.integer({ min: 1, max: 12 }).chain((n) =>
  fc.tuple(
    fc.tuple(...Array.from({ length: n }, (_, i) => arbItem(i))),
    fc.array(fc.record({ amountCents: fc.integer({ min: 0, max: 3000 }), appliesTo: fc.constantFrom("all", "alcohol", "food", "unknown") }), { maxLength: 2 }),
    fc.option(fc.integer({ min: 0, max: 5000 }), { nil: undefined }),
    fc.option(fc.record({ amountCents: fc.integer({ min: 1, max: 1500 }), itemIndex: fc.option(fc.integer({ min: 0, max: n - 1 }), { nil: null }) }), { nil: undefined }),
    fc.oneof(fc.record({ mode: fc.constant("percent" as const), percent: fc.constantFrom(0, 15, 18, 20, 22, 25) }), fc.record({ mode: fc.constant("custom" as const), customCents: fc.integer({ min: 0, max: 10_000 }) }), fc.constant({ mode: "none" as const })),
  ).map(([items, taxes, fee, discount, tip]) => {
    const list = [...items];
    const charges: SplitReceipt["charges"] = taxes.map((t) => ({ kind: "tax" as const, ...t }));
    if (fee != null) charges.push({ kind: "service_charge", amountCents: fee });
    if (discount) {
      const tied = discount.itemIndex != null ? list[discount.itemIndex]! : null;
      // keep every line non-negative after an item-tied discount
      charges.push({ kind: "discount", amountCents: -(tied ? Math.min(discount.amountCents, tied.lineTotalCents) : discount.amountCents), itemId: tied ? tied.id : null });
    }
    const receipt: SplitReceipt = { items: list, charges };
    return { receipt, tip: tip as { mode: "percent" | "custom" | "none"; percent?: number; customCents?: number } };
  }),
);

const arbPeople = fc.integer({ min: 1, max: 12 }).map((n) => Array.from({ length: n }, (_, i) => `p${i}`));

/** Random claims: each item claimed by some subset (single units) or by unit counts, then the rest split evenly by a random non-empty subset. */
function arbClaims(items: SplitReceipt["items"], people: string[]) {
  return fc.tuple(
    fc.tuple(...items.map((it) => fc.array(fc.constantFrom(...people), { maxLength: Math.min(people.length, it.quantity > 1 ? it.quantity : 3) }))),
    fc.subarray(people, { minLength: 1 }),
  ).map(([picks, rest]) => {
    let claims: Claims = {};
    items.forEach((it, i) => {
      for (const p of picks[i]!) claims = tapItem(it, claims, p);
    });
    return splitRestEvenly(items, claims, rest);
  });
}

describe("properties (≥ 1,000 random receipts)", () => {
  it("every method adds up to the grand total exactly, with no negative share unless a discount exceeds someone's food", () => {
    fc.assert(fc.property(arbReceipt, arbPeople, fc.nat(), ({ receipt, tip }, people, h) => {
      const holder = people[h % people.length]!;
      const t = receiptTotals(receipt, tip);
      const even = splitEven(receipt, tip, people, holder);
      expect(sum(even.map((s) => s.totalCents))).toBe(t.grandCents);
      even.forEach((s) => expect(s.totalCents).toBeGreaterThanOrEqual(0));
      return true;
    }), { numRuns: 400 });
  });
  it("by item: shares sum exactly, zero-weight people get 0, and only the leftover moves with the holder", () => {
    fc.assert(fc.property(arbReceipt.chain((rt) => arbPeople.chain((people) => arbClaims(rt.receipt.items, people).map((claims) => ({ ...rt, people, claims })))), fc.nat(), fc.nat(), ({ receipt, tip, people, claims }, h, seed) => {
      const holder = people[h % people.length]!;
      const t = receiptTotals(receipt, tip);
      const r = splitByItem(receipt, claims, tip, people, holder);
      expect("shares" in r).toBe(true);
      if (!("shares" in r)) return false;
      expect(sum(r.shares.map((s) => s.totalCents))).toBe(t.grandCents);
      const food = new Map(r.shares.map((s) => [s.personId, s.foodCents]));
      // zero-weight = claimed nothing (a positive weight can still floor to $0.00 of food on a tiny line)
      const claimed = new Set(Object.values(claims).flatMap((c) => Object.keys(c).filter((p) => (c[p] ?? 0) > 1e-6)));
      const anyFood = receipt.items.some((it) => effectiveItems(receipt).find((e) => e.id === it.id)!.lineTotalCents > 0); // a fully comped meal splits the rest evenly instead
      for (const s of r.shares) {
        if (!claimed.has(s.personId) && anyFood) { expect(s.foodCents).toBe(0); expect(s.taxCents).toBe(0); expect(s.tipCents).toBe(0); expect(s.feesCents).toBe(0); }
        if (s.discountCents === 0) expect(s.totalCents).toBeGreaterThanOrEqual(0);
      }
      // reorder people: identical per-person shares when the holder has food; otherwise the multiset is the same
      const shuffled = [...people].sort((a, b) => ((seed % 7) * a.charCodeAt(1) - b.charCodeAt(1)) || a.localeCompare(b));
      const r2 = splitByItem(receipt, claims, tip, shuffled, holder);
      if (!("shares" in r2)) return false;
      if ((food.get(holder) ?? 0) > 0) for (const s of r2.shares) expect(s.totalCents).toBe(r.shares.find((x) => x.personId === s.personId)!.totalCents);
      else {
        // the leftover cents move from the old first participant to the new one, and nothing else changes
        // (each allocation - food, every tax/fee/discount line, tip - may hand its own leftover to a different "first" person)
        const moved = r2.shares.filter((s) => s.totalCents !== r.shares.find((x) => x.personId === s.personId)!.totalCents);
        expect(sum(moved.map((s) => s.totalCents - r.shares.find((x) => x.personId === s.personId)!.totalCents))).toBe(0);
        for (const s of moved) expect(Math.abs(s.totalCents - r.shares.find((x) => x.personId === s.personId)!.totalCents)).toBeLessThanOrEqual((2 + receipt.charges.length) * Math.max(1, people.length - 1)); // ≤ (n−1) leftover cents per allocation: food, each charge, tip
      }
      return true;
    }), { numRuns: 400 });
  });
  it("exact: entered amounts are returned verbatim and the breakdown adds back to each total", () => {
    fc.assert(fc.property(arbReceipt, arbPeople, fc.nat(), ({ receipt, tip }, people, h) => {
      const t = receiptTotals(receipt, tip);
      const holder = people[h % people.length]!;
      const base = allocate(t.grandCents, people.map((_, i) => (i % 3) + 1), 0);
      const amounts = Object.fromEntries(people.map((p, i) => [p, base[i]!]));
      const r = splitExact(amounts, receipt, tip, holder, people);
      expect("shares" in r).toBe(true);
      if (!("shares" in r)) return false;
      for (const s of r.shares) {
        expect(s.totalCents).toBe(amounts[s.personId]);
        expect(s.foodCents + s.taxCents + s.feesCents + s.tipCents + s.discountCents).toBe(s.totalCents);
      }
      return true;
    }), { numRuns: 300 });
  });
});
