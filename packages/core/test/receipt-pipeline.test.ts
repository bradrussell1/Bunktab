/**
 * The receipt-parse worker's read → validate → reconcile → retry loop, with the
 * Anthropic API mocked (RECEIPT_PIPELINE_PROMPT Step 8, "worker tests"). Runs the
 * exact files the Edge Function imports (supabase/functions/_shared/receipt), so a
 * change to the worker's behaviour fails here before it ships.
 */
import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { DEFAULT_MODEL, DEFAULT_RETRY_MODEL, retryNote, runExtraction } from "../../../supabase/functions/_shared/receipt/pipeline.ts";
import { ExtractionSchema } from "../../../supabase/functions/_shared/receipt/schema.ts";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
const schema = JSON.parse(fs.readFileSync(path.join(root, "design/receipt/receipt-extraction.schema.json"), "utf8"));

/** A read of the El Faro bill that adds up. */
function goodRead() {
  return {
    readable: true, merchant: "El Faro Cantina", date: "2026-10-11", currency: "USD",
    items: [
      { raw_text: "GUACAMOLE & CHIPS 14.00", name: "Guacamole & chips", quantity: 1, unit_price: null, line_total: "14.00", kind: "food", modifiers: [], is_void: false, confidence: "high" },
      { raw_text: "CEVICHE TOSTADAS 18.00", name: "Ceviche tostadas", quantity: 1, unit_price: null, line_total: "18.00", kind: "food", modifiers: [], is_void: false, confidence: "high" },
      { raw_text: "FISH TACOS 16.00", name: "Fish tacos", quantity: 1, unit_price: null, line_total: "16.00", kind: "food", modifiers: [], is_void: false, confidence: "high" },
      { raw_text: "CARNE ASADA PLATE 24.00", name: "Carne asada plate", quantity: 1, unit_price: null, line_total: "24.00", kind: "food", modifiers: [], is_void: false, confidence: "high" },
      { raw_text: "SHRIMP ENCHILADAS 21.00", name: "Shrimp enchiladas", quantity: 1, unit_price: null, line_total: "21.00", kind: "food", modifiers: [], is_void: false, confidence: "high" },
      { raw_text: "MARGARITA 2 @ 12.00 24.00", name: "Margarita", quantity: 2, unit_price: "12.00", line_total: "24.00", kind: "alcohol", modifiers: [], is_void: false, confidence: "high" },
      { raw_text: "PACIFICO 3 @ 6.00 18.00", name: "Pacifico", quantity: 3, unit_price: "6.00", line_total: "18.00", kind: "alcohol", modifiers: [], is_void: false, confidence: "high" },
      { raw_text: "CHURROS 9.00", name: "Churros", quantity: 1, unit_price: null, line_total: "9.00", kind: "food", modifiers: [], is_void: false, confidence: "high" },
    ],
    subtotal: "144.00", tax_lines: [{ label: "TAX 8.25%", amount: "11.88", applies_to: "all" }], fees: [], discounts: [],
    total: "155.88", tip_printed: null, tax_included_in_prices: false, confidence: "high", notes: null,
  };
}

type Call = { model: string; userText: string };
/** fetch that answers each call from a queue of responders; records what was asked. */
function mockApi(responders: Array<(call: Call) => Response>) {
  const calls: Call[] = [];
  const fetchImpl = (async (_url: string | URL | Request, init?: RequestInit) => {
    const body = JSON.parse(String(init?.body));
    const call = { model: body.model, userText: body.messages[0].content.find((c: { type: string }) => c.type === "text").text };
    calls.push(call);
    const r = responders[Math.min(calls.length - 1, responders.length - 1)]!;
    return r(call);
  }) as unknown as typeof fetch;
  return { fetchImpl, calls };
}
const ok = (json: unknown, model = DEFAULT_MODEL) => () =>
  new Response(JSON.stringify({ model, stop_reason: "end_turn", content: [{ type: "text", text: JSON.stringify(json) }], usage: { input_tokens: 1200, output_tokens: 400, cache_read_input_tokens: 900 } }), { status: 200 });
const status = (code: number) => () => new Response(JSON.stringify({ error: { type: "rate_limit" } }), { status: code });

const base = (fetchImpl: typeof fetch) => ({ apiKey: "test", model: DEFAULT_MODEL, retryModel: DEFAULT_RETRY_MODEL, imageBase64: "AAAA", mediaType: "image/jpeg" as const, schema, instructions: "read", fetchImpl, sleep: async () => {} });

describe("receipt-parse pipeline", () => {
  it("a read that reconciles is ready after one call, with token usage recorded", async () => {
    const api = mockApi([ok(goodRead())]);
    const r = await runExtraction(base(api.fetchImpl));
    expect(r.outcome).toBe("ready");
    expect(api.calls).toHaveLength(1);
    expect(r.attempts[0]).toMatchObject({ model: DEFAULT_MODEL, ok: true, inputTokens: 1200, outputTokens: 400, cacheReadTokens: 900 });
    if (r.outcome === "ready") expect(r.reconciliation.totalCents).toBe(15588);
  });

  it("a read that does not add up retries once on the stronger model with the diff in the note", async () => {
    const bad = goodRead(); bad.items[2]!.line_total = "61.00";      // fish tacos misread: items now 189.00 vs subtotal 144.00
    const api = mockApi([ok(bad), ok(goodRead(), DEFAULT_RETRY_MODEL)]);
    const r = await runExtraction(base(api.fetchImpl));
    expect(api.calls.map((c) => c.model)).toEqual([DEFAULT_MODEL, DEFAULT_RETRY_MODEL]);
    expect(api.calls[1]!.userText).toContain("Your previous read did not add up");
    expect(api.calls[1]!.userText).toContain("45.00");
    expect(r.outcome).toBe("ready");
    expect(r.attempts.map((a) => a.ok)).toEqual([false, true]);
  });

  it("two reads that both fail reconciliation end as needs_review with a suspect line", async () => {
    const bad = goodRead(); bad.items[2]!.line_total = "61.00";
    const api = mockApi([ok(bad), ok(bad, DEFAULT_RETRY_MODEL)]);
    const r = await runExtraction(base(api.fetchImpl));
    expect(r.outcome).toBe("needs_review");
    if (r.outcome === "needs_review") { expect(r.reconciliation.ok).toBe(false); expect(r.reconciliation.suspectPosition).toBe(2); }
  });

  it("readable=false is unreadable after a single call, never retried", async () => {
    const api = mockApi([ok({ ...goodRead(), readable: false, items: [], subtotal: null, total: null, notes: "a menu, not a receipt" })]);
    const r = await runExtraction(base(api.fetchImpl));
    expect(r.outcome).toBe("unreadable");
    expect(api.calls).toHaveLength(1);
    if (r.outcome === "unreadable") expect(r.notes).toBe("a menu, not a receipt");
  });

  it("429 then 529 back off and the third try succeeds", async () => {
    const api = mockApi([status(429), status(529), ok(goodRead())]);
    const r = await runExtraction(base(api.fetchImpl));
    expect(r.outcome).toBe("ready");
    expect(api.calls).toHaveLength(3);
  });

  it("four 429s in a row fail with ai_unavailable", async () => {
    const api = mockApi([status(429)]);
    const r = await runExtraction(base(api.fetchImpl));
    expect(r.outcome).toBe("failed");
    if (r.outcome === "failed") expect(r.code).toBe("ai_unavailable");
    expect(api.calls).toHaveLength(4);
  });

  it("a response that breaks the schema on both models fails with bad_output", async () => {
    const broken = { ...goodRead(), items: [{ ...goodRead().items[0], quantity: 500 }] };   // quantity outside 1–99
    const api = mockApi([ok(broken), ok(broken, DEFAULT_RETRY_MODEL)]);
    const r = await runExtraction(base(api.fetchImpl));
    expect(r.outcome).toBe("failed");
    if (r.outcome === "failed") expect(r.code).toBe("bad_output");
  });

  it("out-of-range amounts are flagged instead of trusted", async () => {
    const huge = goodRead(); huge.items[0]!.line_total = "14000.00"; huge.subtotal = "14130.00"; huge.total = "14141.88";
    const api = mockApi([ok(huge), ok(huge, DEFAULT_RETRY_MODEL)]);
    const r = await runExtraction(base(api.fetchImpl));
    expect(r.outcome).toBe("needs_review");
    if (r.outcome === "needs_review") expect(r.reconciliation.reasons.join(" ")).toMatch(/out of range/);
  });

  it("retryNote names the gap in dollars", () => {
    expect(retryNote({ ok: false, subtotalDiffCents: 4500, totalDiffCents: null, subtotalCents: 14400, totalCents: 15588, suspectPosition: 2, reasons: [] })).toContain("off by 45.00");
  });
});

describe("extraction schema", () => {
  it("the Zod schema and the JSON schema sent to the model describe the same object", () => {
    const zodKeys = Object.keys(ExtractionSchema.shape).sort();
    expect(zodKeys).toEqual([...schema.required].sort());
    expect(Object.keys(schema.properties).sort()).toEqual(zodKeys);
    const itemKeys = Object.keys((ExtractionSchema.shape.items as any).element.shape).sort();
    expect(itemKeys).toEqual([...schema.properties.items.items.required].sort());
    expect(schema.properties.items.items.properties.kind.enum).toEqual(["food", "drink", "alcohol", "other"]);
  });

  it("a sample response passes Zod", () => {
    expect(() => ExtractionSchema.parse(goodRead())).not.toThrow();
  });
});
