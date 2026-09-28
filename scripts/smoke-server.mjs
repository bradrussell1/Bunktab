// Server-jobs smoke test (notifications, nudges, auto-archive, invite limit,
// Edge Functions) against the linked project, as the two test numbers.
// `npm run smoke:server`. Set SUPABASE_ACCESS_TOKEN to also exercise the
// pieces that need the postgres role (archive job, pg_net delivery, push auth).
// Leaves nothing behind.
import fs from "node:fs";
const env = Object.fromEntries(fs.readFileSync("apps/mobile/.env", "utf8").trim().split("\n").map((l) => l.split(/=(.*)/s).slice(0, 2)));
const BASE = env.EXPO_PUBLIC_SUPABASE_URL, ANON = env.EXPO_PUBLIC_SUPABASE_ANON_KEY.trim();
const REF = fs.readFileSync("supabase/.temp/project-ref", "utf8").trim();
const PAT = process.env.SUPABASE_ACCESS_TOKEN;
async function call(method, path, body, jwt, prefer) {
  const h = { apikey: ANON, "Content-Type": "application/json", Authorization: `Bearer ${jwt ?? ANON}` };
  if (prefer) h.Prefer = prefer;
  const r = await fetch(BASE + path, { method, headers: h, body: body === undefined ? undefined : JSON.stringify(body) });
  const text = await r.text(); let data = null; try { data = text ? JSON.parse(text) : null; } catch { data = text.slice(0, 300); }
  return [r.status, data];
}
async function sql(q) {
  const r = await fetch(`https://api.supabase.com/v1/projects/${REF}/database/query`, { method: "POST", headers: { Authorization: `Bearer ${PAT}`, "Content-Type": "application/json" }, body: JSON.stringify({ query: q }) });
  return r.json();
}
async function login(phone) { await call("POST", "/auth/v1/otp", { phone }); const [, b] = await call("POST", "/auth/v1/verify", { phone, token: "123456", type: "sms" }); return [b.access_token, b.user.id]; }
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let fails = 0;
const ok = (label, cond, extra = "") => { if (!cond) fails++; console.log((cond ? "PASS " : "FAIL ") + label, cond ? "" : JSON.stringify(extra).slice(0, 300)); };
const logs = async (jwt, tid, kind) => (await call("GET", `/rest/v1/notification_log?select=kind,payload&trip_id=eq.${tid}${kind ? `&kind=eq.${kind}` : ""}&order=id`, undefined, jwt))[1] ?? [];

const [ja, ua] = await login("+15555550100"); const [jb, ub] = await login("+15555550101");
let [st, t] = await call("POST", "/rest/v1/trips", { title: "Server smoke", start_date: "2026-09-01", end_date: "2026-09-03", created_by: ua }, ja, "return=representation");
ok("A creates a trip", st === 201, [st, t]); const tid = t[0].id;
[st] = await call("POST", "/rest/v1/trip_members", { trip_id: tid, user_id: ub, role: "member" }, ja); ok("owner adds B", st === 201, st);

// Done reset + new-expense notifications
[st] = await call("POST", "/rest/v1/rpc/set_done", { p_trip: tid, p_done: true }, ja); ok("A taps Done", st === 204, st);
const exp = (desc, payer, cents, jwt) => call("POST", "/rest/v1/rpc/save_expense", { p: { trip_id: tid, description: desc, category: "dining", subcategory: "restaurants", amount_cents: cents, currency: "USD", payers: [{ user_id: payer, amount_cents: cents }], shares: [{ user_id: ua, share_cents: cents / 2 }, { user_id: ub, share_cents: cents / 2 }] } }, jwt);
let e1; [st, e1] = await exp("Tacos", ub, 4000, jb); ok("B logs an expense", st === 200, [st, e1]);
let l = await logs(ja, tid, "done.reset");
ok("A was told their Done badge was reset", l.length === 1 && /Jordan added Tacos · \$40\.00/.test(l[0].payload.body), l);
ok("A did not also get a duplicate 'new expense' push for it", (await logs(ja, tid, "expense.new")).length === 0);
let e2; [st, e2] = await exp("Brunch", ua, 6000, ja); ok("A logs an expense", st === 200, [st, e2]);
l = await logs(jb, tid, "expense.new");
ok("B was told about A's expense with their share", l.length === 1 && /Bradley added Brunch · \$60\.00 · your share \$30\.00/.test(l[0].payload.body), l);
ok("B cannot read A's notifications", (await logs(jb, tid, "done.reset")).length === 0);

// last one out + close-out unlocked
await call("POST", "/rest/v1/rpc/set_done", { p_trip: tid, p_done: true }, ja);
l = await logs(jb, tid, "nudge.last_one"); ok("B nudged as the last one out", l.length === 1, l);
await call("POST", "/rest/v1/rpc/set_done", { p_trip: tid, p_done: true }, jb);
ok("everyone told close-out is unlocked", (await logs(ja, tid, "closeout.unlocked")).length === 1 && (await logs(jb, tid, "closeout.unlocked")).length === 1);

// comment, delete, payment marked
[st] = await call("POST", "/rest/v1/comments", { expense_id: e2, user_id: ub, body: "was this with tip?" }, jb); ok("B comments", st === 201, st);
l = await logs(ja, tid, "comment.new"); ok("A told about the comment", l.length === 1 && /Jordan on Brunch: was this with tip\?/.test(l[0].payload.body), l);
[st] = await call("POST", "/rest/v1/rpc/delete_expense", { p_id: e1 }, jb); ok("B deletes Tacos", st === 204, st);
ok("A told about the deletion", (await logs(ja, tid, "expense.deleted")).length === 1);
await call("POST", "/rest/v1/rpc/set_done", { p_trip: tid, p_done: true }, ja); await call("POST", "/rest/v1/rpc/set_done", { p_trip: tid, p_done: true }, jb);
let plan; [st, plan] = await call("POST", "/rest/v1/rpc/generate_settlements", { p_trip: tid }, ja); ok("plan: B pays A $30", st === 200 && plan[0]?.amount_cents === 3000, plan);
[st] = await call("POST", "/rest/v1/rpc/mark_settlement", { p_settlement: plan[0].id, p_action: "mark_paid" }, jb);
l = await logs(ja, tid, "payment.marked"); ok("A told B marked $30 paid", l.length === 1 && /Jordan marked \$30\.00 as paid/.test(l[0].payload.body), l);

// invites: normalised, texted (fail-soft without Twilio), capped at 50/day
const phones = Array.from({ length: 50 }, (_, i) => ({ trip_id: tid, phone: `+1555010${String(i).padStart(4, "0")}`, invited_by: ua }));
[st] = await call("POST", "/rest/v1/invites", phones, ja); ok("50 invites accepted", st === 201, st);
let bad; [st, bad] = await call("POST", "/rest/v1/invites", { trip_id: tid, phone: "+15550109999", invited_by: ua }, ja); ok("51st invite rejected by the daily cap", st >= 400 && /invite limit/.test(JSON.stringify(bad)), bad);
let inv; [, inv] = await call("GET", `/rest/v1/invites?select=phone&trip_id=eq.${tid}&limit=1`, undefined, ja); ok("invite phone stored digits-only", inv[0]?.phone === "15550100000", inv);
// pg_net delivers asynchronously; the function logs each attempt when it runs
for (let i = 0; i < 20; i++) { l = await logs(ja, tid, "invite.sms"); if (l.length >= 50) break; await sleep(1500); }
ok("send-invite ran for each invite and logged the Twilio state", l.length === 50 && l.every((x) => x.payload.to?.startsWith("+1555") && x.payload.text.includes("/i/")), { n: l.length, first: l[0] });
console.log("     send-invite result:", JSON.stringify(l[0]?.payload?.error ?? l[0]?.payload?.status), l[0]?.payload?.missing ?? "");

if (PAT) {
  // pg_net actually reached the functions
  const resp = await sql(`select status_code, count(*)::int n from net._http_response where created > now() - interval '3 minutes' group by 1 order by 1`);
  ok("pg_net deliveries returned 200", Array.isArray(resp) && resp.some((r) => r.status_code === 200) && !resp.some((r) => r.status_code >= 400), resp);
  // push function auth + no-device path
  const [{ decrypted_secret: secret }] = await sql(`select decrypted_secret from vault.decrypted_secrets where name = 'checkm8_internal_secret'`);
  let r = await fetch(`${BASE}/functions/v1/push`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ user_id: ua, title: "x" }) });
  ok("push rejects calls without the shared secret", r.status === 401, r.status);
  r = await fetch(`${BASE}/functions/v1/push`, { method: "POST", headers: { "Content-Type": "application/json", "x-checkm8-secret": secret }, body: JSON.stringify({ user_id: ua, title: "x", body: "y" }) });
  ok("push accepts the secret (no devices registered yet)", r.status === 200 && (await r.json()).sent === 0, r.status);
  // auto-archive: back-date and run the job
  await sql(`update public.trips set last_activity_at = now() - interval '15 days', status = 'open' where id = '${tid}'`);
  const [{ run_auto_archive: n }] = await sql(`select public.run_auto_archive()`);
  const [{ status }] = await sql(`select status from public.trips where id = '${tid}'`);
  ok("auto-archive flips a 15-day-quiet trip to archived", n >= 1 && status === "archived", { n, status });
  await call("POST", "/rest/v1/comments", { expense_id: e2, user_id: ua, body: "back again" }, ja);
  const [{ status: s2 }] = await sql(`select status from public.trips where id = '${tid}'`);
  ok("new activity un-archives it", s2 === "open", s2);
  // nudges: back-date B's activity, run the job, then confirm the 24h cap
  await sql(`update public.trip_members set done_at = null, last_active_at = now() - interval '2 days', last_nudged_at = null where trip_id = '${tid}' and user_id = '${ub}'`);
  const [{ run_nudges: n1 }] = await sql(`select public.run_nudges()`);
  const [{ run_nudges: n2 }] = await sql(`select public.run_nudges()`);
  ok("inactivity nudge sent once, then capped for 24h", n1 >= 1 && n2 === 0 && (await logs(jb, tid, "nudge.inactive")).length === 1, { n1, n2 });
  // invite expiry
  await sql(`update public.invites set expires_at = now() - interval '1 minute' where trip_id = '${tid}'`);
  const [{ run_invite_expiry: n3 }] = await sql(`select public.run_invite_expiry()`);
  ok("invite expiry marks old links expired", n3 === 50, n3);
} else {
  console.log("SKIP  archive / nudge / expiry / pg_net / push-auth checks (set SUPABASE_ACCESS_TOKEN)");
}

// read-receipt: membership enforced; not-configured path is soft
let r = await fetch(`${BASE}/functions/v1/read-receipt`, { method: "POST", headers: { "Content-Type": "application/json", apikey: ANON, Authorization: `Bearer ${ANON}` }, body: JSON.stringify({ bucket: "receipts", path: `${tid}/x.jpg` }) });
ok("read-receipt refuses a non-member", r.status === 401, r.status);
r = await fetch(`${BASE}/functions/v1/read-receipt`, { method: "POST", headers: { "Content-Type": "application/json", apikey: ANON, Authorization: `Bearer ${ja}` }, body: JSON.stringify({ bucket: "receipts", path: `${tid}/x.jpg` }) });
const rr = await r.json();
ok("read-receipt answers a member (soft-fails until ANTHROPIC_API_KEY is set)", r.status === 200 && ("total_cents" in rr || rr.error), rr);
console.log("     read-receipt:", JSON.stringify(rr));

[st] = await call("DELETE", `/rest/v1/trips?id=eq.${tid}`, undefined, ja); ok("owner deletes the trip", st === 204, st);
ok("nothing left behind", (await call("GET", "/rest/v1/notification_log?select=id&trip_id=eq." + tid, undefined, ja))[1].length === 0);
console.log(fails ? `\n${fails} FAILED` : "\nALL PASS");
process.exit(fails ? 1 : 0);
