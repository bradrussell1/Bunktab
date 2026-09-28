// read-receipt: read the final total off a receipt photo (spec: Receipt
// reading). The user uploads to receipts/<trip_id>/<expense_or_temp_id>.jpg
// first (storage policy: trip members only), then POSTs here with their JWT:
//   { "bucket": "receipts", "path": "<trip_id>/<name>.jpg" }
// → { total_cents, currency, confidence }  (nulls when unreadable / not configured)
// Membership is enforced by reading the trip through the caller's own client
// (RLS), then the object is fetched with the service role and sent to Claude
// (claude-sonnet-5, vision). Anthropic does not train on API inputs.
import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders, json } from "../_shared/cors.ts";

const MODEL = "claude-sonnet-5";
const PROMPT = "This is a photo of a receipt. Find the FINAL total the customer pays (after tax; if a tip line is blank, the pre-tip total). Reply with JSON only, no prose: {\"total\": <number or null>, \"currency\": <ISO 4217 code or null>, \"confidence\": \"high\" | \"low\"}. Use null when you cannot read a total.";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "method" }, 405);
  const auth = req.headers.get("Authorization") ?? "";
  const { bucket = "receipts", path } = await req.json().catch(() => ({}));
  if (!path || typeof path !== "string" || bucket !== "receipts") return json({ error: "bad request" }, 400);
  const tripId = path.split("/")[0];

  const asUser = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, { global: { headers: { Authorization: auth } }, auth: { persistSession: false } });
  const { data: trip } = await asUser.from("trips").select("id").eq("id", tripId).maybeSingle();
  if (!trip) return json({ error: "unauthorized" }, 401);

  const key = Deno.env.get("ANTHROPIC_API_KEY");
  if (!key) return json({ total_cents: null, currency: null, confidence: null, error: "not configured" });

  const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });
  const { data: blob, error } = await admin.storage.from(bucket).download(path);
  if (error || !blob) return json({ error: error?.message ?? "no file" }, 404);
  const bytes = new Uint8Array(await blob.arrayBuffer());
  let b64 = ""; for (let i = 0; i < bytes.length; i += 0x8000) b64 += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  b64 = btoa(b64);
  const media = blob.type && blob.type.startsWith("image/") ? blob.type : "image/jpeg";

  const r = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    // a key that isn't scoped to a workspace must name one (ANTHROPIC_WORKSPACE_ID)
    headers: { "x-api-key": key, "anthropic-version": "2023-06-01", "Content-Type": "application/json", ...(Deno.env.get("ANTHROPIC_WORKSPACE_ID") ? { "anthropic-workspace-id": Deno.env.get("ANTHROPIC_WORKSPACE_ID")! } : {}) },
    body: JSON.stringify({ model: MODEL, max_tokens: 100, messages: [{ role: "user", content: [{ type: "image", source: { type: "base64", media_type: media, data: b64 } }, { type: "text", text: PROMPT }] }] }),
  });
  if (!r.ok) {
    const detail = (await r.text()).slice(0, 200);
    console.error("anthropic", r.status, detail);
    return json({ total_cents: null, currency: null, confidence: null, error: `anthropic ${r.status}` });
  }
  const j = await r.json();
  const text: string = j?.content?.find((c: { type: string }) => c.type === "text")?.text ?? "";
  let parsed: { total?: number | null; currency?: string | null; confidence?: string } = {};
  try { parsed = JSON.parse(text.slice(text.indexOf("{"), text.lastIndexOf("}") + 1)); } catch { /* unreadable */ }
  const total = typeof parsed.total === "number" && isFinite(parsed.total) && parsed.total >= 0 ? Math.round(parsed.total * 100) : null;
  return json({ total_cents: total, currency: parsed.currency ?? null, confidence: total === null ? null : (parsed.confidence === "high" ? "high" : "low") });
});
