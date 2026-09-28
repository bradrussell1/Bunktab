// push: send one notification to every device a user has registered.
// Called by Postgres (public.notify → pg_net) with the shared secret.
// Body: { log_id, user_id, title, body, data }
// Records Expo's tickets on the notification_log row; drops devices that
// Expo reports as DeviceNotRegistered.
import { createClient } from "npm:@supabase/supabase-js@2";
import { internalOk, json } from "../_shared/cors.ts";

const EXPO = "https://exp.host/--/api/v2/push/send";

Deno.serve(async (req) => {
  if (req.method !== "POST") return json({ error: "method" }, 405);
  if (!internalOk(req)) return json({ error: "unauthorized" }, 401);
  const { log_id, user_id, title, body, data } = await req.json().catch(() => ({}));
  if (!user_id || !title) return json({ error: "bad request" }, 400);

  const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });
  const { data: devices, error } = await admin.from("devices").select("expo_push_token").eq("user_id", user_id);
  if (error) return json({ error: error.message }, 500);
  if (!devices?.length) {
    if (log_id) await admin.from("notification_log").update({ payload: { title, body, data, delivery: "no_devices" } }).eq("id", log_id);
    return json({ sent: 0, reason: "no devices" });
  }

  const messages = devices.map((d) => ({ to: d.expo_push_token, title, body, data: data ?? {}, sound: "default", priority: "high" }));
  const tickets: unknown[] = [];
  const dead: string[] = [];
  for (let i = 0; i < messages.length; i += 100) {
    const chunk = messages.slice(i, i + 100);
    const headers: Record<string, string> = { "Content-Type": "application/json", Accept: "application/json" };
    const token = Deno.env.get("EXPO_ACCESS_TOKEN"); // optional: only needed if push security is enabled on the Expo project
    if (token) headers.Authorization = `Bearer ${token}`;
    const r = await fetch(EXPO, { method: "POST", headers, body: JSON.stringify(chunk) });
    const j = await r.json().catch(() => ({ error: "bad expo response" }));
    const list: Array<{ status: string; details?: { error?: string } }> = j?.data ?? [];
    list.forEach((t, k) => { tickets.push(t); if (t.status === "error" && t.details?.error === "DeviceNotRegistered") dead.push(chunk[k].to); });
    if (!list.length) tickets.push(j);
  }
  if (dead.length) await admin.from("devices").delete().eq("user_id", user_id).in("expo_push_token", dead);
  if (log_id) await admin.from("notification_log").update({ payload: { title, body, data, delivery: { devices: devices.length, tickets } } }).eq("id", log_id);
  return json({ sent: devices.length - dead.length, dropped: dead.length });
});
