import { color, layout, palette, radius, shadow, space } from "@bunktab/theme";
import { StyleSheet, View } from "react-native";
import { Icon, Press, ZText, formatMoney } from "@/ui";
import type { Method } from "@/lib/receipts";

/** "How should we split it?" with the grand total, then Split Evenly · Amounts · By dish (ink). */
export function MethodCards({ grandCents, onPick }: { grandCents: number; onPick: (m: Method) => void }) {
  return (
    <View style={styles.wrap}>
      <View style={styles.head}>
        <ZText variant="headline">How should we split it?</ZText>
        <ZText variant="headline" tabular>{formatMoney(grandCents)}</ZText>
      </View>
      <View style={styles.cards}>
        <MethodCard icon="equals" title="Split Evenly" onPress={() => onPick("equal")} />
        <MethodCard icon="dollar" title="Amounts" sub="Type each share" onPress={() => onPick("exact")} />
        <MethodCard icon="forkKnife" title="By dish" sub="Tap who had what" ink onPress={() => onPick("itemized")} />
      </View>
    </View>
  );
}

function MethodCard({ icon, title, sub, ink, onPress }: { icon: "equals" | "dollar" | "forkKnife"; title: string; sub?: string; ink?: boolean; onPress: () => void }) {
  return (
    <Press onPress={onPress} scaleTo={0.98} accessibilityRole="button" accessibilityLabel={`${title}${sub ? `, ${sub}` : ""}`} style={[styles.card, ink ? styles.cardInk : null]}>
      <View style={[styles.icon, ink ? styles.iconInk : null]}><Icon name={icon} size={20} color={ink ? color.accentOnInk : color.text} stroke={2.2} /></View>
      <ZText variant="headline" color={ink ? color.textOnInk : color.text}>{title}</ZText>
      {sub ? <ZText variant="small" color={ink ? color.accentOnInk : color.textMuted}>{sub}</ZText> : null}
    </Press>
  );
}

const styles = StyleSheet.create({
  wrap: { paddingHorizontal: layout.screenGutter, gap: space[10] },
  head: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: space[4] },
  cards: { flexDirection: "row", gap: space[10] },
  card: { flex: 1, backgroundColor: palette.white, borderRadius: radius.card, padding: 14, minHeight: 120, gap: 6, ...shadow.card },
  cardInk: { backgroundColor: palette.ink },
  icon: { width: 36, height: 36, borderRadius: radius.tile, backgroundColor: color.surfaceTile, alignItems: "center", justifyContent: "center", marginBottom: 4 },
  iconInk: { backgroundColor: color.glassOnInk },
});
