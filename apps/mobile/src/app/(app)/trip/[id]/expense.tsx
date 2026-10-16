import {
  CATEGORIES,
  COMMON_CURRENCIES,
  addDays,
  formatDayShort,
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
} from "@bunktab/core";
import { color, layout, palette, radius, shadow, size, space, text as textStyle } from "@bunktab/theme";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Image, KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { FormError } from "@/components/AuthScreen";
import { WhoSleptWhere } from "@/components/WhoSleptWhere";
import { ActionSheet, Avatar, Button, Icon, Input, KEYBOARD_BAR_HEIGHT, KeyboardDoneBar, Press, Receipt, RowCard, SegmentedControl, TextLink, Toggle, ZText, useKeyboardVisible } from "@/ui";
import { useAuth } from "@/lib/auth";
import { fetchRate, formatFetchedAt } from "@/lib/fx";
import { captureReceipt, signReceipt } from "@/lib/receipts";
import { isNetworkError, supabase } from "@/lib/supabase";
import { activeMembers, useTrip, type Expense } from "@/lib/trips";
import { currencyLabel } from "@/lib/currencyLabels";

/**
 * Add or edit an expense (RESKIN_PROMPT B5; spec: Screens → Add or edit expense), as a
 * white sheet sliding up over the dazzle page. Big amount entry with a currency pill;
 * "Snap a receipt" (ink) and, once the photo is read, the thermal Receipt card with
 * "Use $164.00" / Edit; who paid (you, or on an edit the original payer); who's
 * involved as avatar chips (everyone by default, deselected = dashed); split type;
 * description; category and subcategory as pill dropdowns (the second hides when
 * there are none); tip; "Split by nights stayed" for hotels and rentals with a
 * "Who slept where?" row opening the B6 nights grid. Shares are computed by @bunktab/core and saved through
 * save_expense in one transaction; the server re-checks the sums. A receipt photo
 * uploads to the private receipts bucket and the total is read server-side to
 * pre-fill the amount (tip stays separate); a non-base currency fetches its rate
 * on selection, editable, locked on save. Every read, RPC and target is unchanged.
 *
 * Feedback round 1: Cancel and the backdrop always work, even with no dazzle id (item 1);
 * the Add expense button hides while the keyboard is up, number pads get a Done bar and
 * the focused field scrolls into view (item 15); a dropped connection on save shows
 * "Connection lost…" with Try again re-sending the same payload, never the raw fetch
 * error (item 16). Full offline queueing is out of scope: the form stays as typed.
 */
const SPLITS: { key: SplitType; label: string }[] = [
  { key: "equal", label: "Equal" }, { key: "exact", label: "Exact" }, { key: "percent", label: "%" },
];
type Sheet = "receipt" | "currency" | "category" | "subcategory" | "delete" | null;

export default function ExpenseScreen() {
  const { id, expense: expenseId, receipt_path: receiptParam, ...devParams } = useLocalSearchParams<{ id: string; expense?: string; category?: string; sub?: string; receipt?: string; nights?: string; receipt_path?: string; receipt_id?: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
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
  const [nightsOpen, setNightsOpen] = useState(false); // B6 Who slept where, full screen over the sheet
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [seeded, setSeeded] = useState(false);
  const [receiptPath, setReceiptPath] = useState<string | null>(null);
  const [receiptUrl, setReceiptUrl] = useState<string | null>(null);
  const [receiptBusy, setReceiptBusy] = useState(false);
  const [receiptNote, setReceiptNote] = useState<string | null>(null);
  // a photo attached from the receipt flow's "Enter the total" (manual entry keeps the photo)
  const read = null;
  const [fxNote, setFxNote] = useState<string | null>(null);
  const [commentCount, setCommentCount] = useState<number | null>(null);
  const [sheet, setSheet] = useState<Sheet>(null);
  const [connLost, setConnLost] = useState(false);
  const amountRef = useRef<TextInput>(null);
  const keyboard = useKeyboardVisible();
  // always a way out: back when there is a page under the sheet, else the dazzle (or Home)
  const close = () => { if (router.canGoBack()) router.back(); else router.replace(id ? `/(app)/trip/${id}` : "/(app)/home"); };

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
      setSplit(existing.split_type === "nights" || existing.split_type === "shares" || existing.split_type === "itemized" ? "equal" : existing.split_type);
      setLodging(existing.split_type === "nights");
      if (existing.split_type === "exact") setExact(Object.fromEntries(existing.expense_shares.map((s) => [s.user_id, String(s.share_cents / 100)])));
      if (existing.receipt_url) setReceiptPath(existing.receipt_url);
      else if (receiptParam) setReceiptPath(receiptParam);
      if (existing.nights) { setNights(String(existing.nights)); setPresence(Object.fromEntries(existing.expense_shares.map((s) => [s.user_id, s.night_presence ?? fullPresence([s.user_id], existing.nights!)[s.user_id]!]))); }
    } else {
      setCurrency(data.trip.base_currency);
      setInvolved(ids);
      if (receiptParam) { setReceiptPath(receiptParam); setReceiptNote("Photo saved. Enter the total by hand"); }
      const n = Math.max(1, nightsBetween(data.trip.start_date, data.trip.end_date));
      setNights(String(n)); setPresence(fullPresence(ids, n));
    }
    setSeeded(true);
  }, [data, existing, members, me, seeded]);

  // focus the amount once the sheet has settled: an autoFocus fires before the keyboard's
  // Done bar (InputAccessoryView) is registered, and iOS then shows the pad without it
  useEffect(() => {
    if (!seeded || existing || read || receiptParam) return;
    const t = setTimeout(() => amountRef.current?.focus(), 350);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [seeded]);

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
  useEffect(() => { if (__DEV__ && seeded && lodging && devParams.nights === "1") setNightsOpen(true); }, [seeded, lodging, devParams.nights]); // screenshots: open B6 directly
  useEffect(() => { if (__DEV__ && seeded && !existing && devParams.category) changeCategory(devParams.category, devParams.sub ?? null); }, [seeded, existing, devParams.category, devParams.sub]);

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
  const stayedOn = (uid: string, i: number) => presence[uid]?.[i] ?? true;
  const stripesPainted = involved.reduce((a, uid) => a + Array.from({ length: nightsN }, (_, i) => stayedOn(uid, i)).filter(Boolean).length, 0);
  const emptyNight = involved.length > 0 && Array.from({ length: nightsN }, (_, i) => involved.some((uid) => stayedOn(uid, i))).some((x) => !x);
  function setNightsCount(v: string) {
    setNights(v);
    const n = Math.max(1, parseInt(v, 10) || 1);
    setPresence((p) => Object.fromEntries(involved.map((uid) => [uid, Array.from({ length: n }, (_, i) => p[uid]?.[i] ?? true)])));
  }

  /** Snap a receipt: the photo is read line by line and the split happens on the receipt screens; the sheet closes. */
  async function attachReceipt(source: "camera" | "library") {
    if (!data) return;
    setError(null); setReceiptBusy(true); setReceiptNote(null);
    try {
      const r = await captureReceipt(data.trip.id, source);
      if (!r) return;
      if (r.queued) { setReceiptNote("No connection. The photo will upload when you're back online."); return; }
      if (r.aiDisabled) { setReceiptPath(r.storagePath ?? null); setReceiptNote("Photo saved. Receipt reading is paused right now, so enter the total below."); return; }
      router.replace({ pathname: "/(app)/trip/[id]/receipt/[receiptId]", params: { id: data.trip.id, receiptId: r.receiptId } });
    } catch (e) { setError(e instanceof Error ? e.message : "Couldn't upload the receipt."); }
    finally { setReceiptBusy(false); }
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
    if (e) {
      if (isNetworkError(e.message)) { setConnLost(true); return; } // form state kept; Try again re-submits
      return setError(friendlySaveError(e.message));
    }
    close();
  }
  const isOwner = data?.members.find((m) => m.user_id === me)?.role === "owner";
  const canDelete = !!existing && (existing.created_by === me || isOwner); // user: only the owner or the person who created it
  async function remove() {
    const { error: e } = await supabase.rpc("delete_expense", { p_id: existing!.id });
    if (e) { setError(isNetworkError(e.message) ? "Connection lost. Check your signal and try again." : /owner|created|allowed|42501/i.test(e.message) ? "Only the dazzle owner or the person who added this expense can delete it." : e.message); return; }
    close();
  }

  const name = (uid: string) => (uid === me ? "You" : members.find((m) => m.user_id === uid)?.display_name ?? "Member");
  const first = (uid: string) => name(uid).split(/\s+/)[0]!;
  const photo = (uid: string) => members.find((m) => m.user_id === uid)?.photo_url ?? null;
  const avatarName = (uid: string) => members.find((m) => m.user_id === uid)?.display_name ?? "?";
  const shareText = (uid: string) => (preview?.shares && involved.includes(uid) ? formatCents(preview.shares[uid] ?? 0, currency) : undefined);
  const currencies = data ? [data.trip.base_currency, ...COMMON_CURRENCIES.filter((c) => c !== data.trip.base_currency)] : [...COMMON_CURRENCIES];
  const amountError = total <= 0 && (amount.length > 0 || tip.length > 0) ? "Enter an amount." : null;

  return (
    <View style={styles.host}>
      <Pressable style={styles.backdrop} onPress={close} accessibilityRole="button" accessibilityLabel="Close" />
      <View style={[styles.sheet, { marginTop: insets.top + space[24] }]} accessibilityViewIsModal>
        <View style={styles.grabber} />
        <View style={styles.header}>
          <TextLink label="Cancel" muted onPress={close} style={styles.headerSide} />
          <ZText variant="headline" accessibilityRole="header">{existing ? "Edit expense" : "Add expense"}</ZText>
          <View style={styles.headerSide} />
        </View>
        {!id ? (
          <View style={styles.noTrip}>
            <ZText variant="body" color={color.textMuted} style={styles.noTripText}>Open a dazzle first, then add the expense from there.</ZText>
            <Button kind="secondary" onWhite height={size.pillButton} label="Back to your dazzles" onPress={close} style={styles.noTripButton} />
          </View>
        ) : !data || !seeded ? <View style={styles.flex} /> : (
          <KeyboardAvoidingView behavior={Platform.OS === "ios" ? undefined : "height"} style={styles.flex}>
            <ScrollView contentContainerStyle={[styles.content, keyboard ? { paddingBottom: space[24] + KEYBOARD_BAR_HEIGHT } : null]} keyboardShouldPersistTaps="handled" keyboardDismissMode="interactive" showsVerticalScrollIndicator={false} automaticallyAdjustKeyboardInsets>
              {/* amount */}
              <View style={styles.amountRow}>
                <Press onPress={() => setSheet("currency")} scaleTo={0.97} accessibilityRole="button" accessibilityLabel={`Currency, ${currency}`} style={styles.currencyPill}>
                  <ZText variant="captionStrong">{currency}</ZText>
                  <Icon name="chevronDown" size={14} color={color.textMuted} />
                </Press>
                <TextInput
                  ref={amountRef}
                  value={amount}
                  onChangeText={setAmount}
                  placeholder="0.00"
                  placeholderTextColor={color.textMuted}
                  keyboardType="decimal-pad"
                  accessibilityLabel="Amount"
                 
                  style={styles.amountInput}
                />
              </View>
              {currency !== data.trip.base_currency ? (
                <Input label={`Rate: 1 ${currency} in ${data.trip.base_currency}`} keyboardType="decimal-pad" value={fx} helper={`${formatCents(total, currency)} = ${formatCents(toBaseCents(total, fxRate), data.trip.base_currency)}${fxNote ? ` · ${fxNote}` : " · locked on save"}`} onChangeText={(v) => { setFx(v); setFxNote("Typed rate, locked on save"); }} />
              ) : null}

              {/* receipt */}
              {receiptPath || receiptBusy ? (
                <RowCard
                  tile={receiptUrl ? <Image source={{ uri: receiptUrl }} style={styles.thumb} accessibilityIgnoresInvertColors /> : <Icon name="camera" />}
                  title={receiptBusy ? "Uploading the receipt…" : "Receipt attached"}
                  caption={receiptBusy ? "Then every line is read on the next screen" : receiptNote ?? "Saved with the expense as proof"}
                  right={!receiptBusy ? <TextLink label="Remove" muted onPress={removeReceipt} /> : null}
                />
              ) : (
                <Button kind="ink" icon="camera" label="Snap a receipt" height={size.buttonHeight} onPress={() => setSheet("receipt")} />
              )}

              <Section label="Who paid">
                <View style={styles.chips}>
                  <PersonChip name={first(payerId)} fullName={name(payerId)} avatarName={avatarName(payerId)} photo={photo(payerId)} on />
                </View>
              </Section>

              <Section label="Who's involved" right={<TextLink label={involved.length === members.length ? "Clear" : "Everyone"} muted onPress={() => setInvolved(involved.length === members.length ? [] : members.map((m) => m.user_id))} />}>
                <View style={styles.chips}>
                  {members.map((m) => (
                    <PersonChip key={m.user_id} name={first(m.user_id)} fullName={name(m.user_id)} avatarName={m.display_name ?? "?"} photo={m.photo_url} on={involved.includes(m.user_id)} share={shareText(m.user_id)} onPress={() => toggleInvolved(m.user_id)} />
                  ))}
                </View>
              </Section>

              <Section
                label="Split"
                right={lodgingOffered ? (
                  <View style={styles.toggleRow}>
                    <ZText variant="small" color={color.textMuted}>Split by nights stayed</ZText>
                    <Toggle value={lodging} onChange={setLodging} label="Split by nights stayed" />
                  </View>
                ) : null}
              >
                {lodging ? (
                  <>
                    <Input label="Nights" keyboardType="number-pad" value={nights} onChangeText={setNightsCount} helper={`${formatDayShort(data.trip.start_date)} → ${formatDayShort(addDays(data.trip.start_date, nightsN))} · ${formatCents(Math.round(total / nightsN), currency)} a night, split among the people staying each night.`} />
                    <RowCard
                      tile={<Icon name="moon" size={20} />}
                      title="Who slept where?"
                      caption={`${stripesPainted} ${stripesPainted === 1 ? "stripe" : "stripes"} over ${nightsN} ${nightsN === 1 ? "night" : "nights"}${emptyNight ? " · a night has nobody in it" : ""}`}
                      right={<Icon name="chevronRight" size={18} color={color.textMuted} />}
                      onPress={() => setNightsOpen(true)}
                      accessibilityLabel={`Who slept where? ${stripesPainted} stripes over ${nightsN} nights. Opens the nights grid`}
                    />
                  </>
                ) : (
                  <>
                    <SegmentedControl options={SPLITS} value={split} onChange={setSplit} />
                    {split === "equal" ? <ZText variant="small" color={color.textMuted}>Leftover cents go to the payer so the total always matches.</ZText> : null}
                    {split !== "equal" ? involved.map((uid) => (
                      <View key={uid} style={styles.splitRow}>
                        <ZText variant="bodyStrong" numberOfLines={1} style={styles.flex}>{name(uid)}</ZText>
                        {split === "exact"
                          ? <Input placeholder="0.00" keyboardType="decimal-pad" value={exact[uid] ?? ""} onChangeText={(v) => setExact((x) => ({ ...x, [uid]: v }))} style={styles.splitInput} accessibilityLabel={`${name(uid)}'s exact amount`} />
                          : <Input placeholder="%" keyboardType="decimal-pad" value={percents[uid] ?? ""} onChangeText={(v) => setPercents((x) => ({ ...x, [uid]: v }))} style={styles.splitInput} accessibilityLabel={`${name(uid)}'s percent`} />}
                        <ZText variant="small" color={color.textMuted} tabular style={styles.splitShare}>{shareText(uid)}</ZText>
                      </View>
                    )) : null}
                  </>
                )}
                {preview?.error ? <ZText variant="small" color={color.error}>{preview.error}</ZText> : null}
              </Section>

              <Input label="Description" placeholder="Dinner at Rosa's" value={description} onChangeText={setDescription} maxLength={140} returnKeyType="done" />

              <View style={styles.pillRow}>
                <DropdownPill label="Category" value={cat?.label ?? "Pick a category"} placeholder={!cat} onPress={() => setSheet("category")} />
                {cat && cat.subcategories.length > 0 ? (
                  <DropdownPill label="Subcategory" value={cat.subcategories.find((s) => s.key === subcategory)?.label ?? "Pick one"} placeholder={!subcategory} onPress={() => setSheet("subcategory")} />
                ) : null}
              </View>

              <Input label="Tip (optional)" placeholder="0.00" keyboardType="decimal-pad" value={tip} onChangeText={setTip} helper="Kept separate from the receipt total." />

              {existing ? (
                <RowCard tile={<Icon name="send" />} title={`Comments${commentCount === null ? "" : ` (${commentCount})`}`} caption="Questions and notes about this expense" right={<Icon name="chevronRight" size={18} color={color.textMuted} />} onPress={() => router.push(`/(app)/trip/${data.trip.id}/comments?expense=${existing.id}`)} />
              ) : null}
              {canDelete ? (
                <Press onPress={() => setSheet("delete")} scaleTo={0.97} accessibilityRole="button" accessibilityLabel="Delete this expense" style={styles.delete}>
                  <ZText variant="bodyStrong" color={color.destructive} style={styles.deleteText}>Delete this expense</ZText>
                </Press>
              ) : null}
            </ScrollView>
            {/* the CTA hides while the keyboard is up (the Done bar / return key brings it back) */}
            {!keyboard ? (
              <View style={[styles.footer, { paddingBottom: insets.bottom + space[12] }]}>
                <FormError>{error ?? amountError}</FormError>
                <Button label={existing ? "Save changes" : "Add expense"} onPress={save} loading={busy} disabled={total <= 0 || receiptBusy} />
              </View>
            ) : null}
          </KeyboardAvoidingView>
        )}
      </View>
      <KeyboardDoneBar />

      <ActionSheet open={sheet === "receipt"} onClose={() => setSheet(null)} title="Snap a receipt" actions={[{ label: "Take a photo", onPress: () => attachReceipt("camera") }, { label: "Choose from photos", onPress: () => attachReceipt("library") }]} />
      <ActionSheet open={sheet === "currency"} onClose={() => setSheet(null)} title="Currency" actions={currencies.map((c) => ({ label: currencyLabel(c), onPress: () => setCurrency(c) }))} />
      <ActionSheet open={sheet === "category"} onClose={() => setSheet(null)} title="Category" actions={CATEGORIES.map((c) => ({ label: c.label, onPress: () => changeCategory(c.key, null) }))} />
      <ActionSheet open={sheet === "subcategory"} onClose={() => setSheet(null)} title={cat?.label ?? "Subcategory"} actions={(cat?.subcategories ?? []).map((s) => ({ label: s.label, onPress: () => changeCategory(cat!.key, s.key) }))} />
      <Modal visible={nightsOpen && !!data} animationType="slide" presentationStyle="fullScreen" onRequestClose={() => setNightsOpen(false)}>
        {data ? (
          <WhoSleptWhere
            context={`${description.trim() || "Lodging"} · ${formatCents(total, currency)}`}
            startDate={data.trip.start_date}
            nights={nightsN}
            totalCents={total}
            currency={currency}
            people={involved.map((uid) => ({ id: uid, name: name(uid), short: first(uid), photo: photo(uid) }))}
            payerId={payerId}
            presence={Object.fromEntries(involved.map((uid) => [uid, Array.from({ length: nightsN }, (_, i) => stayedOn(uid, i))]))}
            onSave={(p) => { setPresence((prev) => ({ ...prev, ...p })); setNightsOpen(false); }}
            onClose={() => setNightsOpen(false)}
          />
        ) : null}
      </Modal>
      <ActionSheet open={sheet === "delete"} onClose={() => setSheet(null)} title="Delete this expense? It comes out of every balance and stays in the history." actions={[{ label: "Delete", destructive: true, onPress: remove }]} />
      <ActionSheet open={connLost} onClose={() => setConnLost(false)} title="Connection lost. Check your signal and try again. Nothing you typed is lost." actions={[{ label: "Try again", onPress: save }]} cancelLabel="Not now" />
    </View>
  );
}

/** save_expense / Postgres wording → ours; the raw transport text never reaches the screen. */
function friendlySaveError(m: string): string {
  if (isNetworkError(m)) return "Connection lost. Check your signal and try again.";
  if (/42501|not a member/i.test(m)) return "You're not on this dazzle any more.";
  if (/sum|shares|payers/i.test(m)) return "The split doesn't add up to the total. Check the amounts.";
  return m;
}

function Section({ label, right, children }: { label: string; right?: ReactNode; children: ReactNode }) {
  return (
    <View style={styles.section}>
      <View style={styles.sectionHead}>
        <ZText variant="captionStrong">{label}</ZText>
        {right}
      </View>
      {children}
    </View>
  );
}

/** Avatar chip: selected = sand avatar with a small ink check; deselected = dashed outline, muted name. */
function PersonChip({ name, fullName, avatarName, photo, on, share, onPress }: { name: string; fullName: string; avatarName: string; photo?: string | null; on: boolean; share?: string; onPress?: () => void }) {
  return (
    <Press onPress={onPress} disabled={!onPress} scaleTo={0.97} accessibilityRole={onPress ? "checkbox" : "text"} accessibilityState={onPress ? { checked: on } : undefined} accessibilityLabel={`${fullName}${share ? `, ${share}` : ""}${onPress ? (on ? ", included" : ", not included") : ""}`} style={styles.chip}>
      <View>
        <Avatar name={avatarName} uri={photo} size={44} notDone={!on} style={!on ? styles.avatarOff : null} />
        {on && onPress ? <View style={styles.chipCheck}><Icon name="check" size={10} color={color.textOnInk} stroke={3} /></View> : null}
      </View>
      <ZText variant="small" numberOfLines={1} color={on ? color.text : color.textMuted}>{name}</ZText>
      {share && on ? <ZText variant="micro" color={color.textMuted} tabular>{share}</ZText> : null}
    </Press>
  );
}

/** White pill "dropdown": label above, value (muted when nothing's picked) and a chevron. */
function DropdownPill({ label, value, placeholder, onPress }: { label: string; value: string; placeholder?: boolean; onPress: () => void }) {
  return (
    <View style={styles.flex}>
      <ZText variant="captionStrong" style={styles.fieldLabel}>{label}</ZText>
      <Press onPress={onPress} scaleTo={0.98} accessibilityRole="button" accessibilityLabel={`${label}: ${value}`} style={styles.dropdown}>
        <ZText variant="body" color={placeholder ? color.textMuted : color.text} numberOfLines={1} style={styles.flex}>{value}</ZText>
        <Icon name="chevronDown" size={16} color={color.textMuted} />
      </Press>
    </View>
  );
}

const styles = StyleSheet.create({
  host: { flex: 1 },
  flex: { flex: 1 },
  backdrop: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: palette.ink, opacity: 0.28 },
  sheet: { flex: 1, backgroundColor: palette.white, borderTopLeftRadius: radius.hero, borderTopRightRadius: radius.hero, paddingTop: 10, ...shadow.sheet },
  grabber: { width: 36, height: 5, borderRadius: radius.pill, backgroundColor: color.surfaceTile, alignSelf: "center", marginBottom: 10 },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: layout.screenGutter, paddingBottom: space[4] },
  headerSide: { width: 72 },
  noTrip: { flex: 1, alignItems: "center", justifyContent: "center", gap: space[12], paddingHorizontal: layout.textGutter },
  noTripText: { textAlign: "center" },
  noTripButton: { alignSelf: "center" },
  content: { paddingHorizontal: layout.screenGutter, paddingTop: space[8], paddingBottom: space[24], gap: space[16] },
  amountRow: { flexDirection: "row", alignItems: "center", gap: space[10], paddingHorizontal: space[4] },
  currencyPill: { flexDirection: "row", alignItems: "center", gap: space[4], borderRadius: radius.pill, borderWidth: 1.5, borderColor: color.outline, paddingHorizontal: 12, minHeight: size.pillButton, justifyContent: "center" },
  amountInput: { flex: 1, ...textStyle("amountL"), color: color.text, paddingVertical: space[8], minHeight: size.ctaHeight },
  receiptBlock: { alignItems: "center", gap: space[12] },
  receiptActions: { flexDirection: "row", alignItems: "center", gap: space[16] },
  thumb: { width: size.iconTile, height: size.iconTile },
  section: { gap: space[10] },
  sectionHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", minHeight: 24, paddingHorizontal: space[4] },
  toggleRow: { flexDirection: "row", alignItems: "center", gap: space[8] },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: space[10] },
  chip: { alignItems: "center", gap: space[4], width: 64 },
  avatarOff: { opacity: 0.8 },
  chipCheck: { position: "absolute", right: -2, bottom: -2, width: 18, height: 18, borderRadius: radius.pill, backgroundColor: palette.ink, borderWidth: 2, borderColor: palette.white, alignItems: "center", justifyContent: "center" },
  splitRow: { flexDirection: "row", alignItems: "center", gap: space[10] },
  splitInput: { width: 110 },
  splitShare: { width: 72, textAlign: "right" },
  pillRow: { flexDirection: "row", gap: space[10] },
  fieldLabel: { marginBottom: 6, marginLeft: 4 },
  dropdown: { backgroundColor: palette.white, borderWidth: 1.5, borderColor: color.outline, borderRadius: radius.pill, minHeight: size.buttonHeight, paddingHorizontal: 16, flexDirection: "row", alignItems: "center", gap: space[8] },
  delete: { alignSelf: "center", minHeight: layout.minTapTarget, justifyContent: "center", paddingHorizontal: space[12] },
  deleteText: { textDecorationLine: "underline" },
  footer: { paddingHorizontal: layout.screenGutter, paddingTop: space[10], gap: space[10], borderTopWidth: 1.5, borderTopColor: color.divider, backgroundColor: palette.white },
});
