import { divideEvenly, type Cents } from "./money";
import { SplitError, type UserId } from "./splits";

/**
 * Nights-based lodging splits (spec: Feature specs → Lodging splits).
 * The lodging total is divided evenly across nights; each night's cost is
 * split among the people present that night; leftover cents from either
 * division land on the payer when the payer is present.
 *
 * Example from the spec: $1,200 for 3 nights is $400 a night. Four people
 * stay Friday and Saturday; two stay Sunday. Friday and Saturday cost $100
 * each per person; Sunday costs $200 each.
 */
export type NightsInput = {
  amountCents: Cents;
  nights: number;
  /** For each participant, which nights (0-based) they stayed. */
  presence: Record<UserId, boolean[]>;
  payerIds: UserId[];
};

export type NightsResult = {
  shares: Record<UserId, Cents>;
  /** Per participant: how many nights they stayed. */
  nightsStayed: Record<UserId, number>;
  perNightCents: Cents[];
};

/** Everyone ticked for every night - the default. */
export function fullPresence(participants: UserId[], nights: number): Record<UserId, boolean[]> {
  const out: Record<UserId, boolean[]> = {};
  for (const id of participants) out[id] = Array.from({ length: nights }, () => true);
  return out;
}

/** Nights between two YYYY-MM-DD dates (trip dates pre-fill the field). */
export function nightsBetween(startDate: string, endDate: string): number {
  const a = Date.UTC(Number(startDate.slice(0, 4)), Number(startDate.slice(5, 7)) - 1, Number(startDate.slice(8, 10)));
  const b = Date.UTC(Number(endDate.slice(0, 4)), Number(endDate.slice(5, 7)) - 1, Number(endDate.slice(8, 10)));
  return Math.max(0, Math.round((b - a) / 86_400_000));
}

export function computeNightsShares(input: NightsInput): NightsResult {
  const ids = Object.keys(input.presence);
  if (ids.length === 0) throw new SplitError("Pick at least one person.", "EMPTY");
  if (!Number.isInteger(input.nights) || input.nights <= 0) throw new SplitError("Enter the number of nights.", "EMPTY");
  for (const id of ids) {
    if (input.presence[id]!.length !== input.nights) throw new SplitError(`Nights for ${id} don't match the stay.`, "SUM_MISMATCH");
  }
  const payer = input.payerIds.find((p) => ids.includes(p));
  // payer first, so any per-night remainder cent lands on them
  const ordered = payer ? [payer, ...ids.filter((i) => i !== payer)] : ids;
  const perNight = divideEvenly(input.amountCents, input.nights);
  const shares: Record<UserId, Cents> = {};
  const nightsStayed: Record<UserId, number> = {};
  for (const id of ids) { shares[id] = 0; nightsStayed[id] = 0; }
  for (let n = 0; n < input.nights; n++) {
    const present = ordered.filter((id) => input.presence[id]![n]);
    if (present.length === 0) throw new SplitError(`Nobody is ticked for night ${n + 1}.`, "EMPTY");
    const parts = divideEvenly(perNight[n]!, present.length);
    present.forEach((id, i) => { shares[id]! += parts[i]!; nightsStayed[id]! += 1; });
  }
  return { shares, nightsStayed, perNightCents: perNight };
}
