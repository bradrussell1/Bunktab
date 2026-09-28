import { sumCents, type Cents } from "./money";
import type { UserId } from "./splits";

/**
 * Settlement (spec: Settlement logic). Splitwise's greedy method: net each
 * member (paid − shares, in base-currency cents); the largest debtor pays
 * the largest creditor the smaller of the two amounts; whoever hits zero
 * drops out; repeat. N people never need more than N − 1 payments. Ties are
 * broken by id so the plan is stable between renders.
 */

export type LedgerExpense = {
  id: string;
  /** Payers in base cents. */
  payers: Record<UserId, Cents>;
  /** Shares in base cents. */
  shares: Record<UserId, Cents>;
  deleted?: boolean;
};

export type Payment = { from: UserId; to: UserId; cents: Cents };

/** net > 0 = owed money (creditor); net < 0 = owes money (debtor). */
export function computeNets(expenses: LedgerExpense[], members?: UserId[]): Record<UserId, Cents> {
  const nets: Record<UserId, Cents> = {};
  for (const m of members ?? []) nets[m] = 0;
  for (const e of expenses) {
    if (e.deleted) continue;
    for (const [id, c] of Object.entries(e.payers)) nets[id] = (nets[id] ?? 0) + c;
    for (const [id, c] of Object.entries(e.shares)) nets[id] = (nets[id] ?? 0) - c;
  }
  return nets;
}

export function settle(nets: Record<UserId, Cents>): Payment[] {
  const total = sumCents(Object.values(nets));
  if (total !== 0) throw new RangeError(`Nets must sum to zero, got ${total} cents`);
  const creditors = Object.entries(nets).filter(([, c]) => c > 0).map(([id, c]) => ({ id, c }));
  const debtors = Object.entries(nets).filter(([, c]) => c < 0).map(([id, c]) => ({ id, c: -c }));
  const byAmount = (a: { id: string; c: number }, b: { id: string; c: number }) => b.c - a.c || a.id.localeCompare(b.id);
  const payments: Payment[] = [];
  while (creditors.length && debtors.length) {
    creditors.sort(byAmount);
    debtors.sort(byAmount);
    const cr = creditors[0]!;
    const db = debtors[0]!;
    const pay = Math.min(cr.c, db.c);
    payments.push({ from: db.id, to: cr.id, cents: pay });
    cr.c -= pay;
    db.c -= pay;
    if (cr.c === 0) creditors.shift();
    if (db.c === 0) debtors.shift();
  }
  return payments;
}

/** Nets → payments in one call, for the live settlement preview. */
export function settlementPlan(expenses: LedgerExpense[], members: UserId[]): { nets: Record<UserId, Cents>; payments: Payment[] } {
  const nets = computeNets(expenses, members);
  return { nets, payments: settle(nets) };
}

/** The Done gate: close out unlocks when every active member has tapped Done. */
export function closeoutUnlocked(members: { doneAt: string | null; removedAt?: string | null }[]): boolean {
  const active = members.filter((m) => !m.removedAt);
  return active.length > 0 && active.every((m) => m.doneAt !== null);
}
