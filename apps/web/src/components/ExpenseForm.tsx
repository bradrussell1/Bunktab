"use client";
import { CATEGORIES, COMMON_CURRENCIES, SplitError, computeNightsShares, computeShares, formatCents, fullPresence, isLodgingCategory, nightsBetween, parseToCents, toBaseCents, type SplitType } from "@bunktab/core";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { Avatar } from "./Avatar";
import { supabaseBrowser } from "@/lib/supabase/browser";
import { activeMembers, useTrip, type Expense } from "@/lib/trip";

/**
 * Add or edit an expense on the web (spec: Add or edit expense). Same
 * fields and the same @bunktab/core arithmetic as the app; saved through
 * save_expense in one transaction, re-checked on the server.
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

  const members = useMemo(() => (data ? activeMembers(data) : []), [data]);
  const cat = CATEGORIES.find((c) => c.key === category)!;

  useEffect(() => {
    if (!data || seeded) return;
    if (expenseId && !existing) return; // wait for the expense row
    const ids = members.map((m) => m.user_id);
    if (existing) {
      setAmount(String(existing.amount_cents / 100)); setTip(existing.tip_cents ? String(existing.tip_cents / 100) : "");
      setCurrency(existing.currency); setFx(String(existing.fx_rate)); setDescription(existing.description);
      setCategory(existing.category); setSubcategory(existing.subcategory);
      setPayers(Object.fromEntries(existing.expense_payers.map((p) => [p.user_id, String(p.amount_cents / 100)])));
      setInvolved(existing.expense_shares.map((s) => s.user_id));
      setSplit(existing.split_type === "nights" ? "equal" : existing.split_type); setLodging(existing.split_type === "nights");
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
    if (!existing || !confirm("Delete this expense? It comes out of every balance and stays in the history.")) return;
    await supabaseBrowser().rpc("delete_expense", { p_id: existing.id });
    router.push(`/t/${tripId}`); router.refresh();
  }

  if (!data || !seeded) return <p className="t-cap" style={{ padding: "32px 0" }}>{data && expenseId && !existing ? "That expense isn't here." : "Loading…"}</p>;
  const name = (uid: string) => (uid === me ? "You" : members.find((m) => m.user_id === uid)?.display_name ?? "Member");
  const base = data.trip.base_currency;

  return (
    <form className="stack" style={{ gap: 20, paddingTop: 16 }} onSubmit={save}>
      <div className="row between">
        <button type="button" className="btn text" onClick={() => router.push(`/t/${tripId}`)}>Cancel</button>
        <h1 className="h-title2">{existing ? "Edit expense" : "Add expense"}</h1>
        {existing ? <button type="button" className="btn danger" onClick={remove}>Delete</button> : <span style={{ width: 60 }} />}
      </div>
      <div className="row" style={{ alignItems: "flex-end" }}>
        <div className="field" style={{ flex: 2 }}><label htmlFor="amount">Amount</label><input id="amount" className="input" inputMode="decimal" placeholder="0.00" value={amount} onChange={(e) => setAmount(e.target.value)} autoFocus={!existing} /></div>
        <div className="field" style={{ flex: 1 }}><label htmlFor="tip">Tip</label><input id="tip" className="input" inputMode="decimal" placeholder="0.00" value={tip} onChange={(e) => setTip(e.target.value)} /></div>
      </div>
      <div className="field">
        <label>Currency</label>
        <div className="chips">{[base, ...COMMON_CURRENCIES.filter((c) => c !== base)].map((c) => <button key={c} type="button" role="radio" aria-checked={currency === c} className="chip" onClick={() => setCurrency(c)}>{c}</button>)}</div>
        {currency !== base && <div className="field"><label htmlFor="fx">Rate: 1 {currency} in {base}</label><input id="fx" className="input" inputMode="decimal" value={fx} onChange={(e) => setFx(e.target.value)} /><p className="help">{formatCents(total, currency)} = {formatCents(toBaseCents(total, fxRate), base)} · locked on save</p></div>}
      </div>
      <div className="field"><label htmlFor="desc">Description</label><input id="desc" className="input" placeholder="Dinner at Rosa's" maxLength={140} value={description} onChange={(e) => setDescription(e.target.value)} /></div>
      <div className="field">
        <label>Category</label>
        <div className="chips">{CATEGORIES.map((c) => <button key={c.key} type="button" role="radio" aria-checked={category === c.key} className="chip" onClick={() => pickCategory(c.key)}>{c.label}</button>)}</div>
        {cat.subcategories.length > 0 && <div className="chips">{cat.subcategories.map((s) => <button key={s.key} type="button" role="radio" aria-checked={subcategory === s.key} className="chip" onClick={() => pickSub(s.key)}>{s.label}</button>)}</div>}
      </div>

      <div className="card flush">
        <p className="t-caps" style={{ padding: "12px 16px 4px" }}>Who paid</p>
        {members.map((m) => (
          <div key={m.user_id} className="item" onClick={() => togglePayer(m.user_id)} role="checkbox" aria-checked={m.user_id in payers} tabIndex={0} onKeyDown={(e) => { if (e.key === " " || e.key === "Enter") { e.preventDefault(); togglePayer(m.user_id); } }}>
            <span className="check" data-on={m.user_id in payers}>{m.user_id in payers && "✓"}</span><Avatar name={m.display_name ?? "?"} uri={m.photo_url} size={28} /><span className="grow h-headline">{name(m.user_id)}</span>
            {Object.keys(payers).length > 1 && m.user_id in payers && <input className="input small" inputMode="decimal" placeholder="0.00" value={payers[m.user_id]} onClick={(e) => e.stopPropagation()} onChange={(e) => setPayers((p) => ({ ...p, [m.user_id]: e.target.value }))} />}
          </div>
        ))}
      </div>

      <div className="card flush">
        <div className="row between" style={{ padding: "8px 16px 0" }}><p className="t-caps">Who&apos;s involved</p><button type="button" className="btn text small" onClick={() => setInvolved(involved.length === members.length ? [] : members.map((m) => m.user_id))}>{involved.length === members.length ? "None" : "Everyone"}</button></div>
        {members.map((m) => {
          const on = involved.includes(m.user_id);
          return (
            <div key={m.user_id}>
              <div className="item" onClick={() => toggleInvolved(m.user_id)} role="checkbox" aria-checked={on} tabIndex={0} onKeyDown={(e) => { if (e.key === " " || e.key === "Enter") { e.preventDefault(); toggleInvolved(m.user_id); } }}>
                <span className="check" data-on={on}>{on && "✓"}</span><Avatar name={m.display_name ?? "?"} uri={m.photo_url} size={28} /><span className="grow h-headline">{name(m.user_id)}</span>
                {on && !lodging && split === "exact" && <input className="input small" inputMode="decimal" placeholder="0.00" value={exact[m.user_id] ?? ""} onClick={(e) => e.stopPropagation()} onChange={(e) => setExact((x) => ({ ...x, [m.user_id]: e.target.value }))} />}
                {on && !lodging && split === "percent" && <input className="input small" inputMode="decimal" placeholder="%" style={{ width: 72 }} value={percents[m.user_id] ?? ""} onClick={(e) => e.stopPropagation()} onChange={(e) => setPercents((x) => ({ ...x, [m.user_id]: e.target.value }))} />}
                {on && !lodging && split === "shares" && <input className="input small" inputMode="numeric" placeholder="1" style={{ width: 64 }} value={weights[m.user_id] ?? ""} onClick={(e) => e.stopPropagation()} onChange={(e) => setWeights((x) => ({ ...x, [m.user_id]: e.target.value }))} />}
                {on && preview?.shares && <span className="t-cap-strong t-muted">{formatCents(preview.shares[m.user_id] ?? 0, currency)}</span>}
              </div>
              {on && lodging && (
                <div className="chips" style={{ padding: "0 16px 10px 64px" }}>
                  {Array.from({ length: nightsN }, (_, i) => { const stayed = presence[m.user_id]?.[i] ?? true; return <button key={i} type="button" role="checkbox" aria-checked={stayed} className="chip" style={{ minHeight: 28, padding: "0 10px", borderRadius: 4 }} onClick={() => setPresence((p) => ({ ...p, [m.user_id]: Array.from({ length: nightsN }, (_, k) => (k === i ? !stayed : p[m.user_id]?.[k] ?? true)) }))}>N{i + 1}</button>; })}
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div className="stack" style={{ gap: 8 }}>
        <div className="row between"><span className="t-cap-strong t-muted">Split</span><label className="row" style={{ gap: 8 }}><span className="t-cap">Lodging (by nights)</span><button type="button" role="switch" aria-checked={lodging} className="switch" onClick={() => setLodging((v) => !v)} aria-label="Lodging split by nights" /></label></div>
        {lodging ? (
          <div className="field"><label htmlFor="nights">Nights</label><input id="nights" className="input" inputMode="numeric" value={nights} onChange={(e) => setNightsCount(e.target.value)} /><p className="help">{formatCents(Math.round(total / nightsN), currency)} a night, split among the people ticked for each night.</p></div>
        ) : (
          <div className="seg" role="radiogroup">{SPLITS.map((s) => <button key={s.key} type="button" role="radio" aria-selected={split === s.key} aria-checked={split === s.key} onClick={() => setSplit(s.key)}>{s.label}</button>)}</div>
        )}
        {preview?.error && <p className="err">{preview.error}</p>}
        {!lodging && split === "equal" && <p className="help">Leftover cents go to the payer so the total always matches.</p>}
      </div>
      <div className="divider" />
      {error && <p className="err">{error}</p>}
      <button className="btn primary" type="submit" disabled={busy}>{busy ? "Saving…" : existing ? "Save changes" : `Add ${total ? formatCents(total, currency) : "expense"}`}</button>
    </form>
  );
}
