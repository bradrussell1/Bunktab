// Seed a full demo trip: 6 members, 24 expenses across every category,
// mixed payers and participants, one lodging split by nights, some members
// Done. Owner is Sam Rivera (test friend); the user's real account is a
// member so it shows on their phone. Idempotent: an existing trip with the
// same title owned by Sam is deleted first.
// Usage: node scripts/seed-demo-trip.mjs
import fs from "node:fs";
const env = Object.fromEntries(fs.readFileSync("apps/mobile/.env", "utf8").trim().split("\n").map((l) => l.split(/=(.*)/s).slice(0, 2)));
const BASE = env.EXPO_PUBLIC_SUPABASE_URL, ANON = env.EXPO_PUBLIC_SUPABASE_ANON_KEY.trim();
const H = (jwt) => ({ apikey: ANON, "Content-Type": "application/json", Authorization: `Bearer ${jwt}` });
async function pw(phone) { const r = await fetch(`${BASE}/auth/v1/token?grant_type=password`, { method: "POST", headers: H(ANON), body: JSON.stringify({ phone, password: "Checkm8-Test-2026" }) }); const b = await r.json(); if (!b.access_token) throw new Error(`login ${phone}: ${JSON.stringify(b).slice(0, 120)}`); return { jwt: b.access_token, id: b.user.id }; }
async function otp(phone) {
  for (let i = 0; i < 5; i++) {
    await fetch(`${BASE}/auth/v1/otp`, { method: "POST", headers: H(ANON), body: JSON.stringify({ phone }) });
    const b = await (await fetch(`${BASE}/auth/v1/verify`, { method: "POST", headers: H(ANON), body: JSON.stringify({ phone, token: "123456", type: "sms" }) })).json();
    if (b.access_token) return { jwt: b.access_token, id: b.user.id };
    console.log("otp retry for", phone, (b.msg || b.error_description || "").slice(0, 80)); await new Promise((r) => setTimeout(r, 20000));
  }
  throw new Error("could not sign in " + phone);
}
const call = async (jwt, method, path, body, prefer) => { const h = H(jwt); if (prefer) h.Prefer = prefer; let r; for (let i = 0; ; i++) { try { r = await fetch(BASE + path, { method, headers: h, body: body === undefined ? undefined : JSON.stringify(body) }); break; } catch (e) { if (i >= 3) throw e; await new Promise((res) => setTimeout(res, 400 * (i + 1))); } } const t = await r.text(); let d = null; try { d = t ? JSON.parse(t) : null; } catch { d = t; } if (r.status >= 400) throw new Error(`${method} ${path} ${r.status} ${JSON.stringify(d).slice(0, 200)}`); return d; };

const sam = await pw("+15555550103"), priya = await pw("+15555550104"), mike = await pw("+15555550105"), jen = await pw("+15555550106");
const jordan = await otp("+15555550101");
const people = { sam, priya, mike, jen, jordan };
const users = await call(sam.jwt, "GET", "/rest/v1/users?select=id,display_name,phone");
const brad = users.find((u) => u.phone === "16124236230");
if (!brad) throw new Error("the user's account (…6230) isn't visible to Sam; is the test-crew trip in place?");
const ids = { sam: sam.id, priya: priya.id, mike: mike.id, jen: jen.id, jordan: jordan.id, brad: brad.id };
const all = Object.values(ids);
for (const [k, v] of Object.entries(ids)) if (!v) throw new Error("missing id for " + k);

const TITLE = "Cabo crew: Casa Azul";
for (const t of await call(sam.jwt, "GET", `/rest/v1/trips?select=id&title=eq.${encodeURIComponent(TITLE)}`)) await call(sam.jwt, "DELETE", `/rest/v1/trips?id=eq.${t.id}`);
const [trip] = await call(sam.jwt, "POST", "/rest/v1/trips", { title: TITLE, description: "Six of us, one villa, too many tacos. Pool day Saturday, sunset sail Sunday.", start_date: "2026-10-09", end_date: "2026-10-14", base_currency: "USD", created_by: sam.id }, "return=representation");
const T = trip.id;
for (const k of ["priya", "mike", "jen", "jordan", "brad"]) await call(sam.jwt, "POST", "/rest/v1/trip_members", { trip_id: T, user_id: ids[k], role: "member" });
console.log("trip", T, "members", all.length);

// amounts in cents; who = payer key; among = participant keys (default all)
const E = [
  ["sam", "Casa Azul villa (5 nights)", "travel", "rentals", 240000, 0, Object.keys(ids), "nights"],
  ["brad", "Airport shuttle to the villa", "transportation", "rideshare", 9800],
  ["priya", "Welcome dinner at El Farallón", "dining", "restaurants", 41200, 7400],
  ["mike", "Costco run: breakfast + snacks", "groceries", null, 18650],
  ["jen", "Tequila, mezcal, limes", "alcohol", null, 13200],
  ["jordan", "Pool floaties and sunscreen", "other", null, 4300],
  ["brad", "Sunset sail charter", "recreation", null, 66000, 0, ["brad", "sam", "priya", "mike", "jen", "jordan"]],
  ["sam", "Fish tacos at the marina", "dining", "restaurants", 9600, 1600, ["sam", "brad", "mike"]],
  ["priya", "Uber to Medano Beach", "transportation", "rideshare", 2400, 0, ["priya", "jen", "jordan"]],
  ["mike", "Beach club day beds", "recreation", null, 24000],
  ["jen", "Ice, water, more limes", "groceries", null, 3150],
  ["jordan", "Late-night churros", "dining", "delivery", 2800, 500, ["jordan", "brad", "priya"]],
  ["brad", "Snorkel trip to Santa María", "recreation", null, 30000, 0, ["brad", "jen", "jordan", "sam"]],
  ["sam", "Rooftop bar, round one", "dining", "bars", 15800, 3200],
  ["priya", "Rooftop bar, round two", "dining", "bars", 12400, 2600],
  ["mike", "Rental car for the day", "transportation", "misc", 8900, 0, ["mike", "brad", "sam"]],
  ["jen", "Parking at the marina", "transportation", "parking", 1200, 0, ["jen", "mike", "brad"]],
  ["jordan", "Taco cart lunch", "dining", "restaurants", 6700, 800],
  ["brad", "Private chef night", "dining", "catering", 54000, 6000],
  ["sam", "Cerveza for the pool", "alcohol", null, 6400],
  ["priya", "Pharmacy: aloe + Advil", "other", null, 2650, 0, ["priya", "mike"]],
  ["mike", "Last-morning coffee and pastries", "dining", "restaurants", 5400, 900],
  ["jen", "Shuttle back to the airport", "transportation", "rideshare", 9800],
  ["jordan", "Airport lounge passes", "travel", "airfare", 11800, 0, ["jordan", "brad"]],
];
const split = (total, n) => { const base = Math.floor(total / n), rem = total - base * n; return Array.from({ length: n }, (_, i) => base + (i < rem ? 1 : 0)); };
let count = 0;
for (const [who, description, category, subcategory, amount, tip = 0, among = Object.keys(ids), kind] of E) {
  const parts = Array.isArray(among) ? among.map((k) => ids[k]) : all;
  const total = amount + tip;
  const payerId = ids[who];
  let shares;
  if (kind === "nights") {
    const nights = 5; const presence = Object.fromEntries(parts.map((p) => [p, [true, true, true, true, true]]));
    presence[ids.jordan] = [false, true, true, true, true]; presence[ids.jen] = [true, true, true, true, false];
    const perNight = Math.round(total / nights); const acc = Object.fromEntries(parts.map((p) => [p, 0]));
    for (let n = 0; n < nights; n++) { const here = parts.filter((p) => presence[p][n]); const s = split(n === nights - 1 ? total - perNight * (nights - 1) : perNight, here.length); here.forEach((p, i) => (acc[p] += s[i])); }
    shares = parts.map((p) => ({ user_id: p, share_cents: acc[p], base_share_cents: acc[p], nights: presence[p].filter(Boolean).length, night_presence: presence[p] }));
    const drift = total - shares.reduce((a, s) => a + s.share_cents, 0); shares[0].share_cents += drift; shares[0].base_share_cents += drift;
  } else {
    const s = split(total, parts.length);
    shares = parts.map((p, i) => ({ user_id: p, share_cents: s[i], base_share_cents: s[i] }));
  }
  const p = { trip_id: T, description, category, subcategory, amount_cents: amount, tip_cents: tip, currency: "USD", fx_rate: 1, base_amount_cents: total, split_type: kind === "nights" ? "nights" : "equal", nights: kind === "nights" ? 5 : null, payers: [{ user_id: payerId, amount_cents: total, base_amount_cents: total }], shares };
  const actor = people[who] ?? sam; // Brad's expenses are logged by Sam on his behalf (we can't sign in as the user)
  await call(actor.jwt, "POST", "/rest/v1/rpc/save_expense", { p }); count++;
}
console.log("expenses", count);
for (const k of ["priya", "mike", "jen"]) await call(people[k].jwt, "POST", "/rest/v1/rpc/set_done", { p_trip: T, p_done: true });
console.log("done: priya, mike, jen");
const nets = await call(sam.jwt, "GET", `/rest/v1/expenses?select=base_amount_cents&trip_id=eq.${T}&deleted_at=is.null`);
console.log("trip total $" + (nets.reduce((a, e) => a + e.base_amount_cents, 0) / 100).toFixed(2));
