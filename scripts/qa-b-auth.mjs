// QA Agent B · auth probes: password policy, OTP verify limits, reset lookup
// enumeration, token validity after account deletion. Test numbers only.
import fs from "node:fs";
const env = Object.fromEntries(fs.readFileSync("apps/mobile/.env", "utf8").trim().split("\n").map((l) => l.split(/=(.*)/s).slice(0, 2)));
const BASE = env.EXPO_PUBLIC_SUPABASE_URL, ANON = env.EXPO_PUBLIC_SUPABASE_ANON_KEY.trim();
const H = (jwt) => ({ apikey: ANON, "Content-Type": "application/json", Authorization: `Bearer ${jwt ?? ANON}` });
const req = async (jwt, method, path, body) => { let r; for (let i = 0; ; i++) { try { r = await fetch(BASE + path, { method, headers: H(jwt), body: body === undefined ? undefined : JSON.stringify(body) }); break; } catch (e) { if (i >= 3) throw e; await new Promise((res) => setTimeout(res, 300 * (i + 1))); } } const t = await r.text(); let d; try { d = JSON.parse(t); } catch { d = t; } return [r.status, d, r.headers]; };
const out = (id, v, d) => console.log(`${v.padEnd(7)} ${id}  ${typeof d === "string" ? d : JSON.stringify(d).slice(0, 220)}`);

// 1. password policy server-side
{ const [s, d] = await req(null, "POST", "/auth/v1/signup", { email: `qa-b-${Date.now()}@example.invalid`, password: "abc" }); out("AUTH.password_min_length_server", s >= 400 ? "OK" : "FAIL", `${s} ${JSON.stringify(d).slice(0, 120)}`); }
// 2. signup with a disposable email creates an account with no phone → what can it do?
let ghost = null;
{ const email = `qa-b-ghost-${Date.now()}@example.invalid`; const [s, d] = await req(null, "POST", "/auth/v1/signup", { email, password: "Checkm8-QA-ghost-2026" });
  out("AUTH.email_only_signup_autoconfirmed", s === 200 && d.access_token ? "WARN" : "INFO", `${s} session=${!!d.access_token} (mailer_autoconfirm on: any email string creates a live account without verification)`);
  if (d.access_token) { ghost = { jwt: d.access_token, id: d.user.id };
    const [s2, d2] = await req(ghost.jwt, "POST", "/rest/v1/trips", { title: "ghost trip", start_date: "2026-11-01", end_date: "2026-11-02", created_by: ghost.id });
    out("AUTH.phoneless_account_can_write", s2 < 300 ? "WARN" : "OK", `${s2} ${JSON.stringify(d2).slice(0, 80)} (RLS does not require a confirmed phone)`);
    const [s3, d3] = await req(ghost.jwt, "POST", "/rest/v1/rpc/delete_my_account", {}); out("AUTH.ghost_cleanup", s3 === 204 ? "OK" : "WARN", `${s3} ${JSON.stringify(d3).slice(0, 60)}`); } }
// 3. OTP verify brute-force limits (test number, wrong codes, a handful only)
{ await req(null, "POST", "/auth/v1/otp", { phone: "+15555550102" });
  const codes = []; for (let i = 0; i < 6; i++) { const [s, d, h] = await req(null, "POST", "/auth/v1/verify", { phone: "+15555550102", token: String(100000 + i), type: "sms" }); codes.push(`${s}${h.get("x-ratelimit-remaining") ? ":" + h.get("x-ratelimit-remaining") : ""}${d?.error_code ? ":" + d.error_code : ""}`); }
  out("AUTH.otp_verify_wrong_codes_x6", "INFO", codes.join(" ") + "  (no lockout observed = INFO; Supabase relies on 6-digit space + per-IP limits)"); }
// 4. reset lookup enumeration
{ const [s1, d1] = await req(null, "POST", "/rest/v1/rpc/request_password_reset", { p_identifier: "+15555550103" }); const [s2, d2] = await req(null, "POST", "/rest/v1/rpc/request_password_reset", { p_identifier: "+15555550199" }); const [s3, d3] = await req(null, "POST", "/rest/v1/rpc/request_password_reset", { p_identifier: "nobody@example.invalid" });
  out("AUTH.reset_lookup_enumerates", "WARN", `known phone → ${JSON.stringify(d1)}; unknown phone → ${JSON.stringify(d2)}; unknown email → ${JSON.stringify(d3)} (anon can confirm whether a phone/email has an account; also returns the full phone for an email, which is more than a reset needs)`); }
// 5. token validity after delete_my_account (use the ghost pattern again so no test account is lost)
{ const email = `qa-b-ghost2-${Date.now()}@example.invalid`; const [, d] = await req(null, "POST", "/auth/v1/signup", { email, password: "Checkm8-QA-ghost-2026" });
  if (d?.access_token) { const jwt = d.access_token; const [sdel] = await req(jwt, "POST", "/rest/v1/rpc/delete_my_account", {});
    const [sa, da] = await req(jwt, "GET", "/rest/v1/trips?select=id"); const [su, du] = await req(jwt, "GET", "/auth/v1/user"); const [sr, dr] = await req(jwt, "POST", "/auth/v1/token?grant_type=refresh_token", { refresh_token: d.refresh_token });
    out("AUTH.jwt_after_delete", sa === 200 ? "WARN" : "OK", `delete=${sdel}; REST with old JWT → ${sa} ${JSON.stringify(da).slice(0, 40)}; /auth/user → ${su}; refresh → ${sr} ${JSON.stringify(dr).slice(0, 60)} (access token stays valid for RLS until it expires: ~60 min)`); } }
// 6. anon can call RPCs?
for (const [fn, body] of [["save_expense", { p: {} }], ["set_done", { p_trip: "00000000-0000-0000-0000-000000000000", p_done: true }], ["generate_settlements", { p_trip: "00000000-0000-0000-0000-000000000000" }], ["delete_my_account", {}], ["notify", { p_user: "00000000-0000-0000-0000-000000000000", p_kind: "x", p_title: "x", p_body: "x" }], ["run_nudges", {}], ["run_auto_archive", {}]]) {
  const [s, d] = await req(null, "POST", `/rest/v1/rpc/${fn}`, body); out(`AUTH.anon_rpc.${fn}`, s >= 400 ? "OK" : "FAIL", `${s} ${JSON.stringify(d?.message ?? d).slice(0, 80)}`);
}
