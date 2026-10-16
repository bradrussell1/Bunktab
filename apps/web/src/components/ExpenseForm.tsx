"use client";
import { CATEGORIES, COMMON_CURRENCIES, SplitError, computeNightsShares, computeShares, formatCents, fullPresence, isLodgingCategory, nightsBetween, parseToCents, toBaseCents, type SplitType } from "@bunktab/core";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { Avatar } from "./Avatar";
import { ZebraBust } from "./Zebra";
import { supabaseBrowser } from "@/lib/supabase/browser";
import { activeMembers, useTrip, type Expense } from "@/lib/trip";

/**
 * Add or edit an expense on the web (ticket B5/B9): big amount entry with a
 * currency pill, who paid and who's involved as avatar chips, split control,
 * category pills, tip, Lodging toggle with night stripes. Same fields and the
 * same @bunktab/core arithmetic as the app; saved through save_expense in one
 * transaction, re-checked on the server. No logic changed; surfaces only.
 */
const SPLITS: { key: SplitType; label: string }[] = [{ key: "equal", label: "Equal" }, { key: "exact", label: "Exact" }, { key: "percent", label: "%" }, { key: "shares", label: "Shares" }];

export function ExpenseForm({ tripId, expenseId, me }: { tripId: string; expenseId?: string; me: string }) {
  const router = useRouter();
  const { data } = useTrip(tripId);
  const existing: Expense | undefined = data?.expenses.find((e) => e.id === expenseId);

  const [amount, setAmount] = useState(""); const [tip, setTip] = useState("");
  const [currency, setCurrency] = useState("USD"); const [fx, setFx] = useState("1");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("dining"); const [subcategory, setSubcategory] = useState<string | null>("restaurants");
  const [payers, setPayers] = useState<Record<string, string>>({});
  const [involved, setInvolved] = useState<string[]>([]);
  const [split, setSplit] = useState<SplitType>("equal");
  const [exact, setExact] = useState<Record<string, string>>({}); const [percents, setPercents] = useState<Record<string, string>>({}); const [weights, setWeights] = useState<Record<string, string>>({});
  const [lodging, setLodging] = useState(false); const [nights, setNights] = useState("1"); const [presence, setPresence] = useState<Record<string, boolean[]>>({});
  const [error, setError] = useState<string | null>(null); const [busy, setBusy] = useState(false); const [seeded, setSeeded] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const members = useMemo(() => (data ? activeMembers(data) : []), [data]);
  const cat = CATEGORIES.find((c) => c.key === category)!;

  useEffect(() => {
    if (!data || seeded) return;
    if (expenseId && !existing) return; // wait for the expense row
    const ids = members.map((m) => m.user_id);
    if (existing) {
      setAmount((existing.amount_cents / 100).toFixed(2)); setTip(existing.tip_cents ? (existing.tip_cents / 100).toFixed(2) : "");
      setCurrency(existing.currency); setFx(String(existing.fx_rate)); setDescription(existing.description);
      setCategory(existing.category); setSubcategory(existing.subcategory);
      setPayers(Object.fromEntries(existing.expense_payers.map((p) => [p.user_id, String(p.amount_cents / 100)])));
      setInvolved(existing.expense_shares.map((s) => s.user_id));
      setSplit(existing.split_type === "nights" || existing.split_type === "itemized" ? "equal" : existing.split_type); setLodging(existing.split_type === "nights");
      if (existing.split_type === "exact") setExact(Object.fromEntries(existing.expense_shares.map((s) => [s.user_id, String(s.share_cents / 100)])));
      if (existing.nights) { setNights(String(existing.nights)); setPresence(Object.fromEntries(existing.expense_shares.map((s) => [s.user_id, s.night_presence ?? fullPresence([s.user_id], existing.nights!)[s.user_id]!]))); }
    } else {
      setCurrency(data.trip.base_currency); setPayers({ [me]: "" }); setInvolved(ids);
      const n = Math.max(1, nightsBetween(data.trip.start_date, data.trip.end_date)); setNights(String(n)); setPresence(fullPresence(ids, n));
    }
    setSeeded(true);
  }, [data, existing, expenseId, members, me, seeded]);

  const amountCents = parseToCents(amount) ?? 0, tipCents = parseToCents(tip) ?? 0, total = amountCents + tipCents;
  const fxRate = Number(fx) || 1, nightsN = Math.max(1, parseInt(nights, 10) || 1);

  function pickCategory(key: string) { setCategory(key); const first = CATEGORIES.find((x) => x.key === key)!.subcategories[0]?.key ?? null; setSubcategory(first); if (isLodgingCategory(key, first)) setLodging(true); }
  function pickSub(key: string) { setSubcategory(key); if (isLodgingCategory(category, key)) setLodging(true); }
  const toggleInvolved = (uid: string) => setInvolved((v) => (v.includes(uid) ? v.filter((x) => x !== uid) : [...v, uid]));
  const togglePayer = (uid: string) => setPayers((p) => { const n = { ...p }; if (uid in n) delete n[uid]; else n[uid] = ""; return n; });
  function setNightsCount(v: string) { setNights(v); const n = Math.max(1, parseInt(v, 10) || 1); setPresence((p) => Object.fromEntries(involved.map((uid) => [uid, Array.from({ length: n }, (_, i) => p[uid]?.[i] ?? true)]))); }

  const preview = useMemo(() => {
    try {
      if (total <= 0 || involved.length === 0) return null;
      const payerIds = Object.keys(payers);
      if (lodging) return { shares: computeNightsShares({ amountCents: total, nights: nightsN, presence: Object.fromEntries(involved.map((uid) => [uid, presence[uid] ?? Array.from({ length: nightsN }, () => true)])), payerIds }).shares, error: null };
      const base = { amountCents: total, participants: involved, payerIds };
      const shares = split === "equal" ? computeShares({ ...base, type: "equal" })
        : split === "exact" ? computeShares({ ...base, type: "exact", exactCents: Object.fromEntries(involved.map((u) => [u, parseToCents(exact[u] ?? "") ?? 0])) })
        : split === "percent" ? computeShares({ ...base, type: "percent", percents: Object.fromEntries(involved.map((u) => [u, Number(percents[u] ?? 0)])) })
        : computeShares({ ...base, type: "shares", shares: Object.fromEntries(involved.map((u) => [u, Number(weights[u] ?? 1)])) });
      return { shares, error: null };
    } catch (e) { return { shares: null, error: e instanceof SplitError ? e.message : String(e) }; }
  }, [total, involved, payers, lodging, presence, nightsN, split, exact, percents, weights]);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!data) return;
    if (!description.trim()) return setError("Describe the expense.");
    if (total <= 0) return setError("Enter an amount.");
    const payerIds = Object.keys(payers);
    if (payerIds.length === 0) return setError("Who paid?");
    const payerCents: Record<string, number> = payerIds.length === 1 ? { [payerIds[0]!]: total } : Object.fromEntries(payerIds.map((u) => [u, parseToCents(payers[u] ?? "") ?? 0]));
    const payerSum = Object.values(payerCents).reduce((a, b) => a + b, 0);
    if (payerSum !== total) return setError(`Payers add up to ${formatCents(payerSum, currency)}, not ${formatCents(total, currency)}.`);
    if (!preview?.shares) return setError(preview?.error ?? "Fix the split.");
    setBusy(true); setError(null);
    const payload = {
      id: existing?.id, trip_id: data.trip.id, description: description.trim(), category, subcategory,
      amount_cents: amountCents, tip_cents: tipCents, currency, fx_rate: fxRate, base_amount_cents: toBaseCents(total, fxRate),
      split_type: lodging ? "nights" : split, nights: lodging ? nightsN : null,
      payers: Object.entries(payerCents).map(([user_id, c]) => ({ user_id, amount_cents: c, base_amount_cents: toBaseCents(c, fxRate) })),
      shares: Object.entries(preview.shares).map(([user_id, c]) => ({ user_id, share_cents: c, base_share_cents: toBaseCents(c, fxRate), nights: lodging ? (presence[user_id] ?? []).filter(Boolean).length : null, night_presence: lodging ? presence[user_id] ?? null : null })),
    };
    const { error: err } = await supabaseBrowser().rpc("save_expense", { p: payload });
    setBusy(false);
    if (err) return setError(err.message);
    router.push(`/t/${tripId}`); router.refresh();
  }
  async function remove() {
    if (!existing) return;
    await supabaseBrowser().rpc("delete_expense", { p_id: existing.id });
    router.push(`/t/${tripId}`); router.refresh();
  }

  if (!data || !seeded) return (
    <div className="stack-loose" style={{ paddingTop: "var(--zs-space-32)" }} aria-busy="true">
      {data && expenseId && !existing ? <div className="error-panel"><ZebraBust mood="worried" size={40} decorative /><span>That expense isn&apos;t here.</span></div> : <div className="skeleton"><i style={{ width: "50%", height: 36 }} /><i style={{ height: 52 }} /><i style={{ height: 52 }} /><i style={{ height: 52 }} /></div>}
    </div>
  );
  const name = (uid: string) => (uid === me ? "You" : members.find((m) => m.user_id === uid)?.display_name ?? "Member");
  const first = (uid: string) => name(uid).split(/\s+/)[0]!;
  const base = data.trip.base_currency;
  const multiPayer = Object.keys(payers).length > 1;

  return (
    <form className="stack-loose" style={{ paddingTop: "var(--zs-space-12)", paddingBottom: "var(--zs-space-40)" }} onSubmit={save}>
      <div className="row between">
        <button type="button" className="btn text" onClick={() => router.push(`/t/${tripId}`)}>Cancel</button>
        <h1 className="t-headline">{existing ? "Edit expense" : "Add expense"}</h1>
        <span style={{ width: 72 }} />
      </div>

      <div className="hero-card stack" style={{ gap: "var(--zs-space-12)" }}>
        <div className="row" style={{ gap: "var(--zs-space-12)", alignItems: "center" }}>
          <label htmlFor="currency" className="pill outline" style={{ padding: "var(--zs-space-8) var(--zs-space-12)" }}>
            <select id="currency" value={currency} onChange={(e) => setCurrency(e.target.value)} style={{ border: 0, background: "transparent", font: "inherit", appearance: "none", paddingRight: "var(--zs-space-4)" }} aria-label="Currency">
              {[base, ...COMMON_CURRENCIES.filter((c) => c !== base)].map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
            <span aria-hidden="true">⌄</span>
          </label>
          <input id="amount" className="input amount grow" inputMode="decimal" placeholder="0.00" aria-label="Amount" value={amount} onChange={(e) => setAmount(e.target.value)} autoFocus={!existing} />
        </div>
        <div className="row" style={{ gap: "var(--zs-space-12)" }}>
          <div className="field grow"><label htmlFor="tip">Tip</label><input id="tip" className="input" inputMode="decimal" placeholder="0.00" value={tip} onChange={(e) => setTip(e.target.value)} /></div>
          {currency !== base && <div className="field grow"><label htmlFor="fx">1 {currency} in {base}</label><input id="fx" className="input" inputMode="decimal" value={fx} onChange={(e) => setFx(e.target.value)} /></div>}
        </div>
        {currency !== base && <p className="help">{formatCents(total, currency)} = {formatCents(toBaseCents(total, fxRate), base)} · locked on save</p>}
      </div>

      <div className="field"><label htmlFor="desc">Description</label><input id="desc" className="input" placeholder="Dinner at Rosa's" maxLength={140} value={description} onChange={(e) => setDescription(e.target.value)} /></div>

      <div className="field">
        <span className="field-label">Category</span>
        <div className="chips">{CATEGORIES.map((c) => <button key={c.key} type="button" role="radio" aria-checked={category === c.key} className="chip" onClick={() => pickCategory(c.key)}>{c.label}</button>)}</div>
        {cat.subcategories.length > 0 && <div className="chips">{cat.subcategories.map((s) => <button key={s.key} type="button" role="radio" aria-checked={subcategory === s.key} className="chip" onClick={() => pickSub(s.key)}>{s.label}</button>)}</div>}
      </div>

      <div className="field">
        <span className="field-label">Who paid</span>
        <div className="row" style={{ flexWrap: "wrap", gap: "var(--zs-space-8)" }}>
          {members.map((m) => (
            <button key={m.user_id} type="button" className="chip-avatar" role="checkbox" aria-checked={m.user_id in payers} onClick={() => togglePayer(m.user_id)}>
              <Avatar name={m.display_name ?? "?"} uri={m.photo_url} pending={!(m.user_id in payers)} className={m.user_id in payers ? "selected" : ""} />
              <span className="name">{first(m.user_id)}</span>
            </button>
          ))}
        </div>
        {multiPayer && (
          <div className="stack-tight">
            {Object.keys(payers).map((uid) => <div key={uid} className="row between"><span className="t-caption">{name(uid)} paid</span><input className="input inline" inputMode="decimal" placeholder="0.00" aria-label={`${name(uid)} paid`} value={payers[uid]} onChange={(e) => setPayers((p) => ({ ...p, [uid]: e.target.value }))} /></div>)}
          </div>
        )}
      </div>

      <div className="field">
        <div className="row between"><span className="field-label">Who&apos;s involved</span><button type="button" className="btn text" onClick={() => setInvolved(involved.length === members.length ? [] : members.map((m) => m.user_id))}>{involved.length === members.length ? "None" : "Everyone"}</button></div>
        <div className="row" style={{ flexWrap: "wrap", gap: "var(--zs-space-8)" }}>
          {members.map((m) => {
            const on = involved.includes(m.user_id);
            return (
              <button key={m.user_id} type="button" className="chip-avatar" role="checkbox" aria-checked={on} onClick={() => toggleInvolved(m.user_id)}>
                <Avatar name={m.display_name ?? "?"} uri={m.photo_url} pending={!on} className={on ? "selected" : ""} />
                <span className="name">{first(m.user_id)}</span>
                {on && preview?.shares && <span className="t-small t-muted num">{formatCents(preview.shares[m.user_id] ?? 0, currency)}</span>}
              </button>
            );
          })}
        </div>
      </div>

      <div className="field">
        <span className="field-label">Split</span>
        {!lodging && <div className="seg" role="radiogroup">{SPLITS.map((s) => <button key={s.key} type="button" role="radio" aria-checked={split === s.key} onClick={() => setSplit(s.key)}>{s.label}</button>)}</div>}
        {!lodging && split !== "equal" && (
          <div className="stack-tight">
            {involved.map((uid) => (
              <div key={uid} className="row between">
                <span className="t-caption">{name(uid)}</span>
                {split === "exact" && <input className="input inline" inputMode="decimal" placeholder="0.00" aria-label={`${name(uid)} exact share`} value={exact[uid] ?? ""} onChange={(e) => setExact((x) => ({ ...x, [uid]: e.target.value }))} />}
                {split === "percent" && <input className="input inline" inputMode="decimal" placeholder="%" aria-label={`${name(uid)} percent`} value={percents[uid] ?? ""} onChange={(e) => setPercents((x) => ({ ...x, [uid]: e.target.value }))} />}
                {split === "shares" && <input className="input inline" inputMode="numeric" placeholder="1" aria-label={`${name(uid)} shares`} value={weights[uid] ?? ""} onChange={(e) => setWeights((x) => ({ ...x, [uid]: e.target.value }))} />}
              </div>
            ))}
          </div>
        )}
        <div className="card row between" style={{ padding: "var(--zs-space-12) var(--zs-space-16)" }}>
          <span className="stack-tight"><span className="t-body-strong">Split by nights stayed</span><span className="t-small t-muted">Every night you stayed is a stripe.</span></span>
          <button type="button" role="switch" aria-checked={lodging} className="switch" onClick={() => setLodging((v) => !v)} aria-label="Split by nights stayed" />
        </div>
        {lodging && (
          <div className="card stack" style={{ gap: "var(--zs-space-12)" }}>
            <div className="row between"><label htmlFor="nights" className="t-caption-strong">Nights</label><input id="nights" className="input inline" inputMode="numeric" value={nights} onChange={(e) => setNightsCount(e.target.value)} /></div>
            <p className="help">{formatCents(Math.round(total / nightsN), currency)} a night, split among the people with a stripe that night.</p>
            {involved.map((uid) => (
              <div key={uid} className="row" style={{ gap: "var(--zs-space-10)" }}>
                <span className="t-caption-strong" style={{ width: 64, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{first(uid)}</span>
                <span className="row" style={{ gap: "var(--zs-space-4)", flexWrap: "wrap" }}>
                  {Array.from({ length: nightsN }, (_, i) => { const stayed = presence[uid]?.[i] ?? true; return <button key={i} type="button" role="checkbox" aria-checked={stayed} aria-label={`${name(uid)}, night ${i + 1}, ${stayed ? "stayed" : "away"}`} className="night" onClick={() => setPresence((p) => ({ ...p, [uid]: Array.from({ length: nightsN }, (_, k) => (k === i ? !stayed : p[uid]?.[k] ?? true)) }))}><i /></button>; })}
                </span>
                {preview?.shares && <span className="t-small t-muted num" style={{ marginLeft: "auto" }}>{formatCents(preview.shares[uid] ?? 0, currency)}</span>}
              </div>
            ))}
          </div>
        )}
        {preview?.error && <p className="err">{preview.error}</p>}
        {!lodging && split === "equal" && <p className="help">Leftover cents go to the payer so the total always matches.</p>}
      </div>

      {error && <div className="error-panel"><ZebraBust mood="worried" size={40} decorative /><span>{error}</span></div>}
      <button className="btn primary" type="submit" disabled={busy}>{busy ? "Saving…" : existing ? "Save changes" : "Add expense"}</button>
      {existing && !confirmDelete && <button type="button" className="btn text destructive" style={{ justifySelf: "center" }} onClick={() => setConfirmDelete(true)}>Delete this expense</button>}
      {existing && confirmDelete && (
        <div className="card stack" role="alertdialog" aria-labelledby="del-title">
          <p id="del-title" className="t-body-strong">Delete this expense?</p>
          <p className="t-caption t-muted">It comes out of every balance and stays in the history.</p>
          <div className="row"><button type="button" className="btn secondary on-white" onClick={() => setConfirmDelete(false)}>Keep it</button><button type="button" className="btn ink" style={{ color: "var(--zs-color-text-on-ink)" }} onClick={remove}>Delete</button></div>
        </div>
      )}
    </form>
  );
}
