// Receipt extraction eval (RECEIPT_SPLIT_PROMPT, Verification 2). Runs every fixture in
// design/receipt/fixtures/receipts/ through the same pipeline the Edge Function uses and
// reports the reconciled-pass rate, the totals-exact rate and per-line accuracy.
//
//   ANTHROPIC_API_KEY=… node scripts/receipt-eval.mjs            # local: the pipeline in-process
//   node scripts/receipt-eval.mjs --remote                          # through the deployed function, as a test account
//     needs SUPABASE_URL, SUPABASE_ANON_KEY, TEST_PHONE (+1555…), TEST_OTP (123456), TEST_TRIP_ID
//
// Output: a table per fixture and a summary; --json writes design/receipt/fixtures/receipts/eval.json.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { runExtraction, DEFAULT_MODEL, DEFAULT_RETRY_MODEL } from "../supabase/functions/_shared/receipt/pipeline.ts";
import { INSTRUCTIONS } from "../supabase/functions/receipt-parse/prompts/receipt-extraction.v1.ts";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const dir = path.join(root, "design/receipt/fixtures/receipts");
const schema = JSON.parse(fs.readFileSync(path.join(root, "supabase/functions/receipt-parse/schema.json"), "utf8"));
const remote = process.argv.includes("--remote");
const cases = fs.readdirSync(dir).filter((f) => f.endsWith(".expected.json")).map((f) => f.replace(/\.expected\.json$/, "")).sort();

function imagesFor(name) {
  const two = [1, 2].map((i) => path.join(dir, `${name}-${i}.png`));
  return fs.existsSync(two[0]) ? two : [path.join(dir, `${name}.png`)];
}

/** A two-photo receipt is read as one tall image: stack the pages (the app does the same before upload). */
async function loadImage(files) {
  if (files.length === 1) return { base64: fs.readFileSync(files[0]).toString("base64"), mediaType: "image/png" };
  const { chromium } = (await import("node:module")).createRequire(import.meta.url)("playwright-core");
  const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH ?? "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome", headless: true });
  const page = await browser.newPage({ viewport: { width: 700, height: 1800 } });
  await page.setContent(`<body style="margin:0;background:#6d655c">${files.map((f) => `<img src="data:image/png;base64,${fs.readFileSync(f).toString("base64")}" style="display:block;width:700px">`).join("")}</body>`);
  const buf = await page.screenshot({ fullPage: true });
  await browser.close();
  return { base64: buf.toString("base64"), mediaType: "image/png" };
}

async function readLocal(name) {
  const key = process.env.ANTHROPIC_API_KEY; if (!key) throw new Error("ANTHROPIC_API_KEY not set (or use --remote)");
  const img = await loadImage(imagesFor(name));
  const r = await runExtraction({ apiKey: key, workspaceId: process.env.ANTHROPIC_WORKSPACE_ID, model: process.env.RECEIPT_MODEL ?? DEFAULT_MODEL, retryModel: process.env.RECEIPT_RETRY_MODEL ?? DEFAULT_RETRY_MODEL, imageBase64: img.base64, mediaType: img.mediaType, schema, instructions: INSTRUCTIONS });
  if (r.outcome === "ready" || r.outcome === "needs_review") return { status: r.outcome, reconciled: r.reconciliation.ok, items: r.normalized.items.filter((i) => !i.isVoid), total: r.normalized.printedTotalCents, subtotal: r.normalized.subtotalCents, attempts: r.attempts };
  return { status: r.outcome === "unreadable" ? "failed:unreadable" : `failed:${r.error}`, reconciled: false, items: [], total: null, subtotal: null, attempts: r.attempts };
}

async function readRemote(name) {
  const { createClient } = await import("@supabase/supabase-js");
  const sb = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY, { auth: { persistSession: false } });
  const { error: e1 } = await sb.auth.signInWithOtp({ phone: process.env.TEST_PHONE }); if (e1) throw e1;
  const { data: auth, error: e2 } = await sb.auth.verifyOtp({ phone: process.env.TEST_PHONE, token: process.env.TEST_OTP, type: "sms" }); if (e2) throw e2;
  const files = imagesFor(name);
  const img = await loadImage(files);
  const bytes = Buffer.from(img.base64, "base64");
  const sha = (await import("node:crypto")).createHash("sha256").update(bytes).digest("hex");
  const receiptId = (await import("node:crypto")).randomUUID();
  const trip = process.env.TEST_TRIP_ID;
  const storagePath = `${trip}/${receiptId}.png`;
  const { error: e3 } = await sb.storage.from("receipts").upload(storagePath, bytes, { contentType: "image/png" }); if (e3) throw e3;
  const { error: e4 } = await sb.from("receipts").insert({ id: receiptId, trip_id: trip, storage_path: storagePath, image_sha256: `${sha}-${Date.now()}`, created_by: auth.user.id });
  if (e4) throw e4;
  const started = Date.now();
  let row = null;
  while (Date.now() - started < 120_000) {
    await new Promise((r) => setTimeout(r, 2000));
    const { data } = await sb.from("receipts").select("status, reconciled, printed_total_cents, subtotal_cents, error, model, latency_ms").eq("id", receiptId).single();
    row = data; if (row && !["queued", "processing"].includes(row.status)) break;
  }
  const { data: items } = await sb.from("receipt_items").select("name, quantity, line_total_cents, kind").eq("receipt_id", receiptId).order("position");
  await sb.from("receipts").delete().eq("id", receiptId); await sb.storage.from("receipts").remove([storagePath]);
  return { status: row?.status === "failed" ? `failed:${row.error}` : row?.status ?? "timeout", reconciled: !!row?.reconciled, items: (items ?? []).map((i) => ({ name: i.name, quantity: i.quantity, lineTotalCents: i.line_total_cents, kind: i.kind })), total: row?.printed_total_cents ?? null, subtotal: row?.subtotal_cents ?? null, attempts: [{ model: row?.model, latencyMs: row?.latency_ms }] };
}

const results = [];
for (const name of cases) {
  const exp = JSON.parse(fs.readFileSync(path.join(dir, `${name}.expected.json`), "utf8"));
  const t0 = Date.now();
  let got;
  try { got = await (remote ? readRemote(name) : readLocal(name)); } catch (e) { got = { status: `error:${e.message}`, reconciled: false, items: [], total: null, subtotal: null, attempts: [] }; }
  const expItems = exp.items.filter((i) => !i.is_void);
  const lineHits = expItems.filter((ei) => got.items.some((gi) => gi.lineTotalCents === ei.line_total_cents && gi.quantity === ei.quantity)).length;
  const r = {
    name, expectedReadable: exp.readable, status: got.status, reconciled: got.reconciled,
    totalExact: exp.readable ? got.total === exp.printed_total_cents : got.status.startsWith("failed:unreadable"),
    subtotalExact: exp.readable ? got.subtotal === exp.subtotal_cents : null,
    linesExpected: expItems.length, linesRead: got.items.length, lineHits, ms: Date.now() - t0, attempts: got.attempts,
  };
  results.push(r);
  console.log(`${name.padEnd(18)} ${String(r.status).padEnd(14)} reconciled=${r.reconciled ? "yes" : "no "} total=${r.totalExact ? "exact" : "off  "} lines ${lineHits}/${expItems.length} (read ${got.items.length}) ${r.ms}ms ${r.attempts.map((a) => a.model).join("→")}`);
}
const readable = results.filter((r) => r.expectedReadable);
const summary = {
  fixtures: results.length,
  reconciledPassRate: readable.length ? readable.filter((r) => r.reconciled).length / readable.length : 0,
  totalsExactRate: readable.length ? readable.filter((r) => r.totalExact).length / readable.length : 0,
  lineAccuracy: readable.reduce((s, r) => s + r.lineHits, 0) / Math.max(1, readable.reduce((s, r) => s + r.linesExpected, 0)),
  nonReceiptRejected: results.filter((r) => !r.expectedReadable).every((r) => r.totalExact),
  mode: remote ? "remote" : "local", at: new Date().toISOString(),
};
console.log("\nreconciled pass rate:", (summary.reconciledPassRate * 100).toFixed(0) + "%", " totals exact:", (summary.totalsExactRate * 100).toFixed(0) + "%", " line accuracy:", (summary.lineAccuracy * 100).toFixed(0) + "%", " non-receipt rejected:", summary.nonReceiptRejected);
if (process.argv.includes("--json")) fs.writeFileSync(path.join(dir, "eval.json"), JSON.stringify({ summary, results }, null, 2) + "\n");
