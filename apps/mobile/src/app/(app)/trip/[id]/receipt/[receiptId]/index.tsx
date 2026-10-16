import { color, layout, palette, radius, space } from "@bunktab/theme";
import { useLocalSearchParams, useNavigation, useRouter } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { StyleSheet, View } from "react-native";
import { ActionSheet, Icon, ZText, useToast } from "@/ui";
import { track } from "@/lib/analytics";
import { DEMO_ID, addReceiptItem, captureReceipt, deleteReceiptItem, requeueReceipt, setDemoStatus, updateReceiptItem, type Method, type ReceiptItemRow } from "@/lib/receipts";
import { FlowScreen } from "@/components/receipt/FlowScreen";
import { MethodCards } from "@/components/receipt/MethodCards";
import { ReceiptPaper } from "@/components/receipt/ReceiptPaper";
import { ReceiptRow } from "@/components/receipt/ReceiptRow";
import { LineEditSheet } from "@/components/receipt/Sheets";
import { FailedState, ReadingState } from "@/components/receipt/States";
import { TipCard } from "@/components/receipt/TipCard";
import { receiptDateLabel, useFlow } from "@/components/receipt/useFlow";

/**
 * Receipt read (RECEIPT_SPLIT_PROMPT 4.1, board Receipt-Read). While receipt-parse works:
 * the print animation, then "Still reading…" after 8 s. Ready: merchant title, "{Day} ·
 * {n} items read from your photo", a volt "✓ Adds up" pill (blush "Check 1 line" when
 * the read needs review, with the suspect line dotted), the itemized receipt (tap a line
 * to edit, "+ Add a line the AI missed"), the tip card, "How should we split it?" and
 * the receipt row. Failed: the worried zebra with "Try another photo" / "Enter the total".
 * DEV: /receipt/demo?state=reading|needs_review|failed|custom
 */
export default function ReceiptReadScreen() {
  const { id, receiptId, state } = useLocalSearchParams<{ id: string; receiptId: string; state?: string }>();
  const router = useRouter();
  const nav = useNavigation();
  const { show } = useToast();
  const flow = useFlow(id, receiptId);
  const { bundle, receipt, totals, draft, update, people } = flow;
  const [editing, setEditing] = useState<ReceiptItemRow | null | "new">(null);
  const [retry, setRetry] = useState(false);
  const readyTracked = useRef(false);

  // DEV demo states
  useEffect(() => {
    if (receiptId !== DEMO_ID || !__DEV__ || !nav.isFocused()) return; // only the screen on top drives the shared demo draft
    setDemoStatus(state === "reading" ? "processing" : state === "needs_review" ? "needs_review" : state === "failed" ? "failed" : "ready");
    update({ tip: state === "custom" ? { mode: "custom", customCents: 2600 } : { mode: "percent", percent: 20 } });
    flow.reload();
  }, [receiptId, state]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const r = bundle?.receipt; if (!r || readyTracked.current) return;
    if (r.status === "ready" || r.status === "needs_review") { readyTracked.current = true; track("receipt_read_ready", { reconciled: !!r.reconciled, item_count: bundle!.items.length }); }
    if (r.status === "failed") { readyTracked.current = true; track("receipt_read_failed", { reason: r.error ?? "unknown" }); }
  }, [bundle]);

  const back = () => (router.canGoBack() ? router.back() : router.replace({ pathname: "/(app)/trip/[id]", params: { id: id! } }));
  const manual = () => router.replace({ pathname: "/(app)/trip/[id]/expense", params: { id: id!, ...(bundle ? { receipt_path: bundle.receipt.storage_path, receipt_id: bundle.receipt.id } : {}) } });
  async function anotherPhoto(source: "camera" | "library") {
    try {
      const r = await captureReceipt(id!, source);
      if (!r) return;
      if (r.queued) { show({ message: "No connection. The photo will upload when you're back online." }); return; }
      if (r.aiDisabled) { router.replace({ pathname: "/(app)/trip/[id]/expense", params: { id: id!, receipt_path: r.storagePath! } }); return; }
      router.replace({ pathname: "/(app)/trip/[id]/receipt/[receiptId]", params: { id: id!, receiptId: r.receiptId } });
    } catch (e) { show({ message: e instanceof Error ? e.message : "Couldn't upload the photo." }); }
  }
  function pick(m: Method) {
    update({ method: m });
    track("split_method_chosen", { method: m });
    router.push({ pathname: "/(app)/trip/[id]/receipt/[receiptId]/split", params: { id: id!, receiptId: receiptId!, method: m } });
  }

  const r = bundle?.receipt;
  const reading = !r || r.status === "queued" || r.status === "processing";
  const failed = r?.status === "failed";
  const ready = !!r && !!receipt && !!totals && (r.status === "ready" || r.status === "needs_review");
  const suspect = r?.status === "needs_review" ? (bundle!.items.find((i) => i.confidence === "low") ?? bundle!.items[0])?.position ?? null : null;
  const caption = ready ? `${receiptDateLabel(r.receipt_date) ?? "Receipt"} · ${bundle!.items.length} ${bundle!.items.length === 1 ? "item" : "items"} read from your photo` : undefined;

  return (
    <FlowScreen
      context={flow.context}
      onBack={back}
      title={ready ? r.merchant ?? "Receipt" : reading ? "Reading the receipt" : "Receipt"}
      caption={caption}
      right={ready ? (
        <View style={[styles.pill, r.status === "ready" ? styles.pillVolt : styles.pillBlush]} accessibilityLabel={r.status === "ready" ? "Adds up" : "Check one line"}>
          {r.status === "ready" ? <Icon name="check" size={12} stroke={3} /> : null}
          <ZText variant="captionStrong" color={r.status === "ready" ? color.text : color.youOweText}>{r.status === "ready" ? "Adds up" : "Check 1 line"}</ZText>
        </View>
      ) : undefined}
    >
      {reading ? <ReadingState onManual={manual} /> : null}
      {failed ? <FailedState reason={r.error} onRetry={() => setRetry(true)} onManual={manual} /> : null}
      {ready ? (
        <>
          <ReceiptPaper
            merchant={r.merchant ?? "Receipt"} items={bundle!.items} charges={bundle!.charges} subtotalCents={totals!.subtotalCents} totalCents={totals!.subtotalCents + totals!.taxCents + totals!.feesCents + totals!.discountCents}
            taxIncluded={r.tax_included} suspectPosition={suspect} print
            onEditLine={flow.readonly ? undefined : (it) => setEditing(it)} onAddLine={flow.readonly ? undefined : () => setEditing("new")} readOnly={flow.readonly}
          />
          <TipCard subtotalCents={totals!.subtotalCents} tip={draft.tip} tipPrintedCents={r.tip_printed_cents} onChange={(tip) => update({ tip })} />
          <MethodCards grandCents={totals!.grandCents} onPick={pick} />
          <ReceiptRow receiptId={r.id} storagePath={r.storage_path} />
        </>
      ) : null}
      {bundle && !ready ? <ReceiptRow receiptId={bundle.receipt.id} storagePath={bundle.receipt.storage_path} /> : null}

      <LineEditSheet
        open={editing !== null}
        item={editing === "new" ? null : editing}
        nextPosition={bundle?.items.length ?? 0}
        onClose={() => setEditing(null)}
        onSave={async (v) => {
          if (editing === "new") await addReceiptItem(receiptId!, bundle?.items.length ?? 0, v.name, v.quantity, v.line_total_cents);
          else if (editing) await updateReceiptItem(editing, v);
          flow.reload();
        }}
        onDelete={async (it) => { await deleteReceiptItem(it); flow.reload(); }}
      />
      <ActionSheet open={retry} onClose={() => setRetry(false)} title="Try another photo" actions={[{ label: "Take a photo", onPress: () => anotherPhoto("camera") }, { label: "Choose from photos", onPress: () => anotherPhoto("library") }, { label: "Read this photo again", onPress: () => requeueReceipt(receiptId!).catch((e) => show({ message: e.message })) }]} />
      {people.length === 0 && !reading && !failed && receiptId !== DEMO_ID ? <View style={styles.note}><ZText variant="small" color={color.textMuted}>Loading the dazzle…</ZText></View> : null}
    </FlowScreen>
  );
}

const styles = StyleSheet.create({
  pill: { flexDirection: "row", alignItems: "center", gap: 4, borderRadius: radius.pill, paddingHorizontal: 10, height: 28, alignSelf: "flex-end", marginBottom: 4 },
  pillVolt: { backgroundColor: palette.volt },
  pillBlush: { backgroundColor: color.errorBg },
  note: { paddingHorizontal: layout.textGutter, paddingTop: space[4] },
});
