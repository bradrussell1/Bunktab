"use client";
import { computeNets, settle, type LedgerExpense, type Payment } from "@checkm8/core";
import { useCallback, useEffect, useState } from "react";
import { supabaseBrowser } from "./supabase/browser";

/**
 * Trip reads for the guest view, shaped like the mobile app's (one query per
 * table under row-level security) so both clients show the same figures.
 */
export type Member = { user_id: string; role: "owner" | "member"; done_at: string | null; removed_at: string | null; display_name: string | null; venmo_username: string | null; photo_url: string | null };
export type Expense = {
  id: string; trip_id: string; description: string; category: string; subcategory: string | null;
  amount_cents: number; tip_cents: number; currency: string; fx_rate: number; base_amount_cents: number;
  split_type: "equal" | "exact" | "percent" | "shares" | "nights"; nights: number | null; receipt_url: string | null;
  created_by: string; created_at: string; updated_at: string; deleted_at: string | null;
  expense_payers: { user_id: string; amount_cents: number; base_amount_cents: number }[];
  expense_shares: { user_id: string; share_cents: number; base_share_cents: number; nights: number | null; night_presence: boolean[] | null }[];
};
export type Trip = { id: string; title: string; description: string | null; start_date: string; end_date: string; base_currency: string; status: "open" | "settled" | "archived"; closeout_override_at: string | null; created_by: string };
export type Settlement = { id: string; from_user: string; to_user: string; amount_cents: number; status: "pending" | "marked_paid" | "confirmed" };
export type TripData = { trip: Trip; members: Member[]; expenses: Expense[]; settlements: Settlement[] };

export async function fetchTrip(tripId: string): Promise<TripData | null> {
  const sb = supabaseBrowser();
  const [t, m, e, s] = await Promise.all([
    sb.from("trips").select("id, title, description, start_date, end_date, base_currency, status, closeout_override_at, created_by").eq("id", tripId).maybeSingle(),
    sb.from("trip_members").select("user_id, role, done_at, removed_at, users(display_name, venmo_username, photo_url)").eq("trip_id", tripId),
    sb.from("expenses").select("*, expense_payers(user_id, amount_cents, base_amount_cents), expense_shares(user_id, share_cents, base_share_cents, nights, night_presence)").eq("trip_id", tripId).is("deleted_at", null).order("created_at", { ascending: false }),
    sb.from("settlements").select("id, from_user, to_user, amount_cents, status").eq("trip_id", tripId).order("created_at"),
  ]);
  if (!t.data) return null;
  type Row = { user_id: string; role: "owner" | "member"; done_at: string | null; removed_at: string | null; users: { display_name: string | null; venmo_username: string | null; photo_url: string | null } | null };
  const members: Member[] = ((m.data ?? []) as unknown as Row[]).map((r) => ({ user_id: r.user_id, role: r.role, done_at: r.done_at, removed_at: r.removed_at, display_name: r.users?.display_name ?? null, venmo_username: r.users?.venmo_username ?? null, photo_url: r.users?.photo_url ?? null }));
  return { trip: t.data as Trip, members, expenses: (e.data ?? []) as Expense[], settlements: (s.data ?? []) as Settlement[] };
}

export function useTrip(tripId: string) {
  const [data, setData] = useState<TripData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const reload = useCallback(async () => {
    try { setData(await fetchTrip(tripId)); setError(null); } catch (e) { setError(e instanceof Error ? e.message : "Couldn't load the trip."); }
    finally { setLoading(false); }
  }, [tripId]);
  useEffect(() => { reload(); }, [reload]);
  useEffect(() => {
    const sb = supabaseBrowser();
    // unique per mount: two views of one trip must not share a channel
    const ch = sb.channel(`web:trip:${tripId}:${Math.random().toString(36).slice(2, 8)}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "trip_members", filter: `trip_id=eq.${tripId}` }, () => reload())
      .on("postgres_changes", { event: "*", schema: "public", table: "expenses", filter: `trip_id=eq.${tripId}` }, () => reload())
      .on("postgres_changes", { event: "*", schema: "public", table: "settlements", filter: `trip_id=eq.${tripId}` }, () => reload())
      .subscribe();
    return () => { sb.removeChannel(ch); };
  }, [tripId, reload]);
  return { data, loading, error, reload };
}

export const activeMembers = (d: TripData) => d.members.filter((m) => !m.removed_at);
export const ledger = (d: TripData): LedgerExpense[] => d.expenses.map((e) => ({ id: e.id, payers: Object.fromEntries(e.expense_payers.map((p) => [p.user_id, p.base_amount_cents])), shares: Object.fromEntries(e.expense_shares.map((s) => [s.user_id, s.base_share_cents])), deleted: !!e.deleted_at }));
export const nets = (d: TripData) => computeNets(ledger(d), activeMembers(d).map((m) => m.user_id));
export function previewPayments(d: TripData): Payment[] { const n = nets(d); return Object.values(n).reduce((a, b) => a + b, 0) === 0 ? settle(n) : []; }
export const paidBy = (d: TripData, uid: string) => d.expenses.reduce((s, e) => s + e.expense_payers.filter((p) => p.user_id === uid).reduce((x, p) => x + p.base_amount_cents, 0), 0);
export const shareOf = (d: TripData, uid: string) => d.expenses.reduce((s, e) => s + e.expense_shares.filter((p) => p.user_id === uid).reduce((x, p) => x + p.base_share_cents, 0), 0);
export const tripTotal = (d: TripData) => d.expenses.reduce((s, e) => s + e.base_amount_cents, 0);
export const membersWithNoExpenses = (d: TripData) => { const logged = new Set(d.expenses.map((e) => e.created_by)); return activeMembers(d).filter((m) => !logged.has(m.user_id)); };
export const memberName = (d: TripData, uid: string, me?: string) => (uid === me ? "You" : d.members.find((m) => m.user_id === uid)?.display_name ?? "Someone");
