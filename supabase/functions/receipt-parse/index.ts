// receipt-parse: read every line of a receipt photo (RECEIPT_SPLIT_PROMPT, Part 3).
//
// Trigger: the app uploads the photo to receipts/<trip_id>/<receipt_id>.jpg and inserts
// a receipts row (status 'queued'); the receipts_parse trigger POSTs {receipt_id} here
// with the shared secret (pg_net). The app may also call it directly with the user's
// JWT (a "Try again" that didn't go through requeue_receipt). Either way the row flips
// queued → processing → ready | needs_review | failed and Realtime carries it back;
// nothing waits on this call.
//
// Models: the prompt names claude-sonnet-5-5 / claude-opus-5-5, which don't exist in
// the models list; the current generation is claude-sonnet-5 (first read) and
// claude-opus-5 (the one retry after a failed reconciliation). Both are env-configurable
// (RECEIPT_MODEL, RECEIPT_RETRY_MODEL).
import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders, internalOk, json } from "../_shared/cors.ts";
import { withSentry } from "../_shared/sentry.ts";
import { DEFAULT_MODEL, DEFAULT_RETRY_MODEL, EXTRACTION_SCHEMA_VERSION, runExtraction } from "../_shared/receipt/pipeline.ts";
import { INSTRUCTIONS, PROMPT_VERSION } from "./prompts/receipt-extraction.v1.ts";
import schema from "./schema.json" with { type: "json" };

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const admin = createClient(SUPABASE_URL, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });

// USD per million tokens, by model family (input, output, cache read). Override with
// RECEIPT_PRICES='{"claude-sonnet-5":[3,15,0.3]}' when list prices change; this is an estimate for dashboards.
const DEFAULT_PRICES: Record<string, [number, number, number]> = { "claude-opus-5": [15, 75, 1.5], "claude-sonnet-5": [3, 15, 0.3] };
function costUsd(model: string, input: number, output: number, cacheRead: number): number {
  let prices = DEFAULT_PRICES;
  try { prices = { ...DEFAULT_PRICES, ...JSON.parse(Deno.env.get("RECEIPT_PRICES") ?? "{}") }; } catch { /* keep defaults */ }
  const key = Object.keys(prices).find((k) => model.startsWith(k));
  const [pi, po, pc] = key ? prices[key] : [3, 15, 0.3];
  return ((input - cacheRead) * pi + cacheRead * pc + output * po) / 1_000_000;
}

function toBase64(bytes: Uint8Array): string {
  let s = ""; for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(s);
}

Deno.serve(withSentry("receipt-parse", async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "method" }, 405);
  const body = await req.json().catch(() => ({}));
  const receiptId: string | undefined = body?.receipt_id;
  if (!receiptId || typeof receiptId !== "string") return json({ error: "receipt_id required" }, 400);

  // 1. access: the database (shared secret) or a trip member (JWT; RLS does the check)
  if (!internalOk(req)) {
    const auth = req.headers.get("Authorization") ?? "";
    if (!auth) return json({ error: "unauthorized" }, 401);
    const asUser = createClient(SUPABASE_URL, Deno.env.get("SUPABASE_ANON_KEY")!, { global: { headers: { Authorization: auth } }, auth: { persistSession: false } });
    const { data: visible } = await asUser.from("receipts").select("id").eq("id", receiptId).maybeSingle();
    if (!visible) return json({ error: "unauthorized" }, 401);
  }

  const { data: receipt, error: rErr } = await admin.from("receipts").select("id, trip_id, storage_path, status, attempts, created_by, created_at").eq("id", receiptId).maybeSingle();
  if (rErr || !receipt) return json({ error: "receipt not found" }, 404);
  if (receipt.status === "processing") return json({ ok: true, status: "processing" });
  if (receipt.status === "ready") return json({ ok: true, status: "ready" });

  // settings: kill switch + daily limit (private.config via receipt_settings(); env overrides the limit)
  const { data: settings } = await admin.rpc("receipt_settings");
  if (settings && settings.ai_enabled === false) {
    await admin.from("receipts").update({ status: "failed", error: "disabled" }).eq("id", receiptId);
    return json({ ok: false, status: "failed", error: "disabled" }, 503);
  }
  // daily limit (also enforced by the insert trigger; this covers direct re-runs)
  const limit = Number(Deno.env.get("RECEIPT_DAILY_LIMIT") ?? settings?.daily_limit ?? 30);
  const since = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
  const { count } = await admin.from("receipts").select("id", { count: "exact", head: true }).eq("created_by", receipt.created_by).gte("created_at", since);
  if ((count ?? 0) > limit) {
    await admin.from("receipts").update({ status: "failed", error: "scan limit reached" }).eq("id", receiptId);
    return json({ ok: false, status: "failed", error: "scan limit reached" }, 429);
  }

  const key = Deno.env.get("ANTHROPIC_API_KEY");
  if (!key) {
    await admin.from("receipts").update({ status: "failed", error: "not configured" }).eq("id", receiptId);
    return json({ ok: false, status: "failed", error: "not configured" }, 500);
  }

  await admin.from("receipts").update({ status: "processing", attempts: (receipt.attempts ?? 0) + 1, error: null, started_at: new Date().toISOString() }).eq("id", receiptId);

  // 2. the photo, server-side
  const { data: blob, error: dErr } = await admin.storage.from("receipts").download(receipt.storage_path);
  if (dErr || !blob) {
    await admin.from("receipts").update({ status: "failed", error: `photo missing: ${dErr?.message ?? "no file"}` }).eq("id", receiptId);
    return json({ ok: false, status: "failed", error: "photo missing" }, 404);
  }
  const bytes = new Uint8Array(await blob.arrayBuffer());
  const mediaType = (blob.type && /^image\/(jpeg|png|webp|gif)$/.test(blob.type) ? blob.type : "image/jpeg") as "image/jpeg";

  // 3. read, validate, reconcile, retry once on the stronger model
  const started = Date.now();
  const result = await runExtraction({
    apiKey: key, workspaceId: Deno.env.get("ANTHROPIC_WORKSPACE_ID"),
    model: Deno.env.get("RECEIPT_MODEL") ?? DEFAULT_MODEL, retryModel: Deno.env.get("RECEIPT_RETRY_MODEL") ?? DEFAULT_RETRY_MODEL,
    imageBase64: toBase64(bytes), mediaType, schema, instructions: INSTRUCTIONS,
  });
  const usage = {
    latency_ms: Date.now() - started,
    input_tokens: result.attempts.reduce((s, a) => s + a.inputTokens, 0),
    output_tokens: result.attempts.reduce((s, a) => s + a.outputTokens, 0),
    cost_estimate_usd: Number(result.attempts.reduce((s, a) => s + costUsd(a.model, a.inputTokens, a.outputTokens, a.cacheReadTokens), 0).toFixed(6)),
    prompt_version: PROMPT_VERSION, schema_version: EXTRACTION_SCHEMA_VERSION,
  };
  // Step 9 log line: ids, status, model, timing, tokens, cost. Never content.
  console.log(JSON.stringify({
    receipt_id: receiptId, trip_id: receipt.trip_id, outcome: result.outcome, model: result.attempts.at(-1)?.model ?? null,
    latency_ms: usage.latency_ms, tokens: usage.input_tokens + usage.output_tokens, cost_estimate_usd: usage.cost_estimate_usd,
    reconciled: result.outcome === "ready", retry_used: result.attempts.length > 1, attempts: result.attempts.map((a) => ({ model: a.model, ok: a.ok, latency_ms: a.latencyMs })),
  }));

  if (result.outcome === "unreadable") {
    await admin.from("receipts").update({ status: "failed", error: "unreadable", model: result.attempts.at(-1)?.model ?? null, ...usage }).eq("id", receiptId);
    return json({ ok: false, status: "failed", error: "unreadable" });
  }
  if (result.outcome === "failed") {
    // the row carries the code the app keys copy off ('ai_unavailable' | 'bad_output'); the detail goes to the log only
    console.error(JSON.stringify({ receipt_id: receiptId, code: result.code, detail: result.error.slice(0, 300) }));
    await admin.from("receipts").update({ status: "failed", error: result.code, model: result.attempts.at(-1)?.model ?? null, ...usage }).eq("id", receiptId);
    return json({ ok: false, status: "failed", error: result.code });
  }

  // 4. save the lines and charges, then flip the row (items first so a ready row is never empty)
  const n = result.normalized, rc = result.reconciliation;
  await admin.from("receipt_items").delete().eq("receipt_id", receiptId);
  await admin.from("receipt_charges").delete().eq("receipt_id", receiptId);
  const { data: items, error: iErr } = await admin.from("receipt_items").insert(
    n.items.filter((it) => !it.isVoid || it.lineTotalCents !== 0).map((it) => ({ receipt_id: receiptId, position: it.position, name: it.name.slice(0, 120), raw_text: it.rawText.slice(0, 200), quantity: it.quantity, line_total_cents: it.lineTotalCents, kind: it.kind, confidence: it.confidence })),
  ).select("id, position");
  if (iErr) {
    await admin.from("receipts").update({ status: "failed", error: `save: ${iErr.message}`.slice(0, 300), ...usage }).eq("id", receiptId);
    return json({ ok: false, status: "failed", error: iErr.message }, 500);
  }
  const idByPos = new Map((items ?? []).map((r: { id: string; position: number }) => [r.position, r.id]));
  if (n.charges.length) {
    const { error: cErr } = await admin.from("receipt_charges").insert(n.charges.map((c) => ({ receipt_id: receiptId, kind: c.kind, label: c.label?.slice(0, 80) ?? null, amount_cents: c.amountCents, applies_to: c.appliesTo, item_id: c.itemIndex != null ? idByPos.get(c.itemIndex) ?? null : null, position: c.position })));
    if (cErr) console.error("charges", cErr.message);
  }
  const status = result.outcome === "ready" ? "ready" : "needs_review";
  await admin.from("receipts").update({
    status, reconciled: rc.ok, error: rc.ok ? null : rc.reasons.join("; ").slice(0, 300),
    model: result.model, raw_extraction: result.extraction,
    merchant: n.merchant, receipt_date: n.date, currency: n.currency,
    subtotal_cents: rc.subtotalCents, tax_cents: n.taxCents, fees_cents: n.feesCents, discounts_cents: n.discountsCents,
    printed_total_cents: n.printedTotalCents ?? rc.totalCents, tip_printed_cents: n.tipPrintedCents, tax_included: n.taxIncluded,
    ...usage,
  }).eq("id", receiptId);
  return json({ ok: true, status, item_count: items?.length ?? 0, reconciled: rc.ok, suspect_position: rc.suspectPosition });
}));
