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
import { DEFAULT_MODEL, DEFAULT_RETRY_MODEL, EXTRACTION_SCHEMA_VERSION, runExtraction } from "../_shared/receipt/pipeline.ts";
import { INSTRUCTIONS, PROMPT_VERSION } from "./prompts/receipt-extraction.v1.ts";
import schema from "./schema.json" with { type: "json" };

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const admin = createClient(SUPABASE_URL, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });

function toBase64(bytes: Uint8Array): string {
  let s = ""; for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(s);
}

Deno.serve(async (req) => {
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

  // daily limit (also enforced by the insert trigger; this covers direct re-runs)
  const limit = Number(Deno.env.get("RECEIPT_DAILY_LIMIT") ?? 30);
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

  await admin.from("receipts").update({ status: "processing", attempts: (receipt.attempts ?? 0) + 1, error: null }).eq("id", receiptId);

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
    prompt_version: PROMPT_VERSION, schema_version: EXTRACTION_SCHEMA_VERSION,
  };
  console.log(JSON.stringify({ receipt_id: receiptId, outcome: result.outcome, attempts: result.attempts }));

  if (result.outcome === "unreadable") {
    await admin.from("receipts").update({ status: "failed", error: "unreadable", model: result.attempts.at(-1)?.model ?? null, ...usage }).eq("id", receiptId);
    return json({ ok: false, status: "failed", error: "unreadable" });
  }
  if (result.outcome === "failed") {
    await admin.from("receipts").update({ status: "failed", error: result.error.slice(0, 300), model: result.attempts.at(-1)?.model ?? null, ...usage }).eq("id", receiptId);
    return json({ ok: false, status: "failed", error: result.error });
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
});
