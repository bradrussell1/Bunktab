// QA Agent B · scale probe: a 7-member trip with 150 expenses; time the exact
// queries the app issues (fetchTrip: 4 queries; Home: 3 queries) and report
// payload sizes. Cleans up. Usage: node scripts/qa-b-perf.mjs
import fs from "node:fs";
const env = Object.fromEntries(fs.readFileSync("apps/mobile/.env", "utf8").trim().split("\n").map((l) => l.split(/=(.*)/s).slice(0, 2)));
const BASE = env.EXPO_PUBLIC_SUPABASE_URL, ANON = env.EXPO_PUBLIC_SUPABASE_ANON_KEY.trim();
const H = (jwt, extra = {}) => ({ apikey: ANON, "Content-Type": "application/json", Authorization: `Bearer ${jwt ?? ANON}`, ...extra });
async function req(jwt, method, path, body, extra) { let r; for (let i = 0; ; i++) { try { r = await fetch(BASE + path, { method, headers: H(jwt, extra), body: body === undefined ? undefined : JSON.stringify(body) }); break; } catch (e) { if (i >= 3) throw e; await new Promise((res) => setTimeout(res, 300 * (i + 1))); } } const t = await r.text(); let d = null; try { d = t ? JSON.parse(t) : null; } catch { d = t; } return [r.status, d, t.length]; }
async function pw(phone) { const [, b] = await req(null, "POST", "/auth/v1/token?grant_type=password", { phone, password: "Checkm8-Test-2026" }); return { jwt: b.access_token, id: b.user.id }; }
async function timed(jwt, path) { const t0 = performance.now(); const [s, d, bytes] = await req(jwt, "GET", path); return { ms: Math.round(performance.now() - t0), status: s, rows: Array.isArray(d) ? d.length : 1, kb: Math.round(bytes / 1024) }; }

const sam = await pw("+15555550103"), priya = await pw("+15555550104"), mike = await pw("+15555550105"), jen = await pw("+15555550106");
const members = [sam, priya, mike, jen];
for (const t of (await req(sam.jwt, "GET", "/rest/v1/trips?select=id&title=like.QA-B*"))[1] ?? []) await req(sam.jwt, "DELETE", `/rest/v1/trips?id=eq.${t.id}`);
const [, [trip]] = await req(sam.jwt, "POST", "/rest/v1/trips", { title: "QA-B perf trip", start_date: "2026-11-01", end_date: "2026-11-08", created_by: sam.id }, { Prefer: "return=representation" });
const T = trip.id;
for (const u of members.slice(1)) await req(sam.jwt, "POST", "/rest/v1/trip_members", { trip_id: T, user_id: u.id, role: "member" });
const ids = members.map((m) => m.id);
const split = (total, n) => { const b = Math.floor(total / n), r = total - b * n; return Array.from({ length: n }, (_, i) => b + (i < r ? 1 : 0)); };
const t0 = performance.now(); let created = 0;
for (let i = 0; i < 150; i++) {
  const payer = members[i % members.length]; const parts = ids.filter((_, k) => (i + k) % 3 !== 0 || k === i % members.length); const total = 500 + (i * 137) % 20000; const sh = split(total, parts.length);
  const p = { trip_id: T, description: `Perf expense ${i}`, category: ["dining", "groceries", "transportation", "other"][i % 4], subcategory: ["restaurants", null, "rideshare", null][i % 4], amount_cents: total, tip_cents: 0, currency: "USD", fx_rate: 1, base_amount_cents: total, split_type: "equal", payers: [{ user_id: payer.id, amount_cents: total, base_amount_cents: total }], shares: parts.map((u, k) => ({ user_id: u, share_cents: sh[k], base_share_cents: sh[k] })) };
  const [s] = await req(payer.jwt, "POST", "/rest/v1/rpc/save_expense", { p }); if (s === 200) created++;
}
console.log(`seeded ${created} expenses in ${Math.round(performance.now() - t0)} ms (${Math.round((performance.now() - t0) / created)} ms per save_expense incl. notify fan-out)`);
// warm + measure fetchTrip queries 3x
const Q = [
  ["trips", `/rest/v1/trips?select=*&id=eq.${T}`],
  ["trip_members+users", `/rest/v1/trip_members?select=user_id,role,done_at,settled_up_at,removed_at,users(display_name,venmo_username,photo_url,phone)&trip_id=eq.${T}`],
  ["expenses+payers+shares", `/rest/v1/expenses?select=*,expense_payers(user_id,amount_cents,base_amount_cents),expense_shares(user_id,share_cents,base_share_cents,nights,night_presence)&trip_id=eq.${T}&deleted_at=is.null&order=created_at.desc`],
  ["settlements", `/rest/v1/settlements?select=*&trip_id=eq.${T}&order=created_at`],
  ["HOME trips", `/rest/v1/trips?select=id,title,status,start_date,end_date,cover_photo_url,last_activity_at&order=last_activity_at.desc`],
  ["HOME members", `/rest/v1/trip_members?select=trip_id,user_id,users(display_name,photo_url)&removed_at=is.null`],
  ["HOME expenses(all trips)", `/rest/v1/expenses?select=trip_id,expense_payers(user_id,base_amount_cents),expense_shares(user_id,base_share_cents)&deleted_at=is.null`],
  ["history(trip)", `/rest/v1/expense_history?select=id,action,at&trip_id=eq.${T}&order=at.desc`],
];
for (const [name, path] of Q) { const runs = []; for (let i = 0; i < 3; i++) runs.push(await timed(sam.jwt, path)); const best = runs.reduce((a, b) => (a.ms < b.ms ? a : b)); console.log(`${name.padEnd(26)} best ${String(best.ms).padStart(5)} ms  rows ${String(best.rows).padStart(4)}  ${best.kb} KB  (runs ${runs.map((r) => r.ms).join("/")})`); }
const [, hist] = await req(sam.jwt, "GET", `/rest/v1/expense_history?select=id&trip_id=eq.${T}`); console.log("expense_history rows for 150 creates:", hist.length);
const [, log] = await req(priya.jwt, "GET", `/rest/v1/notification_log?select=id&trip_id=eq.${T}`); console.log("notification_log rows for priya from this trip:", log.length);
const [sd] = await req(sam.jwt, "DELETE", `/rest/v1/trips?id=eq.${T}`); console.log("cleanup", sd);
