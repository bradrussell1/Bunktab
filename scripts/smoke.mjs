// End-to-end smoke test against the linked Supabase project, as the two test
// phone numbers (auth.sms.test_otp; A = …0100, B = …0102 so they share no other trip): trip creation, membership isolation,
// save_expense validation, the Done gate, settlement generation, marking
// paid, and cleanup. Run with `npm run smoke` after `apps/mobile/.env` exists.
// Leaves nothing behind.
import fs from "node:fs";
const env = Object.fromEntries(fs.readFileSync("apps/mobile/.env", "utf8").trim().split("\n").map((l) => l.split(/=(.*)/s).slice(0, 2)));
const URL = env.EXPO_PUBLIC_SUPABASE_URL, ANON = env.EXPO_PUBLIC_SUPABASE_ANON_KEY.trim();
async function call(method, path, body, jwt, prefer) {
  const h = { apikey: ANON, "Content-Type": "application/json", Authorization: `Bearer ${jwt ?? ANON}` };
  if (prefer) h.Prefer = prefer;
  const r = await fetch(URL + path, { method, headers: h, body: body === undefined ? undefined : JSON.stringify(body) });
  const text = await r.text();
  let data = null; try { data = text ? JSON.parse(text) : null; } catch { data = text.slice(0, 300); }
  return [r.status, data];
}
async function login(phone) {
  await call("POST", "/auth/v1/otp", { phone });
  const [, b] = await call("POST", "/auth/v1/verify", { phone, token: "123456", type: "sms" });
  return [b.access_token, b.user.id];
}
const ok = (label, cond, extra = "") => console.log((cond ? "PASS " : "FAIL ") + label, cond ? "" : JSON.stringify(extra).slice(0, 200));
const [ja, ua] = await login("+15555550100"); const [jb, ub] = await login("+15555550102"); // a user who shares no trips with A

let [st, t] = await call("POST", "/rest/v1/trips", { title: "RLS smoke test", start_date: "2026-10-02", end_date: "2026-10-05", created_by: ua }, ja, "return=representation");
ok("A creates a trip", st === 201, [st, t]); const tid = t[0].id;
let m; [st, m] = await call("GET", `/rest/v1/trip_members?select=user_id,role&trip_id=eq.${tid}`, undefined, ja);
ok("owner membership row added by trigger", st === 200 && JSON.stringify(m) === JSON.stringify([{ user_id: ua, role: "owner" }]), m);
ok("B cannot see A's trip", (await call("GET", `/rest/v1/trips?select=id&id=eq.${tid}`, undefined, jb))[1].length === 0);
ok("B cannot see A's profile", (await call("GET", `/rest/v1/users?select=id&id=eq.${ua}`, undefined, jb))[1].length === 0);
[st] = await call("POST", "/rest/v1/trip_members", { trip_id: tid, user_id: ub, role: "member" }, ja);
ok("owner adds a member", st === 201, st);
ok("B now sees the trip", (await call("GET", `/rest/v1/trips?select=id&id=eq.${tid}`, undefined, jb))[1].length === 1);
ok("B now sees A's profile", (await call("GET", `/rest/v1/users?select=id&id=eq.${ua}`, undefined, jb))[1].length === 1);
let eid; [st, eid] = await call("POST", "/rest/v1/rpc/save_expense", { p: { trip_id: tid, description: "Dinner", category: "dining", subcategory: "restaurants", amount_cents: 12000, tip_cents: 0, currency: "USD", fx_rate: 1, split_type: "equal", payers: [{ user_id: ua, amount_cents: 12000 }], shares: [{ user_id: ua, share_cents: 6000 }, { user_id: ub, share_cents: 6000 }] } }, ja);
ok("save_expense (one transaction)", st === 200, [st, eid]);
let bad; [st, bad] = await call("POST", "/rest/v1/rpc/save_expense", { p: { trip_id: tid, description: "Bad sums", category: "other", amount_cents: 10000, currency: "USD", payers: [{ user_id: ua, amount_cents: 10000 }], shares: [{ user_id: ua, share_cents: 4000 }, { user_id: ub, share_cents: 4000 }] } }, ja);
ok("server rejects shares that don't sum", st >= 400 && JSON.stringify(bad).includes("add up"), bad);
[st, bad] = await call("POST", "/rest/v1/rpc/save_expense", { p: { trip_id: tid, description: "Bad cat", category: "travel", subcategory: null, amount_cents: 100, currency: "USD", payers: [{ user_id: ua, amount_cents: 100 }], shares: [{ user_id: ua, share_cents: 100 }] } }, ja);
ok("server rejects an invalid category pair", st >= 400, bad);
let h; [st, h] = await call("GET", `/rest/v1/expense_history?select=action&trip_id=eq.${tid}&order=at`, undefined, ja);
ok("history logged the create", h.some((x) => x.action === "expense.create"), h);
await call("POST", "/rest/v1/rpc/set_done", { p_trip: tid, p_done: true }, ja);
let g; [st, g] = await call("POST", "/rest/v1/rpc/gate_open", { p_trip: tid }, ja); ok("gate locked while B isn't done", g === false, g);
[st, bad] = await call("POST", "/rest/v1/rpc/generate_settlements", { p_trip: tid }, ja); ok("settlements refused while locked", st >= 400, bad);
await call("POST", "/rest/v1/rpc/save_expense", { p: { trip_id: tid, description: "Coffee", category: "dining", subcategory: "restaurants", amount_cents: 1000, currency: "USD", payers: [{ user_id: ub, amount_cents: 1000 }], shares: [{ user_id: ua, share_cents: 500 }, { user_id: ub, share_cents: 500 }] } }, jb);
[st, m] = await call("GET", `/rest/v1/trip_members?select=user_id,done_at&trip_id=eq.${tid}`, undefined, ja);
ok("new expense cleared A's Done", m.every((x) => x.done_at === null), m);
await call("POST", "/rest/v1/rpc/set_done", { p_trip: tid, p_done: true }, ja); await call("POST", "/rest/v1/rpc/set_done", { p_trip: tid, p_done: true }, jb);
[st, g] = await call("POST", "/rest/v1/rpc/gate_open", { p_trip: tid }, ja); ok("gate opens when everyone is Done", g === true, g);
let plan; [st, plan] = await call("POST", "/rest/v1/rpc/generate_settlements", { p_trip: tid }, ja);
ok("settlement plan: B pays A $55.00", st === 200 && plan.length === 1 && plan[0].from_user === ub && plan[0].to_user === ua && plan[0].amount_cents === 5500, plan);
const sid = plan[0]?.id;
[st] = await call("POST", "/rest/v1/rpc/mark_settlement", { p_settlement: sid, p_action: "mark_paid" }, ja); ok("recipient cannot mark it paid", st >= 400, st);
[st] = await call("POST", "/rest/v1/rpc/mark_settlement", { p_settlement: sid, p_action: "mark_paid" }, jb); ok("payer marks it paid", st === 204, st);
let tr; [st, tr] = await call("GET", `/rest/v1/trips?select=status&id=eq.${tid}`, undefined, ja); ok("trip becomes settled once every payment is marked", tr[0]?.status === "settled", tr);
[st] = await call("POST", "/rest/v1/rpc/mark_settlement", { p_settlement: sid, p_action: "confirm" }, ja); ok("recipient's optional Got it", st === 204, st);
[st] = await call("DELETE", `/rest/v1/trips?id=eq.${tid}`, undefined, ja); ok("owner deletes the trip", st === 204, st);
ok("nothing left behind", (await call("GET", `/rest/v1/trips?select=id&id=eq.${tid}`, undefined, ja))[1].length === 0);
