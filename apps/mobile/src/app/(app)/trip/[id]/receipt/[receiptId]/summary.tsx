import { smallestFoodShare, splitByItem, splitEven, splitExact, type Share } from "@bunktab/core";
import { color, layout, space } from "@bunktab/theme";
import { useLocalSearchParams, useNavigation, useRouter } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import { StyleSheet, View } from "react-native";
import { Button, ZText, formatMoney, useToast } from "@/ui";
import { DEMO_ID, resetDraft, saveReceiptExpense, type Method } from "@/lib/receipts";
import { DockedCta, FlowScreen } from "@/components/receipt/FlowScreen";
import { ReceiptRow } from "@/components/receipt/ReceiptRow";
import { CheckLine, Explainer, PersonCard } from "@/components/receipt/Summary";
import { itemsLineFor, sharesMap, useFlow } from "@/components/receipt/useFlow";

/**
 * Summary (RECEIPT_SPLIT_PROMPT 4.5–4.6): one layout for every method. "{Method} · $grand
 * adds up to the cent", the explainer inset (the smallest food share is the worked
 * example in By item, that card inverted to ink), a card per person with Food · Tax · Tip
 * (· Fees) chips, the check line, the stray-cent footnote, the receipt row and the docked
 * "Add Expense · +$x to you". Opening a saved receipt expense lands here in read mode with
 * "Edit split" and "Change method"; archived dazzles are read-only with the photo viewer.
 * DEV: /receipt/demo/summary?method=itemized|equal|exact ; &readonly=1
 */
export default function SummaryScreen() {
  const { id, receiptId, expense, method: methodParam, readonly: roParam } = useLocalSearchParams<{ id: string; receiptId: string; expense?: string; method?: Method; readonly?: string }>();
  const router = useRouter();
  const nav = useNavigation();
  const { show } = useToast();
  const flow = useFlow(id, receiptId, expense ?? null);
  const { receipt, totals, draft, update, participants, me } = flow;
  const [busy, setBusy] = useState(false);
  const method: Method = (draft.method ?? methodParam ?? "equal") as Method;
  const readMode = !!expense || (receiptId === DEMO_ID && roParam === "1");
  const readonly = flow.readonly || (receiptId === DEMO_ID && roParam === "1");

  // DEV demo: the worked example for each method
  useEffect(() => {
    if (receiptId !== DEMO_ID || !__DEV__ || !draft.seeded || !receipt || !nav.isFocused()) return;
    const four = ["you", "pp", "mc", "jt"];
    const m = (methodParam ?? "itemized") as Method;
    const third = 2 / 3;
    update({ method: m, participants: four, tip: { mode: "percent", percent: 20 },
      claims: m === "itemized" ? { guac: { jt: 1 }, pac: { jt: 1, you: third, pp: third, mc: third }, cev: { you: 1, pp: 1, mc: 1 }, fish: { you: 1, pp: 1, mc: 1 }, carne: { you: 1, pp: 1, mc: 1 }, shrimp: { you: 1, pp: 1, mc: 1 }, marg: { you: third, pp: third, mc: third }, churro: { you: 1, pp: 1, mc: 1 } } : {},
      amounts: m === "exact" ? { you: 5000, pp: 5000, mc: 5000, jt: 3468 } : {} });
  }, [receiptId, methodParam, draft.seeded, !!receipt]); // eslint-disable-line react-hooks/exhaustive-deps

  const ids = participants.map((p) => p.id);
  const shares: Share[] | null = useMemo(() => {
    if (!receipt || !totals || !ids.length) return null;
    if (method === "equal") return splitEven(receipt, draft.tip, ids, me);
    if (method === "exact") { const r = splitExact(Object.fromEntries(ids.map((u) => [u, draft.amounts[u] ?? 0])), receipt, draft.tip, me, ids); return "shares" in r ? r.shares : null; }
    const r = splitByItem(receipt, draft.claims, draft.tip, ids, me); return "shares" in r ? r.shares : null;
  }, [receipt, totals, ids.join(","), method, draft.tip, draft.amounts, draft.claims, me]); // eslint-disable-line react-hooks/exhaustive-deps

  const back = () => (router.canGoBack() ? router.back() : router.replace({ pathname: "/(app)/trip/[id]", params: { id: id! } }));
  const methodLabel = method === "itemized" ? "Split by item" : method === "equal" ? "Split evenly" : "Exact split";
  const example = method === "itemized" && shares ? smallestFoodShare(shares) : null;
  const mine = shares?.find((s) => s.personId === me)?.totalCents ?? 0;
  const owed = totals ? totals.grandCents - mine : 0;

  async function save() {
    if (!shares || !totals || !flow.bundle) return;
    setBusy(true);
    try {
      await saveReceiptExpense({
        trip_id: flow.tripId, receipt_id: flow.bundle.receipt.id, expense_id: draft.expenseId, method, tip: draft.tip, participants: ids,
        claims: method === "itemized" ? draft.claims : undefined, amounts: method === "exact" ? Object.fromEntries(ids.map((u) => [u, draft.amounts[u] ?? 0])) : undefined,
        shares: sharesMap(shares), description: draft.description ?? flow.bundle.receipt.merchant ?? "Receipt", currency: flow.bundle.receipt.currency,
      });
      show({ message: `Added. ${formatMoney(totals.grandCents)} split ${ids.length} ways` });
      resetDraft(receiptId!);
      router.dismissTo({ pathname: "/(app)/trip/[id]", params: { id: id! } });
    } catch (e) {
      show({ message: e instanceof Error ? e.message : "Couldn't save the expense." });
    } finally { setBusy(false); }
  }
  const editSplit = () => router.push({ pathname: "/(app)/trip/[id]/receipt/[receiptId]/split", params: { id: id!, receiptId: receiptId!, method } });
  const changeMethod = () => router.push({ pathname: "/(app)/trip/[id]/receipt/[receiptId]", params: { id: id!, receiptId: receiptId! } });

  if (!receipt || !totals || !shares) {
    return <FlowScreen context={flow.context} onBack={back} title="Summary" caption={!ids.length ? "Nobody is on this split yet." : "Working it out…"}>{null}</FlowScreen>;
  }
  return (
    <FlowScreen context={flow.context} onBack={back} title="Summary" caption={`${methodLabel} · ${formatMoney(totals.grandCents)} adds up to the cent`}
      bust={{ mood: "happy", label: "Zebra, happy: the split adds up" }}
      footer={readonly ? undefined : readMode ? (
        <View style={styles.editRow}>
          <Button kind="secondary" label="Edit split" height={54} onPress={editSplit} style={styles.half} />
          <Button kind="ink" label="Change method" height={54} onPress={changeMethod} style={styles.half} />
        </View>
      ) : <DockedCta label={`Add Expense · +${formatMoney(owed)} to you`} onPress={save} loading={busy} />}>
      <Explainer method={method} totals={totals} example={example} people={participants} />
      <View style={styles.cards}>
        {shares.map((s) => {
          const p = participants.find((x) => x.id === s.personId)!;
          return <PersonCard key={s.personId} share={s} person={p} method={method} totals={totals} itemsLine={itemsLineFor(s.personId, method, receipt, draft.claims)} inverted={!!example && example.personId === s.personId} />;
        })}
      </View>
      <CheckLine totals={totals} />
      <ZText variant="small" color={color.textMuted} style={styles.footnote}>When a split leaves a stray cent, it goes to you, the account holder.</ZText>
      <ReceiptRow receiptId={flow.bundle!.receipt.id} storagePath={flow.bundle!.receipt.storage_path} />
      {readonly ? <ZText variant="small" color={color.textMuted} style={styles.footnote}>This dazzle is closed, so the split is read-only.</ZText> : null}
    </FlowScreen>
  );
}

const styles = StyleSheet.create({
  cards: { gap: space[10] },
  footnote: { paddingHorizontal: layout.textGutter },
  editRow: { flexDirection: "row", gap: space[10] },
  half: { flex: 1 },
});
