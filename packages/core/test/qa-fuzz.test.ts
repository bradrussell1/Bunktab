/**
 * QA Agent B · property/fuzz tests for the money-moving core. Every run uses a
 * seeded PRNG so a failure is reproducible from the printed seed.
 */
import { describe, expect, it } from "vitest";
import { computeNets, computeNightsShares, computeShares, convertSharesToBase, divideByWeights, divideEvenly, settle, toBaseCents } from "../src";

function rng(seed: number) { let s = seed >>> 0; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 2 ** 32; }; }
const SEED = Number(process.env.QA_SEED ?? 20261001);
const R = rng(SEED);
const int = (lo: number, hi: number) => lo + Math.floor(R() * (hi - lo + 1));
const ids = (n: number) => Array.from({ length: n }, (_, i) => `u${i}`);
const sum = (o: Record<string, number>) => Object.values(o).reduce((a, b) => a + b, 0);

describe(`core fuzz (seed ${SEED})`, () => {
  it("divideEvenly / divideByWeights always sum to the total with whole non-negative cents", () => {
    for (let k = 0; k < 2000; k++) {
      const total = int(0, 5_000_000), n = int(1, 25);
      const parts = divideEvenly(total, n);
      expect(parts.reduce((a, b) => a + b, 0)).toBe(total);
      expect(parts.every((p) => Number.isInteger(p) && p >= 0)).toBe(true);
      expect(Math.max(...parts) - Math.min(...parts)).toBeLessThanOrEqual(1);
      const weights = Array.from({ length: n }, () => int(0, 1000) / (R() < 0.3 ? 7 : 1));
      if (weights.reduce((a, b) => a + b, 0) <= 0) continue;
      const w = divideByWeights(total, weights);
      expect(w.reduce((a, b) => a + b, 0)).toBe(total);
      expect(w.every((p) => Number.isInteger(p) && p >= 0)).toBe(true);
      const wsum = weights.reduce((a, b) => a + b, 0);
      w.forEach((p, i) => expect(Math.abs(p - (total * weights[i]!) / wsum)).toBeLessThan(1 + 1e-9));
    }
  });

  it("equal / percent / exact splits sum exactly, never negative, leftovers land on the payer", () => {
    for (let k = 0; k < 1500; k++) {
      const n = int(1, 20), people = ids(n), total = int(1, 2_000_000);
      const payer = people[int(0, n - 1)]!;
      const eq = computeShares({ type: "equal", amountCents: total, participants: people, payerIds: [payer] });
      expect(sum(eq)).toBe(total);
      expect(Object.values(eq).every((c) => c >= 0 && Number.isInteger(c))).toBe(true);
      expect(eq[payer]! >= Math.min(...Object.values(eq))).toBe(true);
      // percents that sum to 100 with two decimals
      let left = 10000; const pct: Record<string, number> = {};
      people.forEach((p, i) => { const v = i === n - 1 ? left : int(0, left); pct[p] = v / 100; left -= v; });
      const pc = computeShares({ type: "percent", amountCents: total, participants: people, payerIds: [payer], percents: pct });
      expect(sum(pc)).toBe(total);
      Object.entries(pc).forEach(([p, c]) => expect(Math.abs(c - (total * pct[p]!) / 100)).toBeLessThan(1 + 1e-9));
      // exact
      const parts = divideEvenly(total, n); const exact: Record<string, number> = {}; people.forEach((p, i) => (exact[p] = parts[i]!));
      expect(sum(computeShares({ type: "exact", amountCents: total, participants: people, payerIds: [payer], exactCents: exact }))).toBe(total);
    }
  });

  it("rejects: duplicate participants, negative exact, percent ≠ 100, non-integer amounts", () => {
    expect(() => computeShares({ type: "equal", amountCents: 100, participants: ["a", "a"], payerIds: ["a"] })).toThrow();
    expect(() => computeShares({ type: "exact", amountCents: 100, participants: ["a", "b"], payerIds: ["a"], exactCents: { a: 150, b: -50 } })).toThrow();
    expect(() => computeShares({ type: "percent", amountCents: 100, participants: ["a", "b"], payerIds: ["a"], percents: { a: 60, b: 50 } })).toThrow();
    expect(() => computeShares({ type: "equal", amountCents: 100.5, participants: ["a"], payerIds: ["a"] })).toThrow();
    expect(() => computeShares({ type: "equal", amountCents: 100, participants: [], payerIds: ["a"] })).toThrow();
  });

  it("nights splits sum to the total, every present night is charged, absent nights cost nothing", () => {
    for (let k = 0; k < 800; k++) {
      const n = int(1, 10), nights = int(1, 14), total = int(1, 3_000_000), people = ids(n);
      const presence: Record<string, boolean[]> = {};
      for (const p of people) presence[p] = Array.from({ length: nights }, () => R() < 0.7);
      for (let night = 0; night < nights; night++) if (!people.some((p) => presence[p]![night])) presence[people[0]!]![night] = true;
      const r = computeNightsShares({ amountCents: total, nights, presence, payerIds: [people[0]!] });
      expect(sum(r.shares)).toBe(total);
      expect(r.perNightCents.reduce((a, b) => a + b, 0)).toBe(total);
      for (const p of people) {
        expect(r.nightsStayed[p]).toBe(presence[p]!.filter(Boolean).length);
        if (r.nightsStayed[p] === 0) expect(r.shares[p]).toBe(0);
        else expect(r.shares[p]).toBeGreaterThanOrEqual(0);
      }
    }
    expect(() => computeNightsShares({ amountCents: 100, nights: 2, presence: { a: [true] }, payerIds: ["a"] })).toThrow();
    expect(() => computeNightsShares({ amountCents: 100, nights: 2, presence: { a: [false, false] }, payerIds: ["a"] })).toThrow();
  });

  it("settlement: payments clear every net, at most N−1 payments, no self-payments, no zero payments", () => {
    for (let k = 0; k < 1500; k++) {
      const n = int(1, 20), people = ids(n), expenses = [];
      for (let e = 0; e < int(0, 30); e++) {
        const total = int(1, 500_000), payer = people[int(0, n - 1)]!;
        const parts = people.filter(() => R() < 0.6); if (!parts.includes(payer) && R() < 0.5) parts.push(payer); if (parts.length === 0) parts.push(payer);
        const shares = computeShares({ type: "equal", amountCents: total, participants: parts, payerIds: [payer] });
        expenses.push({ id: `e${e}`, payers: { [payer]: total }, shares, deleted: R() < 0.1 });
      }
      const nets = computeNets(expenses, people);
      expect(sum(nets)).toBe(0);
      const pays = settle(nets);
      expect(pays.length).toBeLessThanOrEqual(Math.max(0, Object.values(nets).filter((c) => c !== 0).length - 1));
      const after = { ...nets };
      for (const p of pays) { expect(p.cents).toBeGreaterThan(0); expect(p.from).not.toBe(p.to); after[p.from]! += p.cents; after[p.to]! -= p.cents; }
      expect(Object.values(after).every((c) => c === 0)).toBe(true);
      // deterministic
      expect(settle(nets)).toEqual(pays);
    }
    expect(settle({ a: 0, b: 0 })).toEqual([]);
    expect(() => settle({ a: 1, b: 0 })).toThrow();
  });

  it("currency conversion keeps base shares summing to the converted total", () => {
    for (let k = 0; k < 1000; k++) {
      const n = int(1, 12), people = ids(n), total = int(1, 1_000_000), rate = int(1, 200_000) / 1000; // 0.001 … 200
      const shares = computeShares({ type: "equal", amountCents: total, participants: people, payerIds: [people[0]!] });
      const base = convertSharesToBase(shares, rate);
      expect(sum(base)).toBe(toBaseCents(total, rate));
      expect(Object.values(base).every((c) => Number.isInteger(c))).toBe(true);
    }
    expect(() => toBaseCents(100, 0)).toThrow();
    expect(() => toBaseCents(100, -1)).toThrow();
  });

  it("convertSharesToBase never produces a negative share (B-15 fixed)", () => {
    // 3 people × 1 cent each at rate 0.4 → base total 1, first two round to 0, 0 → last = 1. Fine.
    // but 2 people share [1, 1] at rate 0.3: total base = round(0.6)=1; first = round(0.3)=0; last = 1 → fine.
    // adverse case: shares [99, 1] at rate 0.005 → total base round(0.5)=1 (banker? JS rounds .5 up) ; first round(0.495)=0; last=1. ok
    // Search for any negative share:
    let negative: unknown = null;
    for (let k = 0; k < 20000 && !negative; k++) {
      const n = int(2, 6), people = ids(n), total = int(1, 2000), rate = int(1, 999) / 1000;
      const shares = computeShares({ type: "equal", amountCents: total, participants: people, payerIds: [people[0]!] });
      const base = convertSharesToBase(shares, rate);
      if (Object.values(base).some((c) => c < 0)) negative = { shares, rate, base };
    }
    // Report rather than fail: the app passes per-share base cents from the client and the server
    // folds drift onto the first row, so a negative here would surface as a negative base_share.
    expect(negative).toBeNull();
    expect(true).toBe(true);
  });
});
