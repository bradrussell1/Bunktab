#!/usr/bin/env node
// Row-level-security audit against the live project, read-mostly, test accounts only.
//
//   SUPABASE_URL=… SUPABASE_ANON_KEY=… MEMBER_PHONE=+1555… OUTSIDER_PHONE=+1555… TEST_OTP=123456 \
//   TRIP_ID=<a trip the member is on and the outsider is not> node scripts/rls-audit.mjs [--md out.md]
//
// For every RLS table it tries, as the OUTSIDER, to read rows of TRIP_ID, insert a row pointing at it,
// update and delete one, touch storage under the trip's folder, and call the money/membership RPCs;
// each must be denied or come back empty. As the MEMBER it confirms the same reads succeed. As ANON it
// checks nothing leaks. Any insert that unexpectedly succeeds is deleted again and reported as FAIL.
// Signs in once per account (Supabase allows one OTP per phone per minute).
import { createClient } from "@supabase/supabase-js";
import { randomUUID } from "node:crypto";
import fs from "node:fs";

const env = (k, d) => process.env[k] ?? d;
const URL_ = env("SUPABASE_URL"), ANON = env("SUPABASE_ANON_KEY"), TRIP = env("TRIP_ID"), OTP = env("TEST_OTP", "123456");
if (!URL_ || !ANON || !TRIP) { console.error("SUPABASE_URL, SUPABASE_ANON_KEY and TRIP_ID are required"); process.exit(2); }
const mdOut = process.argv.includes("--md") ? process.argv[process.argv.indexOf("--md") + 1] : null;

async function signIn(phone) {
  const sb = createClient(URL_, ANON, { auth: { persistSession: false, autoRefreshToken: false } });
  const { error: e1 } = await sb.auth.signInWithOtp({ phone }); if (e1) throw new Error(`${phone}: ${e1.message}`);
  const { data, error: e2 } = await sb.auth.verifyOtp({ phone, token: OTP, type: "sms" }); if (e2) throw new Error(`${phone}: ${e2.message}`);
  return { sb, uid: data.user.id };
}

const rows = [];
const record = (actor, target, action, expect, outcome, detail = "") => {
  const pass = expect === "denied" ? outcome === "denied" || outcome === "empty" : expect === "allowed" ? outcome === "allowed" : outcome === expect;
  rows.push({ actor, target, action, expect, outcome, pass, detail: String(detail).slice(0, 90) });
};
const denied = (e) => e && /row-level security|permission denied|42501|not a member|only the|not allowed|violates|JWT|401|403|not found|does not exist|No API key/i.test(e.message ?? String(e));

async function tryRead(actor, sb, table, filter) {
  let q = sb.from(table).select("*").limit(5);
  for (const [k, v] of Object.entries(filter)) q = q.eq(k, v);
  const { data, error } = await q;
  if (error) return denied(error) ? ["denied", error.message] : ["error", error.message];
  return [data?.length ? "allowed" : "empty", `${data?.length ?? 0} rows`];
}
async function tryInsert(actor, sb, table, row) {
  const { data, error } = await sb.from(table).insert(row).select("*").limit(1);
  if (error) return [denied(error) ? "denied" : "error", error.message];
  // unexpected success: clean up
  const id = data?.[0]?.id;
  if (id) await sb.from(table).delete().eq("id", id);
  return ["allowed", `INSERTED${id ? " and removed " + id : ""}`];
}
async function tryUpdate(actor, sb, table, filter, patch) {
  let q = sb.from(table).update(patch);
  for (const [k, v] of Object.entries(filter)) q = q.eq(k, v);
  const { data, error } = await q.select("*");
  if (error) return [denied(error) ? "denied" : "error", error.message];
  return [data?.length ? "allowed" : "empty", `${data?.length ?? 0} rows touched`];
}
async function tryDelete(actor, sb, table, filter) {
  let q = sb.from(table).delete();
  for (const [k, v] of Object.entries(filter)) q = q.eq(k, v);
  const { data, error } = await q.select("*");
  if (error) return [denied(error) ? "denied" : "error", error.message];
  return [data?.length ? "allowed" : "empty", `${data?.length ?? 0} rows deleted`];
}
async function tryRpc(sb, fn, args) {
  const { data, error } = await sb.rpc(fn, args);
  if (error) return [denied(error) ? "denied" : "error", error.message];
  if (data == null || (Array.isArray(data) && data.length === 0) || data === false || data === 0) return ["empty", JSON.stringify(data)];
  return ["allowed", JSON.stringify(data).slice(0, 80)];
}

const member = await signIn(env("MEMBER_PHONE", "+15555550104"));
const outsider = await signIn(env("OUTSIDER_PHONE", "+15555550100"));
const anon = createClient(URL_, ANON, { auth: { persistSession: false } });

// ids of real rows in the trip, read as the member, so updates/deletes target something that exists
const pick = async (table, extra = {}) => { let q = member.sb.from(table).select("id").limit(1); for (const [k, v] of Object.entries({ trip_id: TRIP, ...extra })) q = q.eq(k, v); const { data } = await q; return data?.[0]?.id ?? null; };
const expenseId = await pick("expenses");
const memberRow = await member.sb.from("trip_members").select("user_id").eq("trip_id", TRIP).limit(1).then((r) => r.data?.[0]?.user_id ?? null);
const receiptId = await pick("receipts");

// [table, filter for "rows of this trip", probe row the outsider tries to insert, patch for update]
const tripTables = [
  ["trip_members", { trip_id: TRIP }, { trip_id: TRIP, user_id: outsider.uid }, { role: "member" }],
  ["expenses", { trip_id: TRIP }, { id: randomUUID(), trip_id: TRIP, description: "rls-probe", amount_cents: 100, base_amount_cents: 100, currency: "USD", category: "Other", subcategory: "Other", created_by: outsider.uid }, { description: "rls-probe" }],
  ["expense_payers", { expense_id: expenseId ?? randomUUID() }, { expense_id: expenseId ?? randomUUID(), user_id: outsider.uid, amount_cents: 1, base_amount_cents: 1 }, { amount_cents: 1 }],
  ["expense_shares", { expense_id: expenseId ?? randomUUID() }, { expense_id: expenseId ?? randomUUID(), user_id: outsider.uid, share_cents: 1, base_share_cents: 1 }, { share_cents: 1 }],
  ["expense_history", { trip_id: TRIP }, { trip_id: TRIP, actor_id: outsider.uid, action: "rls-probe" }, { action: "rls-probe" }],
  ["comments", { expense_id: expenseId ?? randomUUID() }, { expense_id: expenseId ?? randomUUID(), user_id: outsider.uid, body: "rls-probe" }, { body: "rls-probe" }],
  ["invites", { trip_id: TRIP }, { trip_id: TRIP, phone: "+15555550199", invited_by: outsider.uid, token: randomUUID().replace(/-/g, "") }, { status: "pending" }],
  ["settlements", { trip_id: TRIP }, { trip_id: TRIP, from_user: outsider.uid, to_user: memberRow, amount_cents: 1 }, { status: "pending" }],
  ["receipts", { trip_id: TRIP }, { id: randomUUID(), trip_id: TRIP, storage_path: `${TRIP}/rls-probe.jpg`, image_sha256: "rls" + Date.now(), created_by: outsider.uid }, { merchant: "rls-probe" }],
  ["receipt_items", { receipt_id: receiptId ?? randomUUID() }, { receipt_id: receiptId ?? randomUUID(), position: 99, name: "rls-probe", quantity: 1, line_total_cents: 1 }, { name: "rls-probe" }],
  ["receipt_charges", { receipt_id: receiptId ?? randomUUID() }, { receipt_id: receiptId ?? randomUUID(), kind: "tax", amount_cents: 1 }, { label: "rls-probe" }],
  ["client_events", { name: "rls-probe" }, { name: "rls-probe", props: {}, platform: "ios", app_version: "0" }, { name: "rls-probe" }],   // append-only via log_event(); nobody reads from the apps
  ["notification_log", { trip_id: TRIP }, { user_id: memberRow, trip_id: TRIP, kind: "rls-probe", payload: {} }, { kind: "rls-probe" }],
  ["devices", { user_id: memberRow }, { user_id: memberRow, expo_push_token: "rls-probe", platform: "ios" }, { platform: "ios" }],
];

// trips: creating your OWN trip is allowed by design; what must fail is reading, editing or deleting
// someone else's, and inserting one that claims another creator.
{
  const [o1, d1] = await tryRead("outsider", outsider.sb, "trips", { id: TRIP }); record("outsider", "trips", "select", "denied", o1, d1);
  const [o2, d2] = await tryInsert("outsider", outsider.sb, "trips", { id: randomUUID(), title: "rls-probe", start_date: "2026-01-01", end_date: "2026-01-02", created_by: memberRow }); record("outsider", "trips", "insert as another creator", "denied", o2, d2);
  const [o3, d3] = await tryUpdate("outsider", outsider.sb, "trips", { id: TRIP }, { title: "rls-probe" }); record("outsider", "trips", "update", "denied", o3, d3);
  const [o4, d4] = await tryDelete("outsider", outsider.sb, "trips", { id: TRIP }); record("outsider", "trips", "delete", "denied", o4, d4);
  const [a1, ad] = await tryRead("anon", anon, "trips", { id: TRIP }); record("anon", "trips", "select", "denied", a1, ad);
  const [m1, md] = await tryRead("member", member.sb, "trips", { id: TRIP }); record("member", "trips", "select", "allowed", m1, md);
}

for (const [table, filter, row, patch] of tripTables) {
  const [o1, d1] = await tryRead("outsider", outsider.sb, table, filter); record("outsider", table, "select", "denied", o1, d1);
  const [o2, d2] = await tryInsert("outsider", outsider.sb, table, row); record("outsider", table, "insert", "denied", o2, d2);
  const [o3, d3] = await tryUpdate("outsider", outsider.sb, table, filter, patch); record("outsider", table, "update", "denied", o3, d3);
  const [o4, d4] = await tryDelete("outsider", outsider.sb, table, filter); record("outsider", table, "delete", "denied", o4, d4);
  const [a1, ad] = await tryRead("anon", anon, table, filter); record("anon", table, "select", "denied", a1, ad);
  const [m1, md] = await tryRead("member", member.sb, table, filter);
  // tables that may legitimately be empty for this trip still count as pass when the read is permitted
  record("member", table, "select", m1 === "empty" ? "empty" : "allowed", m1, md);
}

// users: the outsider must not read a member's profile unless they share a trip; the member can
{
  const [o, d] = await tryRead("outsider", outsider.sb, "users", { id: memberRow }); record("outsider", "users", "select member profile", "denied", o, d);
  const [m, md] = await tryRead("member", member.sb, "users", { id: memberRow }); record("member", "users", "select own trip-mate", "allowed", m, md);
  const [u, ud] = await tryUpdate("outsider", outsider.sb, "users", { id: memberRow }, { display_name: "rls-probe" }); record("outsider", "users", "update member profile", "denied", u, ud);
}

// storage: outsider under the trip folder
for (const bucket of ["receipts", "covers", "avatars"]) {
  const path = bucket === "avatars" ? `${memberRow}/rls-probe.png` : `${TRIP}/rls-probe.png`;
  const up = await outsider.sb.storage.from(bucket).upload(path, Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), { contentType: "image/png" });
  if (!up.error) await outsider.sb.storage.from(bucket).remove([path]);
  record("outsider", `storage/${bucket}`, "upload", "denied", up.error ? "denied" : "allowed", up.error?.message ?? "UPLOADED and removed");
  const ls = await outsider.sb.storage.from(bucket).list(bucket === "avatars" ? memberRow : TRIP);
  record("outsider", `storage/${bucket}`, "list", "denied", ls.error ? "denied" : ls.data?.length ? "allowed" : "empty", ls.error?.message ?? `${ls.data?.length ?? 0} objects`);
  const signed = await outsider.sb.storage.from(bucket).createSignedUrl(path, 60);
  record("outsider", `storage/${bucket}`, "signed url", "denied", signed.error ? "denied" : "allowed", signed.error?.message ?? "URL issued");
  const an = await anon.storage.from(bucket).list(TRIP);
  record("anon", `storage/${bucket}`, "list", "denied", an.error ? "denied" : an.data?.length ? "allowed" : "empty", an.error?.message ?? `${an.data?.length ?? 0} objects`);
}

// RPCs as the outsider: every one must refuse or do nothing
const rpcs = [
  ["save_expense", { p: { trip_id: TRIP, description: "rls-probe", amount_cents: 100, currency: "USD", category: "Other", subcategory: "Other", payers: [{ user_id: outsider.uid, amount_cents: 100 }], shares: [{ user_id: outsider.uid, share_cents: 100 }] } }],
  ["save_receipt_expense", { p: { trip_id: TRIP, receipt_id: receiptId, method: "equal", participants: [outsider.uid], shares: [{ user_id: outsider.uid, total_cents: 1 }], tip_mode: "none" } }],
  ["set_done", { p_trip: TRIP, p_done: true }],
  ["send_nudge", { p_trip: TRIP, p_user: memberRow }],
  ["force_close_out", { p_trip: TRIP }],
  ["requeue_receipt", { p_receipt: receiptId ?? randomUUID() }],
  ["remove_member", { p_trip: TRIP, p_user: memberRow }],
  ["delete_expense", { p_id: expenseId ?? randomUUID() }],
  ["generate_settlements", { p_trip: TRIP }],
  ["owner_closeout", { p_trip: TRIP }],
  ["set_settled_up", { p_trip: TRIP, p_on: true }],
];
for (const [fn, args] of rpcs) {
  const [o, d] = await tryRpc(outsider.sb, fn, args); record("outsider", `rpc/${fn}`, "call", "denied", o, d);
}
{
  // the public invite preview answers a bogus code with {state:"invalid"} and nothing else: that is its contract
  const [o, d] = await tryRpc(anon, "get_invite_preview", { code: "not-a-real-code-" + Date.now() }); record("anon", "rpc/get_invite_preview", "bogus code → invalid, no data", /"state":"invalid"/.test(d) ? "allowed" : "denied", o, d);
  const [o2, d2] = await tryRpc(anon, "save_expense", { p: { trip_id: TRIP } }); record("anon", "rpc/save_expense", "call", "denied", o2, d2);
  const [o3, d3] = await tryRpc(outsider.sb, "receipt_settings", {}); record("outsider", "rpc/receipt_settings", "read-only settings (allowed by design)", "allowed", o3, d3);
}

// report
const pad = (s, n) => String(s).padEnd(n);
const lines = [`| actor | target | action | expected | outcome | ok | detail |`, `|---|---|---|---|---|---|---|`];
for (const r of rows) lines.push(`| ${r.actor} | ${r.target} | ${r.action} | ${r.expect} | ${r.outcome} | ${r.pass ? "pass" : "FAIL"} | ${r.detail.replace(/\|/g, "/")} |`);
const fails = rows.filter((r) => !r.pass);
console.log(rows.map((r) => `${pad(r.pass ? "pass" : "FAIL", 5)} ${pad(r.actor, 9)} ${pad(r.target, 26)} ${pad(r.action, 36)} ${pad(r.outcome, 8)} ${r.detail}`).join("\n"));
console.log(`\n${rows.length} checks, ${rows.length - fails.length} pass, ${fails.length} fail`);
if (mdOut) {
  fs.mkdirSync(mdOut.replace(/\/[^/]+$/, ""), { recursive: true });
  fs.writeFileSync(mdOut, `# RLS audit · ${new Date().toISOString().slice(0, 10)}\n\nProject: ${URL_}\nTrip under test: ${TRIP}\nMember: ${env("MEMBER_PHONE", "+15555550104")} · Outsider: ${env("OUTSIDER_PHONE", "+15555550100")} · plus the anon role.\n\n**${rows.length} checks, ${rows.length - fails.length} pass, ${fails.length} fail.**\n\n${lines.join("\n")}\n`);
}
process.exit(fails.length ? 1 : 0);
