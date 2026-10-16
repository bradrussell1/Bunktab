"use client";
import { CATEGORIES, categoryLabel, closeoutUnlocked, formatCents, formatDateRange, nightsBetween, zebraLabel, zebraMoodFor } from "@bunktab/core";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Avatar } from "./Avatar";
import { ZebraBust } from "./Zebra";
import { supabaseBrowser } from "@/lib/supabase/browser";
import { activeMembers, memberName, membersWithNoExpenses, nets, paidBy, previewPayments, shareOf, tripTotal, useTrip } from "@/lib/trip";

/**
 * Guest dazzle view (ticket B9 = B4 minus the Venmo close-out): title, caption,
 * avatar row with done stripes, balance hero with the zebra, stripes inset, who
 * hasn't logged yet, settlement preview, Expenses · People · Summary, and the
 * sheet footer with the Done toggle and Add expense. Figures come from
 * @bunktab/core, the same code the app runs; every RPC is unchanged.
 */
type Tab = "expenses" | "people" | "summary";

function firstName(n: string | null | undefined, fallback: string) { return (n ?? fallback).trim().split(/\s+/)[0] || fallback; }

export function AmountPill({ cents, currency, size }: { cents: number; currency: string; size?: "lg" }) {
  if (cents === 0) return null;
  const cls = `amount-pill ${cents > 0 ? "up" : "down"}${size ? ` ${size}` : ""}`;
  return <span className={cls}>{cents > 0 ? "+" : "−"}{formatCents(Math.abs(cents), currency)}</span>;
}

export function StripeMeter({ members, done }: { members: number; done: number }) {
  return (
    <span className="meter" role="img" aria-label={`${done} of ${members} people are done adding expenses`}>
      <span className="stripes" aria-hidden="true">{Array.from({ length: members }, (_, i) => <i key={i} className={i < done ? "on" : ""} />)}</span>
      <span className="t-caption-strong">{done} of {members} stripes</span>
    </span>
  );
}

export function Toast({ text, onDone }: { text: string; onDone: () => void }) {
  useEffect(() => { const t = setTimeout(onDone, 3000); return () => clearTimeout(t); }, [onDone]);
  return <div className="toast" role="status">{text}</div>;
}

export function TripView({ tripId, me }: { tripId: string; me: string }) {
  const { data, loading, error, reload } = useTrip(tripId);
  const [tab, setTab] = useState<Tab>("expenses");
  const [showPlan, setShowPlan] = useState(false);
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const fig = useMemo(() => {
    if (!data) return null;
    const n = nets(data);
    const members = activeMembers(data);
    return { nets: n, mine: n[me] ?? 0, plan: previewPayments(data), total: tripTotal(data), members, done: members.filter((m) => m.done_at).length, quiet: membersWithNoExpenses(data) };
  }, [data, me]);

  if (loading) return (
    <div className="stack-loose" style={{ paddingTop: "var(--zs-space-32)" }} aria-busy="true" aria-label="Loading the dazzle">
      <div className="skeleton"><i style={{ width: "60%", height: 28 }} /><i style={{ width: "40%" }} /></div>
      <div className="hero-card skeleton" style={{ minHeight: 172 }}><i style={{ width: "30%" }} /><i style={{ width: "55%", height: 36 }} /></div>
      <div className="skeleton"><i style={{ height: 64 }} /><i style={{ height: 64 }} /><i style={{ height: 64 }} /></div>
    </div>
  );
  if (error) return (
    <div className="stack" style={{ paddingTop: "var(--zs-space-32)" }}>
      <div className="error-panel"><ZebraBust mood="worried" size={40} decorative /><span>{error}</span></div>
      <button type="button" className="btn secondary" onClick={() => reload()}>Try again</button>
    </div>
  );
  if (!data || !fig) return (
    <div className="stack col-text" style={{ paddingTop: "var(--zs-space-32)" }}>
      <ZebraBust mood="worried" size={88} label="Zebra, worried" />
      <h1 className="t-title2">This dazzle isn&apos;t available</h1>
      <p className="t-body t-soft">You may not be a member yet. Open the invite link you were texted, or ask the organizer to add your number.</p>
    </div>
  );

  const { trip, members } = data;
  const meMember = members.find((m) => m.user_id === me);
  const unlocked = closeoutUnlocked(fig.members.map((m) => ({ doneAt: m.done_at, removedAt: m.removed_at }))) || !!trip.closeout_override_at;
  const perPerson = fig.members.length ? Math.round(fig.total / fig.members.length) : 0;
  const cur = trip.base_currency;
  const nights = Math.max(0, nightsBetween(trip.start_date, trip.end_date));
  const settled = trip.status !== "open";
  const mood = zebraMoodFor({ place: "dazzle-hero", members: fig.members.length, done: fig.done }) ?? "hi";
  const stillAdding = fig.members.filter((m) => !m.done_at).map((m) => firstName(m.display_name, m.user_id === me ? "You" : "Someone"));
  const toGo = fig.members.length - fig.done;

  async function toggleDone() {
    setBusy(true);
    const next = !meMember?.done_at;
    await supabaseBrowser().rpc("set_done", { p_trip: trip.id, p_done: next });
    setBusy(false); reload();
    setToast(next ? "Done adding. Stripe earned." : "Back to adding.");
  }

  return (
    <>
      <div className="stack-loose" style={{ paddingTop: "var(--zs-space-12)" }}>
        <div className="stack-tight col-text">
          <h1 className="t-title1">{trip.title}</h1>
          <p className="t-caption t-muted">{formatDateRange(trip.start_date, trip.end_date)}{nights ? ` · ${nights} night${nights === 1 ? "" : "s"}` : ""} · {fig.members.length} in the dazzle{settled ? " · Settled" : ""}</p>
          {trip.description && <p className="t-body t-soft">{trip.description}</p>}
          <div className="avatar-row" style={{ marginTop: "var(--zs-space-6)" }} aria-label="Members">
            {fig.members.map((m) => <Avatar key={m.user_id} name={m.user_id === me ? "You" : (m.display_name ?? "Invited")} uri={m.photo_url} done={!!m.done_at} pending={!m.done_at} />)}
          </div>
        </div>

        <div className="hero-card stack" style={{ gap: "var(--zs-space-10)" }}>
          <p className="t-caption t-muted">Your balance</p>
          <p className="t-amount-l num" style={{ paddingRight: "var(--zs-space-24)" }}>{fig.mine === 0 ? "$0.00" : formatCents(Math.abs(fig.mine), cur)}</p>
          <div className="row" style={{ gap: "var(--zs-space-8)" }}>
            {fig.mine !== 0 && !settled && <span className={`amount-pill lg ${fig.mine > 0 ? "up" : "down"}`}>{fig.mine > 0 ? "owed to you" : "you owe"}</span>}
            {settled && <span className="pill outline">Settled</span>}
          </div>
          {!settled && (
            <div className="inset row between" style={{ gap: "var(--zs-space-10)", marginRight: "var(--zs-space-40)", paddingRight: "var(--zs-space-40)" }}>
              <span className="t-caption"><b>{fig.done} of {fig.members.length} stripes.</b>{stillAdding.length > 0 && <span className="t-muted"> {stillAdding.join(", ")} still adding.</span>}</span>
            </div>
          )}
          <ZebraBust mood={mood} size={112} label={zebraLabel(mood, fig.members.length, fig.done)} className="hero-zebra" />
        </div>

        {fig.quiet.length > 0 && !settled && (
          <p className="t-caption t-muted col-text row" style={{ gap: "var(--zs-space-8)" }}><span className="live-dot" aria-hidden="true" />{fig.quiet.map((m) => (m.user_id === me ? "You haven't" : `${firstName(m.display_name, "A member")} hasn't`)).join(", ")} added anything yet.</p>
        )}

        <button type="button" className="inset row between" style={{ width: "100%", border: 0, textAlign: "left", color: "inherit", padding: "var(--zs-space-12) var(--zs-space-14)" }} aria-expanded={showPlan} onClick={() => setShowPlan((v) => !v)}>
          <span className="t-body-strong">See who pays who</span>
          <span className="t-caption-strong t-muted">{showPlan ? "Hide" : `${fig.plan.length} ${fig.plan.length === 1 ? "payment" : "payments"} ›`}</span>
        </button>
        {showPlan && (
          <div className="card stack rise" style={{ gap: "var(--zs-space-8)" }}>
            {fig.plan.length === 0 && <p className="t-caption t-muted">Nothing to settle yet.</p>}
            {fig.plan.map((p, i) => <p key={i} className="t-body">{memberName(data, p.from, me)} {p.from === me ? "pay" : "pays"} {p.to === me ? "you" : memberName(data, p.to, me)} <b className="num">{formatCents(p.cents, cur)}</b></p>)}
          </div>
        )}

        <div className="seg" role="tablist">
          {(["expenses", "people", "summary"] as Tab[]).map((k) => <button key={k} role="tab" aria-selected={tab === k} onClick={() => setTab(k)}>{k === "expenses" ? "Expenses" : k === "people" ? "People" : "Summary"}</button>)}
        </div>

        {tab === "expenses" && (
          <div className="list">
            {data.expenses.length === 0 && <div className="card t-caption t-muted">No expenses yet. Add the first one.</div>}
            {data.expenses.map((e) => {
              const myShare = e.expense_shares.find((s) => s.user_id === me)?.base_share_cents ?? 0;
              const myPaid = e.expense_payers.filter((p) => p.user_id === me).reduce((s, p) => s + p.base_amount_cents, 0);
              const net = myPaid - myShare;
              const payer = e.expense_payers[0]?.user_id ?? e.created_by;
              return (
                <Link key={e.id} href={e.receipt_id ? `/t/${trip.id}/receipt/${e.id}` : settled ? "#" : `/t/${trip.id}/expense/${e.id}`} className="row-card" aria-disabled={(settled && !e.receipt_id) || undefined}>
                  <span className="tile t-micro t-muted" aria-hidden="true">{categoryLabel(e.category, e.subcategory).slice(0, 2).toUpperCase()}</span>
                  <span className="grow">
                    <span className="t-body-strong" style={{ display: "block", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{e.description}</span>
                    <span className="t-small t-muted" style={{ display: "block" }}>{payer === me ? "You" : firstName(memberName(data, payer, me), "Someone")} paid{e.expense_payers.length > 1 ? ` +${e.expense_payers.length - 1}` : ""} · {e.split_type === "nights" ? "split by nights stayed" : e.split_type === "itemized" ? `split by item · ${e.expense_shares.length} people` : `${e.expense_shares.length} ${e.expense_shares.length === 1 ? "person" : "people"}`}{e.updated_at !== e.created_at ? " · Edited" : ""}</span>
                  </span>
                  <span className="right stack-tight" style={{ justifyItems: "end" }}>
                    <b className="t-amount-row num">{formatCents(e.base_amount_cents, cur)}</b>
                    {!settled && <AmountPill cents={net} currency={cur} />}
                  </span>
                </Link>
              );
            })}
          </div>
        )}

        {tab === "people" && (
          <div className="list">
            {[...fig.members].sort((a, b) => (a.user_id === me ? -1 : b.user_id === me ? 1 : 0)).map((m) => {
              const paid = paidBy(data, m.user_id), share = shareOf(data, m.user_id), net = fig.nets[m.user_id] ?? 0;
              return (
                <div key={m.user_id} className="row-card">
                  <Avatar name={m.display_name ?? "?"} uri={m.photo_url} done={!!m.done_at} pending={!m.done_at} />
                  <span className="grow"><span className="t-body-strong" style={{ display: "block" }}>{m.user_id === me ? "You" : (m.display_name ?? "Member")}</span><span className="t-small t-muted">Paid {formatCents(paid, cur)} · share {formatCents(share, cur)}{m.done_at ? " · Done" : ""}</span></span>
                  {net === 0 ? <span className="t-caption-strong t-muted num">$0.00</span> : <AmountPill cents={net} currency={cur} />}
                </div>
              );
            })}
          </div>
        )}

        {tab === "summary" && (
          <div className="card stack" style={{ gap: "var(--zs-space-16)" }}>
            <div className="row between" style={{ alignItems: "flex-end" }}>
              <div><p className="t-caption t-muted">Dazzle total</p><p className="t-amount-l num">{formatCents(fig.total, cur)}</p></div>
              <div className="right"><p className="t-caption t-muted">A person</p><p className="t-headline num">{formatCents(perPerson, cur)}</p></div>
            </div>
            <div className="divider" />
            {CATEGORIES.map((c) => ({ c, cents: data.expenses.filter((e) => e.category === c.key).reduce((s, e) => s + e.base_amount_cents, 0) }))
              .filter((x) => x.cents > 0).sort((a, b) => b.cents - a.cents)
              .map(({ c, cents }) => (
                <div key={c.key} className="stack-tight">
                  <div className="row between"><span className="t-caption-strong">{c.label}</span><span className="t-caption-strong num">{formatCents(cents, cur)}</span></div>
                  <div className="bar" role="img" aria-label={`${c.label}: ${formatCents(cents, cur)}`}><span style={{ width: `${fig.total ? Math.round((cents / fig.total) * 100) : 0}%` }} /></div>
                </div>
              ))}
          </div>
        )}

        {data.settlements.length > 0 && (
          <div className="stack">
            <p className="t-overline col-text">Close-out</p>
            <div className="list">
              {data.settlements.map((s) => (
                <div key={s.id} className="row-card">
                  <span className="grow"><span className="t-body-strong" style={{ display: "block" }}>{memberName(data, s.from_user, me)} {s.from_user === me ? "pay" : "pays"} {s.to_user === me ? "you" : memberName(data, s.to_user, me)} <span className="num">{formatCents(s.amount_cents, cur)}</span></span><span className="t-small t-muted">{s.status === "pending" ? "Not marked paid yet" : s.status === "confirmed" ? "Got it" : "Marked paid"}</span></span>
                </div>
              ))}
            </div>
            <p className="help col-text">Payments happen in the Zebrasplit app, which opens Venmo pre-filled for each one.</p>
          </div>
        )}
      </div>

      {!settled && (
        <div className="sheet-footer">
          <div className="inner">
            <div className="grabber" aria-hidden="true" />
            <div className="row between">
              <span className="t-body-strong">{meMember?.done_at ? "Done adding expenses" : "I'm done adding expenses"}</span>
              <button type="button" role="switch" aria-checked={!!meMember?.done_at} className="switch" onClick={toggleDone} disabled={busy || !meMember} aria-label="Done adding expenses" />
            </div>
            <div className="row">
              <Link href={`/t/${trip.id}/expense`} className="btn primary">Add expense</Link>
              <span className="btn locked" aria-disabled="true" style={{ flex: 1 }}>{unlocked ? "Close out in the app" : `Close out · ${toGo} to go`}</span>
            </div>
          </div>
        </div>
      )}
      {toast && <Toast text={toast} onDone={() => setToast(null)} />}
    </>
  );
}
