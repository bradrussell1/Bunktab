"use client";
import { formatCents, itemStatus, receiptTotals, smallestFoodShare, splitByItem, splitEven, splitExact, tapItem, type Claims, type Share, type SplitReceipt, type TipChoice, type Totals } from "@bunktab/core";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Avatar } from "./Avatar";
import { ZebraBust } from "./Zebra";
import { supabaseBrowser } from "@/lib/supabase/browser";
import { activeMembers, memberName, useTrip, type Expense } from "@/lib/trip";

/**
 * Receipt expense on the web guest view (RECEIPT_SPLIT_PROMPT 4.7): the Summary in the
 * app's layout, the receipt photo (signed URL), and - on an OPEN expense split by item -
 * the guest's own claims: tap a dish to take or release it; "Save my items" recomputes
 * every share with @bunktab/core and saves through receipt-save (which recomputes again).
 * Claiming for other people and the camera are app-only.
 */
type ItemRow = { id: string; name: string; quantity: number; line_total_cents: number; kind: "food" | "drink" | "alcohol" | "other" | null; position: number };
type ChargeRow = { id: string; kind: "tax" | "service_charge" | "auto_gratuity" | "other_fee" | "discount"; label: string | null; amount_cents: number; applies_to: "all" | "food" | "alcohol" | "unknown"; item_id: string | null };
type ReceiptRow = { id: string; storage_path: string; merchant: string | null; subtotal_cents: number | null; tax_included: boolean; currency: string | null };

export function ReceiptSummary({ tripId, expenseId, me }: { tripId: string; expenseId: string; me: string }) {
  const { data } = useTrip(tripId);
  const expense: Expense | undefined = data?.expenses.find((e) => e.id === expenseId);
  const [receipt, setReceipt] = useState<ReceiptRow | null>(null);
  const [items, setItems] = useState<ItemRow[]>([]);
  const [charges, setCharges] = useState<ChargeRow[]>([]);
  const [claims, setClaims] = useState<Claims>({});
  const [saved, setSaved] = useState<Claims>({});
  const [photo, setPhoto] = useState<string | null>(null);
  const [showPhoto, setShowPhoto] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!expense?.receipt_id) return;
    const sb = supabaseBrowser();
    (async () => {
      const { data: r } = await sb.from("receipts").select("id, storage_path, merchant, subtotal_cents, tax_included, currency").eq("id", expense.receipt_id!).maybeSingle();
      if (!r) return;
      setReceipt(r as ReceiptRow);
      const [{ data: its }, { data: chs }] = await Promise.all([
        sb.from("receipt_items").select("id, name, quantity, line_total_cents, kind, position").eq("receipt_id", r.id).order("position"),
        sb.from("receipt_charges").select("id, kind, label, amount_cents, applies_to, item_id").eq("receipt_id", r.id).order("position"),
      ]);
      setItems((its ?? []) as ItemRow[]); setCharges((chs ?? []) as ChargeRow[]);
      const ids = ((its ?? []) as ItemRow[]).map((i) => i.id);
      const { data: cl } = ids.length ? await sb.from("receipt_item_claims").select("item_id, user_id, units").in("item_id", ids) : { data: [] };
      const c: Claims = {};
      for (const row of cl ?? []) (c[row.item_id] ??= {})[row.user_id] = Number(row.units);
      setClaims(c); setSaved(c);
      const { data: url } = await sb.storage.from("receipts").createSignedUrl(r.storage_path, 600);
      setPhoto(url?.signedUrl ?? null);
    })();
  }, [expense?.receipt_id]);

  const model: SplitReceipt | null = useMemo(() => receipt ? ({
    items: items.map((i) => ({ id: i.id, name: i.name, quantity: i.quantity, lineTotalCents: i.line_total_cents, kind: i.kind })),
    charges: charges.map((c) => ({ id: c.id, kind: c.kind, label: c.label, amountCents: c.amount_cents, appliesTo: c.applies_to, itemId: c.item_id })),
    subtotalCents: receipt.subtotal_cents, taxIncluded: receipt.tax_included,
  }) : null, [receipt, items, charges]);

  if (!data || !expense) return <main className="stack"><p className="t-caption t-muted">Loading…</p></main>;
  if (!expense.receipt_id || !model) return <main className="stack"><p className="t-body">This expense has no receipt.</p><Link className="t-link" href={`/t/${tripId}`}>Back to the Dazzle</Link></main>;

  const method = expense.split_type === "itemized" ? "itemized" : expense.split_type === "exact" ? "exact" : "equal";
  const holder = expense.expense_payers[0]?.user_id ?? expense.created_by;
  const participants = expense.expense_shares.map((s) => s.user_id);
  const tip: TipChoice = { mode: expense.tip_mode ?? (expense.tip_cents ? "custom" : "none"), percent: expense.tip_percent, customCents: expense.tip_cents };
  const open = data.trip.status === "open";
  const members = activeMembers(data);
  const shortName = (uid: string) => (uid === me ? "You" : (memberName(data, uid, me) ?? "Member").split(/\s+/)[0]!);

  let shares: Share[] | null = null; let problem: string | null = null;
  const totals: Totals = receiptTotals(model, tip);
  if (method === "equal") shares = splitEven(model, tip, participants, holder);
  else if (method === "exact") { const r = splitExact(Object.fromEntries(expense.expense_shares.map((s) => [s.user_id, s.share_cents])), model, tip, holder, participants); shares = "shares" in r ? r.shares : null; }
  else { const r = splitByItem(model, claims, tip, participants, holder); if ("shares" in r) shares = r.shares; else problem = `${formatCents(r.unclaimedFoodCents)} of food is unclaimed`; }

  const dirty = JSON.stringify(claims) !== JSON.stringify(saved);
  const example = method === "itemized" && shares ? smallestFoodShare(shares) : null;
  const methodLabel = method === "itemized" ? "Split by item" : method === "equal" ? "Split evenly" : "Exact split";

  async function saveClaims() {
    if (!shares || !receipt) return;
    setBusy(true); setError(null);
    const { data: res, error: err } = (await supabaseBrowser().functions.invoke("receipt-save", {
      body: { trip_id: tripId, receipt_id: receipt.id, expense_id: expense!.id, method: "itemized", tip, participants, claims, shares: Object.fromEntries(shares.map((s) => [s.personId, s.totalCents])), description: expense!.description, currency: expense!.currency },
    })) as { data: { expense_id?: string; error?: string } | null; error: { message: string } | null };
    setBusy(false);
    if (err || res?.error) { setError(res?.error ?? err?.message ?? "Couldn't save."); return; }
    setSaved(claims);
  }

  return (
    <main className="stack-loose">
      <div className="topbar"><Link href={`/t/${tripId}`} className="icon-btn" aria-label="Back">‹</Link><span className="pill t-caption-strong">{receipt?.merchant ?? expense.description} · {formatCents(totals.grandCents, expense.currency)}</span></div>
      <header className="between">
        <div className="stack-tight"><h1 className="t-title1">Summary</h1><p className="t-caption t-muted">{methodLabel} · {formatCents(totals.grandCents, expense.currency)} adds up to the cent</p></div>
        <ZebraBust mood={problem ? "worried" : "happy"} size={56} label={problem ? "Zebra, worried" : "Zebra, happy"} />
      </header>

      {example && shares ? <div className="inset t-caption"><b>Tax and tip follow the food.</b> {shortName(example.personId)} ordered {formatCents(example.foodCents)} of the {formatCents(totals.subtotalCents)} in food ({((example.foodCents / Math.max(1, totals.subtotalCents)) * 100).toFixed(1)}%), so they cover that share of the {formatCents(totals.taxCents)} tax and {formatCents(totals.tipCents)} tip.</div> : null}
      {method === "equal" ? <div className="inset t-caption"><b>Everyone pays the same.</b> {formatCents(totals.grandCents)} ÷ {participants.length} = {formatCents(Math.floor(totals.grandCents / Math.max(1, participants.length)))} each, with tax and tip included.</div> : null}
      {method === "exact" ? <div className="inset t-caption"><b>Amounts were set by hand.</b> Each total is what was entered. Food, tax and tip are shown in proportion to each share.</div> : null}

      {method === "itemized" ? (
        <section className="card stack">
          <div className="between"><h2 className="t-headline">Who had what</h2>{open ? <span className="t-small t-muted">Tap a dish to take or release it</span> : null}</div>
          <div className="list">
            {model.items.map((it) => {
              const st = itemStatus(it, claims[it.id], participants);
              const mine = (claims[it.id]?.[me] ?? 0) > 1e-6;
              const who = st.claimers.length === participants.length && participants.length > 0 ? "Everyone" : st.claimers.map(shortName).join(", ") || "Nobody yet";
              return (
                <button key={it.id} type="button" className="row" disabled={!open || !participants.includes(me)} aria-pressed={mine} onClick={() => setClaims((c) => tapItem(it, c, me))} style={{ textAlign: "left", background: mine ? "var(--zs-color-surface-inset)" : "transparent", border: 0, borderRadius: "var(--zs-radius-inset)", padding: "var(--zs-space-8) var(--zs-space-10)" }}>
                  <span className="grow"><span className="t-body-strong" style={{ display: "block" }}>{it.name}{it.quantity > 1 ? ` ×${it.quantity}` : ""}</span><span className={`t-small ${st.fullyClaimed ? "t-muted" : "t-error"}`}>{who}{!st.fullyClaimed && it.quantity > 1 ? ` · ${st.leftUnits % 1 === 0 ? st.leftUnits : "some"} left` : ""}</span></span>
                  <b className="t-amount-row num">{formatCents(it.lineTotalCents)}</b>
                </button>
              );
            })}
          </div>
          {open && dirty ? <button type="button" className="btn" onClick={saveClaims} disabled={busy || !!problem}>{problem ? problem : busy ? "Saving…" : "Save my items"}</button> : null}
          {error ? <p className="t-error t-small">{error}</p> : null}
        </section>
      ) : null}

      {shares ? (
        <div className="list">
          {shares.map((s) => {
            const m = members.find((x) => x.user_id === s.personId);
            const pct = method === "itemized" ? `${((s.foodCents / Math.max(1, totals.subtotalCents)) * 100).toFixed(1)}% of the food` : `${((s.totalCents / Math.max(1, totals.grandCents)) * 100).toFixed(1)}% of the bill`;
            return (
              <div key={s.personId} className="card stack-tight">
                <div className="between"><span className="row"><Avatar name={m?.display_name ?? "?"} uri={m?.photo_url} size={28} /><b className="t-headline">{shortName(s.personId)}</b></span><span className="t-small t-muted">{pct}</span><b className="t-headline num">{formatCents(s.totalCents)}</b></div>
                <div className="chips">{([["Food", s.foodCents], ["Tax", s.taxCents], ["Tip", s.tipCents]] as [string, number][]).concat(s.feesCents ? [["Fees", s.feesCents]] : []).map(([k, v]) => <span key={k} className="chip t-small num">{k} {formatCents(v)}</span>)}</div>
              </div>
            );
          })}
        </div>
      ) : null}

      <div className="card between t-caption-strong"><span>Food {formatCents(totals.subtotalCents)} + tax {formatCents(totals.taxCents)}{totals.feesCents ? ` + fees ${formatCents(totals.feesCents)}` : ""} + tip {formatCents(totals.tipCents)}</span><b className="num">= {formatCents(totals.grandCents)}</b></div>
      <p className="t-small t-muted">When a split leaves a stray cent, it goes to the person who paid.</p>

      <div className="row-card"><span className="tile" aria-hidden="true">🧾</span><span className="grow t-body-strong">Receipt photo saved to this Dazzle</span>{photo ? <button type="button" className="t-link" onClick={() => setShowPhoto((v) => !v)} style={{ background: "none", border: 0 }}>{showPhoto ? "Hide" : "View"}</button> : null}</div>
      {showPhoto && photo ? <img src={photo} alt="Receipt" style={{ width: "100%", borderRadius: "var(--zs-radius-card)" }} /> : null}
    </main>
  );
}
