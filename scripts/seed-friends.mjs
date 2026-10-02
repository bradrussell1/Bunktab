// Seed four test friends for the founder's real account so "Invite your
// friends" has people in it. Idempotent. Needs SUPABASE_ACCESS_TOKEN (PAT);
// the service role key is fetched at runtime and never written to disk.
// Usage: SUPABASE_ACCESS_TOKEN=sbp_… node scripts/seed-friends.mjs [owner-email]
import fs from "node:fs";
const REF = fs.readFileSync("supabase/.temp/project-ref", "utf8").trim();
const PAT = process.env.SUPABASE_ACCESS_TOKEN; if (!PAT) throw new Error("SUPABASE_ACCESS_TOKEN not set");
const OWNER_EMAIL = process.argv[2] ?? "brad.russell16@gmail.com";
const BASE = `https://${REF}.supabase.co`;
const PASSWORD = "Bunktab-Test-2026";
const FRIENDS = [
  { name: "Sam Rivera", phone: "15555550103", venmo: "sam-rivera-c8" },
  { name: "Priya Patel", phone: "15555550104", venmo: "priya-patel-c8" },
  { name: "Mike Chen", phone: "15555550105", venmo: "mike-chen-c8" },
  { name: "Jen Alvarez", phone: "15555550106", venmo: "jen-alvarez-c8" },
];
const TEST_OTP = "15555550100=123456,15555550101=123456,15555550102=123456,15555550103=123456,15555550104=123456,15555550105=123456,15555550106=123456";

const mgmt = (path, init = {}) => fetch(`https://api.supabase.com/v1/projects/${REF}${path}`, { ...init, headers: { Authorization: `Bearer ${PAT}`, "Content-Type": "application/json", ...(init.headers ?? {}) } });
const sql = async (query) => { const r = await mgmt("/database/query", { method: "POST", body: JSON.stringify({ query }) }); const t = await r.text(); if (!r.ok) throw new Error(`${r.status} ${t}`); return t ? JSON.parse(t) : []; };

const keys = await (await mgmt("/api-keys?reveal=true")).json();
const SRK = keys.find((k) => k.name === "service_role")?.api_key; if (!SRK) throw new Error("no service role key");
const admin = { apikey: SRK, Authorization: `Bearer ${SRK}`, "Content-Type": "application/json" };

// 1. test OTP list includes the four numbers
const cfg = await (await mgmt("/config/auth", { method: "PATCH", body: JSON.stringify({ sms_test_otp: TEST_OTP, sms_test_otp_valid_until: "2027-09-28T00:00:00Z" }) })).json();
console.log("test OTP numbers:", cfg.sms_test_otp ? cfg.sms_test_otp.split(",").length : cfg.message);

// 2. accounts (confirmed phone + password), users rows filled in
const ids = {};
for (const f of FRIENDS) {
  const [existing] = await sql(`select id from auth.users where phone = '${f.phone}'`);
  let id = existing?.id;
  if (!id) {
    const r = await fetch(`${BASE}/auth/v1/admin/users`, { method: "POST", headers: admin, body: JSON.stringify({ phone: `+${f.phone}`, password: PASSWORD, phone_confirm: true, user_metadata: { display_name: f.name, venmo_username: f.venmo } }) });
    const j = await r.json(); if (!r.ok) throw new Error(`create ${f.name}: ${JSON.stringify(j)}`);
    id = j.id;
  }
  ids[f.phone] = id;
  await sql(`update public.users set display_name = '${f.name}', venmo_username = '${f.venmo}', phone = '${f.phone}', deleted_at = null where id = '${id}'`);
  console.log("friend:", f.name, id);
}

// 3. the owner (the founder's real account)
const [owner] = await sql(`select id from public.users where lower(email) = lower('${OWNER_EMAIL}')`);
if (!owner) throw new Error(`owner ${OWNER_EMAIL} not found in public.users`);

// 4. one archived trip they all share, so they count as friends
let [trip] = await sql(`select id from public.trips where title = 'Checkm8 test crew' and created_by = '${owner.id}'`);
if (!trip) {
  [trip] = await sql(`insert into public.trips (title, description, start_date, end_date, base_currency, status, created_by, last_activity_at)
    values ('Checkm8 test crew', 'Seeded so the test friends show up under Invite your friends.', (current_date - interval '35 days')::date, (current_date - interval '32 days')::date, 'USD', 'archived', '${owner.id}', now() - interval '30 days') returning id`);
}
for (const id of Object.values(ids)) {
  await sql(`insert into public.trip_members (trip_id, user_id, role, joined_via, done_at) values ('${trip.id}', '${id}', 'member', 'app', now()) on conflict (trip_id, user_id) do update set removed_at = null`);
}
await sql(`insert into public.trip_members (trip_id, user_id, role) values ('${trip.id}', '${owner.id}', 'owner') on conflict (trip_id, user_id) do nothing`);
await sql(`update public.trips set status = 'archived' where id = '${trip.id}'`);
const [{ n }] = await sql(`select count(*)::int as n from public.trip_members where trip_id = '${trip.id}' and removed_at is null`);
console.log(`trip "Checkm8 test crew" ${trip.id}: ${n} members (owner + ${FRIENDS.length} friends)`);
console.log(`Friends can log in with their number and password ${PASSWORD}, or code 123456.`);
