import {
  CATEGORIES,
  COMMON_CURRENCIES,
  SplitError,
  computeNightsShares,
  computeShares,
  formatCents,
  fullPresence,
  isLodgingCategory,
  nightsBetween,
  parseToCents,
  toBaseCents,
  type SplitType,
} from "@checkm8/core";
import { theme } from "@checkm8/theme";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import { Alert, KeyboardAvoidingView, Platform, Pressable, ScrollView, Switch, View } from "react-native";
import { Avatar, Button, Card, Divider, Input, Screen, Segmented, Text } from "@/components/ui";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/lib/supabase";
import { activeMembers, useTrip, type Expense } from "@/lib/trips";

/**
 * Add or edit an expense (spec: Screens → Add or edit expense). Amount and
 * currency; who paid (defaults to you; several payers supported); who's
 * involved (everyone by default); the split type; description; category and
 * subcategory from the fixed list; tip as its own field; the lodging toggle
 * that switches to nights. Shares are computed by @checkm8/core and saved
 * through save_expense in one transaction; the server re-checks the sums.
 * Receipt photo and the exchange-rate lookup arrive with the server phase;
 * a non-base currency takes a typed rate until then.
 */
const SPLITS: { key: SplitType; label: string }[] = [
  { key: "equal", label: "Equal" }, { key: "exact", label: "Exact" }, { key: "percent", label: "%" }, { key: "shares", label: "Shares" },
];

export default function ExpenseScreen() {
  const { id, expense: expenseId } = useLocalSearchParams<{ id: string; expense?: string }>();
  const router = useRouter();
  const { session } = useAuth();
  const me = session!.user.id;
  const { data } = useTrip(id);
  const existing: Expense | undefined = data?.expenses.find((e) => e.id === expenseId);

  const [amount, setAmount] = useState("");
  const [tip, setTip] = useState("");
  const [currency, setCurrency] = useState("USD");
  const [fx, setFx] = useState("1");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("dining");
  const [subcategory, setSubcategory] = useState<string | null>("restaurants");
  const [payers, setPayers] = useState<Record<string, string>>({});
  const [involved, setInvolved] = useState<string[]>([]);
  const [split, setSplit] = useState<SplitType>("equal");
  const [exact, setExact] = useState<Record<string, string>>({});
  const [percents, setPercents] = useState<Record<string, string>>({});
  const [weights, setWeights] = useState<Record<string, string>>({});
  const [lodging, setLodging] = useState(false);
  const [nights, setNights] = useState("1");
  const [presence, setPresence] = useState<Record<string, boolean[]>>({});
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [seeded, setSeeded] = useState(false);

  const members = useMemo(() => (data ? activeMembers(data) : []), [data]);
  const cat = CATEGORIES.find((c) => c.key === category)!;

  // seed from the trip (defaults) or the expense being edited
  useEffect(() => {
    if (!data || seeded) return;
    const ids = members.map((m) => m.user_id);
    if (existing) {
      setAmount(String(existing.amount_cents / 100)); setTip(existing.tip_cents ? String(existing.tip_cents / 100) : "");
      setCurrency(existing.currency); setFx(String(existing.fx_rate)); setDescription(existing.description);
      setCategory(existing.category); setSubcategory(existing.subcategory);
      setPayers(Object.fromEntries(existing.expense_payers.map((p) => [p.user_id, String(p.amount_cents / 100)])));
      setInvolved(existing.expense_shares.map((s) => s.user_id));
      setSplit(existing.split_type === "nights" ? "equal" : existing.split_type);
      setLodging(existing.split_type === "nights");
      if (existing.split_type === "exact") setExact(Object.fromEntries(existing.expense_shares.map((s) => [s.user_id, String(s.share_cents / 100)])));
      if (existing.nights) { setNights(String(existing.nights)); setPresence(Object.fromEntries(existing.expense_shares.map((s) => [s.user_id, s.night_presence ?? fullPresence([s.user_id], existing.nights!)[s.user_id]!]))); }
    } else {
      setCurrency(data.trip.base_currency);
      setPayers({ [me]: "" });
      setInvolved(ids);
      const n = Math.max(1, nightsBetween(data.trip.start_date, data.trip.end_date));
      setNights(String(n)); setPresence(fullPresence(ids, n));
    }
    setSeeded(true);
  }, [data, existing, members, me, seeded]);

  const amountCents = parseToCents(amount) ?? 0;
  const tipCents = parseToCents(tip) ?? 0;
  const total = amountCents + tipCents;
  const fxRate = Number(fx) || 1;
  const nightsN = Math.max(1, parseInt(nights, 10) || 1);

  function pickCategory(key: string) {
    setCategory(key);
    const c = CATEGORIES.find((x) => x.key === key)!;
    const first = c.subcategories[0]?.key ?? null;
    setSubcategory(first);
    if (isLodgingCategory(key, first)) setLodging(true);
  }
  function pickSub(key: string) { setSubcategory(key); if (isLodgingCategory(category, key)) setLodging(true); }
  function toggleInvolved(uid: string) { setInvolved((v) => (v.includes(uid) ? v.filter((x) => x !== uid) : [...v, uid])); }
  function togglePayer(uid: string) { setPayers((p) => { const n = { ...p }; if (uid in n) delete n[uid]; else n[uid] = ""; return n; }); }
  function setNightsCount(v: string) {
    setNights(v);
    const n = Math.max(1, parseInt(v, 10) || 1);
    setPresence((p) => Object.fromEntries(involved.map((uid) => [uid, Array.from({ length: n }, (_, i) => p[uid]?.[i] ?? true)])));
  }

  const preview = useMemo(() => {
    try {
      if (total <= 0 || involved.length === 0) return null;
      const payerIds = Object.keys(payers);
      if (lodging) {
        const pres = Object.fromEntries(involved.map((uid) => [uid, presence[uid] ?? Array.from({ length: nightsN }, () => true)]));
        return { shares: computeNightsShares({ amountCents: total, nights: nightsN, presence: pres, payerIds }).shares, error: null };
      }
      const base = { amountCents: total, participants: involved, payerIds };
      const shares =
        split === "equal" ? computeShares({ ...base, type: "equal" })
        : split === "exact" ? computeShares({ ...base, type: "exact", exactCents: Object.fromEntries(involved.map((u) => [u, parseToCents(exact[u] ?? "") ?? 0])) })
        : split === "percent" ? computeShares({ ...base, type: "percent", percents: Object.fromEntries(involved.map((u) => [u, Number(percents[u] ?? 0)])) })
        : computeShares({ ...base, type: "shares", shares: Object.fromEntries(involved.map((u) => [u, Number(weights[u] ?? 1)])) });
      return { shares, error: null };
    } catch (e) {
      return { shares: null, error: e instanceof SplitError ? e.message : String(e) };
    }
  }, [total, involved, payers, lodging, presence, nightsN, split, exact, percents, weights]);

  async function save() {
    if (!data) return;
    if (!description.trim()) return setError("Describe the expense.");
    if (total <= 0) return setError("Enter an amount.");
    const payerIds = Object.keys(payers);
    if (payerIds.length === 0) return setError("Who paid?");
    // payers: one payer takes it all; several must be typed and add up
    const payerCents: Record<string, number> = payerIds.length === 1 ? { [payerIds[0]!]: total } : Object.fromEntries(payerIds.map((u) => [u, parseToCents(payers[u] ?? "") ?? 0]));
    const payerSum = Object.values(payerCents).reduce((a, b) => a + b, 0);
    if (payerSum !== total) return setError(`Payers add up to ${formatCents(payerSum, currency)}, not ${formatCents(total, currency)}.`);
    if (!preview?.shares) return setError(preview?.error ?? "Fix the split.");
    setBusy(true); setError(null);
    const base = toBaseCents(total, fxRate);
    const payload = {
      id: existing?.id, trip_id: data.trip.id, description: description.trim(), category, subcategory,
      amount_cents: amountCents, tip_cents: tipCents, currency, fx_rate: fxRate, base_amount_cents: base,
      split_type: lodging ? "nights" : split, nights: lodging ? nightsN : null,
      payers: Object.entries(payerCents).map(([user_id, c]) => ({ user_id, amount_cents: c, base_amount_cents: toBaseCents(c, fxRate) })),
      shares: Object.entries(preview.shares).map(([user_id, c]) => ({ user_id, share_cents: c, base_share_cents: toBaseCents(c, fxRate), nights: lodging ? (presence[user_id] ?? []).filter(Boolean).length : null, night_presence: lodging ? presence[user_id] ?? null : null })),
    };
    const { error: e } = await supabase.rpc("save_expense", { p: payload });
    setBusy(false);
    if (e) return setError(e.message);
    router.back();
  }
  function remove() {
    Alert.alert("Delete this expense?", "It comes out of every balance and stays in the history.", [
      { text: "Cancel", style: "cancel" },
      { text: "Delete", style: "destructive", onPress: async () => { await supabase.rpc("delete_expense", { p_id: existing!.id }); router.back(); } },
    ]);
  }

  if (!data || !seeded) return <Screen><View /></Screen>;
  const name = (uid: string) => (uid === me ? "You" : members.find((m) => m.user_id === uid)?.display_name ?? "Member");

  return (
    <Screen padded={false}>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1 }}>
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: theme.screenPadding, paddingVertical: theme.spacing.sm }}>
          <Button title="Cancel" kind="text" size="small" onPress={() => router.back()} />
          <Text variant="title2">{existing ? "Edit expense" : "Add expense"}</Text>
          {existing ? <Button title="Delete" kind="text" size="small" onPress={remove} /> : <View style={{ width: 60 }} />}
        </View>
        <ScrollView contentContainerStyle={{ paddingHorizontal: theme.screenPadding, gap: theme.spacing.lg, paddingBottom: 120 }} keyboardShouldPersistTaps="handled">
          <View style={{ flexDirection: "row", gap: theme.spacing.md }}>
            <View style={{ flex: 2 }}><Input label="Amount" placeholder="0.00" keyboardType="decimal-pad" value={amount} onChangeText={setAmount} autoFocus={!existing} /></View>
            <View style={{ flex: 1 }}><Input label="Tip" placeholder="0.00" keyboardType="decimal-pad" value={tip} onChangeText={setTip} /></View>
          </View>
          <View style={{ gap: theme.spacing.xs }}>
            <Text variant="caption1Semibold" color={theme.colors.text.onBackground.secondary}>Currency</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: theme.spacing.sm }}>
              {[data.trip.base_currency, ...COMMON_CURRENCIES.filter((c) => c !== data.trip.base_currency)].map((c) => (
                <Pressable key={c} onPress={() => setCurrency(c)} accessibilityRole="radio" accessibilityState={{ selected: currency === c }} style={{ paddingHorizontal: 12, paddingVertical: 8, borderRadius: theme.radius.pill, borderWidth: 1, borderColor: currency === c ? theme.colors.border.primary : theme.colors.border.neutral, backgroundColor: currency === c ? theme.colors.fill.primary : theme.colors.background.surface }}>
                  <Text variant="caption1Semibold">{c}</Text>
                </Pressable>
              ))}
            </ScrollView>
            {currency !== data.trip.base_currency && <Input label={`Rate: 1 ${currency} in ${data.trip.base_currency}`} keyboardType="decimal-pad" value={fx} onChangeText={setFx} helper={`${formatCents(total, currency)} = ${formatCents(toBaseCents(total, fxRate), data.trip.base_currency)} · locked on save`} />}
          </View>
          <Input label="Description" placeholder="Dinner at Rosa's" value={description} onChangeText={setDescription} maxLength={140} />

          <View style={{ gap: theme.spacing.xs }}>
            <Text variant="caption1Semibold" color={theme.colors.text.onBackground.secondary}>Category</Text>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: theme.spacing.sm }}>
              {CATEGORIES.map((c) => <Chip key={c.key} label={c.label} on={category === c.key} onPress={() => pickCategory(c.key)} />)}
            </View>
            {cat.subcategories.length > 0 && (
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: theme.spacing.sm, marginTop: 4 }}>
                {cat.subcategories.map((s) => <Chip key={s.key} label={s.label} on={subcategory === s.key} onPress={() => pickSub(s.key)} />)}
              </View>
            )}
          </View>

          <Card style={{ padding: 0, overflow: "hidden" }}>
            <Text variant="captionCaps2" color={theme.colors.text.onBackground.secondary} style={{ padding: 12, paddingBottom: 4 }}>Who paid</Text>
            {members.map((m) => (
              <Pressable key={m.user_id} onPress={() => togglePayer(m.user_id)} style={{ flexDirection: "row", alignItems: "center", gap: 12, padding: 12 }}>
                <Check on={m.user_id in payers} /><Avatar name={m.display_name ?? "?"} size={28} /><Text variant="headline" style={{ flex: 1 }}>{name(m.user_id)}</Text>
                {Object.keys(payers).length > 1 && m.user_id in payers && <Input placeholder="0.00" keyboardType="decimal-pad" value={payers[m.user_id]} onChangeText={(v) => setPayers((p) => ({ ...p, [m.user_id]: v }))} style={{ width: 96, height: 36 }} />}
              </Pressable>
            ))}
          </Card>

          <Card style={{ padding: 0, overflow: "hidden" }}>
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", padding: 12, paddingBottom: 4 }}>
              <Text variant="captionCaps2" color={theme.colors.text.onBackground.secondary}>Who&apos;s involved</Text>
              <Button title={involved.length === members.length ? "None" : "Everyone"} kind="text" size="small" onPress={() => setInvolved(involved.length === members.length ? [] : members.map((m) => m.user_id))} />
            </View>
            {members.map((m) => {
              const on = involved.includes(m.user_id);
              return (
                <View key={m.user_id}>
                  <Pressable onPress={() => toggleInvolved(m.user_id)} style={{ flexDirection: "row", alignItems: "center", gap: 12, padding: 12 }}>
                    <Check on={on} /><Avatar name={m.display_name ?? "?"} size={28} /><Text variant="headline" style={{ flex: 1 }}>{name(m.user_id)}</Text>
                    {on && !lodging && split === "exact" && <Input placeholder="0.00" keyboardType="decimal-pad" value={exact[m.user_id] ?? ""} onChangeText={(v) => setExact((x) => ({ ...x, [m.user_id]: v }))} style={{ width: 96, height: 36 }} />}
                    {on && !lodging && split === "percent" && <Input placeholder="%" keyboardType="decimal-pad" value={percents[m.user_id] ?? ""} onChangeText={(v) => setPercents((x) => ({ ...x, [m.user_id]: v }))} style={{ width: 72, height: 36 }} />}
                    {on && !lodging && split === "shares" && <Input placeholder="1" keyboardType="number-pad" value={weights[m.user_id] ?? ""} onChangeText={(v) => setWeights((x) => ({ ...x, [m.user_id]: v }))} style={{ width: 64, height: 36 }} />}
                    {on && preview?.shares && <Text variant="caption1Semibold" color={theme.colors.text.onBackground.secondary}>{formatCents(preview.shares[m.user_id] ?? 0, currency)}</Text>}
                  </Pressable>
                  {on && lodging && (
                    <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6, paddingHorizontal: 12, paddingBottom: 10, paddingLeft: 64 }}>
                      {Array.from({ length: nightsN }, (_, i) => {
                        const stayed = presence[m.user_id]?.[i] ?? true;
                        return <Pressable key={i} onPress={() => setPresence((p) => ({ ...p, [m.user_id]: Array.from({ length: nightsN }, (_, k) => (k === i ? !stayed : p[m.user_id]?.[k] ?? true)) }))} accessibilityRole="checkbox" accessibilityState={{ checked: stayed }} style={{ paddingHorizontal: 10, paddingVertical: 4, borderRadius: theme.radius.tag, borderWidth: 1, borderColor: stayed ? theme.colors.border.primary : theme.colors.border.neutral, backgroundColor: stayed ? theme.colors.fill.primary : "transparent" }}><Text variant="caption3">N{i + 1}</Text></Pressable>;
                      })}
                    </View>
                  )}
                </View>
              );
            })}
          </Card>

          <View style={{ gap: theme.spacing.sm }}>
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
              <Text variant="caption1Semibold" color={theme.colors.text.onBackground.secondary}>Split</Text>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}><Text variant="caption1">Lodging (by nights)</Text><Switch value={lodging} onValueChange={setLodging} trackColor={{ true: theme.colors.fill.success }} /></View>
            </View>
            {lodging ? (
              <Input label="Nights" keyboardType="number-pad" value={nights} onChangeText={setNightsCount} helper={`${formatCents(Math.round(total / nightsN), currency)} a night, split among the people ticked for each night.`} />
            ) : (
              <Segmented options={SPLITS} value={split} onChange={setSplit} />
            )}
            {preview?.error && <Text variant="caption1" color={theme.colors.text.destructive}>{preview.error}</Text>}
            {!lodging && split === "equal" && <Text variant="caption1" color={theme.colors.text.onBackground.tertiary}>Leftover cents go to the payer so the total always matches.</Text>}
          </View>
          <Divider />
          {error && <Text variant="caption1" color={theme.colors.text.destructive}>{error}</Text>}
          <Button title={existing ? "Save changes" : `Add ${total ? formatCents(total, currency) : "expense"}`} onPress={save} loading={busy} />
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}

function Chip({ label, on, onPress }: { label: string; on: boolean; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} accessibilityRole="radio" accessibilityState={{ selected: on }} style={{ paddingHorizontal: 12, paddingVertical: 8, borderRadius: theme.radius.pill, borderWidth: 1, borderColor: on ? theme.colors.border.primary : theme.colors.border.neutral, backgroundColor: on ? theme.colors.fill.primary : theme.colors.background.surface }}>
      <Text variant="caption1Semibold">{label}</Text>
    </Pressable>
  );
}
function Check({ on }: { on: boolean }) {
  return <View style={{ width: 22, height: 22, borderRadius: 6, borderWidth: 1.5, borderColor: on ? theme.colors.border.primary : theme.colors.border.neutral, backgroundColor: on ? theme.colors.fill.primary : "transparent", alignItems: "center", justifyContent: "center" }}>{on && <Text variant="caption3">✓</Text>}</View>;
}
