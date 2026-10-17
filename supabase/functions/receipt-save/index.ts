// receipt-save: the one write path for a receipt expense (RECEIPT_SPLIT_PROMPT, Part 5).
//
// The client sends the method, tip, participants and either claims (by item) or
// amounts (exact), plus the shares it computed. This function reloads the receipt's
// lines and charges through the caller's own client (RLS), recomputes every share
// with the same split engine (supabase/functions/_shared/receipt is a verbatim copy of
// packages/core/src/receipt), rejects the save if anything differs by a cent, and then
// calls save_receipt_expense as the user, which does the whole write in one transaction.
//
//   POST { trip_id, receipt_id, expense_id?, method: 'equal'|'exact'|'itemized',
//          tip: { mode, percent?, customCents? }, participants: uuid[],
//          claims?: { [item_id]: { [user_id]: units } }, amounts?: { [user_id]: cents },
//          shares: { [user_id]: cents }, description?, category?, subcategory?, currency?, fx_rate? }
//   → { expense_id, shares }
import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders, json } from "../_shared/cors.ts";
import { withSentry } from "../_shared/sentry.ts";
import { receiptTotals, splitByItem, splitEven, splitExact, type Claims, type Share, type SplitReceipt, type TipChoice } from "../_shared/receipt/index.ts";

Deno.serve(withSentry("receipt-save", async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "method" }, 405);
  const auth = req.headers.get("Authorization") ?? "";
  if (!auth) return json({ error: "unauthorized" }, 401);
  const asUser = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, { global: { headers: { Authorization: auth } }, auth: { persistSession: false } });
  const { data: me } = await asUser.auth.getUser();
  if (!me?.user) return json({ error: "unauthorized" }, 401);

  const p = await req.json().catch(() => null);
  if (!p || typeof p !== "object") return json({ error: "bad request" }, 400);
  const method: string = p.method;
  if (!["equal", "exact", "itemized"].includes(method)) return json({ error: "method must be equal, exact or itemized" }, 400);
  const participants: string[] = Array.isArray(p.participants) ? p.participants : [];
  if (!participants.length) return json({ error: "pick at least one person" }, 400);
  const tip: TipChoice = { mode: p.tip?.mode ?? "none", percent: p.tip?.percent ?? null, customCents: p.tip?.customCents ?? null };
  if (!["percent", "custom", "none"].includes(tip.mode)) return json({ error: "bad tip" }, 400);

  // the receipt, through RLS
  const { data: receipt } = await asUser.from("receipts").select("id, trip_id, status, subtotal_cents, tax_included, currency").eq("id", p.receipt_id).maybeSingle();
  if (!receipt) return json({ error: "receipt not found" }, 404);
  if (receipt.trip_id !== p.trip_id) return json({ error: "receipt is on another dazzle" }, 400);
  const [{ data: items }, { data: charges }] = await Promise.all([
    asUser.from("receipt_items").select("id, name, quantity, line_total_cents, kind, position").eq("receipt_id", receipt.id).order("position"),
    asUser.from("receipt_charges").select("id, kind, label, amount_cents, applies_to, item_id, position").eq("receipt_id", receipt.id).order("position"),
  ]);
  const model: SplitReceipt = {
    items: (items ?? []).map((i) => ({ id: i.id, name: i.name, quantity: i.quantity, lineTotalCents: i.line_total_cents, kind: i.kind })),
    charges: (charges ?? []).map((c) => ({ id: c.id, kind: c.kind, label: c.label, amountCents: c.amount_cents, appliesTo: c.applies_to, itemId: c.item_id })),
    subtotalCents: receipt.subtotal_cents, taxIncluded: receipt.tax_included,
  };
  const totals = receiptTotals(model, tip);
  const holder = me.user.id;

  // recompute
  let shares: Share[];
  let claimsOut: { item_id: string; user_id: string; units: number }[] = [];
  if (method === "equal") shares = splitEven(model, tip, participants, holder);
  else if (method === "exact") {
    const r = splitExact(p.amounts ?? {}, model, tip, holder, participants);
    if (!("shares" in r)) return json({ error: `amounts are ${r.remaining > 0 ? "short" : "over"} by ${Math.abs(r.remaining)} cents` }, 422);
    shares = r.shares;
  } else {
    const claims: Claims = p.claims ?? {};
    const r = splitByItem(model, claims, tip, participants, holder);
    if (!("shares" in r)) return json({ error: `${r.unclaimedFoodCents} cents of food unclaimed` }, 422);
    shares = r.shares;
    for (const itemId of Object.keys(claims)) for (const uid of Object.keys(claims[itemId]!)) if ((claims[itemId]![uid] ?? 0) > 1e-6) claimsOut.push({ item_id: itemId, user_id: uid, units: Number(claims[itemId]![uid]!.toFixed(8)) });
  }

  // the client's arithmetic must match ours to the cent
  const mine = Object.fromEntries(shares.map((s) => [s.personId, s.totalCents]));
  const theirs: Record<string, number> = p.shares ?? {};
  const diff = participants.filter((u) => (theirs[u] ?? 0) !== (mine[u] ?? 0));
  if (diff.length || Object.keys(theirs).length !== participants.length) return json({ error: "split mismatch", server: mine, client: theirs }, 409);

  const payload = {
    id: p.expense_id ?? null, trip_id: p.trip_id, receipt_id: receipt.id, payer_id: holder,
    amount_cents: totals.grandCents, tip_cents: totals.tipCents, tip_mode: tip.mode, tip_percent: tip.mode === "percent" ? tip.percent : null,
    split_type: method, currency: p.currency ?? receipt.currency ?? "USD", fx_rate: p.fx_rate ?? 1,
    description: p.description ?? null, category: p.category ?? "dining", subcategory: p.subcategory ?? "restaurants",
    shares: shares.filter((s) => participants.includes(s.personId)).map((s) => ({ user_id: s.personId, share_cents: s.totalCents })),
    claims: claimsOut,
  };
  const { data: expenseId, error } = await asUser.rpc("save_receipt_expense", { p: payload });
  if (error) return json({ error: error.message }, /42501/.test(error.message) ? 403 : 422);
  return json({ expense_id: expenseId, shares: mine, grand_cents: totals.grandCents });
}));
