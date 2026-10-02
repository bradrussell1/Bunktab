// QA Agent B · focused re-verification on clean trips (earlier run was
// contaminated by the invite trigger adding the "outsider" mid-run).
import fs from "node:fs";
const env = Object.fromEntries(fs.readFileSync("apps/mobile/.env", "utf8").trim().split("\n").map((l) => l.split(/=(.*)/s).slice(0, 2)));
const BASE = env.EXPO_PUBLIC_SUPABASE_URL, ANON = env.EXPO_PUBLIC_SUPABASE_ANON_KEY.trim();
const H = (jwt, extra = {}) => ({ apikey: ANON, "Content-Type": "application/json", Authorization: `Bearer ${jwt ?? ANON}`, ...extra });
const out = (id, v, d) => console.log(`${v.padEnd(7)} ${id}  ${typeof d === "string" ? d : JSON.stringify(d).slice(0, 220)}`);
async function req(jwt, method, path, body, extra) { let r; for (let i = 0; ; i++) { try { r = await fetch(BASE + path, { method, headers: H(jwt, extra), body: body === undefined ? undefined : JSON.stringify(body) }); break; } catch (e) { if (i >= 3) throw e; await new Promise((res) => setTimeout(res, 300 * (i + 1))); } } const t = await r.text(); let d = null; try { d = t ? JSON.parse(t) : null; } catch { d = t; } return [r.status, d]; }
async function pw(phone) { const [, b] = await req(null, "POST", "/auth/v1/token?grant_type=password", { phone, password: "Checkm8-Test-2026" }); return { jwt: b.access_token, id: b.user.id }; }
const sam = await pw("+15555550103"), priya = await pw("+15555550104"), mike = await pw("+15555550105"), jen = await pw("+15555550106");
for (const u of [sam, priya, mike, jen]) for (const t of (await req(u.jwt, "GET", "/rest/v1/trips?select=id&title=like.QA-B*"))[1] ?? []) await req(u.jwt, "DELETE", `/rest/v1/trips?id=eq.${t.id}`);
const mk = async (owner, title, members) => { const [, [t]] = await req(owner.jwt, "POST", "/rest/v1/trips", { title, start_date: "2026-11-01", end_date: "2026-11-03", created_by: owner.id }, { Prefer: "return=representation" }); for (const m of members) await req(owner.jwt, "POST", "/rest/v1/trip_members", { trip_id: t.id, user_id: m.id, role: "member" }); return t.id; };
const exp = (actor, T, over = {}) => req(actor.jwt, "POST", "/rest/v1/rpc/save_expense", { p: { trip_id: T, description: "v2", category: "other", subcategory: null, amount_cents: 3000, tip_cents: 0, currency: "USD", fx_rate: 1, base_amount_cents: 3000, split_type: "equal", payers: [{ user_id: actor.id, amount_cents: 3000, base_amount_cents: 3000 }], shares: [{ user_id: sam.id, share_cents: 1500, base_share_cents: 1500 }, { user_id: priya.id, share_cents: 1500, base_share_cents: 1500 }], ...over } });

// A. membership validation in isolation
{ const T = await mk(sam, "QA-B v2 a", [priya, jen]);
  const [s1, d1] = await exp(sam, T, { payers: [{ user_id: mike.id, amount_cents: 3000 }] }); out("V2.payer_not_member", s1 >= 400 ? "OK" : "FAIL", `${s1} ${JSON.stringify(d1?.message ?? d1).slice(0, 80)}`);
  await req(sam.jwt, "POST", "/rest/v1/rpc/remove_member", { p_trip: T, p_user: jen.id });
  const [s2, d2] = await exp(sam, T, { shares: [{ user_id: sam.id, share_cents: 1500 }, { user_id: jen.id, share_cents: 1500 }] }); out("V2.share_for_removed_member", s2 >= 400 ? "OK" : "FAIL", `${s2} ${JSON.stringify(d2?.message ?? d2).slice(0, 80)}`);
  const r = await fetch(`${BASE}/functions/v1/read-receipt`, { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${mike.jwt}`, apikey: ANON }, body: JSON.stringify({ bucket: "receipts", path: `${T}/x.jpg` }) }); out("V2.read-receipt.non_member", r.status === 401 ? "OK" : "FAIL", `${r.status} ${(await r.text()).slice(0, 60)}`);
  const up = await fetch(`${BASE}/storage/v1/object/receipts/${T}/x.jpg`, { method: "POST", headers: { apikey: ANON, Authorization: `Bearer ${mike.jwt}`, "Content-Type": "image/jpeg" }, body: new Uint8Array([0xff, 0xd8, 0xff]) }); out("V2.storage.upload_receipt_foreign_trip", up.status >= 400 ? "OK" : "FAIL", `${up.status} ${(await up.text()).slice(0, 60)}`);
  // removed member jen: can she still read the trip / invite tokens?
  const [, jt] = await req(jen.jwt, "GET", `/rest/v1/trips?select=id&id=eq.${T}`); out("V2.removed_member.reads_trip", jt.length === 0 ? "OK" : "FAIL", `rows=${jt.length}`);
  // self-promotion impact: priya promotes herself then deletes the trip
  await req(priya.jwt, "PATCH", `/rest/v1/trip_members?trip_id=eq.${T}&user_id=eq.${priya.id}`, { role: "owner" });
  const [sd, dd] = await req(priya.jwt, "DELETE", `/rest/v1/trips?id=eq.${T}`, undefined, { Prefer: "return=representation" }); out("V2.self_promoted_member_deletes_trip", Array.isArray(dd) && dd.length ? "FAIL" : "OK", `${sd} deleted=${Array.isArray(dd) ? dd.length : dd}`);
  if (!(Array.isArray(dd) && dd.length)) await req(sam.jwt, "DELETE", `/rest/v1/trips?id=eq.${T}`); }

// B. settlement freeze with 3 members (marking one payment doesn't settle the trip)
{ const T = await mk(sam, "QA-B v2 b", [priya, mike]);
  await exp(sam, T, { amount_cents: 9000, base_amount_cents: 9000, payers: [{ user_id: sam.id, amount_cents: 9000 }], shares: [sam, priya, mike].map((u) => ({ user_id: u.id, share_cents: 3000 })) });
  for (const u of [sam, priya, mike]) await req(u.jwt, "POST", "/rest/v1/rpc/set_done", { p_trip: T, p_done: true });
  const [, plan] = await req(sam.jwt, "POST", "/rest/v1/rpc/generate_settlements", { p_trip: T });
  const pp = plan.find((x) => x.from_user === priya.id); await req(priya.jwt, "POST", "/rest/v1/rpc/mark_settlement", { p_settlement: pp.id, p_action: "mark_paid" });
  const [, tr] = await req(sam.jwt, "GET", `/rest/v1/trips?select=status&id=eq.${T}`);
  const [s3] = await exp(mike, T, { amount_cents: 6000, base_amount_cents: 6000, payers: [{ user_id: mike.id, amount_cents: 6000 }], shares: [sam, priya, mike].map((u) => ({ user_id: u.id, share_cents: 2000 })) });
  for (const u of [sam, priya, mike]) await req(u.jwt, "POST", "/rest/v1/rpc/set_done", { p_trip: T, p_done: true });
  const [, plan2] = await req(sam.jwt, "POST", "/rest/v1/rpc/generate_settlements", { p_trip: T });
  out("V2.settlement_frozen_after_one_marked_paid", "INFO", `trip=${tr[0].status}; late expense ${s3}; plan before=${plan.map((x) => x.from_user.slice(0, 4) + ":" + x.amount_cents)} after=${plan2.map((x) => x.from_user.slice(0, 4) + ":" + x.amount_cents + ":" + x.status)} → ${JSON.stringify(plan) === JSON.stringify(plan2) ? "UNCHANGED (stale: mike's $60 is never settled)" : "regenerated"}`);
  // unmark the paid one → does trip reopen / plan regenerate?
  await req(priya.jwt, "POST", "/rest/v1/rpc/mark_settlement", { p_settlement: pp.id, p_action: "unmark" });
  const [, plan3] = await req(sam.jwt, "POST", "/rest/v1/rpc/generate_settlements", { p_trip: T });
  out("V2.settlement_regen_after_unmark", JSON.stringify(plan3) !== JSON.stringify(plan2) ? "OK" : "WARN", `after unmark: ${plan3.map((x) => x.from_user.slice(0, 4) + ":" + x.amount_cents)}`);
  // comments: can I delete/edit my own comment?
  const [, [e]] = await req(sam.jwt, "GET", `/rest/v1/expenses?select=id&trip_id=eq.${T}&limit=1`);
  const [sc, c] = await req(sam.jwt, "POST", "/rest/v1/comments", { expense_id: e.id, user_id: sam.id, body: "qa comment" }, { Prefer: "return=representation" });
  const [su, du] = await req(sam.jwt, "PATCH", `/rest/v1/comments?id=eq.${c[0].id}`, { body: "edited" }, { Prefer: "return=representation" }); const [sdl, ddl] = await req(sam.jwt, "DELETE", `/rest/v1/comments?id=eq.${c[0].id}`, undefined, { Prefer: "return=representation" });
  out("V2.comments.no_edit_or_delete_policy", (Array.isArray(du) && du.length === 0 && Array.isArray(ddl) && ddl.length === 0) ? "WARN" : "INFO", `insert ${sc}; patch affected=${Array.isArray(du) ? du.length : du}; delete affected=${Array.isArray(ddl) ? ddl.length : ddl}`);
  const [sc2, c2] = await req(priya.jwt, "POST", "/rest/v1/comments", { expense_id: e.id, user_id: sam.id, body: "forged author" }); out("V2.comments.forge_author", sc2 >= 400 ? "OK" : "FAIL", `${sc2}`);
  // invite token of another member's invite: accept as the wrong phone
  const [, inv] = await req(sam.jwt, "POST", "/rest/v1/invites", { trip_id: T, phone: "15555550197", invited_by: sam.id }, { Prefer: "return=representation" });
  const [sa, da] = await req(jen.jwt, "POST", "/rest/v1/rpc/accept_invite_token", { p_token: inv[0].token }); out("V2.accept_token_wrong_phone", sa >= 400 ? "OK" : "FAIL", `${sa} ${JSON.stringify(da?.message ?? da).slice(0, 60)}`);
  const [si, di] = await req(sam.jwt, "POST", "/rest/v1/invites", { trip_id: T, phone: "15555550103", invited_by: sam.id }, { Prefer: "return=representation" }); out("V2.invite_self", "INFO", `${si} status=${di?.[0]?.status} (self-invite accepted → a text to yourself is attempted)`);
  // cover upload then trip delete → storage orphan?
  const upc = await fetch(`${BASE}/storage/v1/object/covers/${T}/cover.jpg`, { method: "POST", headers: { apikey: ANON, Authorization: `Bearer ${sam.jwt}`, "Content-Type": "image/jpeg", "x-upsert": "true" }, body: new Uint8Array([0xff, 0xd8, 0xff, 0xe0]) });
  await req(sam.jwt, "DELETE", `/rest/v1/trips?id=eq.${T}`);
  const [sg] = await req(sam.jwt, "POST", `/storage/v1/object/sign/covers/${T}/cover.jpg`, { expiresIn: 60 });
  console.log("ORPHAN_CHECK", T, "upload", upc.status, "sign after delete", sg); }
console.log("done");
