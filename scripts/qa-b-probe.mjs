// QA Agent B · access-control and data-integrity probes against the live
// project, as the test accounts only. Creates its own trips and removes them.
// Usage: node scripts/qa-b-probe.mjs
import fs from "node:fs";
const env = Object.fromEntries(fs.readFileSync("apps/mobile/.env", "utf8").trim().split("\n").map((l) => l.split(/=(.*)/s).slice(0, 2)));
const BASE = env.EXPO_PUBLIC_SUPABASE_URL, ANON = env.EXPO_PUBLIC_SUPABASE_ANON_KEY.trim();
const H = (jwt, extra = {}) => ({ apikey: ANON, "Content-Type": "application/json", Authorization: `Bearer ${jwt ?? ANON}`, ...extra });
const results = [];
const note = (id, verdict, detail) => { results.push({ id, verdict, detail }); console.log(`${verdict.padEnd(7)} ${id}  ${typeof detail === "string" ? detail : JSON.stringify(detail).slice(0, 220)}`); };
async function req(jwt, method, path, body, extra) {
  let r;
  for (let i = 0; ; i++) {
    try { r = await fetch(BASE + path, { method, headers: H(jwt, extra), body: body === undefined ? undefined : JSON.stringify(body) }); break; }
    catch (e) { if (i >= 3) throw e; await new Promise((res) => setTimeout(res, 300 * (i + 1))); }
  }
  const t = await r.text(); let d = null; try { d = t ? JSON.parse(t) : null; } catch { d = t; }
  return [r.status, d, r.headers];
}
async function pw(phone) { const [, b] = await req(null, "POST", "/auth/v1/token?grant_type=password", { phone, password: "Checkm8-Test-2026" }); if (!b.access_token) throw new Error(`login ${phone}: ${JSON.stringify(b).slice(0, 120)}`); return { jwt: b.access_token, id: b.user.id, phone }; }

const sam = await pw("+15555550103");   // owner
const priya = await pw("+15555550104"); // member
const jen = await pw("+15555550106");   // member to remove
const mike = await pw("+15555550105");  // outsider
const P = (o) => ({ ...o });

// ---------------------------------------------------------------- setup
const TITLE = "QA-B probe trip";
for (const u of [sam, priya, mike, jen]) for (const t of (await req(u.jwt, "GET", "/rest/v1/trips?select=id&title=like.QA-B*"))[1] ?? []) await req(u.jwt, "DELETE", `/rest/v1/trips?id=eq.${t.id}`);
// a true outsider who shares no trip with anyone: a throwaway email account
const ghostEmail = `qa-b-outsider-${Date.now()}@example.invalid`;
const [, gb] = await req(null, "POST", "/auth/v1/signup", { email: ghostEmail, password: "Checkm8-QA-ghost-2026" });
const ghost = { jwt: gb.access_token, id: gb.user.id };
const [, [trip]] = await req(sam.jwt, "POST", "/rest/v1/trips", { title: TITLE, start_date: "2026-11-01", end_date: "2026-11-03", created_by: sam.id }, { Prefer: "return=representation" });
const T = trip.id;
for (const u of [priya, jen]) await req(sam.jwt, "POST", "/rest/v1/trip_members", { trip_id: T, user_id: u.id, role: "member" });
const exp = async (actor, over = {}) => {
  const p = { trip_id: T, description: "Probe dinner", category: "dining", subcategory: "restaurants", amount_cents: 3000, tip_cents: 0, currency: "USD", fx_rate: 1, base_amount_cents: 3000, split_type: "equal",
    payers: [{ user_id: actor.id, amount_cents: 3000, base_amount_cents: 3000 }], shares: [{ user_id: sam.id, share_cents: 1500, base_share_cents: 1500 }, { user_id: priya.id, share_cents: 1500, base_share_cents: 1500 }], ...over };
  return req(actor.jwt, "POST", "/rest/v1/rpc/save_expense", { p });
};
const [, E1] = await exp(sam);
console.log("trip", T, "expense", E1);

// ---------------------------------------------------------------- 1. access control (outsider = mike)
for (const [table, q] of [["trips", `id=eq.${T}`], ["trip_members", `trip_id=eq.${T}`], ["invites", `trip_id=eq.${T}`], ["expenses", `trip_id=eq.${T}`], ["expense_payers", `expense_id=eq.${E1}`], ["expense_shares", `expense_id=eq.${E1}`], ["expense_history", `trip_id=eq.${T}`], ["comments", `expense_id=eq.${E1}`], ["settlements", `trip_id=eq.${T}`], ["users", `id=eq.${sam.id}`]]) {
  const [s, d] = await req(table === "users" ? ghost.jwt : mike.jwt, "GET", `/rest/v1/${table}?select=*&${q}`);
  note(`AC.read.${table}`, s === 200 && Array.isArray(d) && d.length === 0 ? "OK" : "FAIL", `${s} rows=${Array.isArray(d) ? d.length : d}`);
}
{ const [s] = await req(mike.jwt, "PATCH", `/rest/v1/expenses?id=eq.${E1}`, { description: "hacked" }, { Prefer: "return=representation" }); const [, d] = await req(sam.jwt, "GET", `/rest/v1/expenses?select=description&id=eq.${E1}`); note("AC.outsider.patch.expense", d[0].description === "Probe dinner" ? "OK" : "FAIL", `${s} desc=${d[0].description}`); }
{ const [s, d] = await req(mike.jwt, "POST", "/rest/v1/trip_members", { trip_id: T, user_id: mike.id, role: "member" }); note("AC.outsider.insert.member", s >= 400 ? "OK" : "FAIL", `${s} ${JSON.stringify(d).slice(0, 80)}`); }
{ const [s, d] = await req(mike.jwt, "POST", "/rest/v1/invites", { trip_id: T, phone: "15555550199", invited_by: mike.id }); note("AC.outsider.insert.invite", s >= 400 ? "OK" : "FAIL", `${s} ${JSON.stringify(d).slice(0, 80)}`); }
{ const [s, d] = await exp(mike); note("AC.outsider.save_expense", s >= 400 ? "OK" : "FAIL", `${s} ${JSON.stringify(d).slice(0, 100)}`); }
{ const [s, d] = await req(mike.jwt, "POST", "/rest/v1/rpc/delete_expense", { p_id: E1 }); note("AC.outsider.delete_expense", s >= 400 ? "OK" : "FAIL", `${s} ${JSON.stringify(d).slice(0, 100)}`); }
{ const [s, d] = await req(mike.jwt, "POST", "/rest/v1/rpc/set_settled_up", { p_trip: T, p_on: true }); note("AC.outsider.set_settled_up", s >= 400 ? "OK" : "FAIL", `${s} ${JSON.stringify(d).slice(0, 100)}`); }
{ const [s, d] = await req(priya.jwt, "POST", "/rest/v1/rpc/remove_member", { p_trip: T, p_user: jen.id }); note("AC.member.remove_member", s >= 400 ? "OK" : "FAIL", `${s} ${JSON.stringify(d).slice(0, 100)}`); }
{ const [s, d] = await req(priya.jwt, "POST", "/rest/v1/rpc/owner_closeout", { p_trip: T }); note("AC.member.owner_closeout", s >= 400 ? "OK" : "FAIL", `${s} ${JSON.stringify(d).slice(0, 100)}`); }
{ const [s, d] = await req(mike.jwt, "POST", "/rest/v1/rpc/accept_invite_token", { p_token: "deadbeef" }); note("AC.guessed_invite_token", s >= 400 ? "OK" : "FAIL", `${s} ${JSON.stringify(d).slice(0, 100)}`); }
// member edits another member's expense via save_expense with a different trip_id
{ const [, [t2]] = await req(mike.jwt, "POST", "/rest/v1/trips", { title: "QA-B mike trip", start_date: "2026-11-01", end_date: "2026-11-02", created_by: mike.id }, { Prefer: "return=representation" });
  const [s, d] = await req(mike.jwt, "POST", "/rest/v1/rpc/save_expense", { p: { id: E1, trip_id: t2.id, description: "moved", category: "other", subcategory: null, amount_cents: 100, currency: "USD", payers: [{ user_id: mike.id, amount_cents: 100 }], shares: [{ user_id: mike.id, share_cents: 100 }] } });
  note("AC.save_expense.foreign_id_other_trip", s >= 400 ? "OK" : "FAIL", `${s} ${JSON.stringify(d).slice(0, 100)}`);
  await req(mike.jwt, "DELETE", `/rest/v1/trips?id=eq.${t2.id}`); }

// ---------------------------------------------------------------- 1b. member-level escalation via direct table writes
{ const [s, d] = await req(priya.jwt, "PATCH", `/rest/v1/trip_members?trip_id=eq.${T}&user_id=eq.${priya.id}`, { role: "owner" }, { Prefer: "return=representation" });
  const [, m] = await req(sam.jwt, "GET", `/rest/v1/trip_members?select=role&trip_id=eq.${T}&user_id=eq.${priya.id}`);
  note("ESC.member.self_promote_owner", m[0].role === "member" ? "OK" : "FAIL", `${s} role now=${m[0].role}`);
  if (m[0].role === "owner") await req(sam.jwt, "PATCH", `/rest/v1/trip_members?trip_id=eq.${T}&user_id=eq.${priya.id}`, { role: "member" }); }
{ const [s] = await req(priya.jwt, "PATCH", `/rest/v1/trip_members?trip_id=eq.${T}&user_id=eq.${priya.id}`, { last_nudged_at: "2030-01-01T00:00:00Z", last_active_at: "2030-01-01T00:00:00Z", settled_up_at: "2026-01-01T00:00:00Z" }, { Prefer: "return=representation" });
  const [, m] = await req(sam.jwt, "GET", `/rest/v1/trip_members?select=last_nudged_at,settled_up_at&trip_id=eq.${T}&user_id=eq.${priya.id}`);
  note("ESC.member.patch_bookkeeping_cols", m[0].last_nudged_at === null && m[0].settled_up_at === null ? "OK" : "WARN", `${s} ${JSON.stringify(m[0])}`);
  await req(priya.jwt, "PATCH", `/rest/v1/trip_members?trip_id=eq.${T}&user_id=eq.${priya.id}`, { last_nudged_at: null, settled_up_at: null }); }
// removed member re-adds themself
{ await req(sam.jwt, "POST", "/rest/v1/rpc/remove_member", { p_trip: T, p_user: jen.id });
  const [s, d] = await req(jen.jwt, "PATCH", `/rest/v1/trip_members?trip_id=eq.${T}&user_id=eq.${jen.id}`, { removed_at: null }, { Prefer: "return=representation" });
  const [, m] = await req(sam.jwt, "GET", `/rest/v1/trip_members?select=removed_at&trip_id=eq.${T}&user_id=eq.${jen.id}`);
  note("ESC.removed_member.unremove_self", m[0].removed_at !== null ? "OK" : "FAIL", `${s} removed_at=${m[0].removed_at}`); }
// member invites a known user → trigger adds them (bypasses owner-only member insert?) and re-adds a removed member
{ const [s, d] = await req(priya.jwt, "POST", "/rest/v1/invites", { trip_id: T, phone: "15555550106", invited_by: priya.id }, { Prefer: "return=representation" });
  const [, m] = await req(sam.jwt, "GET", `/rest/v1/trip_members?select=removed_at&trip_id=eq.${T}&user_id=eq.${jen.id}`);
  note("ESC.member.invite_readds_removed_member", m[0].removed_at !== null ? "OK" : "FAIL", `${s} invite=${JSON.stringify(d).slice(0, 60)} jen.removed_at=${m[0].removed_at}`); }
{ const [s, d] = await req(priya.jwt, "POST", "/rest/v1/invites", { trip_id: T, phone: "15555550105", invited_by: priya.id }, { Prefer: "return=representation" });
  const [, m] = await req(sam.jwt, "GET", `/rest/v1/trip_members?select=user_id&trip_id=eq.${T}&user_id=eq.${mike.id}`);
  note("ESC.member.invite_adds_known_user", m.length === 0 ? "OK" : "FAIL", `${s} invite status=${d?.[0]?.status} mike is member=${m.length > 0}`); }
// direct writes on expenses / payers / shares by a member
{ const [s] = await req(priya.jwt, "PATCH", `/rest/v1/expenses?id=eq.${E1}`, { amount_cents: 1, base_amount_cents: 1 }, { Prefer: "return=representation" });
  const [, e] = await req(sam.jwt, "GET", `/rest/v1/expenses?select=amount_cents,base_amount_cents&id=eq.${E1}`);
  note("INT.direct_patch_expense_amount", e[0].amount_cents === 3000 ? "OK" : "FAIL", `${s} amount now=${e[0].amount_cents} (payers/shares still 3000 → ledger inconsistent)`);
  if (e[0].amount_cents !== 3000) await req(sam.jwt, "PATCH", `/rest/v1/expenses?id=eq.${E1}`, { amount_cents: 3000, base_amount_cents: 3000 }); }
{ const [s] = await req(priya.jwt, "DELETE", `/rest/v1/expense_shares?expense_id=eq.${E1}&user_id=eq.${priya.id}`);
  const [, sh] = await req(sam.jwt, "GET", `/rest/v1/expense_shares?select=user_id&expense_id=eq.${E1}`);
  note("INT.direct_delete_share", sh.length === 2 ? "OK" : "FAIL", `${s} shares left=${sh.length}`); }
{ const [s, d] = await req(priya.jwt, "POST", "/rest/v1/expenses", { trip_id: T, description: "direct insert, no shares", category: "other", amount_cents: 5000, currency: "USD", base_amount_cents: 5000, created_by: priya.id }, { Prefer: "return=representation" });
  note("INT.direct_insert_expense_without_shares", s >= 400 ? "OK" : "FAIL", `${s} ${JSON.stringify(d).slice(0, 90)}`);
  if (s < 400 && d?.[0]?.id) await req(priya.jwt, "POST", "/rest/v1/rpc/delete_expense", { p_id: d[0].id }); }
{ // move an expense to another trip via PATCH trip_id
  const [, [t3]] = await req(priya.jwt, "POST", "/rest/v1/trips", { title: "QA-B priya trip", start_date: "2026-11-01", end_date: "2026-11-02", created_by: priya.id }, { Prefer: "return=representation" });
  const [s] = await req(priya.jwt, "PATCH", `/rest/v1/expenses?id=eq.${E1}`, { trip_id: t3.id }, { Prefer: "return=representation" });
  const [, e] = await req(sam.jwt, "GET", `/rest/v1/expenses?select=trip_id&id=eq.${E1}`);
  note("INT.direct_patch_expense_trip_id", e.length && e[0].trip_id === T ? "OK" : "FAIL", `${s} visible to owner=${e.length > 0} trip=${e[0]?.trip_id === T ? "same" : "MOVED"}`);
  if (!e.length) await req(priya.jwt, "PATCH", `/rest/v1/expenses?id=eq.${E1}`, { trip_id: T });
  await req(priya.jwt, "DELETE", `/rest/v1/trips?id=eq.${t3.id}`); }
{ const [s] = await req(priya.jwt, "PATCH", `/rest/v1/expenses?id=eq.${E1}`, { created_by: priya.id }, { Prefer: "return=representation" });
  const [, e] = await req(sam.jwt, "GET", `/rest/v1/expenses?select=created_by&id=eq.${E1}`);
  note("INT.direct_patch_created_by", e[0].created_by === sam.id ? "OK" : "WARN", `${s} created_by now ${e[0].created_by === sam.id ? "sam" : "priya"}`);
  if (e[0].created_by !== sam.id) await req(priya.jwt, "PATCH", `/rest/v1/expenses?id=eq.${E1}`, { created_by: sam.id }); }
{ const [s, d] = await req(priya.jwt, "PATCH", `/rest/v1/settlements?trip_id=eq.${T}`, { status: "confirmed" }, { Prefer: "return=representation" }); note("AC.member.patch_settlements", s >= 400 || (Array.isArray(d) && d.length === 0) ? "OK" : "FAIL", `${s} ${JSON.stringify(d).slice(0, 60)}`); }
{ const [s, d] = await req(priya.jwt, "PATCH", `/rest/v1/trips?id=eq.${T}`, { title: "renamed by member" }, { Prefer: "return=representation" }); note("AC.member.patch_trip", s >= 400 || (Array.isArray(d) && d.length === 0) ? "OK" : "FAIL", `${s} ${JSON.stringify(d).slice(0, 60)}`); }
{ const [s, d] = await req(priya.jwt, "DELETE", `/rest/v1/trips?id=eq.${T}`, undefined, { Prefer: "return=representation" }); note("AC.member.delete_trip", Array.isArray(d) && d.length === 0 ? "OK" : "FAIL", `${s} ${JSON.stringify(d).slice(0, 60)}`); }
// privacy reads by a co-member
{ const [, d] = await req(priya.jwt, "GET", `/rest/v1/users?select=id,phone,email,display_name&id=eq.${sam.id}`); note("PRIV.comember.reads.phone_email", d[0]?.email || d[0]?.phone ? "WARN" : "OK", `priya sees sam: ${JSON.stringify(d[0])}`); }
{ const [, d] = await req(jen.jwt, "GET", `/rest/v1/users?select=id,display_name&id=eq.${sam.id}`); note("PRIV.removed_member.reads_users", d.length === 0 ? "OK" : "WARN", `removed jen sees sam rows=${d.length}`); }
{ const [, d] = await req(priya.jwt, "GET", `/rest/v1/invites?select=phone,token&trip_id=eq.${T}`); note("PRIV.member.reads.invite_phones_tokens", d.length ? "WARN" : "OK", `phones+tokens visible to any member: ${JSON.stringify(d).slice(0, 120)}`); }
{ const [, d] = await req(priya.jwt, "GET", `/rest/v1/notification_log?select=kind,payload&trip_id=eq.${T}&limit=3`); note("PRIV.notification_log.self_only", "INFO", JSON.stringify(d).slice(0, 200)); }

// ---------------------------------------------------------------- 2. data integrity via save_expense
const cases = [
  ["zero_amount", { amount_cents: 0, base_amount_cents: 0, payers: [{ user_id: sam.id, amount_cents: 0 }], shares: [{ user_id: sam.id, share_cents: 0 }] }],
  ["negative_amount", { amount_cents: -100, base_amount_cents: -100, payers: [{ user_id: sam.id, amount_cents: -100 }], shares: [{ user_id: sam.id, share_cents: -100 }] }],
  ["negative_tip", { tip_cents: -500, amount_cents: 3000, base_amount_cents: 2500, payers: [{ user_id: sam.id, amount_cents: 2500 }], shares: [{ user_id: sam.id, share_cents: 2500 }] }],
  ["fractional_cents", { amount_cents: 12.5, base_amount_cents: 12.5, payers: [{ user_id: sam.id, amount_cents: 12.5 }], shares: [{ user_id: sam.id, share_cents: 12.5 }] }],
  ["huge_amount", { amount_cents: 2147483647, base_amount_cents: 2147483647, payers: [{ user_id: sam.id, amount_cents: 2147483647 }], shares: [{ user_id: sam.id, share_cents: 2147483647 }] }],
  ["overflow_amount", { amount_cents: 3000000000, base_amount_cents: 3000000000, payers: [{ user_id: sam.id, amount_cents: 3000000000 }], shares: [{ user_id: sam.id, share_cents: 3000000000 }] }],
  ["payer_not_member", { payers: [{ user_id: mike.id, amount_cents: 3000 }] }],
  ["share_for_removed_member", { shares: [{ user_id: sam.id, share_cents: 1500 }, { user_id: jen.id, share_cents: 1500 }] }],
  ["duplicate_share_user", { shares: [{ user_id: sam.id, share_cents: 1500 }, { user_id: sam.id, share_cents: 1500 }] }],
  ["bad_category_pair", { category: "groceries", subcategory: "restaurants" }],
  ["unknown_category", { category: "crypto", subcategory: null }],
  ["nights_presence_len_mismatch", { split_type: "nights", nights: 3, shares: [{ user_id: sam.id, share_cents: 1500, nights: 2, night_presence: [true, true] }, { user_id: priya.id, share_cents: 1500, nights: 3, night_presence: [true, true, true] }] }],
  ["fx_zero", { fx_rate: 0, base_amount_cents: 0, payers: [{ user_id: sam.id, amount_cents: 3000, base_amount_cents: 0 }], shares: [{ user_id: sam.id, share_cents: 1500, base_share_cents: 0 }, { user_id: priya.id, share_cents: 1500, base_share_cents: 0 }] }],
  ["fx_negative", { fx_rate: -1, base_amount_cents: -3000, payers: [{ user_id: sam.id, amount_cents: 3000, base_amount_cents: -3000 }], shares: [{ user_id: sam.id, share_cents: 1500, base_share_cents: -1500 }, { user_id: priya.id, share_cents: 1500, base_share_cents: -1500 }] }],
  ["base_mismatch_vs_fx", { currency: "EUR", fx_rate: 1.1, base_amount_cents: 999999, payers: [{ user_id: sam.id, amount_cents: 3000, base_amount_cents: 999999 }], shares: [{ user_id: sam.id, share_cents: 1500, base_share_cents: 499999 }, { user_id: priya.id, share_cents: 1500, base_share_cents: 500000 }] }],
  ["currency_garbage", { currency: "ABCD" }],
  ["currency_lower", { currency: "usd" }],
  ["description_300", { description: "x".repeat(300) }],
  ["description_empty", { description: "" }],
  ["payers_sum_mismatch", { payers: [{ user_id: sam.id, amount_cents: 2999 }] }],
  ["shares_sum_mismatch", { shares: [{ user_id: sam.id, share_cents: 1500 }, { user_id: priya.id, share_cents: 1400 }] }],
  ["split_type_shares_legacy", { split_type: "shares" }],
];
const created = [];
for (const [name, over] of cases) {
  const [s, d] = await exp(sam, over);
  if (s === 200) created.push(d);
  const expectReject = !["split_type_shares_legacy", "currency_lower", "huge_amount"].includes(name);
  const ok = expectReject ? s >= 400 : s === 200;
  note(`INT.save_expense.${name}`, ok ? "OK" : (name === "zero_amount" || name === "nights_presence_len_mismatch" || name === "fx_zero" || name === "base_mismatch_vs_fx" || name === "currency_lower" ? "WARN" : "FAIL"), `${s} ${typeof d === "string" ? d.slice(0, 90) : JSON.stringify(d?.message ?? d).slice(0, 90)}`);
}
// concurrent edits on the same id
{ const [a, b] = await Promise.all([exp(sam, { id: E1, description: "edit A" }), exp(sam, { id: E1, description: "edit B" })]);
  const [, e] = await req(sam.jwt, "GET", `/rest/v1/expenses?select=description&id=eq.${E1}`);
  note("INT.concurrent_edits", a[0] === 200 && b[0] === 200 ? "OK" : "WARN", `statuses ${a[0]}/${b[0]} final=${e[0].description}`); }
// delete then edit
{ const [, eid] = await exp(sam, { description: "to delete" }); await req(sam.jwt, "POST", "/rest/v1/rpc/delete_expense", { p_id: eid });
  const [s, d] = await exp(sam, { id: eid, description: "zombie" }); note("INT.edit_after_delete", s >= 400 ? "OK" : "FAIL", `${s} ${JSON.stringify(d?.message ?? d).slice(0, 80)}`);
  const [s2] = await req(sam.jwt, "POST", "/rest/v1/rpc/delete_expense", { p_id: eid }); note("INT.double_delete", s2 >= 400 ? "OK" : "WARN", `${s2}`); }
// done gate + settlements regeneration after a payment is marked paid (fresh 2-person trip)
const [, [trip2]] = await req(sam.jwt, "POST", "/rest/v1/trips", { title: "QA-B settle trip", start_date: "2026-11-01", end_date: "2026-11-03", created_by: sam.id }, { Prefer: "return=representation" });
const T1 = T; const T2 = trip2.id; await req(sam.jwt, "POST", "/rest/v1/trip_members", { trip_id: T2, user_id: priya.id, role: "member" });
const exp2 = (actor, over = {}) => exp(actor, { trip_id: T2, ...over });
{ await exp2(sam);
  for (const u of [sam, priya]) await req(u.jwt, "POST", "/rest/v1/rpc/set_done", { p_trip: T2, p_done: true });
  const [s1, planraw] = await req(sam.jwt, "POST", "/rest/v1/rpc/generate_settlements", { p_trip: T2 }); const plan = Array.isArray(planraw) ? planraw : []; if (!plan.length) note("INT.generate_settlements", "FAIL", `${s1} ${JSON.stringify(planraw).slice(0, 120)}`);
  const pay = plan.find((x) => x.from_user === priya.id) ?? { id: "00000000-0000-0000-0000-000000000000" };
  await req(priya.jwt, "POST", "/rest/v1/rpc/mark_settlement", { p_settlement: pay.id, p_action: "mark_paid" });
  const [, tr] = await req(sam.jwt, "GET", `/rest/v1/trips?select=status&id=eq.${T2}`);
  note("INT.trip_settles_when_all_marked", tr[0].status === "settled" ? "OK" : "WARN", `status=${tr[0].status}`);
  const [s3, d3] = await exp2(priya, { description: "late expense after settle", payers: [{ user_id: priya.id, amount_cents: 3000 }] });
  note("INT.late_expense_on_settled_trip", s3 >= 400 ? "OK" : "WARN", `${s3} ${JSON.stringify(d3?.message ?? d3).slice(0, 80)}`);
  // reopen by unmarking, add a late expense, regenerate
  await req(priya.jwt, "POST", "/rest/v1/rpc/mark_settlement", { p_settlement: pay.id, p_action: "unmark" });
  const [, tr2] = await req(sam.jwt, "GET", `/rest/v1/trips?select=status&id=eq.${T2}`);
  note("INT.unmark_reopens_trip", tr2[0].status === "open" ? "OK" : "FAIL", `status after unmark=${tr2[0].status}`);
  if (tr2[0].status !== "open") await req(sam.jwt, "PATCH", `/rest/v1/trips?id=eq.${T2}`, { status: "open", settled_at: null });
  const [s4] = await exp2(priya, { description: "late expense", payers: [{ user_id: priya.id, amount_cents: 3000 }] });
  for (const u of [sam, priya]) await req(u.jwt, "POST", "/rest/v1/rpc/set_done", { p_trip: T2, p_done: true });
  const [, plan2raw] = await req(sam.jwt, "POST", "/rest/v1/rpc/generate_settlements", { p_trip: T2 }); const plan2 = Array.isArray(plan2raw) ? plan2raw : []; if (!Array.isArray(plan2raw)) note("INT.regen.error", "INFO", JSON.stringify(plan2raw).slice(0, 120));
  note("INT.regen_after_late_expense_all_pending", JSON.stringify(plan2.map((x) => x.amount_cents)) !== JSON.stringify(plan.map((x) => x.amount_cents)) ? "OK" : "WARN", `late expense ${s4}; before=${plan.map((x) => x.amount_cents)} after=${plan2.map((x) => x.amount_cents)}`);
  // now mark one paid, add another late expense, regen → frozen?
  const p2 = plan2.find((x) => x.from_user === priya.id) ?? plan2[0];
  if (p2) { await req(p2.from_user === priya.id ? priya.jwt : sam.jwt, "POST", "/rest/v1/rpc/mark_settlement", { p_settlement: p2.id, p_action: "mark_paid" }); }
  const [, tr3] = await req(sam.jwt, "GET", `/rest/v1/trips?select=status&id=eq.${T2}`);
  if (tr3[0].status === "settled") { note("INT.regen_after_marked_paid", "INFO", "trip settled on single payment; late expenses are refused on settled trips (plan frozen)"); }
  else { await exp2(sam, { description: "late expense 2" }); for (const u of [sam, priya]) await req(u.jwt, "POST", "/rest/v1/rpc/set_done", { p_trip: T2, p_done: true }); const [, plan3] = await req(sam.jwt, "POST", "/rest/v1/rpc/generate_settlements", { p_trip: T2 }); note("INT.regen_after_marked_paid", "INFO", `plan unchanged (frozen)=${JSON.stringify(plan3.map((x) => x.amount_cents)) === JSON.stringify(plan2.map((x) => x.amount_cents))}`); }
}
// settled_up idempotence
{ const seq = []; for (const on of [true, false, true, true, false]) { const [s] = await req(sam.jwt, "POST", "/rest/v1/rpc/set_settled_up", { p_trip: T2, p_on: on }); seq.push(s); }
  const [, m] = await req(sam.jwt, "GET", `/rest/v1/trip_members?select=settled_up_at,settled_up_undo&trip_id=eq.${T2}&user_id=eq.${sam.id}`);
  const [, st] = await req(sam.jwt, "GET", `/rest/v1/settlements?select=status&trip_id=eq.${T2}`);
  note("INT.settled_up.on_off_on_on_off", m[0].settled_up_at === null ? "OK" : "FAIL", `statuses=${seq} final settled_up_at=${m[0].settled_up_at} settlements=${st.map((x) => x.status)}`); }
// done reset: edit vs create
{ await req(priya.jwt, "POST", "/rest/v1/rpc/set_done", { p_trip: T2, p_done: true });
  await exp2(sam, { id: E1, description: "edited again" });
  const [, m1] = await req(sam.jwt, "GET", `/rest/v1/trip_members?select=done_at&trip_id=eq.${T2}&user_id=eq.${priya.id}`);
  note("INT.done_survives_edit", m1[0].done_at !== null ? "OK" : "FAIL", `done_at after edit=${m1[0].done_at}`);
  const [, tr] = await req(sam.jwt, "GET", `/rest/v1/trips?select=status&id=eq.${T2}`);
  if (tr[0].status === "open") { await exp2(sam, { description: "new one" }); const [, m2] = await req(sam.jwt, "GET", `/rest/v1/trip_members?select=done_at&trip_id=eq.${T2}&user_id=eq.${priya.id}`); note("INT.done_cleared_on_create", m2[0].done_at === null ? "OK" : "FAIL", `done_at after create=${m2[0].done_at}`); } }

// ---------------------------------------------------------------- 3. storage
{ const [s, d] = await req(mike.jwt, "POST", `/storage/v1/object/sign/covers/${T}/cover.jpg`, { expiresIn: 60 }); note("AC.storage.sign_foreign_cover", s >= 400 ? "OK" : "FAIL", `${s} ${JSON.stringify(d).slice(0, 80)}`); }
{ const r = await fetch(`${BASE}/storage/v1/object/avatars/${sam.id}/avatar.jpg`, { method: "POST", headers: { apikey: ANON, Authorization: `Bearer ${mike.jwt}`, "Content-Type": "image/jpeg" }, body: new Uint8Array([0xff, 0xd8, 0xff]) }); note("AC.storage.upload_other_users_avatar", r.status >= 400 ? "OK" : "FAIL", `${r.status} ${(await r.text()).slice(0, 80)}`); }
{ const r = await fetch(`${BASE}/storage/v1/object/receipts/${T}/x.jpg`, { method: "POST", headers: { apikey: ANON, Authorization: `Bearer ${mike.jwt}`, "Content-Type": "image/jpeg" }, body: new Uint8Array([0xff, 0xd8, 0xff]) }); note("AC.storage.upload_receipt_foreign_trip", r.status >= 400 ? "OK" : "FAIL", `${r.status}`); }
{ const r = await fetch(`${BASE}/storage/v1/object/list/avatars`, { method: "POST", headers: { apikey: ANON, "Content-Type": "application/json" }, body: JSON.stringify({ prefix: "", limit: 10 }) }); const t = await r.text(); note("AC.storage.anon_list_avatars", r.status >= 400 || t === "[]" ? "OK" : "WARN", `${r.status} ${t.slice(0, 80)}`); }
{ const r = await fetch(`${BASE}/storage/v1/object/list/site-assets`, { method: "POST", headers: { apikey: ANON, "Content-Type": "application/json" }, body: JSON.stringify({ prefix: "", limit: 10 }) }); const t = await r.text(); note("PRIV.storage.anon_list_site_assets", r.status >= 400 || t === "[]" ? "OK" : "WARN", `${r.status} ${t.slice(0, 120)}`); }

// ---------------------------------------------------------------- 4. edge functions
{ const r = await fetch(`${BASE}/functions/v1/push`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ user_id: sam.id, title: "x" }) }); note("FN.push.no_secret", r.status === 401 ? "OK" : "FAIL", `${r.status}`); }
{ const r = await fetch(`${BASE}/functions/v1/push`, { method: "POST", headers: { "Content-Type": "application/json", "x-checkm8-secret": "wrong" }, body: JSON.stringify({ user_id: sam.id, title: "x" }) }); note("FN.push.wrong_secret", r.status === 401 ? "OK" : "FAIL", `${r.status}`); }
{ const r = await fetch(`${BASE}/functions/v1/send-invite`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ invite_id: "00000000-0000-0000-0000-000000000000" }) }); note("FN.send-invite.no_auth", r.status === 401 ? "OK" : "FAIL", `${r.status}`); }
{ const [, inv] = await req(sam.jwt, "POST", "/rest/v1/invites", { trip_id: T, phone: "15555550198", invited_by: sam.id }, { Prefer: "return=representation" });
  const r = await fetch(`${BASE}/functions/v1/send-invite`, { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${priya.jwt}`, apikey: ANON }, body: JSON.stringify({ invite_id: inv[0].id }) }); note("FN.send-invite.other_members_invite", r.status === 403 ? "OK" : "FAIL", `${r.status} ${(await r.text()).slice(0, 60)}`);
  const r2 = await fetch(`${BASE}/functions/v1/send-invite`, { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${sam.jwt}`, apikey: ANON }, body: JSON.stringify({ invite_id: inv[0].id }) }); note("FN.send-invite.resend_by_inviter_spams_twilio", "INFO", `${r2.status} ${(await r2.text()).slice(0, 100)} (inviter can re-POST the same invite id repeatedly → one Twilio send each; no per-invite dedupe)`); }
{ const r = await fetch(`${BASE}/functions/v1/read-receipt`, { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${mike.jwt}`, apikey: ANON }, body: JSON.stringify({ bucket: "receipts", path: `${T}/x.jpg` }) }); note("FN.read-receipt.non_member", r.status === 401 ? "OK" : "FAIL", `${r.status}`); }
{ const [, [tm]] = await req(mike.jwt, "POST", "/rest/v1/trips", { title: "QA-B mike trip 2", start_date: "2026-11-01", end_date: "2026-11-02", created_by: mike.id }, { Prefer: "return=representation" });
  const r = await fetch(`${BASE}/functions/v1/read-receipt`, { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${mike.jwt}`, apikey: ANON }, body: JSON.stringify({ bucket: "receipts", path: `${tm.id}/../${T}/cover.jpg` }) }); const t = await r.text(); note("FN.read-receipt.path_traversal", r.status === 401 || r.status === 404 || t.includes("not found") || t.includes("Object") ? "OK" : "WARN", `${r.status} ${t.slice(0, 100)}`);
  const r2 = await fetch(`${BASE}/functions/v1/read-receipt`, { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${mike.jwt}`, apikey: ANON }, body: JSON.stringify({ bucket: "covers", path: `${T}/cover.jpg` }) }); note("FN.read-receipt.bucket_switch", r2.status === 400 ? "OK" : "FAIL", `${r2.status}`);
  await req(mike.jwt, "DELETE", `/rest/v1/trips?id=eq.${tm.id}`); }

// ---------------------------------------------------------------- cleanup
for (const t of [T1, T2]) { await req(sam.jwt, "PATCH", `/rest/v1/trips?id=eq.${t}`, { status: "open" }); }
const [sd] = await req(sam.jwt, "DELETE", `/rest/v1/trips?id=in.(${T1},${T2})`);
await req(ghost.jwt, "POST", "/rest/v1/rpc/delete_my_account", {});
console.log("cleanup", sd);
fs.writeFileSync("/private/tmp/claude-501/-Users-bradleyrussell/d3745d4c-c8be-4979-8e8a-1cdc4edbd54b/scratchpad/qa-b-results.json", JSON.stringify(results, null, 1));
console.log("SUMMARY", Object.entries(results.reduce((a, r) => ((a[r.verdict] = (a[r.verdict] ?? 0) + 1), a), {})).map(([k, v]) => `${k}=${v}`).join(" "));
