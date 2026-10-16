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
  | { outcome: "failed"; attempts: Attempt[]; error: string };

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
};

export const DEFAULT_MODEL = "claude-sonnet-5";
export const DEFAULT_RETRY_MODEL = "claude-opus-5";

async function once(o: PipelineOptions, model: string): Promise<{ read: ReadResult; extraction?: Extraction; normalized?: Normalized; reconciliation?: Reconciliation; unreadable?: boolean; reason?: string }> {
  const read = await readReceiptImage({ apiKey: o.apiKey, workspaceId: o.workspaceId, model, imageBase64: o.imageBase64, mediaType: o.mediaType, schema: apiSchema(o.schema), instructions: o.instructions, fetchImpl: o.fetchImpl, sleep: o.sleep });
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
      const r = await once(o, model);
      last = r;
      if (r.unreadable) { note(r.read, false, "unreadable"); return { outcome: "unreadable", attempts, notes: r.extraction?.notes ?? null }; }
      if (!r.normalized || !r.reconciliation) { note(r.read, false, r.reason); continue; }   // bad shape or no items: try the stronger model
      note(r.read, r.reconciliation.ok, r.reconciliation.ok ? undefined : r.reconciliation.reasons.join("; "));
      if (r.reconciliation.ok) return { outcome: "ready", extraction: r.extraction!, normalized: r.normalized, reconciliation: r.reconciliation, attempts, model: r.read.model };
      if (model === o.retryModel) break;
    }
  } catch (e) {
    const msg = e instanceof AnthropicError ? e.message : e instanceof Error ? e.message : String(e);
    return { outcome: "failed", attempts, error: msg };
  }
  if (last?.normalized && last.reconciliation) return { outcome: "needs_review", extraction: last.extraction!, normalized: last.normalized, reconciliation: last.reconciliation, attempts, model: last.read.model };
  return { outcome: "failed", attempts, error: last?.reason ?? "no usable read" };
}

export { EXTRACTION_SCHEMA_VERSION };
