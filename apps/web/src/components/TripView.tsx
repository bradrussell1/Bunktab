"use client";
import { CATEGORIES, categoryLabel, closeoutUnlocked, formatCents, formatDateRange } from "@checkm8/core";
import Link from "next/link";
import { useMemo, useState } from "react";
import { Avatar } from "./Avatar";
import { supabaseBrowser } from "@/lib/supabase/browser";
import { activeMembers, memberName, membersWithNoExpenses, nets, paidBy, previewPayments, shareOf, tripTotal, useTrip } from "@/lib/trip";

/**
 * Guest trip view (spec: Web guest view): view the trip, add and edit
 * expenses, tap Done. Close-out is read-only here; Venmo payments happen in
 * the app. Figures come from @checkm8/core, the same code the app runs.
 */
type Tab = "expenses" | "people" | "summary";

export function TripView({ tripId, me }: { tripId: string; me: string }) {
  const { data, loading, error, reload } = useTrip(tripId);
  const [tab, setTab] = useState<Tab>("expenses");
  const [showPlan, setShowPlan] = useState(false);
  const [busy, setBusy] = useState(false);

  const fig = useMemo(() => {
    if (!data) return null;
    const n = nets(data);
    return { nets: n, mine: n[me] ?? 0, plan: previewPayments(data), total: tripTotal(data), members: activeMembers(data), quiet: membersWithNoExpenses(data) };
  }, [data, me]);

  if (loading) return <p className="t-cap" style={{ padding: "32px 0" }}>Loading…</p>;
  if (error) return <p className="err" style={{ padding: "32px 0" }}>{error}</p>;
  if (!data || !fig) return (
    <div className="stack" style={{ paddingTop: 32 }}>
      <h1 className="h-title2">This trip isn&apos;t available</h1>
      <p className="t-body t-muted">You may not be a member yet. Open the invite link you were texted, or ask the organizer to add your number.</p>
    </div>
  );

  const { trip, members } = data;
  const meMember = members.find((m) => m.user_id === me);
  const unlocked = closeoutUnlocked(fig.members.map((m) => ({ doneAt: m.done_at, removedAt: m.removed_at }))) || !!trip.closeout_override_at;
  const perPerson = fig.members.length ? Math.round(fig.total / fig.members.length) : 0;
  const cur = trip.base_currency;

  async function toggleDone() {
    setBusy(true);
    await supabaseBrowser().rpc("set_done", { p_trip: trip.id, p_done: !meMember?.done_at });
    setBusy(false); reload();
  }

  return (
    <>
      <div className="stack" style={{ gap: 16, paddingTop: 20 }}>
        <div className="stack" style={{ gap: 8 }}>
          <h1 className="h-large">{trip.title}</h1>
          <p className="t-cap">{formatDateRange(trip.start_date, trip.end_date)} · {cur}{trip.status !== "open" ? ` · ${trip.status}` : ""}</p>
          {trip.description && <p className="t-body t-muted">{trip.description}</p>}
          <div className="chips">
            {fig.members.map((m) => (
              <span key={m.user_id} className="member"><Avatar name={m.display_name ?? "?"} uri={m.photo_url} size={26} />{m.user_id === me ? "You" : (m.display_name ?? "Invited")}{m.done_at && <span className="badge">Done</span>}</span>
            ))}
          </div>
        </div>

        {/* the one navy hero on this page */}
        <div className="hero stack" style={{ gap: 8 }}>
          <p className="t-caps">Your balance</p>
          <p className={`h-large ${fig.mine < 0 ? "t-owe" : fig.mine > 0 ? "t-success" : ""}`}>
            {fig.mine === 0 ? "Settled up" : fig.mine > 0 ? `You're owed ${formatCents(fig.mine, cur)}` : `You owe ${formatCents(-fig.mine, cur)}`}
          </p>
          <button type="button" className="row between" style={{ background: "none", border: 0, padding: "4px 0", cursor: "pointer", width: "100%", color: "inherit" }} aria-expanded={showPlan} onClick={() => setShowPlan((v) => !v)}>
            <span className="t-cap-strong t-key">Settlement preview</span>
            <span className="t-cap-strong t-key">{showPlan ? "Hide" : `${fig.plan.length} ${fig.plan.length === 1 ? "payment" : "payments"}`}</span>
          </button>
          {showPlan && (
            <div className="stack" style={{ gap: 6 }}>
              {fig.plan.length === 0 && <p className="t-cap">Nothing to settle yet.</p>}
              {fig.plan.map((p, i) => <p key={i} className="t-body">{memberName(data, p.from, me)} {p.from === me ? "pay" : "pays"} {p.to === me ? "you" : memberName(data, p.to, me)} <b>{formatCents(p.cents, cur)}</b></p>)}
            </div>
          )}
        </div>
        {fig.quiet.length > 0 && <p className="t-cap">{fig.quiet.map((m) => (m.user_id === me ? "You haven't" : `${m.display_name ?? "A member"} hasn't`)).join(", ")} added anything yet.</p>}

        <div className="seg" role="tablist">
          {(["expenses", "people", "summary"] as Tab[]).map((k) => <button key={k} role="tab" aria-selected={tab === k} onClick={() => setTab(k)}>{k === "expenses" ? "Expenses" : k === "people" ? "Per person" : "Summary"}</button>)}
        </div>

        {tab === "expenses" && (
          <div className="card flush">
            {data.expenses.length === 0 && <p className="t-cap" style={{ padding: 16 }}>No expenses yet. Add the first one.</p>}
            {data.expenses.map((e) => (
              <Link key={e.id} href={`/t/${trip.id}/expense/${e.id}`} className="item" style={{ textDecoration: "none" }}>
                <span className="grow">
                  <span className="h-headline" style={{ display: "block" }}>{e.description}</span>
                  <span className="t-cap" style={{ display: "block" }}>{memberName(data, e.expense_payers[0]?.user_id ?? e.created_by, me)} paid{e.expense_payers.length > 1 ? ` +${e.expense_payers.length - 1}` : ""} · {e.expense_shares.length} {e.expense_shares.length === 1 ? "person" : "people"} · {categoryLabel(e.category, e.subcategory)}{e.updated_at !== e.created_at ? " · Edited" : ""}</span>
                </span>
                <span style={{ textAlign: "right" }}>
                  <b style={{ display: "block" }}>{formatCents(e.base_amount_cents, cur)}</b>
                  {e.currency !== cur && <span className="t-cap t-faint">{formatCents(e.amount_cents + e.tip_cents, e.currency)}</span>}
                </span>
              </Link>
            ))}
          </div>
        )}

        {tab === "people" && (
          <div className="card flush">
            {[...fig.members].sort((a, b) => (a.user_id === me ? -1 : b.user_id === me ? 1 : 0)).map((m) => {
              const paid = paidBy(data, m.user_id), share = shareOf(data, m.user_id), net = fig.nets[m.user_id] ?? 0;
              return (
                <div key={m.user_id} className="item" style={{ cursor: "default" }}>
                  <Avatar name={m.display_name ?? "?"} uri={m.photo_url} />
                  <span className="grow"><span className="h-headline" style={{ display: "block" }}>{m.user_id === me ? "You" : (m.display_name ?? "Member")}</span><span className="t-cap">Paid {formatCents(paid, cur)} · share {formatCents(share, cur)}</span></span>
                  <b className={net < 0 ? "t-owe" : net > 0 ? "t-success" : "t-muted"}>{net === 0 ? "even" : net > 0 ? `+${formatCents(net, cur)}` : `−${formatCents(-net, cur)}`}</b>
                </div>
              );
            })}
          </div>
        )}

        {tab === "summary" && (
          <div className="card stack">
            <div className="row between">
              <div><p className="t-caps">Trip total</p><p className="h-large">{formatCents(fig.total, cur)}</p></div>
              <div style={{ textAlign: "right" }}><p className="t-caps">Per person</p><p className="h-large">{formatCents(perPerson, cur)}</p></div>
            </div>
            <div className="divider" />
            {CATEGORIES.map((c) => {
              const cents = data.expenses.filter((e) => e.category === c.key).reduce((s, e) => s + e.base_amount_cents, 0);
              if (!cents) return null;
              return (
                <div key={c.key} className="stack" style={{ gap: 4 }}>
                  <div className="row between"><span className="t-cap-strong">{c.label}</span><span className="t-cap-strong">{formatCents(cents, cur)}</span></div>
                  <div className="bar"><span style={{ width: `${fig.total ? Math.round((cents / fig.total) * 100) : 0}%` }} /></div>
                </div>
              );
            })}
          </div>
        )}

        {data.settlements.length > 0 && (
          <div className="stack" style={{ gap: 8 }}>
            <p className="t-caps">Close-out plan</p>
            <div className="card flush">
              {data.settlements.map((s) => (
                <div key={s.id} className="item" style={{ cursor: "default" }}>
                  <span className="grow"><span className="h-headline" style={{ display: "block" }}>{memberName(data, s.from_user, me)} {s.from_user === me ? "pay" : "pays"} {s.to_user === me ? "you" : memberName(data, s.to_user, me)} {formatCents(s.amount_cents, cur)}</span><span className="t-cap">{s.status === "pending" ? "Not marked paid yet" : s.status === "confirmed" ? "Confirmed" : "Marked paid"}</span></span>
                </div>
              ))}
            </div>
            <p className="help">Payments happen in the Checkm8 app, which opens Venmo pre-filled for each one.</p>
          </div>
        )}
      </div>

      {trip.status === "open" && (
        <div className="footer">
          <div className="inner">
            <div className="row between">
              <span className="h-headline">Done adding expenses</span>
              <button type="button" role="switch" aria-checked={!!meMember?.done_at} className="switch" onClick={toggleDone} disabled={busy || !meMember} aria-label="Done adding expenses" />
            </div>
            <div className="row">
              <Link href={`/t/${trip.id}/expense`} className="btn primary">Add expense</Link>
            </div>
            <p className="help" style={{ textAlign: "center" }}>{unlocked ? "Close out is unlocked. Payments are made in the app." : "Close out unlocks when everyone has tapped Done."}</p>
          </div>
        </div>
      )}
    </>
  );
}
