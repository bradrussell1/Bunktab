/**
 * Read → validate → normalise → reconcile → (retry on a stronger model) → outcome.
 * Shared by receipt-parse (Deno) and scripts/receipt-eval.mjs (Node), so the eval
 * measures exactly what production does. No I/O besides the model call.
 */
import { AnthropicError, readReceiptImage, type ReadOptions, type ReadResult } from "./anthropic.ts";
import { ExtractionError, EXTRACTION_SCHEMA_VERSION, normalizeExtraction, reconcile, type Extraction, type Normalized, type Reconciliation } from "./extraction.ts";
import { apiSchema, validateExtraction } from "./schema.ts";

export type Attempt = { model: string; latencyMs: number; inputTokens: number; outputTokens: number; cacheReadTokens: number; ok: boolean; reason?: string };

export type PipelineResult =
  | { outcome: "ready" | "needs_review"; extraction: Extraction; normalized: Normalized; reconciliation: Reconciliation; attempts: Attempt[]; model: string }
  | { outcome: "unreadable"; attempts: Attempt[]; notes: string | null }
  | { outcome: "failed"; attempts: Attempt[]; error: string; code: FailureCode };

export type PipelineOptions = {
  apiKey: string;
  workspaceId?: string | null;
  /** First read; a failed reconciliation retries once on `retryModel`. */
  model: string;
  retryModel: string;
  imageBase64: string;
  mediaType: ReadOptions["mediaType"];
  schema: unknown;
  instructions: string;
  fetchImpl?: typeof fetch;
  sleep?: (ms: number) => Promise<void>;
  timeoutMs?: number;
};

/** Error codes the receipts row carries (Step 5.10). */
export type FailureCode = "ai_unavailable" | "bad_output" | "unreadable";

export const DEFAULT_MODEL = "claude-sonnet-5";
export const DEFAULT_RETRY_MODEL = "claude-opus-5";

/** The note the stronger model gets when the first read didn't add up (Step 5.8). */
export function retryNote(rc: Reconciliation | null | undefined, reason?: string): string {
  const diff = rc ? [rc.subtotalDiffCents != null && rc.subtotalDiffCents !== 0 ? `items vs subtotal off by ${(rc.subtotalDiffCents / 100).toFixed(2)}` : null, rc.totalDiffCents != null && rc.totalDiffCents !== 0 ? `subtotal+tax+fees vs total off by ${(rc.totalDiffCents / 100).toFixed(2)}` : null].filter(Boolean).join("; ") : "";
  return `Your previous read did not add up: ${diff || reason || "the lines did not match the printed totals"}. Re-read carefully. Return the JSON.`;
}

async function once(o: PipelineOptions, model: string, userText?: string): Promise<{ read: ReadResult; extraction?: Extraction; normalized?: Normalized; reconciliation?: Reconciliation; unreadable?: boolean; reason?: string }> {
  const read = await readReceiptImage({ apiKey: o.apiKey, workspaceId: o.workspaceId, model, imageBase64: o.imageBase64, mediaType: o.mediaType, schema: apiSchema(o.schema), instructions: o.instructions, userText, timeoutMs: o.timeoutMs, fetchImpl: o.fetchImpl, sleep: o.sleep });
  if (read.stopReason === "refusal" || read.json == null) return { read, reason: "refusal" };
  let extraction: Extraction;
  try { extraction = validateExtraction(read.json); } catch (e) { return { read, reason: `schema: ${e instanceof Error ? e.message.slice(0, 200) : String(e)}` }; }
  if (!extraction.readable) return { read, extraction, unreadable: true };
  try {
    const normalized = normalizeExtraction(extraction);
    const reconciliation = reconcile(normalized);
    return { read, extraction, normalized, reconciliation };
  } catch (e) {
    if (e instanceof ExtractionError && e.code === "UNREADABLE") return { read, extraction, unreadable: true };
    return { read, extraction, reason: e instanceof Error ? e.message : String(e) };
  }
}

export async function runExtraction(o: PipelineOptions): Promise<PipelineResult> {
  const attempts: Attempt[] = [];
  const note = (r: ReadResult, ok: boolean, reason?: string) => attempts.push({ model: r.model, latencyMs: r.latencyMs, inputTokens: r.inputTokens, outputTokens: r.outputTokens, cacheReadTokens: r.cacheReadTokens, ok, reason });
  let last: Awaited<ReturnType<typeof once>> | null = null;
  try {
    for (const model of [o.model, o.retryModel]) {
      const r = await once(o, model, model === o.retryModel && last ? retryNote(last.reconciliation, last.reason) : undefined);
      last = r;
      if (r.unreadable) { note(r.read, false, "unreadable"); return { outcome: "unreadable", attempts, notes: r.extraction?.notes ?? null }; }
      if (!r.normalized || !r.reconciliation) { note(r.read, false, r.reason); continue; }   // bad shape or no items: try the stronger model
      note(r.read, r.reconciliation.ok, r.reconciliation.ok ? undefined : r.reconciliation.reasons.join("; "));
      if (r.reconciliation.ok) return { outcome: "ready", extraction: r.extraction!, normalized: r.normalized, reconciliation: r.reconciliation, attempts, model: r.read.model };
      if (model === o.retryModel) break;
    }
  } catch (e) {
    const msg = e instanceof AnthropicError ? e.message : e instanceof Error ? e.message : String(e);
    const code: FailureCode = e instanceof AnthropicError && (e.retryable || e.status >= 500 || e.status === 429) ? "ai_unavailable" : "bad_output";
    return { outcome: "failed", attempts, error: msg, code };
  }
  if (last?.normalized && last.reconciliation) return { outcome: "needs_review", extraction: last.extraction!, normalized: last.normalized, reconciliation: last.reconciliation, attempts, model: last.read.model };
  return { outcome: "failed", attempts, error: last?.reason ?? "no usable read", code: "bad_output" };
}

export { EXTRACTION_SCHEMA_VERSION };
