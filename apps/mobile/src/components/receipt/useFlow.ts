import { computeTip, receiptTotals, type Claims, type Share, type SplitReceipt, type TipChoice, type Totals } from "@bunktab/core";
import { useEffect, useMemo } from "react";
import { useAuth } from "@/lib/auth";
import { DEMO_ID, DEMO_PEOPLE, DEMO_TRIP_ID, toSplitReceipt, useReceipt, useSplitDraft, type Method, type ReceiptBundle, type SplitDraft } from "@/lib/receipts";
import { activeMembers, sortMembers, useTrip, type Expense, type TripData } from "@/lib/trips";
import { formatMoney } from "@/ui";
import type { Person } from "./People";

/**
 * Everything the five receipt screens share: the trip's people in trip-member order
 * (You first), the receipt as the engine sees it, the live draft (tip, method,
 * participants, claims, amounts) and the totals. `receiptId === "demo"` runs the El Faro
 * fixture with the Cabo crew names so the screens can be driven without a network
 * (DEV screenshots).
 */
export type Flow = {
  me: string;
  tripId: string;
  trip: TripData | null;
  bundle: ReceiptBundle | null;
  people: Person[];            // every active member, trip order, You first
  participants: Person[];      // the draft's participants, same order
  receipt: SplitReceipt | null;
  totals: Totals | null;
  draft: SplitDraft;
  update: ReturnType<typeof useSplitDraft>[1];
  context: string;
  existing: Expense | null;    // when editing a saved receipt expense
  readonly: boolean;
  reload: () => void;
};

export function useFlow(tripId: string | undefined, receiptId: string | undefined, expenseId?: string | null): Flow {
  const { session } = useAuth();
  const demo = receiptId === DEMO_ID;
  const me = demo ? "you" : session?.user.id ?? "";
  const { data: trip, reload: reloadTrip } = useTrip(demo ? undefined : tripId);
  const { data: bundle, reload: reloadReceipt } = useReceipt(receiptId);
  const reload = () => { reloadTrip(); reloadReceipt(); };
  const [draft, update] = useSplitDraft(receiptId ?? "none");

  const people: Person[] = useMemo(() => {
    if (demo) return DEMO_PEOPLE.map((p) => ({ id: p.user_id, name: p.display_name, short: p.first, photo: null }));
    if (!trip) return [];
    const ms = sortMembers(activeMembers(trip));
    const mine = ms.filter((m) => m.user_id === me), others = ms.filter((m) => m.user_id !== me);
    return [...mine, ...others].map((m) => ({ id: m.user_id, name: m.user_id === me ? "You" : m.display_name ?? "Member", short: m.user_id === me ? "You" : (m.first_name ?? m.display_name ?? "Member").split(/\s+/)[0]!, photo: m.photo_url }));
  }, [demo, trip, me]);

  const existing = useMemo(() => (trip && expenseId ? trip.expenses.find((e) => e.id === expenseId) ?? null : null), [trip, expenseId]);

  // seed the draft once: participants = the expense's people (or everyone), tip from the expense or the printed tip or 20%
  useEffect(() => {
    if (draft.seeded || !receiptId || people.length === 0 || !bundle) return;
    const r = bundle.receipt;
    const tip: TipChoice = existing
      ? { mode: existing.tip_mode ?? (existing.tip_cents ? "custom" : "none"), percent: existing.tip_percent ?? null, customCents: existing.tip_cents }
      : r.tip_printed_cents != null ? { mode: "custom", customCents: r.tip_printed_cents } : { mode: "percent", percent: 20 };
    const participants = existing ? existing.expense_shares.map((s) => s.user_id).filter((u) => people.some((p) => p.id === u)) : people.map((p) => p.id);
    const amounts = existing?.split_type === "exact" ? Object.fromEntries(existing.expense_shares.map((s) => [s.user_id, s.share_cents])) : {};
    const method: Method | null = existing ? (existing.split_type === "itemized" ? "itemized" : existing.split_type === "exact" ? "exact" : "equal") : null;
    update({ seeded: true, tip, participants, claims: bundle.claims, amounts, active: me || people[0]!.id, expenseId: existing?.id ?? null, method, description: existing?.description ?? null });
  }, [draft.seeded, receiptId, people, bundle, existing, me, update]);

  const receipt = useMemo(() => (bundle ? toSplitReceipt(bundle) : null), [bundle]);
  const totals = useMemo(() => (receipt ? receiptTotals(receipt, draft.tip) : null), [receipt, draft.tip]);
  const participants = useMemo(() => people.filter((p) => draft.participants.includes(p.id)), [people, draft.participants]);
  const merchant = bundle?.receipt.merchant ?? "Receipt";
  const context = totals ? `${merchant} · ${formatMoney(totals.grandCents)}` : demo ? "Cabo crew: Casa Azul" : trip?.trip.title ?? "";
  const readonly = !!trip && trip.trip.status !== "open" && !demo;
  return { me, tripId: tripId ?? DEMO_TRIP_ID, trip, bundle, people, participants, receipt, totals, draft, update, context, existing, readonly, reload };
}

/** "Sun, Oct 11" from a YYYY-MM-DD, no timezone drift. */
export function receiptDateLabel(iso: string | null): string | null {
  if (!iso || !/^\d{4}-\d{2}-\d{2}$/.test(iso)) return null;
  const d = new Date(Date.UTC(Number(iso.slice(0, 4)), Number(iso.slice(5, 7)) - 1, Number(iso.slice(8, 10))));
  return d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", timeZone: "UTC" });
}

/** The Summary's items line: named dishes, "⅓ of everything else", "An even share of all 8 items", "Amount set by hand". */
export function itemsLineFor(personId: string, method: Method, receipt: SplitReceipt, claims: Claims): string {
  if (method === "equal") return `An even share of all ${receipt.items.length} ${receipt.items.length === 1 ? "item" : "items"}`;
  if (method === "exact") return "Amount set by hand";
  const named: string[] = []; const shared: { frac: string; count: number }[] = [];
  const fracLabel = (n: number) => (n === 2 ? "½" : n === 3 ? "⅓" : n === 4 ? "¼" : n === 5 ? "⅕" : n === 6 ? "⅙" : n === 8 ? "⅛" : `1/${n}`);
  let elsewhere = 0; // dishes this person has no part of
  for (const it of receipt.items) {
    const c = claims[it.id] ?? {}; const u = c[personId] ?? 0;
    if (u <= 1e-6) { elsewhere++; continue; }
    const claimers = Object.keys(c).filter((k) => (c[k] ?? 0) > 1e-6);
    if (it.quantity > 1 && Math.abs(u - Math.round(u)) < 1e-6) { named.push(`${it.name} ×${Math.round(u)}`); continue; }
    if (claimers.length === 1) { named.push(it.name); continue; }
    // the people sharing the fractional remainder of this dish (whole units named by someone else don't count)
    const sharers = claimers.filter((k) => Math.abs((c[k] ?? 0) - Math.round(c[k] ?? 0)) > 1e-6 || it.quantity <= 1);
    const even = sharers.every((k) => Math.abs((c[k] ?? 0) - u) < 1e-6);
    const frac = even ? fracLabel(sharers.length) : "part";
    const s = shared.find((x) => x.frac === frac); if (s) s.count++; else shared.push({ frac, count: 1 });
  }
  const parts = [...named];
  for (const s of shared) {
    const all = named.length === 0 && shared.length === 1;
    parts.push(all && elsewhere === 0 ? `${s.frac} of everything` : all && elsewhere > 0 ? `${s.frac} of everything else` : `${s.frac} of ${s.count} ${s.count === 1 ? "dish" : "dishes"}`);
  }
  return parts.length ? parts.join(" · ") : "Nothing yet";
}

export function tipLabel(tip: TipChoice, subtotal: number): string {
  const c = computeTip(subtotal, tip.mode, tip.percent, tip.customCents);
  return tip.mode === "percent" ? `${tip.percent}% tip · ${formatMoney(c)}` : tip.mode === "custom" ? `Tip ${formatMoney(c)}` : "No tip";
}

export const sharesMap = (shares: Share[]) => Object.fromEntries(shares.map((s) => [s.personId, s.totalCents]));
