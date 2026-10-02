import { computeNets, settle, type LedgerExpense, type Payment } from "@bunktab/core";
import { useCallback, useEffect, useState } from "react";
import { supabase } from "./supabase";

/**
 * Trip reads for the screens. One query per table under row-level security,
 * shaped for the trip page; realtime subscriptions on trip_members (Done
 * badges), expenses and settlements re-fetch so every member sees changes
 * live (spec: Stack → Supabase realtime for the Done badges).
 */
export type Member = { user_id: string; role: "owner" | "member"; done_at: string | null; settled_up_at: string | null; removed_at: string | null; display_name: string | null; venmo_username: string | null; photo_url: string | null; phone: string | null };
export type Expense = {
  id: string; trip_id: string; description: string; category: string; subcategory: string | null;
  amount_cents: number; tip_cents: number; currency: string; fx_rate: number; base_amount_cents: number;
  split_type: "equal" | "exact" | "percent" | "shares" | "nights"; nights: number | null; receipt_url: string | null;
  created_by: string; created_at: string; updated_at: string; deleted_at: string | null;
  expense_payers: { user_id: string; amount_cents: number; base_amount_cents: number }[];
  expense_shares: { user_id: string; share_cents: number; base_share_cents: number; nights: number | null; night_presence: boolean[] | null }[];
};
export type Trip = {
  id: string; title: string; description: string | null; cover_photo_url: string | null; start_date: string; end_date: string;
  base_currency: string; status: "open" | "settled" | "archived"; closeout_override_at: string | null; closeout_override_by: string | null;
  last_activity_at: string; created_by: string;
};
export type Settlement = { id: string; trip_id: string; from_user: string; to_user: string; amount_cents: number; status: "pending" | "marked_paid" | "confirmed"; marked_at: string | null; confirmed_at: string | null };

export type TripData = { trip: Trip; members: Member[]; expenses: Expense[]; settlements: Settlement[] };

export async function fetchTrip(tripId: string): Promise<TripData | null> {
  const [t, m, e, s] = await Promise.all([
    supabase.from("trips").select("*").eq("id", tripId).maybeSingle(),
    supabase.from("trip_members").select("user_id, role, done_at, settled_up_at, removed_at, users(display_name, venmo_username, photo_url, phone)").eq("trip_id", tripId),
    supabase.from("expenses").select("*, expense_payers(user_id, amount_cents, base_amount_cents), expense_shares(user_id, share_cents, base_share_cents, nights, night_presence)").eq("trip_id", tripId).is("deleted_at", null).order("created_at", { ascending: false }),
    supabase.from("settlements").select("*").eq("trip_id", tripId).order("created_at"),
  ]);
  if (!t.data) return null;
  type Row = { user_id: string; role: "owner" | "member"; done_at: string | null; settled_up_at: string | null; removed_at: string | null; users: { display_name: string | null; venmo_username: string | null; photo_url: string | null; phone: string | null } | null };
  const members: Member[] = ((m.data ?? []) as unknown as Row[]).map((r) => ({ user_id: r.user_id, role: r.role, done_at: r.done_at, settled_up_at: r.settled_up_at, removed_at: r.removed_at, display_name: r.users?.display_name ?? null, venmo_username: r.users?.venmo_username ?? null, photo_url: r.users?.photo_url ?? null, phone: r.users?.phone ?? null }));
  return { trip: t.data as Trip, members, expenses: (e.data ?? []) as Expense[], settlements: (s.data ?? []) as Settlement[] };
}

export function useTrip(tripId: string | undefined) {
  const [data, setData] = useState<TripData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const reload = useCallback(async () => {
    if (!tripId) return;
    try { setData(await fetchTrip(tripId)); setError(null); } catch (e) { setError(e instanceof Error ? e.message : "Couldn't load the trip."); }
    finally { setLoading(false); }
  }, [tripId]);
  useEffect(() => { reload(); }, [reload]);
  useEffect(() => {
    if (!tripId) return;
    // unique per mount: the trip page and a sheet above it both subscribe to the same trip
    const ch = supabase.channel(`trip:${tripId}:${Math.random().toString(36).slice(2, 8)}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "trip_members", filter: `trip_id=eq.${tripId}` }, () => reload())
      .on("postgres_changes", { event: "*", schema: "public", table: "expenses", filter: `trip_id=eq.${tripId}` }, () => reload())
      .on("postgres_changes", { event: "*", schema: "public", table: "settlements", filter: `trip_id=eq.${tripId}` }, () => reload())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [tripId, reload]);
  return { data, loading, error, reload };
}

/* ---------- derived figures (all base cents, all through @bunktab/core) ---------- */

/** One ordering everywhere (Home cards, trip page, members): owner first, then by join time. */
export function sortMembers<T extends { role?: "owner" | "member"; joined_at?: string | null; user_id: string }>(ms: T[]): T[] {
  return [...ms].sort((a, b) => (a.role === "owner" ? -1 : b.role === "owner" ? 1 : 0) || String(a.joined_at ?? "").localeCompare(String(b.joined_at ?? "")) || a.user_id.localeCompare(b.user_id));
}
export function activeMembers(d: TripData): Member[] {
  return sortMembers(d.members.filter((m) => !m.removed_at));
}

export function ledger(d: TripData): LedgerExpense[] {
  return d.expenses.map((e) => ({
    id: e.id,
    payers: Object.fromEntries(e.expense_payers.map((p) => [p.user_id, p.base_amount_cents])),
    shares: Object.fromEntries(e.expense_shares.map((s) => [s.user_id, s.base_share_cents])),
    deleted: !!e.deleted_at,
  }));
}

export function nets(d: TripData): Record<string, number> {
  return computeNets(ledger(d), activeMembers(d).map((m) => m.user_id));
}

export function previewPayments(d: TripData): Payment[] {
  const n = nets(d);
  const total = Object.values(n).reduce((a, b) => a + b, 0);
  if (total !== 0) return []; // a removed member with history; the server plan handles it
  return settle(n);
}

export function paidBy(d: TripData, userId: string): number {
  return d.expenses.reduce((s, e) => s + e.expense_payers.filter((p) => p.user_id === userId).reduce((x, p) => x + p.base_amount_cents, 0), 0);
}
export function shareOf(d: TripData, userId: string): number {
  return d.expenses.reduce((s, e) => s + e.expense_shares.filter((p) => p.user_id === userId).reduce((x, p) => x + p.base_share_cents, 0), 0);
}
export function tripTotal(d: TripData): number {
  return d.expenses.reduce((s, e) => s + e.base_amount_cents, 0);
}
export function membersWithNoExpenses(d: TripData): Member[] {
  const logged = new Set(d.expenses.map((e) => e.created_by));
  return activeMembers(d).filter((m) => !logged.has(m.user_id));
}
/** Expenses the viewer logged (the "Expenses" tab); everything is "All Expenses". */
export function myExpenses(d: TripData, me: string): Expense[] {
  return d.expenses.filter((e) => e.created_by === me);
}
/** My effect on one expense: + = others owe me for it, − = I owe the payer. */
export function myDelta(e: Expense, me: string): number {
  const paid = e.expense_payers.filter((p) => p.user_id === me).reduce((s, p) => s + p.base_amount_cents, 0);
  const share = e.expense_shares.filter((s) => s.user_id === me).reduce((s, x) => s + x.base_share_cents, 0);
  return paid - share;
}
export function memberName(d: TripData, userId: string, me?: string): string {
  if (userId === me) return "You";
  return d.members.find((m) => m.user_id === userId)?.display_name ?? "Someone";
}

/* ---------- trip summaries (Home, Profile → History) ---------- */

export type TripSummary = { id: string; title: string; status: Trip["status"]; start_date: string; end_date: string; base_currency: string; cover_photo_url: string | null; last_activity_at: string; net_cents: number; paid_cents: number; expense_count: number };

/** Every trip I'm in, with my net (paid − share) and what I fronted, from the same rows the trip page uses. */
export async function loadTripSummaries(me: string): Promise<TripSummary[]> {
  const [t, e] = await Promise.all([
    supabase.from("trips").select("id, title, status, start_date, end_date, base_currency, cover_photo_url, last_activity_at").order("last_activity_at", { ascending: false }),
    supabase.from("expenses").select("trip_id, expense_payers(user_id, base_amount_cents), expense_shares(user_id, base_share_cents)").is("deleted_at", null),
  ]);
  type E = { trip_id: string; expense_payers: { user_id: string; base_amount_cents: number }[]; expense_shares: { user_id: string; base_share_cents: number }[] };
  const by = new Map<string, { net: number; paid: number; n: number }>();
  for (const x of (e.data ?? []) as unknown as E[]) {
    const paid = x.expense_payers.filter((p) => p.user_id === me).reduce((s, p) => s + p.base_amount_cents, 0);
    const share = x.expense_shares.filter((p) => p.user_id === me).reduce((s, p) => s + p.base_share_cents, 0);
    const cur = by.get(x.trip_id) ?? { net: 0, paid: 0, n: 0 };
    by.set(x.trip_id, { net: cur.net + paid - share, paid: cur.paid + paid, n: cur.n + 1 });
  }
  return ((t.data ?? []) as Omit<TripSummary, "net_cents" | "paid_cents" | "expense_count">[]).map((r) => {
    const s = by.get(r.id) ?? { net: 0, paid: 0, n: 0 };
    return { ...r, net_cents: s.net, paid_cents: s.paid, expense_count: s.n };
  });
}
