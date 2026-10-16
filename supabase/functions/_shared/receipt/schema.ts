/**
 * Zod validation of the model's receipt JSON (RECEIPT_SPLIT_PROMPT Part 3, step 5):
 * shape, enums, decimal-string format, quantities ≥ 1. Structured outputs guarantee
 * the shape; this guards the ranges the schema can't express and anything a retry
 * path or a future model might return. Portable: runs in Deno and in the Node
 * eval harness (zod is resolved through each function's deno.json / the repo root).
 */
import { z } from "zod";
import type { Extraction } from "./extraction.ts";

const decimal = z.string().regex(/^-?\d{1,7}(\.\d{1,2})?$/, "amount must be a decimal string like 12.50");
const decimalOrNull = decimal.nullable();
const confidence = z.enum(["high", "medium", "low"]);

export const ExtractionSchema = z.object({
  readable: z.boolean(),
  merchant: z.string().max(120).nullable(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().catch(null),
  currency: z.string().regex(/^[A-Za-z]{3}$/).nullable().catch(null),
  items: z.array(z.object({
    raw_text: z.string().max(200),
    name: z.string().max(120),
    quantity: z.number().finite().min(1).max(99),   // 1–99 (Step 5.6); out of range is a bad read, not a clamp
    unit_price: decimalOrNull.catch(null),
    line_total: decimal,
    kind: z.enum(["food", "drink", "alcohol", "other"]).catch("other"),
    modifiers: z.array(z.object({ text: z.string().max(120), amount: decimalOrNull.catch(null) })).max(20).catch([]),
    is_void: z.boolean().catch(false),
    confidence: confidence.catch("medium"),
  })).max(200),
  subtotal: decimalOrNull.catch(null),
  tax_lines: z.array(z.object({ label: z.string().max(80), amount: decimal, applies_to: z.enum(["all", "alcohol", "food", "unknown"]).catch("unknown") })).max(10),
  fees: z.array(z.object({ label: z.string().max(80), amount: decimal, kind: z.enum(["service_charge", "auto_gratuity", "other_fee"]).catch("other_fee") })).max(10),
  discounts: z.array(z.object({ label: z.string().max(80), amount: decimal, item_index: z.number().int().nullable().catch(null) })).max(20),
  total: decimalOrNull.catch(null),
  tip_printed: decimalOrNull.catch(null),
  tax_included_in_prices: z.boolean().catch(false),
  confidence: confidence.catch("medium"),
  notes: z.string().max(500).nullable().catch(null),
});

export function validateExtraction(json: unknown): Extraction {
  return ExtractionSchema.parse(json) as Extraction;
}

/** The JSON schema as sent to the API: structured outputs reject `format` and `$comment`. */
export function apiSchema(schema: unknown): unknown {
  if (Array.isArray(schema)) return schema.map(apiSchema);
  if (schema && typeof schema === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(schema as Record<string, unknown>)) {
      if (k === "format" || k === "$comment") continue;
      out[k] = apiSchema(v);
    }
    return out;
  }
  return schema;
}
