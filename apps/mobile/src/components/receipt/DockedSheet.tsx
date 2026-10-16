import { allocate, type ByItemProgress } from "@bunktab/core";
import { color, palette, radius, space } from "@bunktab/theme";
import { ScrollView, StyleSheet, View } from "react-native";
import { Button, Press, Rise, ZText, formatMoney } from "@/ui";
import { DockedCta } from "./FlowScreen";
import { initialsOf, type Person } from "./People";

/**
 * The docked bottom sheet on Split by item: a grid of per-person running totals (the
 * active person inverted to ink + volt; a horizontal row above 4 people), the status
 * line (blush "$x of food unclaimed" + "Split the rest evenly", or cream "All claimed ·
 * $grand adds up" + "Start over") and the CTA (locked "$x remaining" or volt "Review the
 * split").
 */
export function RunningTotals({ progress, people, active }: { progress: ByItemProgress; people: Person[]; active: string }) {
  const cards = people.map((p) => {
    const pp = progress.perPerson[p.id];
    const on = p.id === active;
    return (
      <View key={p.id} style={[styles.total, on ? styles.totalOn : null, people.length > 4 ? styles.totalWide : styles.totalFlex]} accessibilityLabel={`${p.name}: ${formatMoney(pp?.totalCents ?? 0)}, ${(pp?.pctOfFood ?? 0).toFixed(1)} percent of the food`}>
        <ZText variant="small" color={on ? color.textOnInk : color.textMuted} numberOfLines={1}>{p.short}</ZText>
        <ZText variant="headline" tabular color={on ? color.accentOnInk : color.text}>{formatMoney(pp?.totalCents ?? 0)}</ZText>
        <ZText variant="micro" color={on ? color.outlineDashed : color.textMuted}>{(pp?.pctOfFood ?? 0) > 0 ? `${(pp!.pctOfFood).toFixed(1)}%` : "0%"}</ZText>
      </View>
    );
  });
  if (people.length > 4) return <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.totalsRow}>{cards}</ScrollView>;
  return <View style={styles.totalsRow}>{cards}</View>;
}

export function ByItemFooter({ progress, people, active, onSplitRest, onReset, onReview }: { progress: ByItemProgress; people: Person[]; active: string; onSplitRest: () => void; onReset: () => void; onReview: () => void }) {
  const done = progress.allClaimed;
  return (
    <View style={styles.stack}>
      <RunningTotals progress={progress} people={people} active={active} />
      <View style={[styles.status, done ? styles.statusCream : styles.statusBlush]}>
        <ZText variant="captionStrong" color={done ? color.text : color.youOweText} style={styles.statusText}>{done ? `All claimed · ${formatMoney(progress.totals.grandCents)} adds up` : `${formatMoney(progress.unclaimedFoodCents)} of food unclaimed`}</ZText>
        {done
          ? <Press onPress={onReset} scaleTo={0.97} accessibilityRole="button" accessibilityLabel="Start over" style={styles.ghostBtn}><ZText variant="captionStrong">Start over</ZText></Press>
          : <Press onPress={onSplitRest} scaleTo={0.97} accessibilityRole="button" accessibilityLabel="Split the rest evenly" style={styles.inkBtn}><ZText variant="captionStrong" color={color.textOnInk}>Split the rest evenly</ZText></Press>}
      </View>
      {done
        ? <Rise><DockedCta label="Review the split" onPress={onReview} /></Rise>
        : <DockedCta label={`${formatMoney(progress.unclaimedFoodCents)} remaining`} locked accessibilityLabel={`${formatMoney(progress.unclaimedFoodCents)} remaining`} />}
    </View>
  );
}

/** "Split the rest evenly" sheet content: a grabber, the title, the explainer, person toggles with a live "+$share", Cancel / Split between k. */
export function SplitRestSheet({ people, selected, unclaimedFoodCents, holder, onToggle, onCancel, onConfirm }: { people: Person[]; selected: string[]; unclaimedFoodCents: number; holder: string; onToggle: (id: string) => void; onCancel: () => void; onConfirm: () => void }) {
  const k = selected.length;
  const parts = allocate(unclaimedFoodCents, people.map((p) => (selected.includes(p.id) ? 1 : 0)), Math.max(0, people.findIndex((p) => p.id === holder)));
  return (
    <Rise style={styles.stack}>
      <View style={styles.grabber} />
      <ZText variant="headline">Split the rest evenly</ZText>
      <ZText variant="caption" color={color.textSecondary}>Everything still unclaimed ({formatMoney(unclaimedFoodCents)} of food) is shared evenly by the people you pick. Tax and tip follow.</ZText>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.toggles}>
        {people.map((p, i) => {
          const on = selected.includes(p.id);
          return (
            <Press key={p.id} onPress={() => onToggle(p.id)} scaleTo={0.97} accessibilityRole="checkbox" accessibilityState={{ checked: on }} accessibilityLabel={`${p.name}, ${on ? `sharing, plus ${formatMoney(parts[i] ?? 0)}` : "not sharing"}`} style={styles.toggle}>
              <View style={[styles.toggleDisc, on ? styles.toggleOn : null]}><ZText variant="captionStrong" color={on ? color.textOnInk : color.textMuted}>{p.short === "You" ? "YOU" : initialsOf(p.name)}</ZText></View>
              <ZText variant="captionStrong" color={on ? color.text : color.textMuted} numberOfLines={1}>{p.short}</ZText>
              <ZText variant="small" color={on ? color.text : color.textMuted} tabular>{on ? `+${formatMoney(parts[i] ?? 0)}` : "Not sharing"}</ZText>
            </Press>
          );
        })}
      </ScrollView>
      <View style={styles.buttons}>
        <Button kind="secondary" onWhite label="Cancel" height={54} onPress={onCancel} style={styles.half} />
        <Button kind={k ? "ink" : "locked"} label={k ? `Split between ${k}` : "Pick someone"} height={54} onPress={onConfirm} disabled={!k} style={styles.half} />
      </View>
    </Rise>
  );
}

const styles = StyleSheet.create({
  stack: { gap: space[10] },
  grabber: { width: 36, height: 5, borderRadius: radius.pill, backgroundColor: color.surfaceTile, alignSelf: "center", marginBottom: 2 },
  totalsRow: { flexDirection: "row", gap: space[8] },
  total: { backgroundColor: color.surfaceInset, borderRadius: radius.inset, paddingVertical: 8, paddingHorizontal: 10, gap: 1, alignItems: "center" },
  totalFlex: { flex: 1 },
  totalWide: { width: 96 },
  totalOn: { backgroundColor: palette.ink },
  status: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: space[8], borderRadius: radius.inset, paddingVertical: 8, paddingLeft: 12, paddingRight: 8, minHeight: 44 },
  statusBlush: { backgroundColor: color.errorBg },
  statusCream: { backgroundColor: color.surfaceInset },
  statusText: { flex: 1 },
  inkBtn: { backgroundColor: palette.ink, borderRadius: radius.pill, paddingHorizontal: 12, height: 32, justifyContent: "center" },
  ghostBtn: { backgroundColor: palette.white, borderRadius: radius.pill, paddingHorizontal: 12, height: 32, justifyContent: "center", borderWidth: 1.5, borderColor: color.outline },
  toggles: { gap: space[14], paddingVertical: space[4] },
  toggle: { alignItems: "center", gap: 4, width: 72 },
  toggleDisc: { width: 44, height: 44, borderRadius: radius.pill, backgroundColor: palette.white, borderWidth: 1.5, borderStyle: "dashed", borderColor: color.outlineDashed, alignItems: "center", justifyContent: "center" },
  toggleOn: { backgroundColor: palette.ink, borderColor: palette.ink, borderStyle: "solid" },
  buttons: { flexDirection: "row", gap: space[10] },
  half: { flex: 1 },
});
