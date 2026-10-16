import { parseToCents } from "@bunktab/core";
import { color, space } from "@bunktab/theme";
import { useEffect, useState } from "react";
import { StyleSheet, View } from "react-native";
import { BottomSheet, Button, Input, ZText, formatMoney } from "@/ui";
import type { ReceiptItemRow } from "@/lib/receipts";

/** Numeric keypad for an amount (two decimals). Opens with the current value selected. */
export function KeypadSheet({ open, title, cents, onClose, onSave, helper }: { open: boolean; title: string; cents: number; onClose: () => void; onSave: (cents: number) => void; helper?: string }) {
  const [text, setText] = useState("");
  useEffect(() => { if (open) setText((cents / 100).toFixed(2)); }, [open, cents]);
  const parsed = parseToCents(text);
  return (
    <BottomSheet open={open} onClose={onClose} title={title}>
      <View style={styles.stack}>
        <Input label="Amount" value={text} onChangeText={setText} keyboardType="decimal-pad" autoFocus selectTextOnFocus helper={helper} accessibilityLabel={`${title}, amount`} returnKeyType="done" onSubmitEditing={() => { if (parsed != null && parsed >= 0) onSave(parsed); }} />
        <Button label={parsed != null && parsed >= 0 ? `Use ${formatMoney(parsed)}` : "Enter an amount"} kind={parsed != null && parsed >= 0 ? "primary" : "locked"} onPress={() => { if (parsed != null && parsed >= 0) onSave(parsed); }} />
      </View>
    </BottomSheet>
  );
}

/** Edit one receipt line: name, quantity, amount, delete. A new line comes in with item = null. */
export function LineEditSheet({ open, item, nextPosition, onClose, onSave, onDelete }: {
  open: boolean; item: ReceiptItemRow | null; nextPosition: number; onClose: () => void;
  onSave: (v: { name: string; quantity: number; line_total_cents: number }) => Promise<void> | void;
  onDelete?: (item: ReceiptItemRow) => Promise<void> | void;
}) {
  const [name, setName] = useState(""); const [qty, setQty] = useState("1"); const [amount, setAmount] = useState(""); const [busy, setBusy] = useState(false); const [err, setErr] = useState<string | null>(null);
  useEffect(() => {
    if (!open) return;
    setName(item?.name ?? ""); setQty(String(item?.quantity ?? 1)); setAmount(item ? (item.line_total_cents / 100).toFixed(2) : ""); setErr(null);
  }, [open, item]);
  const cents = parseToCents(amount); const q = Math.max(1, parseInt(qty, 10) || 1);
  const ok = name.trim().length > 0 && cents != null;
  async function save() {
    if (!ok) { setErr("Give the line a name and an amount."); return; }
    setBusy(true); setErr(null);
    try { await onSave({ name: name.trim(), quantity: q, line_total_cents: cents! }); onClose(); } catch (e) { setErr(e instanceof Error ? e.message : "Couldn't save the line."); } finally { setBusy(false); }
  }
  return (
    <BottomSheet open={open} onClose={onClose} title={item ? "Edit this line" : `Add a line (${nextPosition + 1})`}>
      <View style={styles.stack}>
        <Input label="Item" value={name} onChangeText={setName} placeholder="Fish tacos" autoFocus={!item} maxLength={120} />
        <View style={styles.row}>
          <Input label="Quantity" value={qty} onChangeText={setQty} keyboardType="number-pad" style={styles.half} />
          <Input label="Line total" value={amount} onChangeText={setAmount} keyboardType="decimal-pad" placeholder="0.00" style={styles.half} helper={q > 1 && cents != null ? `${q} @ ${formatMoney(Math.round(cents / q))}` : undefined} />
        </View>
        {err ? <ZText variant="small" color={color.error}>{err}</ZText> : null}
        <Button label={item ? "Save the line" : "Add the line"} kind={ok ? "primary" : "locked"} onPress={save} loading={busy} />
        {item && onDelete ? <Button kind="secondary" onWhite label="Delete this line" onPress={async () => { setBusy(true); try { await onDelete(item); onClose(); } finally { setBusy(false); } }} /> : null}
      </View>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  stack: { gap: space[12], paddingBottom: space[8] },
  row: { flexDirection: "row", gap: space[10] },
  half: { flex: 1 },
});
