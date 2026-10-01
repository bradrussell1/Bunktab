import {
  CATEGORIES,
  COMMON_CURRENCIES,
  addDays,
  formatDayShort,
  weekdayShort,
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
import { ActionSheetIOS, Alert, Image, KeyboardAvoidingView, Platform, Pressable, ScrollView, Switch, View } from "react-native";
import { CategoryPicker } from "@/components/CategoryPicker";
import { Avatar, Button, Card, Divider, Input, ListItem, Screen, Segmented, Text } from "@/components/ui";
import { useAuth } from "@/lib/auth";
import { fetchRate, formatFetchedAt } from "@/lib/fx";
import { pickReceipt, readReceipt, signReceipt, uploadReceipt } from "@/lib/receipts";
import { supabase } from "@/lib/supabase";
import { activeMembers, useTrip, type Expense } from "@/lib/trips";

/**
 * Add or edit an expense (spec: Screens → Add or edit expense). Amount and
 * currency; the payer is always you (an edit keeps the original payer);
 * who's involved (everyone by default); the split type; description; category and
 * subcategory from the fixed list; tip as its own field; "Pro-rate lodging
 * by nights", offered only for hotels and rentals, switches to nights. Shares are computed by @checkm8/core and saved
 * through save_expense in one transaction; the server re-checks the sums.
 * A receipt photo uploads to the private receipts bucket and the total is
 * read server-side to pre-fill the amount (tip stays separate); a non-base
 * currency fetches its rate on selection, editable, locked on save.
 */
const SPLITS: { key: SplitType; label: string }[] = [
  { key: "equal", label: "Equal" }, { key: "exact", label: "Exact" }, { key: "percent", label: "%" },
];

export default function ExpenseScreen() {
  const { id, expense: expenseId, ...devParams } = useLocalSearchParams<{ id: string; expense?: string; category?: string; sub?: string }>();
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
  const [category, setCategory] = useState<string | null>(null); // nothing picked until the user chooses
  const [subcategory, setSubcategory] = useState<string | null>(null);
  const [involved, setInvolved] = useState<string[]>([]);
  const [split, setSplit] = useState<SplitType>("equal");
  const [exact, setExact] = useState<Record<string, string>>({});
  const [percents, setPercents] = useState<Record<string, string>>({});
  const [lodging, setLodging] = useState(false);
  const [nights, setNights] = useState("1");
  const [presence, setPresence] = useState<Record<string, boolean[]>>({});
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [seeded, setSeeded] = useState(false);
  const [receiptPath, setReceiptPath] = useState<string | null>(null);
  const [receiptUrl, setReceiptUrl] = useState<string | null>(null);
  const [receiptBusy, setReceiptBusy] = useState(false);
  const [receiptNote, setReceiptNote] = useState<string | null>(null);
  const [fxNote, setFxNote] = useState<string | null>(null);
  const [commentCount, setCommentCount] = useState<number | null>(null);

  const members = useMemo(() => (data ? activeMembers(data) : []), [data]);
  const cat = CATEGORIES.find((c) => c.key === category) ?? null;

  // seed from the trip (defaults) or the expense being edited
  useEffect(() => {
    if (!data || seeded) return;
    const ids = members.map((m) => m.user_id);
    if (existing) {
      setAmount(String(existing.amount_cents / 100)); setTip(existing.tip_cents ? String(existing.tip_cents / 100) : "");
      setCurrency(existing.currency); setFx(String(existing.fx_rate)); setDescription(existing.description);
      setCategory(existing.category); setSubcategory(existing.subcategory);
      setInvolved(existing.expense_shares.map((s) => s.user_id));
      setSplit(existing.split_type === "nights" || existing.split_type === "shares" ? "equal" : existing.split_type);
      setLodging(existing.split_type === "nights");
      if (existing.split_type === "exact") setExact(Object.fromEntries(existing.expense_shares.map((s) => [s.user_id, String(s.share_cents / 100)])));
      if (existing.receipt_url) setReceiptPath(existing.receipt_url);
      if (existing.nights) { setNights(String(existing.nights)); setPresence(Object.fromEntries(existing.expense_shares.map((s) => [s.user_id, s.night_presence ?? fullPresence([s.user_id], existing.nights!)[s.user_id]!]))); }
    } else {
      setCurrency(data.trip.base_currency);
      setInvolved(ids);
      const n = Math.max(1, nightsBetween(data.trip.start_date, data.trip.end_date));
      setNights(String(n)); setPresence(fullPresence(ids, n));
    }
    setSeeded(true);
  }, [data, existing, members, me, seeded]);

  // signed link for the receipt thumbnail (private bucket)
  useEffect(() => {
    let live = true;
    if (!receiptPath) { setReceiptUrl(null); return; }
    signReceipt(receiptPath).then((u) => { if (live) setReceiptUrl(u); });
    return () => { live = false; };
  }, [receiptPath]);

  // fetch the rate when a non-base currency is picked; typed rate stays the fallback
  useEffect(() => {
    if (!data || !seeded) return;
    const base = data.trip.base_currency;
    if (currency === base) { setFx("1"); setFxNote(null); return; }
    if (existing && currency === existing.currency && !fxNote) return; // keep the locked rate on an edit until the user changes currency
    let live = true;
    setFxNote("Fetching rate…");
    fetchRate(currency, base).then((q) => {
      if (!live) return;
      if (q) { setFx(String(Number(q.rate.toFixed(6)))); setFxNote(`Rate fetched ${formatFetchedAt(q.fetchedAt)}, locked on save`); }
      else setFxNote("Couldn't fetch a rate, enter one by hand");
    });
    return () => { live = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currency, data?.trip.base_currency, seeded]);

  // comment count for the saved expense
  useEffect(() => {
    if (!existing) return;
    supabase.from("comments").select("id", { count: "exact", head: true }).eq("expense_id", existing.id).then(({ count }) => setCommentCount(count ?? 0));
  }, [existing]);

  // DEV only: ?category=&sub= preselects a pair (screenshots, tests)
  useEffect(() => { if (__DEV__ && seeded && !existing && devParams.category) changeCategory(devParams.category, devParams.sub ?? null); }, [seeded, existing, devParams.category, devParams.sub]); // eslint-disable-line react-hooks/exhaustive-deps

  const amountCents = parseToCents(amount) ?? 0;
  const tipCents = parseToCents(tip) ?? 0;
  const total = amountCents + tipCents;
  const fxRate = Number(fx) || 1;
  const nightsN = Math.max(1, parseInt(nights, 10) || 1);

  // lodging (by nights) exists only under Travel & Lodging; hotels/rentals turn it on
  function changeCategory(key: string | null, sub: string | null) {
    setCategory(key); setSubcategory(sub);
    if (key !== "travel") setLodging(false);
    else if (isLodgingCategory(key, sub)) setLodging(true);
  }
  function toggleInvolved(uid: string) { setInvolved((v) => (v.includes(uid) ? v.filter((x) => x !== uid) : [...v, uid])); }
  // the payer: you, or on an edit the person who originally paid
  const payerId = existing?.expense_payers[0]?.user_id ?? me;
  const lodgingOffered = category === "travel" && isLodgingCategory(category, subcategory);
  function setNightsCount(v: string) {
    setNights(v);
    const n = Math.max(1, parseInt(v, 10) || 1);
    setPresence((p) => Object.fromEntries(involved.map((uid) => [uid, Array.from({ length: n }, (_, i) => p[uid]?.[i] ?? true)])));
  }

  async function attachReceipt(source: "camera" | "library") {
    if (!data) return;
    setError(null);
    const uri = await pickReceipt(source);
    if (!uri) return;
    setReceiptBusy(true); setReceiptNote(null);
    try {
      const path = await uploadReceipt(data.trip.id, uri);
      setReceiptPath(path);
      const read = await readReceipt(path);
      if (read?.total_cents && read.total_cents > 0 && read.confidence !== "low" && !amount.trim()) {
        setAmount((read.total_cents / 100).toFixed(2));
        if (read.currency && (COMMON_CURRENCIES as readonly string[]).includes(read.currency)) setCurrency(read.currency);
        setReceiptNote("Read from the receipt, check it");
      } else {
        setReceiptNote(amount.trim() ? "Receipt attached" : "Couldn't read a total, enter it by hand");
      }
    } catch (e) { setError(e instanceof Error ? e.message : "Couldn't upload the receipt."); }
    setReceiptBusy(false);
  }
  function chooseReceipt() {
    if (Platform.OS === "ios") {
      ActionSheetIOS.showActionSheetWithOptions({ options: ["Cancel", "Take photo", "Choose photo"], cancelButtonIndex: 0 }, (i) => { if (i === 1) attachReceipt("camera"); if (i === 2) attachReceipt("library"); });
    } else {
      Alert.alert("Receipt", undefined, [{ text: "Take photo", onPress: () => attachReceipt("camera") }, { text: "Choose photo", onPress: () => attachReceipt("library") }, { text: "Cancel", style: "cancel" }]);
    }
  }
  function removeReceipt() { setReceiptPath(null); setReceiptNote(null); }

  const preview = useMemo(() => {
    try {
      if (total <= 0 || involved.length === 0) return null;
      const payerIds = [payerId];
      if (lodging) {
        const pres = Object.fromEntries(involved.map((uid) => [uid, presence[uid] ?? Array.from({ length: nightsN }, () => true)]));
        return { shares: computeNightsShares({ amountCents: total, nights: nightsN, presence: pres, payerIds }).shares, error: null };
      }
      const base = { amountCents: total, participants: involved, payerIds };
      const shares =
        split === "equal" ? computeShares({ ...base, type: "equal" })
        : split === "exact" ? computeShares({ ...base, type: "exact", exactCents: Object.fromEntries(involved.map((u) => [u, parseToCents(exact[u] ?? "") ?? 0])) })
        : computeShares({ ...base, type: "percent", percents: Object.fromEntries(involved.map((u) => [u, Number(percents[u] ?? 0)])) });
      return { shares, error: null };
    } catch (e) {
      return { shares: null, error: e instanceof SplitError ? e.message : String(e) };
    }
  }, [total, involved, payerId, lodging, presence, nightsN, split, exact, percents]);

  async function save() {
    if (!data) return;
    if (!description.trim()) return setError("Describe the expense.");
    if (!category || (cat && cat.subcategories.length > 0 && !subcategory)) return setError("Pick a category.");
    if (total <= 0) return setError("Enter an amount.");
    const payerCents: Record<string, number> = { [payerId]: total };
    if (!preview?.shares) return setError(preview?.error ?? "Fix the split.");
    setBusy(true); setError(null);
    const base = toBaseCents(total, fxRate);
    const payload = {
      id: existing?.id, trip_id: data.trip.id, description: description.trim(), category, subcategory,
      amount_cents: amountCents, tip_cents: tipCents, currency, fx_rate: fxRate, base_amount_cents: base,
      split_type: lodging ? "nights" : split, nights: lodging ? nightsN : null,
      receipt_url: receiptPath,
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
  const payerNote = payerId === me ? "You paid this" : `${name(payerId)} paid this`;

  return (
    <Screen padded={false}>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1 }}>
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: theme.screenPadding, paddingVertical: theme.spacing.sm }}>
          <Button title="Cancel" kind="text" size="small" onPress={() => router.back()} />
          <Text variant="title2">{existing ? "Edit expense" : "Add expense"}</Text>
          {existing ? <Button title="Delete" kind="text" size="small" onPress={remove} /> : <View style={{ width: 60 }} />}
        </View>
        <ScrollView contentContainerStyle={{ paddingHorizontal: theme.screenPadding, gap: theme.spacing.lg, paddingBottom: 120 }} keyboardShouldPersistTaps="handled">
          <Card style={{ padding: 12, flexDirection: "row", alignItems: "center", gap: theme.spacing.md }}>
            <Pressable onPress={chooseReceipt} disabled={receiptBusy} accessibilityRole="button" accessibilityLabel={receiptPath ? "Change receipt photo" : "Add receipt photo"}
              style={{ width: 56, height: 56, borderRadius: theme.radius.control, borderWidth: 1, borderColor: theme.colors.border.neutral, backgroundColor: theme.colors.fill.secondary, alignItems: "center", justifyContent: "center", overflow: "hidden" }}>
              {receiptUrl ? <Image source={{ uri: receiptUrl }} style={{ width: 56, height: 56 }} resizeMode="cover" accessibilityIgnoresInvertColors /> : <Text variant="caption3" color={theme.colors.text.onBackground.secondary}>{receiptBusy ? "…" : "Receipt"}</Text>}
            </Pressable>
            <View style={{ flex: 1, gap: 2 }}>
              <Text variant="headline">{receiptPath ? "Receipt attached" : "Receipt"}</Text>
              <Text variant="caption1" color={theme.colors.text.onBackground.secondary}>{receiptBusy ? "Uploading and reading the total…" : receiptNote ?? (receiptPath ? "Saved with the expense as proof." : "Snap it and the total fills in. Add tip separately.")}</Text>
            </View>
            {receiptPath
              ? <Button title="Remove" kind="text" size="small" onPress={removeReceipt} disabled={receiptBusy} />
              : <Button title="Add" kind="secondary" size="small" onPress={chooseReceipt} loading={receiptBusy} />}
          </Card>
          <View style={{ flexDirection: "row", gap: theme.spacing.md }}>
            <View style={{ flex: 2 }}><Input label="Amount" placeholder="0.00" keyboardType="decimal-pad" value={amount} onChangeText={setAmount} autoFocus={!existing} /></View>
            <View style={{ flex: 1 }}><Input label="Tip" placeholder="0.00" keyboardType="decimal-pad" value={tip} onChangeText={setTip} /></View>
          </View>
          <View style={{ gap: theme.spacing.xs }}>
            <Text variant="caption1Semibold" color={theme.colors.text.onBackground.secondary}>Currency</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: theme.spacing.sm }}>
              {[data.trip.base_currency, ...COMMON_CURRENCIES.filter((c) => c !== data.trip.base_currency)].map((c) => (
                <Pressable key={c} onPress={() => setCurrency(c)} accessibilityRole="radio" accessibilityState={{ selected: currency === c }} style={{ paddingHorizontal: 12, paddingVertical: 8, borderRadius: theme.radius.pill, borderWidth: 1, borderColor: currency === c ? theme.colors.fill.primary : theme.colors.border.neutral, backgroundColor: currency === c ? theme.colors.fill.primary : theme.colors.background.surface }}>
                  <Text variant="caption1Semibold" color={currency === c ? theme.colors.text.onFill.onPrimary : theme.colors.text.onBackground.primary}>{c}</Text>
                </Pressable>
              ))}
            </ScrollView>
            {currency !== data.trip.base_currency && <Input label={`Rate: 1 ${currency} in ${data.trip.base_currency}`} keyboardType="decimal-pad" value={fx} helper={`${formatCents(total, currency)} = ${formatCents(toBaseCents(total, fxRate), data.trip.base_currency)}${fxNote ? ` · ${fxNote}` : " · locked on save"}`} onChangeText={(v) => { setFx(v); setFxNote("Typed rate, locked on save"); }} />}
          </View>
          <Input label="Description" placeholder="Dinner at Rosa's" value={description} onChangeText={setDescription} maxLength={140} helper={payerNote} />

          <CategoryPicker category={category} subcategory={subcategory} onChange={changeCategory} />

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
                    {on && preview?.shares && <Text variant="caption1Semibold" color={theme.colors.text.onBackground.secondary}>{formatCents(preview.shares[m.user_id] ?? 0, currency)}</Text>}
                  </Pressable>
                  {on && lodging && (
                    <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6, paddingHorizontal: 12, paddingBottom: 10, paddingLeft: 64 }}>
                      {Array.from({ length: nightsN }, (_, i) => {
                        const stayed = presence[m.user_id]?.[i] ?? true;
                        return <Pressable key={i} onPress={() => setPresence((p) => ({ ...p, [m.user_id]: Array.from({ length: nightsN }, (_, k) => (k === i ? !stayed : p[m.user_id]?.[k] ?? true)) }))} accessibilityRole="checkbox" accessibilityState={{ checked: stayed }} style={{ paddingHorizontal: 10, paddingVertical: 4, borderRadius: theme.radius.tag, borderWidth: 1, borderColor: stayed ? theme.colors.fill.primary : theme.colors.border.neutral, backgroundColor: stayed ? theme.colors.fill.primary : "transparent" }}><Text variant="caption3" color={stayed ? theme.colors.text.onFill.onPrimary : theme.colors.text.onBackground.secondary}>{weekdayShort(addDays(data.trip.start_date, i))}</Text></Pressable>;
                      })}
                    </View>
                  )}
                </View>
              );
            })}
          </Card>

          <View style={{ gap: theme.spacing.sm }}>
            {/* one row: "Split" on the left; for hotels/rentals a right-aligned "Pro-rate lodging by nights" switch */}
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", minHeight: 31 }}>
              <Text variant="caption1Semibold" color={theme.colors.text.onBackground.secondary}>Split</Text>
              {lodgingOffered && (
                <View style={{ flexDirection: "row", alignItems: "center", gap: theme.spacing.sm }}>
                  <Text variant="caption1Semibold" color={theme.colors.text.onBackground.secondary}>Pro-rate lodging by nights</Text>
                  <Switch value={lodging} onValueChange={setLodging} trackColor={{ true: theme.colors.fill.primary, false: theme.palette.grayDeep }} accessibilityLabel="Pro-rate lodging by nights" />
                </View>
              )}
            </View>
            {lodging ? (
              <Input label="Nights" keyboardType="number-pad" value={nights} onChangeText={setNightsCount} helper={`${formatDayShort(data.trip.start_date)} → ${formatDayShort(addDays(data.trip.start_date, nightsN))} · ${nightsN} ${nightsN === 1 ? "night" : "nights"} · ${formatCents(Math.round(total / nightsN), currency)} a night, split among the people ticked for each night.`} />
            ) : (
              <Segmented options={SPLITS} value={split} onChange={setSplit} />
            )}
            {preview?.error && <Text variant="caption1" color={theme.colors.text.destructive}>{preview.error}</Text>}
            {!lodging && split === "equal" && <Text variant="caption1" color={theme.colors.text.onBackground.tertiary}>Leftover cents go to the payer so the total always matches.</Text>}
          </View>
          {existing && (
            <Card style={{ padding: 0, overflow: "hidden" }}>
              <ListItem title={`Comments${commentCount === null ? "" : ` (${commentCount})`}`} subtitle="Questions and notes about this expense" onPress={() => router.push(`/(app)/trip/${data.trip.id}/comments?expense=${existing.id}`)} right={<Text variant="caption1Semibold" color={theme.colors.text.onBackground.accent}>Open ›</Text>} />
            </Card>
          )}
          <Divider />
          {error && <Text variant="caption1" color={theme.colors.text.destructive}>{error}</Text>}
          <Button title={existing ? "Save changes" : `Add ${total ? formatCents(total, currency) : "expense"}`} onPress={save} loading={busy} disabled={total <= 0 || receiptBusy} />
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}

function Check({ on }: { on: boolean }) {
  return <View style={{ width: 22, height: 22, borderRadius: 6, borderWidth: 1.5, borderColor: on ? theme.colors.fill.primary : theme.colors.border.neutral, backgroundColor: on ? theme.colors.fill.primary : "transparent", alignItems: "center", justifyContent: "center" }}>{on && <Text variant="caption3" color={theme.colors.text.onFill.onPrimary}>✓</Text>}</View>;
}
