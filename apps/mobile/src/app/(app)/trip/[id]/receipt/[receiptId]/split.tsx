import { byItemProgress, defaultRestSelection, effectiveItems, fillRemainingEvenly, splitEven, splitExact, splitRestEvenly, tapItem, tapItemEveryone, type Claims } from "@bunktab/core";
import { color, layout, palette, radius, shadow, size, space } from "@bunktab/theme";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { StyleSheet, View } from "react-native";
import { Button, CountUp, Icon, Press, Rise, SegmentedControl, Zebra, ZText, formatMoney, haptic } from "@/ui";
import { track } from "@/lib/analytics";
import { DEMO_ID, type Method } from "@/lib/receipts";
import { DockedCta, FlowScreen } from "@/components/receipt/FlowScreen";
import { ByItemFooter, SplitRestSheet } from "@/components/receipt/DockedSheet";
import { ItemRow } from "@/components/receipt/ItemRow";
import { PersonPicker, PersonRow } from "@/components/receipt/People";
import { ReceiptRow } from "@/components/receipt/ReceiptRow";
import { KeypadSheet } from "@/components/receipt/Sheets";
import { useFlow } from "@/components/receipt/useFlow";

const SEGMENTS: { key: Method; label: string }[] = [{ key: "equal", label: "Evenly" }, { key: "exact", label: "Amounts" }, { key: "itemized", label: "By dish" }];

/**
 * The three split methods (RECEIPT_SPLIT_PROMPT 4.2–4.4) behind one segmented control
 * that keeps every method's state in the shared draft. Split Evenly: hero "Each of n
 * pays", the dinner roster. Exact Split: blush/white hero (worried ↔ happy), ±$1 steppers,
 * keypad, "Split what's left evenly". Split by Item: person picker (Everyone first), one
 * row per dish, the docked sheet with running totals, status line and the "Split the
 * rest evenly" sheet (three taps or fewer).
 * DEV: /receipt/demo/split?method=itemized&state=jordan|sheet|done ; method=exact&state=over|adds ; method=equal&state=deselect
 */
export default function SplitScreen() {
  const { id, receiptId, method: methodParam, state } = useLocalSearchParams<{ id: string; receiptId: string; method?: Method; state?: string }>();
  const router = useRouter();
  const flow = useFlow(id, receiptId);
  const { receipt, totals, draft, update, people, participants, me } = flow;
  const method: Method = (draft.method ?? methodParam ?? "equal") as Method;
  const [restOpen, setRestOpen] = useState(false);
  const [restSel, setRestSel] = useState<string[]>([]);
  const [keypad, setKeypad] = useState<string | null>(null);
  const successFired = useRef(false);

  useEffect(() => { if (methodParam && draft.method !== methodParam) update({ method: methodParam }); }, [methodParam]); // eslint-disable-line react-hooks/exhaustive-deps

  // DEV demo states
  useEffect(() => {
    if (receiptId !== DEMO_ID || !__DEV__ || !draft.seeded || !receipt) return;
    const four = ["you", "pp", "mc", "jt"];
    if (method === "itemized") {
      const start: Claims = { guac: { jt: 1 }, pac: { jt: 1 } };
      const items = effectiveItems(receipt);
      update({ participants: four, active: "jt", claims: state === "done" ? splitRestEvenly(items, start, ["you", "pp", "mc"]) : start });
      if (state === "sheet") { setRestSel(["you", "pp", "mc"]); setRestOpen(true); }
    } else if (method === "exact") {
      update({ participants: four, amounts: state === "adds" ? { you: 5000, pp: 5000, mc: 5000, jt: 3468 } : state === "over" ? { you: 7000, pp: 6000, mc: 6000, jt: 2000 } : { you: 6000, pp: 5000, mc: 5000, jt: 0 } });
    } else update({ participants: state === "deselect" ? ["you", "pp", "mc"] : four });
  }, [receiptId, method, state, draft.seeded, !!receipt]); // eslint-disable-line react-hooks/exhaustive-deps

  const back = () => (router.canGoBack() ? router.back() : router.replace({ pathname: "/(app)/trip/[id]/receipt/[receiptId]", params: { id: id!, receiptId: receiptId! } }));
  const toSummary = () => router.push({ pathname: "/(app)/trip/[id]/receipt/[receiptId]/summary", params: { id: id!, receiptId: receiptId! } });
  const ids = participants.map((p) => p.id);
  const holder = me;

  /* ── even ── */
  const even = useMemo(() => (receipt && totals && ids.length ? splitEven(receipt, draft.tip, ids, holder) : []), [receipt, totals, ids.join(","), draft.tip, holder]); // eslint-disable-line react-hooks/exhaustive-deps
  const evenEach = even.length ? Math.min(...even.map((s) => s.totalCents)) : 0;
  const evenLeft = totals && ids.length ? totals.grandCents - evenEach * ids.length : 0;

  /* ── exact ── */
  const exact = useMemo(() => (receipt && totals && ids.length ? splitExact(Object.fromEntries(ids.map((u) => [u, draft.amounts[u] ?? 0])), receipt, draft.tip, holder, ids) : { remaining: 0 }), [receipt, totals, ids.join(","), draft.amounts, draft.tip, holder]); // eslint-disable-line react-hooks/exhaustive-deps
  const exactOk = "shares" in exact;
  const remaining = "remaining" in exact ? exact.remaining : 0;
  const setAmount = (u: string, c: number) => update((d) => ({ amounts: { ...d.amounts, [u]: Math.max(0, c) } }));

  /* ── by item ── */
  const progress = useMemo(() => (receipt && totals && ids.length ? byItemProgress(receipt, draft.claims, draft.tip, ids, holder) : null), [receipt, totals, ids.join(","), draft.claims, draft.tip, holder]); // eslint-disable-line react-hooks/exhaustive-deps
  const items = receipt ? effectiveItems(receipt) : [];
  function tap(itemId: string) {
    const it = items.find((i) => i.id === itemId); if (!it) return;
    haptic.light();
    update((d) => ({ claims: d.active === "all" ? tapItemEveryone(it, d.claims, ids) : tapItem(it, d.claims, d.active) }));
  }
  function openRest() { setRestSel(defaultRestSelection(items, draft.claims, ids)); setRestOpen(true); }
  function confirmRest() {
    if (!restSel.length) return;
    update((d) => ({ claims: splitRestEvenly(items, d.claims, restSel) }));
    track("split_rest_used", { k: restSel.length });
    setRestOpen(false);
  }
  const allClaimed = !!progress?.allClaimed;
  useEffect(() => {
    const ok = method === "itemized" ? allClaimed : method === "exact" ? exactOk : false;
    if (ok && !successFired.current) { successFired.current = true; haptic.success(); } else if (!ok) successFired.current = false;
  }, [method, allClaimed, exactOk]);

  if (!receipt || !totals) return <FlowScreen context={flow.context} onBack={back} title="Split">{null}</FlowScreen>;
  const grand = formatMoney(totals.grandCents);
  const segmented = <View style={styles.seg}><SegmentedControl options={SEGMENTS} value={method} onChange={(m) => { update({ method: m }); track("split_method_chosen", { method: m }); }} /></View>;
  const payerIsMe = true; // the account holder enters the receipt and pays it (Part 4 "Product terms")

  if (method === "equal") {
    return (
      <FlowScreen context={flow.context} onBack={back} title="Split Evenly" caption={payerIsMe ? "You paid. Tax and tip are already in." : "Tax and tip are already in."}
        footer={ids.length ? <DockedCta label={`Add Expense · ${grand}`} onPress={toSummary} /> : <DockedCta label="Pick at least one person" locked />}>
        {segmented}
        <View style={styles.hero}>
          <View style={styles.heroText}>
            <ZText variant="caption" color={color.textMuted}>{ids.length ? `Each of ${ids.length} pays` : "Pick who was there"}</ZText>
            <CountUp cents={evenEach} variant="display" underline={false} style={styles.heroAmount} />
            <ZText variant="captionStrong" color={color.textSecondary}>{evenLeft ? `Leftover ${evenLeft}¢ goes to you, the account holder` : "Splits evenly to the cent"}</ZText>
          </View>
          <Zebra variant="bust" mood="happy" size={88} animate={{ blink: true }} accessibilityLabel="Zebra, happy" style={styles.heroZebra} />
        </View>
        <View style={styles.sectionHead}><ZText variant="headline">Who was at dinner?</ZText><ZText variant="small" color={color.textMuted}>Tap to add or remove</ZText></View>
        <View style={styles.card}>
          {people.map((p, i) => {
            const on = ids.includes(p.id);
            const share = even.find((s) => s.personId === p.id)?.totalCents ?? 0;
            return <PersonRow key={p.id} person={p} on={on} first={i === 0} sub={on ? (p.id === me ? "Paid the bill" : payerIsMe ? "Owes you" : "Owes the payer") : "Not at dinner"} amount={on ? formatMoney(share) : "—"} onPress={() => update((d) => ({ participants: on ? d.participants.filter((x) => x !== p.id) : [...d.participants, p.id] }))} />;
          })}
        </View>
        <ReceiptRow receiptId={flow.bundle!.receipt.id} storagePath={flow.bundle!.receipt.storage_path} />
      </FlowScreen>
    );
  }

  if (method === "exact") {
    const over = remaining < 0;
    return (
      <FlowScreen context={flow.context} onBack={back} title="Exact Split" caption="Set what each person pays. Tax and tip are already in."
        footer={exactOk ? <Rise><DockedCta label={`Add Expense · ${grand}`} onPress={toSummary} /></Rise> : <DockedCta label={`${formatMoney(Math.abs(remaining))} ${over ? "over" : "remaining"}`} locked accessibilityLabel={`${formatMoney(Math.abs(remaining))} ${over ? "over" : "remaining"}`} />}>
        {segmented}
        <View style={[styles.hero, exactOk ? null : styles.heroBlush]}>
          <View style={styles.heroText}>
            <ZText variant="captionStrong" color={exactOk ? color.textMuted : color.youOweText}>{exactOk ? "Adds up" : over ? "Over by" : "Remaining"}</ZText>
            <ZText variant="heroAmount" tabular color={exactOk ? color.text : color.youOweText}>{formatMoney(exactOk ? totals.grandCents : Math.abs(remaining))}</ZText>
            <ZText variant="caption" color={color.textMuted}>{exactOk ? "Every dollar is spoken for" : `of ${grand} total`}</ZText>
          </View>
          <Zebra variant="bust" mood={exactOk ? "happy" : "worried"} size={88} animate={{ blink: true }} accessibilityLabel={exactOk ? "Zebra, happy: the amounts add up" : "Zebra, worried: the amounts don't add up yet"} style={styles.heroZebra} />
        </View>
        <View style={styles.card}>
          {participants.map((p, i) => {
            const a = draft.amounts[p.id] ?? 0;
            return (
              <View key={p.id} style={[styles.exactRow, i === 0 ? null : styles.rule]}>
                <View style={styles.exactPerson}>
                  <View style={styles.inkDisc}><ZText variant="captionStrong" color={color.textOnInk}>{p.short === "You" ? "YOU" : p.name.split(/\s+/).map((w) => w[0]).join("").slice(0, 2).toUpperCase()}</ZText></View>
                  <View style={styles.flex}>
                    <ZText variant="bodyStrong" numberOfLines={1}>{p.short}</ZText>
                    <ZText variant="small" color={color.textMuted}>{a ? `${((a / totals.grandCents) * 100).toFixed(1)}% of the bill` : "Nothing yet"}</ZText>
                  </View>
                </View>
                <Press onPress={() => setAmount(p.id, a - 100)} scaleTo={0.97} accessibilityRole="button" accessibilityLabel={`Take $1 off ${p.short}`} style={styles.step}><Icon name="minus" size={16} color={color.textOnInk} stroke={2.4} /></Press>
                <Press onPress={() => setKeypad(p.id)} scaleTo={0.97} accessibilityRole="button" accessibilityLabel={`${p.short}'s amount, ${formatMoney(a)}, tap to type`} style={[styles.amountPill, a ? styles.amountPillSet : null]}><ZText variant="bodyStrong" tabular>{formatMoney(a)}</ZText></Press>
                <Press onPress={() => setAmount(p.id, a + 100)} scaleTo={0.97} accessibilityRole="button" accessibilityLabel={`Add $1 to ${p.short}`} style={styles.step}><Icon name="plus" size={16} color={color.textOnInk} stroke={2.4} /></Press>
              </View>
            );
          })}
        </View>
        <View style={styles.chips}>
          <Button kind="secondary" height={size.pillButton} label="Split what's left evenly" onPress={() => { if (remaining > 0) update((d) => ({ amounts: fillRemainingEvenly(Object.fromEntries(ids.map((u) => [u, d.amounts[u] ?? 0])), remaining, ids, holder) })); }} />
          <Button kind="secondary" height={size.pillButton} label="Start over" onPress={() => update({ amounts: {} })} />
        </View>
        <ZText variant="small" color={color.textMuted} style={styles.hint}>Tap to type, or adjust in $1 increments. Any leftover cent goes to you.</ZText>
        <ReceiptRow receiptId={flow.bundle!.receipt.id} storagePath={flow.bundle!.receipt.storage_path} />
        <KeypadSheet open={!!keypad} title={keypad ? `${people.find((p) => p.id === keypad)?.short ?? ""} pays` : ""} cents={keypad ? draft.amounts[keypad] ?? 0 : 0} onClose={() => setKeypad(null)} onSave={(c) => { if (keypad) setAmount(keypad, c); setKeypad(null); }} />
      </FlowScreen>
    );
  }

  // by item
  return (
    <FlowScreen context={flow.context} onBack={back} title="Split by Item" caption="Select who was involved in each dish" sheet
      bust={{ mood: allClaimed ? "happy" : "worried", label: allClaimed ? "Zebra, happy: every dish is claimed" : "Zebra, worried: some dishes are unclaimed" }}
      footer={restOpen && progress
        ? <SplitRestSheet people={participants} selected={restSel} unclaimedFoodCents={progress.unclaimedFoodCents} holder={holder} onToggle={(u) => setRestSel((s) => (s.includes(u) ? s.filter((x) => x !== u) : [...s, u]))} onCancel={() => setRestOpen(false)} onConfirm={confirmRest} />
        : progress ? <ByItemFooter progress={progress} people={participants} active={draft.active} onSplitRest={openRest} onReset={() => update({ claims: {} })} onReview={toSummary} /> : null}>
      {segmented}
      <PersonPicker people={participants} active={draft.active} onPick={(u) => update({ active: u })} />
      <View style={styles.card}>
        {items.map((it, i) => <ItemRow key={it.id} item={it} claims={draft.claims[it.id]} people={participants} active={draft.active} first={i === 0} onTap={() => tap(it.id)} />)}
      </View>
      <ReceiptRow receiptId={flow.bundle!.receipt.id} storagePath={flow.bundle!.receipt.storage_path} />
    </FlowScreen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  seg: { paddingHorizontal: layout.screenGutter },
  hero: { marginHorizontal: layout.screenGutter, backgroundColor: color.surfaceTranslucentStrong, borderRadius: radius.hero, minHeight: 132, paddingVertical: 20, paddingHorizontal: layout.heroPadding, flexDirection: "row", alignItems: "center", gap: space[8], overflow: "hidden", ...shadow.hero },
  heroBlush: { backgroundColor: color.errorBg },
  heroText: { flex: 1, gap: 4 },
  heroAmount: { alignSelf: "flex-start" },
  heroZebra: { marginRight: -8, marginBottom: -24, alignSelf: "flex-end" },
  sectionHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: layout.textGutter },
  card: { marginHorizontal: layout.screenGutter, backgroundColor: palette.white, borderRadius: radius.card, paddingHorizontal: 4, paddingVertical: 4, ...shadow.card },
  rule: { borderTopWidth: 1, borderTopColor: color.divider },
  exactRow: { flexDirection: "row", alignItems: "center", gap: 6, paddingVertical: 8, paddingHorizontal: 10, minHeight: 56 },
  exactPerson: { flex: 1, flexDirection: "row", alignItems: "center", gap: space[10] },
  inkDisc: { width: 36, height: 36, borderRadius: radius.pill, backgroundColor: palette.ink, alignItems: "center", justifyContent: "center" },
  step: { width: size.pillSmall, height: size.pillSmall, borderRadius: radius.pill, backgroundColor: palette.ink, alignItems: "center", justifyContent: "center" },
  amountPill: { minWidth: 82, height: 36, paddingHorizontal: 10, borderRadius: radius.pill, backgroundColor: color.surfaceInset, borderWidth: 1.5, borderColor: color.outline, alignItems: "center", justifyContent: "center" },
  amountPillSet: { backgroundColor: palette.white, borderColor: palette.ink },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: space[8], paddingHorizontal: layout.screenGutter },
  hint: { paddingHorizontal: layout.textGutter },
});
