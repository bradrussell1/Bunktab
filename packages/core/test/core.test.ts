/**
 * The part where a bug costs people real money, tested in isolation (spec:
 * Build order). Every example in the spec is a test here.
 */
import { describe, expect, it } from "vitest";
import {
  CATEGORIES,
  centsToDecimalString,
  closeoutUnlocked,
  computeNets,
  computeNightsShares,
  computeShares,
  convertSharesToBase,
  divideByWeights,
  divideEvenly,
  formatCents,
  fullPresence,
  isLodgingCategory,
  isValidCategory,
  isValidVenmoUsername,
  nightsBetween,
  parseToCents,
  settle,
  settlementPlan,
  SplitError,
  toBaseCents,
  validatePayers,
  venmoChargeLink,
  venmoNote,
  venmoPayLink,
  venmoProfileUrl,
} from "../src";

describe("money", () => {
  it("divides evenly to the cent and hands the remainder to the first parts", () => {
    expect(divideEvenly(12_000, 4)).toEqual([3000, 3000, 3000, 3000]);
    expect(divideEvenly(10_000, 3)).toEqual([3334, 3333, 3333]);
    expect(divideEvenly(1, 3)).toEqual([1, 0, 0]);
    expect(divideEvenly(-10_000, 3)).toEqual([-3334, -3333, -3333]);
  });
  it("divides by weights with largest remainders, summing exactly", () => {
    expect(divideByWeights(10_000, [50, 25, 25])).toEqual([5000, 2500, 2500]);
    expect(divideByWeights(10_000, [1, 1, 1])).toEqual([3334, 3333, 3333]);
    expect(divideByWeights(101, [1, 1, 1]).reduce((a, b) => a + b, 0)).toBe(101);
  });
  it("formats and parses", () => {
    expect(formatCents(8450)).toBe("$84.50");
    expect(formatCents(-1200)).toBe("-$12.00");
    expect(centsToDecimalString(8450)).toBe("84.50");
    expect(centsToDecimalString(5)).toBe("0.05");
    expect(parseToCents("$1,200.5")).toBe(120_050);
    expect(parseToCents("abc")).toBeNull();
  });
  it("refuses non-integer cents", () => {
    expect(() => divideEvenly(10.5, 2)).toThrow(RangeError);
  });
});

describe("split types", () => {
  const people = ["apollo", "sam", "mike", "jen"];
  it("equal: $120 dinner, 4 people, $30 each", () => {
    expect(computeShares({ type: "equal", amountCents: 12_000, participants: people, payerIds: ["apollo"] })).toEqual({ apollo: 3000, sam: 3000, mike: 3000, jen: 3000 });
  });
  it("equal: leftover cents go to the payer", () => {
    const s = computeShares({ type: "equal", amountCents: 10_000, participants: people.slice(0, 3), payerIds: ["mike"] });
    expect(s).toEqual({ mike: 3334, apollo: 3333, sam: 3333 });
    expect(Object.values(s).reduce((a, b) => a + b, 0)).toBe(10_000);
  });
  it("exact: groceries $40, $25, $35 must sum to the total", () => {
    expect(computeShares({ type: "exact", amountCents: 10_000, participants: ["a", "b", "c"], payerIds: ["a"], exactCents: { a: 4000, b: 2500, c: 3500 } })).toEqual({ a: 4000, b: 2500, c: 3500 });
    expect(() => computeShares({ type: "exact", amountCents: 10_000, participants: ["a", "b"], payerIds: ["a"], exactCents: { a: 4000, b: 2500 } })).toThrow(SplitError);
  });
  it("percent: car rental 50/25/25, must sum to 100", () => {
    expect(computeShares({ type: "percent", amountCents: 30_000, participants: ["a", "b", "c"], payerIds: ["a"], percents: { a: 50, b: 25, c: 25 } })).toEqual({ a: 15_000, b: 7500, c: 7500 });
    expect(() => computeShares({ type: "percent", amountCents: 100, participants: ["a", "b"], payerIds: ["a"], percents: { a: 60, b: 50 } })).toThrow(/100%/);
  });
  it("shares: gas, 2 shares for the driver's family, 1 for others", () => {
    expect(computeShares({ type: "shares", amountCents: 8000, participants: ["driver", "b", "c"], payerIds: ["driver"], shares: { driver: 2, b: 1, c: 1 } })).toEqual({ driver: 4000, b: 2000, c: 2000 });
  });
  it("payers: several must add up to the amount", () => {
    expect(() => validatePayers(10_000, { a: 6000, b: 4000 })).not.toThrow();
    expect(() => validatePayers(10_000, { a: 6000, b: 3000 })).toThrow(SplitError);
    expect(() => validatePayers(10_000, {})).toThrow(SplitError);
  });
});

describe("lodging nights", () => {
  it("the spec's example: $1,200, 3 nights; four stay Fri+Sat, two stay Sun", () => {
    const presence = { a: [true, true, true], b: [true, true, true], c: [true, true, false], d: [true, true, false] };
    const r = computeNightsShares({ amountCents: 120_000, nights: 3, presence, payerIds: ["a"] });
    expect(r.perNightCents).toEqual([40_000, 40_000, 40_000]);
    expect(r.shares).toEqual({ a: 40_000, b: 40_000, c: 20_000, d: 20_000 });
    expect(Object.values(r.shares).reduce((x, y) => x + y, 0)).toBe(120_000);
    expect(r.nightsStayed).toEqual({ a: 3, b: 3, c: 2, d: 2 });
  });
  it("defaults everyone to every night and counts nights between dates", () => {
    expect(fullPresence(["a", "b"], 2)).toEqual({ a: [true, true], b: [true, true] });
    expect(nightsBetween("2026-10-02", "2026-10-05")).toBe(3);
    expect(nightsBetween("2026-10-05", "2026-10-02")).toBe(0);
  });
  it("refuses a night nobody stayed", () => {
    expect(() => computeNightsShares({ amountCents: 100, nights: 1, presence: { a: [false] }, payerIds: ["a"] })).toThrow(/Nobody/);
  });
});

describe("settlement", () => {
  it("the spec's worked example: three payments for four people", () => {
    const payments = settle({ apollo: 15_000, sam: 3000, mike: -10_000, jen: -8000 });
    expect(payments).toEqual([
      { from: "mike", to: "apollo", cents: 10_000 },
      { from: "jen", to: "apollo", cents: 5000 },
      { from: "jen", to: "sam", cents: 3000 },
    ]);
  });
  it("never needs more than N − 1 payments and always balances", () => {
    const nets = { a: 12_345, b: -1, c: -6172, d: -6172, e: 0 };
    const p = settle(nets);
    expect(p.length).toBeLessThanOrEqual(4);
    const check: Record<string, number> = { ...nets };
    for (const x of p) { check[x.from]! += x.cents; check[x.to]! -= x.cents; }
    expect(Object.values(check).every((v) => v === 0)).toBe(true);
  });
  it("nets from payers minus shares, ignoring soft-deleted expenses", () => {
    const nets = computeNets([
      { id: "1", payers: { a: 12_000 }, shares: { a: 3000, b: 3000, c: 3000, d: 3000 } },
      { id: "2", payers: { b: 4000 }, shares: { a: 2000, b: 2000 } },
      { id: "3", payers: { c: 99_999 }, shares: { a: 99_999 }, deleted: true },
    ], ["a", "b", "c", "d"]);
    expect(nets).toEqual({ a: 7000, b: -1000, c: -3000, d: -3000 });
    const plan = settlementPlan([{ id: "1", payers: { a: 100 }, shares: { a: 50, b: 50 } }], ["a", "b"]);
    expect(plan.payments).toEqual([{ from: "b", to: "a", cents: 50 }]);
  });
  it("refuses nets that don't sum to zero", () => {
    expect(() => settle({ a: 1 })).toThrow(RangeError);
  });
  it("the Done gate needs every active member", () => {
    expect(closeoutUnlocked([{ doneAt: "x" }, { doneAt: "y" }])).toBe(true);
    expect(closeoutUnlocked([{ doneAt: "x" }, { doneAt: null }])).toBe(false);
    expect(closeoutUnlocked([{ doneAt: "x" }, { doneAt: null, removedAt: "z" }])).toBe(true);
    expect(closeoutUnlocked([])).toBe(false);
  });
});

describe("venmo links", () => {
  it("builds the app link and the web fallback with the same fields", () => {
    const l = venmoPayLink("mike-r", 8450, "Tahoe 2026");
    expect(l.app).toBe("venmo://paycharge?txn=pay&recipients=mike-r&amount=84.50&note=Tahoe+2026+-+settled+via+Checkm8");
    expect(l.web).toBe("https://venmo.com/?txn=pay&recipients=mike-r&amount=84.50&note=Tahoe+2026+-+settled+via+Checkm8");
    expect(venmoPayLink("@mike-r", 100, "t").app).toContain("recipients=mike-r");
  });
  it("charge from everyone lists several recipients", () => {
    expect(venmoChargeLink(["a", "b"], 3000, "Trip").app).toContain("txn=charge&recipients=a%2Cb&amount=30.00");
  });
  it("keeps the note within 280 characters and validates usernames", () => {
    expect(venmoNote("x".repeat(300)).length).toBe(280);
    expect(venmoNote("Tahoe")).toBe("Tahoe - settled via Checkm8");
    expect(isValidVenmoUsername("mike-r_1")).toBe(true);
    expect(isValidVenmoUsername("ab")).toBe(false);
    expect(venmoProfileUrl("@Mike R")).toBe("https://venmo.com/u/Mike%20R");
  });
});

describe("categories and currency", () => {
  it("is the fixed two-level list", () => {
    expect(CATEGORIES.map((c) => c.label)).toEqual(["Travel & Lodging", "Dining, Food, Beverage", "Groceries", "Beer, Wine, Spirits", "Transportation", "Recreation", "Other"]);
    expect(isValidCategory("groceries", null)).toBe(true);
    expect(isValidCategory("groceries", "x")).toBe(false);
    expect(isValidCategory("travel", null)).toBe(false);
    expect(isLodgingCategory("travel", "hotels")).toBe(true);
    expect(isLodgingCategory("travel", "airfare")).toBe(false);
  });
  it("locks a rate and keeps base shares summing to the base total", () => {
    expect(toBaseCents(10_000, 1.0842)).toBe(10_842);
    const base = convertSharesToBase({ a: 3333, b: 3333, c: 3334 }, 1.0842);
    expect(Object.values(base).reduce((x, y) => x + y, 0)).toBe(10_842);
    expect(() => toBaseCents(1, 0)).toThrow(RangeError);
  });
});
