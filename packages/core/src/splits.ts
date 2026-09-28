import { assertCents, divideByWeights, divideEvenly, sumCents, type Cents } from "./money";

/**
 * Split types (spec: Feature specs → Split types). Every function returns
 * whole-cent shares that sum exactly to the amount; leftover cents go to the
 * payer (the first payer, when there are several) so totals always match.
 */

export type SplitType = "equal" | "exact" | "percent" | "shares" | "nights";

export type UserId = string;

export type SplitInput = {
  /** Total to split - the receipt total plus tip, in the expense currency. */
  amountCents: Cents;
  /** Who's involved, in display order. */
  participants: UserId[];
  /** Who paid (leftover cents land on payerIds[0] when they are a participant). */
  payerIds: UserId[];
} & (
  | { type: "equal" }
  | { type: "exact"; exactCents: Record<UserId, Cents> }
  | { type: "percent"; percents: Record<UserId, number> }
  | { type: "shares"; shares: Record<UserId, number> }
);

export class SplitError extends Error {
  constructor(message: string, public readonly code: "EMPTY" | "SUM_MISMATCH" | "PERCENT_SUM" | "NEGATIVE" | "UNKNOWN_USER") {
    super(message);
    this.name = "SplitError";
  }
}

/** Move remainder cents onto the payer: shares are computed with the payer
 *  first, so the extra cents from division land on them. */
function orderWithPayerFirst(participants: UserId[], payerIds: UserId[]): UserId[] {
  const payer = payerIds.find((p) => participants.includes(p));
  if (!payer) return participants;
  return [payer, ...participants.filter((p) => p !== payer)];
}

export function computeShares(input: SplitInput): Record<UserId, Cents> {
  assertCents(input.amountCents, "amount");
  const people = input.participants;
  if (people.length === 0) throw new SplitError("Pick at least one person.", "EMPTY");
  if (new Set(people).size !== people.length) throw new SplitError("A person is listed twice.", "UNKNOWN_USER");
  const ordered = orderWithPayerFirst(people, input.payerIds);
  const out: Record<UserId, Cents> = {};

  switch (input.type) {
    case "equal": {
      const parts = divideEvenly(input.amountCents, ordered.length);
      ordered.forEach((id, i) => { out[id] = parts[i]!; });
      return out;
    }
    case "exact": {
      for (const id of people) {
        const v = input.exactCents[id];
        if (v === undefined) throw new SplitError(`No amount for ${id}.`, "UNKNOWN_USER");
        assertCents(v, `amount for ${id}`);
        if (v < 0) throw new SplitError("Amounts can't be negative.", "NEGATIVE");
      }
      const total = sumCents(people.map((id) => input.exactCents[id]!));
      if (total !== input.amountCents) throw new SplitError(`Amounts add up to ${total} cents, not ${input.amountCents}.`, "SUM_MISMATCH");
      for (const id of people) out[id] = input.exactCents[id]!;
      return out;
    }
    case "percent": {
      const pcts = people.map((id) => {
        const p = input.percents[id];
        if (p === undefined) throw new SplitError(`No percentage for ${id}.`, "UNKNOWN_USER");
        if (p < 0) throw new SplitError("Percentages can't be negative.", "NEGATIVE");
        return p;
      });
      const sum = pcts.reduce((s, p) => s + p, 0);
      if (Math.abs(sum - 100) > 0.0001) throw new SplitError(`Percentages add up to ${sum}%, not 100%.`, "PERCENT_SUM");
      // weights in payer-first order so remainder cents land on the payer
      const weights = ordered.map((id) => input.percents[id]!);
      const parts = divideByWeights(input.amountCents, weights);
      ordered.forEach((id, i) => { out[id] = parts[i]!; });
      return out;
    }
    case "shares": {
      const weights = ordered.map((id) => {
        const w = input.shares[id];
        if (w === undefined) throw new SplitError(`No shares for ${id}.`, "UNKNOWN_USER");
        if (w < 0) throw new SplitError("Shares can't be negative.", "NEGATIVE");
        return w;
      });
      if (weights.every((w) => w === 0)) throw new SplitError("Give at least one person a share.", "EMPTY");
      const parts = divideByWeights(input.amountCents, weights);
      ordered.forEach((id, i) => { out[id] = parts[i]!; });
      return out;
    }
  }
}

/** Payers: one payer takes the whole amount; several must add up to it exactly. */
export function validatePayers(amountCents: Cents, payers: Record<UserId, Cents>): void {
  const ids = Object.keys(payers);
  if (ids.length === 0) throw new SplitError("Someone has to have paid.", "EMPTY");
  const total = sumCents(Object.values(payers));
  if (total !== amountCents) throw new SplitError(`Payments add up to ${total} cents, not ${amountCents}.`, "SUM_MISMATCH");
}
