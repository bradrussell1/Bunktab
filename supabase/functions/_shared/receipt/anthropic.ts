/**
 * One call to Claude with the receipt image first, then the instructions, with
 * structured outputs pinned to the extraction schema and the static instructions
 * cached. Plain fetch so the same file runs in the Edge Function (Deno) and in the
 * Node eval harness; the existing read-receipt function already calls the API this way.
 *
 * 429 / 529 / network failures retry with backoff up to 3 times (Part 3, step 8).
 */
export type ReadOptions = {
  apiKey: string;
  workspaceId?: string | null;
  model: string;
  imageBase64: string;
  mediaType: "image/jpeg" | "image/png" | "image/webp" | "image/gif";
  schema: unknown;
  instructions: string;
  maxTokens?: number;
  fetchImpl?: typeof fetch;
  /** sleep override for tests */
  sleep?: (ms: number) => Promise<void>;
};

export type ReadResult = {
  json: unknown;
  model: string;
  stopReason: string | null;
  latencyMs: number;
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
  cacheWriteTokens: number;
};

export class AnthropicError extends Error {
  readonly status: number;
  readonly retryable: boolean;
  constructor(message: string, status: number, retryable: boolean) { super(message); this.name = "AnthropicError"; this.status = status; this.retryable = retryable; }
}

const RETRYABLE = new Set([408, 409, 429, 500, 502, 503, 529]);

export async function readReceiptImage(o: ReadOptions): Promise<ReadResult> {
  const f = o.fetchImpl ?? fetch;
  const sleep = o.sleep ?? ((ms: number) => new Promise((r) => setTimeout(r, ms)));
  const body = {
    model: o.model,
    max_tokens: o.maxTokens ?? 8000,
    // the receipt text is read, not reasoned about: keep latency down
    output_config: { effort: "low", format: { type: "json_schema", schema: o.schema } },
    system: [{ type: "text", text: o.instructions, cache_control: { type: "ephemeral" } }],
    messages: [{
      role: "user",
      content: [
        { type: "image", source: { type: "base64", media_type: o.mediaType, data: o.imageBase64 } },
        { type: "text", text: "Read this receipt and return the JSON." },
      ],
    }],
  };
  const headers: Record<string, string> = { "x-api-key": o.apiKey, "anthropic-version": "2023-06-01", "Content-Type": "application/json" };
  if (o.workspaceId) headers["anthropic-workspace-id"] = o.workspaceId;

  let lastErr: AnthropicError | null = null;
  for (let attempt = 0; attempt < 4; attempt++) {
    if (attempt) await sleep(500 * 2 ** attempt + Math.floor(Math.random() * 250));
    const started = Date.now();
    let r: Response;
    try {
      r = await f("https://api.anthropic.com/v1/messages", { method: "POST", headers, body: JSON.stringify(body) });
    } catch (e) {
      lastErr = new AnthropicError(`network: ${e instanceof Error ? e.message : String(e)}`, 0, true);
      continue;
    }
    if (!r.ok) {
      const detail = (await r.text()).slice(0, 300);
      lastErr = new AnthropicError(`anthropic ${r.status}: ${detail}`, r.status, RETRYABLE.has(r.status));
      if (!lastErr.retryable) throw lastErr;
      continue;
    }
    const j = await r.json();
    const text: string = (j?.content ?? []).find((c: { type: string }) => c.type === "text")?.text ?? "";
    let json: unknown = null;
    try { json = JSON.parse(text); } catch { json = null; }
    if (json == null && j?.stop_reason !== "refusal") throw new AnthropicError("model returned no JSON", 0, false);
    return {
      json, model: j?.model ?? o.model, stopReason: j?.stop_reason ?? null, latencyMs: Date.now() - started,
      inputTokens: j?.usage?.input_tokens ?? 0, outputTokens: j?.usage?.output_tokens ?? 0,
      cacheReadTokens: j?.usage?.cache_read_input_tokens ?? 0, cacheWriteTokens: j?.usage?.cache_creation_input_tokens ?? 0,
    };
  }
  throw lastErr ?? new AnthropicError("anthropic: gave up", 0, true);
}
