import { itemStatus, type SplitItem } from "@bunktab/core";
import { color, motion, palette, radius, space } from "@bunktab/theme";
import { useEffect } from "react";
import { StyleSheet, View } from "react-native";
import Animated, { Easing, useAnimatedStyle, useSharedValue, withTiming } from "react-native-reanimated";
import { Press, ZText, formatMoney, useReducedMotion } from "@/ui";
import type { Person } from "./People";

const pop = Easing.bezier(motion.springPop.bezier[0], motion.springPop.bezier[1], motion.springPop.bezier[2], motion.springPop.bezier[3]);

function fmtUnits(u: number): string { return Math.abs(u - Math.round(u)) < 1e-6 ? String(Math.round(u)) : ""; }

/**
 * One receipt line on Split by item: pink dot while unclaimed, name (+ ×qty), a sub line
 * ("Tap to claim" / "{Name}" / "Everyone · $x each" / "Shared by n · $x each" / "{qty} ×
 * $unit · k left"), claimer chips (22 px initials pills; the active person's chip is ink,
 * an "ALL" chip when everyone has it; "×2" for units) and the line total. The row is one
 * button labelled "{name}, {state}"; chips spring-pop in.
 */
export function ItemRow({ item, claims, people, active, onTap, first }: { item: SplitItem; claims: Record<string, number> | undefined; people: Person[]; active: string; onTap: () => void; first?: boolean }) {
  const ids = people.map((p) => p.id);
  const st = itemStatus(item, claims, ids);
  const n = people.length;
  const nameOf = (id: string) => people.find((p) => p.id === id)?.short ?? "?";
  const iniOf = (id: string) => { const p = people.find((x) => x.id === id); return p?.short === "You" ? "YOU" : (p?.name ?? "?").trim().split(/\s+/).slice(0, 2).map((w) => w[0]?.toUpperCase() ?? "").join(""); };
  const mine = active !== "all" && (claims?.[active] ?? 0) > 1e-6;
  let sub: string; let subBlush = false;
  if (item.quantity <= 1) {
    if (!st.claimers.length) { sub = "Tap to claim"; subBlush = true; }
    else if (st.claimers.length === 1) sub = nameOf(st.claimers[0]!);
    else if (st.claimers.length === n) sub = `Everyone · ${formatMoney(st.eachCents)} each`;
    else sub = `Shared by ${st.claimers.length} · ${formatMoney(st.eachCents)} each`;
  } else {
    sub = `${item.quantity} × ${formatMoney(st.unitCents)}`;
    if (!st.fullyClaimed) { const lu = fmtUnits(st.leftUnits); sub += ` · ${lu ? `${lu} left` : "some left"}`; subBlush = true; }
    else sub += " · all claimed";
  }
  const chips = st.claimers.length === n && n > 0
    ? [{ key: "all", label: "ALL", ink: true }]
    : st.claimers.map((id) => { const u = item.quantity > 1 ? fmtUnits(claims?.[id] ?? 0) : ""; return { key: id, label: iniOf(id) + (u && u !== "1" ? ` ×${u}` : ""), ink: id === active }; });
  const a11yState = item.quantity > 1 ? `${item.quantity} at ${formatMoney(st.unitCents)}, ${st.fullyClaimed ? "all claimed" : `${fmtUnits(st.leftUnits) || "some"} left`}` : sub;
  return (
    <Press onPress={onTap} scaleTo={0.98} accessibilityRole="button" accessibilityLabel={`${item.name}, ${a11yState}`} style={[styles.row, first ? null : styles.rule, mine ? styles.mine : null]}>
      <View style={styles.dotCol}>{!st.fullyClaimed ? <View style={styles.dot} /> : null}</View>
      <View style={styles.text}>
        <ZText variant="bodyStrong" numberOfLines={1}>{item.name}{item.quantity > 1 ? ` ×${item.quantity}` : ""}</ZText>
        <ZText variant="small" color={subBlush ? color.youOweText : color.textMuted} numberOfLines={1}>{sub}</ZText>
      </View>
      <View style={styles.right}>
        <View style={styles.chips}>{chips.map((c) => <Chip key={c.key} label={c.label} ink={c.ink} />)}</View>
        <ZText variant="amountRow" tabular>{formatMoney(item.lineTotalCents)}</ZText>
      </View>
    </Press>
  );
}

function Chip({ label, ink }: { label: string; ink: boolean }) {
  const reduced = useReducedMotion();
  const s = useSharedValue(reduced ? 1 : 0.4);
  useEffect(() => { s.value = withTiming(1, { duration: reduced ? motion.moodCrossfade : motion.springPop.duration, easing: pop }); }, [s, reduced]);
  const a = useAnimatedStyle(() => ({ transform: [{ scale: s.value }] }));
  return (
    <Animated.View style={[styles.chip, ink ? styles.chipInk : null, a]}>
      <ZText variant="micro" color={ink ? color.textOnInk : color.text}>{label}</ZText>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", gap: space[8], paddingVertical: 10, paddingHorizontal: 12, minHeight: 56, borderRadius: radius.inset },
  rule: { borderTopWidth: 1, borderTopColor: color.divider },
  mine: { backgroundColor: color.surfaceInset },
  dotCol: { width: 10, alignItems: "center" },
  dot: { width: 7, height: 7, borderRadius: radius.pill, backgroundColor: color.attention },
  text: { flex: 1, gap: 1 },
  right: { flexDirection: "row", alignItems: "center", gap: space[8] },
  chips: { flexDirection: "row", gap: 4, flexWrap: "wrap", justifyContent: "flex-end", maxWidth: 120 },
  chip: { height: 22, paddingHorizontal: 7, borderRadius: radius.pill, backgroundColor: color.surfaceTile, alignItems: "center", justifyContent: "center" },
  chipInk: { backgroundColor: palette.ink },
});
