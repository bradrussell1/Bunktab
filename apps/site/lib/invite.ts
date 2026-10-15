import "server-only";
import { createClient } from "@supabase/supabase-js";
import { unstable_cache } from "next/cache";

/**
 * Invite preview for /join/[code]. The code is the existing invites.token. Data comes from
 * the SECURITY DEFINER function get_invite_preview(code) (supabase/migrations/
 * 20261015000002_get_invite_preview.sql), called with the anon key on the server only.
 * It returns no phones, amounts, Venmo handles, receipts or ids.
 */
export type InviteState = "valid" | "expired" | "settled" | "invalid";
export type InviteMember = { name: string; done: boolean };
export type InvitePreview = {
  state: InviteState;
  trip?: { name: string; startDate: string; endDate: string };
  inviter?: string;
  members: InviteMember[];
  memberCount: number;
  doneCount: number;
  expenseCount: number;
};

const INVALID: InvitePreview = { state: "invalid", members: [], memberCount: 0, doneCount: 0, expenseCount: 0 };
const CODE = /^[A-Za-z0-9_-]{8,128}$/;

async function fetchPreview(code: string): Promise<InvitePreview> {
  if (!CODE.test(code)) return INVALID;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anon) {
    console.warn("[invite] NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY unset; /join renders the invalid state");
    return INVALID;
  }
  const sb = createClient(url, anon, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data, error } = await sb.rpc("get_invite_preview", { code });
  if (error || !data || typeof data !== "object") {
    if (error) console.error("[invite] get_invite_preview failed:", error.message);
    return INVALID;
  }
  const d = data as Record<string, unknown>;
  const state = (["valid", "expired", "settled"].includes(String(d.state)) ? d.state : "invalid") as InviteState;
  if (state === "invalid") return INVALID;
  const trip = d.trip as { name?: string; start_date?: string; end_date?: string } | undefined;
  const members = Array.isArray(d.members) ? (d.members as { name?: string; done?: boolean }[]).map((m) => ({ name: String(m.name ?? "Friend"), done: !!m.done })) : [];
  return {
    state,
    trip: trip ? { name: String(trip.name ?? ""), startDate: String(trip.start_date ?? ""), endDate: String(trip.end_date ?? "") } : undefined,
    inviter: typeof d.inviter === "string" ? d.inviter : undefined,
    members,
    memberCount: Number(d.member_count ?? members.length),
    doneCount: Number(d.done_count ?? members.filter((m) => m.done).length),
    expenseCount: Number(d.expense_count ?? 0),
  };
}

/** Cached for 60 s per code so invite data stays fresh without a DB hit per view. */
export const getInvitePreview = unstable_cache(fetchPreview, ["invite-preview-v1"], { revalidate: 60 });

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
/** "Mar 12 – 16", "Mar 30 – Apr 2", "Dec 30, 2026 – Jan 2, 2027". Dates are ISO yyyy-mm-dd. */
export function formatDates(start: string, end: string): string {
  const p = (s: string) => { const [y, m, d] = s.split("-").map(Number); return { y: y ?? 0, m: (m ?? 1) - 1, d: d ?? 1 }; };
  const a = p(start), b = p(end);
  if (!start) return "";
  if (!end || start === end) return `${MONTHS[a.m]} ${a.d}`;
  if (a.y !== b.y) return `${MONTHS[a.m]} ${a.d}, ${a.y} – ${MONTHS[b.m]} ${b.d}, ${b.y}`;
  if (a.m !== b.m) return `${MONTHS[a.m]} ${a.d} – ${MONTHS[b.m]} ${b.d}`;
  return `${MONTHS[a.m]} ${a.d} – ${b.d}`;
}

export function platformFromUA(ua: string | null): "ios" | "android" | "other" {
  const u = (ua ?? "").toLowerCase();
  if (/iphone|ipad|ipod/.test(u)) return "ios";
  if (/android/.test(u)) return "android";
  return "other";
}
