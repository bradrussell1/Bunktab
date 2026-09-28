// send-invite: text an invitee their link (spec: Create trip → Invite; Push
// notifications → "Invited to a trip": text message if not on the app).
// Called by Postgres (invites insert trigger → pg_net) with the shared secret,
// or by the app with the user's JWT (then only for invites they sent).
// Body: { invite_id }
// Twilio secrets: TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_FROM (a
// Messaging Service SID "MG…" or an E.164 number). Missing secrets fail soft:
// the attempt is logged in notification_log with the error, nothing throws.
import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders, internalOk, json } from "../_shared/cors.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "method" }, 405);
  const { invite_id } = await req.json().catch(() => ({}));
  if (!invite_id) return json({ error: "invite_id required" }, 400);

  const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });
  let callerId: string | null = null;
  if (!internalOk(req)) {
    const auth = req.headers.get("Authorization") ?? "";
    const { data: { user } } = await createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, { global: { headers: { Authorization: auth } }, auth: { persistSession: false } }).auth.getUser();
    if (!user) return json({ error: "unauthorized" }, 401);
    callerId = user.id;
  }

  const { data: inv } = await admin.from("invites").select("id, trip_id, phone, token, status, invited_by, trips(title), users!invites_invited_by_fkey(display_name)").eq("id", invite_id).maybeSingle();
  if (!inv) return json({ error: "invite not found" }, 404);
  if (callerId && inv.invited_by !== callerId) return json({ error: "forbidden" }, 403);
  if (inv.status !== "pending") return json({ skipped: inv.status });

  // already on the app? then a push will do and the phone login links them anyway
  const { data: existing } = await admin.from("users").select("id").eq("phone", inv.phone).maybeSingle();
  const trip = (inv as unknown as { trips: { title: string } | null }).trips;
  const inviter = (inv as unknown as { users: { display_name: string | null } | null }).users;
  const who = inviter?.display_name?.split(" ")[0] || "A friend";
  const base = Deno.env.get("INVITE_BASE_URL") ?? "https://checkm8.app/i/";
  // one-time invitation; the Messaging Service handles STOP/HELP automatically
  const text = `Checkm8: ${who} added you to '${trip?.title ?? "a trip"}' to split trip expenses. Open it: ${base}${inv.token}\nReply STOP to opt out.`;
  const to = inv.phone.startsWith("+") ? inv.phone : `+${inv.phone}`;

  const sid = Deno.env.get("TWILIO_ACCOUNT_SID"), tok = Deno.env.get("TWILIO_AUTH_TOKEN"), from = Deno.env.get("TWILIO_FROM");
  let result: Record<string, unknown>;
  if (!sid || !tok || !from) {
    result = { error: "twilio not configured", missing: [!sid && "TWILIO_ACCOUNT_SID", !tok && "TWILIO_AUTH_TOKEN", !from && "TWILIO_FROM"].filter(Boolean) };
  } else {
    const form = new URLSearchParams({ To: to, Body: text });
    if (from.startsWith("MG")) form.set("MessagingServiceSid", from); else form.set("From", from);
    const r = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
      method: "POST", headers: { Authorization: "Basic " + btoa(`${sid}:${tok}`), "Content-Type": "application/x-www-form-urlencoded" }, body: form,
    });
    const j = await r.json().catch(() => ({}));
    result = r.ok ? { sid: j.sid, status: j.status } : { error: j.message ?? `twilio ${r.status}`, code: j.code };
  }
  if (existing?.id) {
    // they have the app: also push
    await admin.from("notification_log").insert({ user_id: existing.id, trip_id: inv.trip_id, kind: "invite.push", payload: { title: trip?.title ?? "Checkm8", body: `${who} added you to this trip.` } });
    await admin.rpc("notify", { p_user: existing.id, p_kind: "trip.invited", p_title: trip?.title ?? "Checkm8", p_body: `${who} added you to this trip.`, p_data: {}, p_trip: inv.trip_id, p_dedupe: `invite:${inv.id}` }).then(() => undefined, () => undefined);
  }
  await admin.from("notification_log").insert({ user_id: inv.invited_by, trip_id: inv.trip_id, kind: "invite.sms", dedupe_key: `invite.sms:${inv.id}`, payload: { to, text, ...result } });
  return json({ ok: !("error" in result), ...result });
});
