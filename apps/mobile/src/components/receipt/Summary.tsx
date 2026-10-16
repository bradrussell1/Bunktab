import type { Share, Totals } from "@bunktab/core";
import { color, layout, palette, radius, shadow, space } from "@bunktab/theme";
import { StyleSheet, View } from "react-native";
import { Avatar, ZText, formatMoney } from "@/ui";
import type { Method } from "@/lib/receipts";
import { initialsOf, type Person } from "./People";

/** Summary explainer inset, one per method; the example is the smallest food share. */
export function Explainer({ method, totals, example, people }: { method: Method; totals: Totals; example: Share | null; people: Person[] }) {
  const n = people.length;
  let strong: string; let body: string;
  if (method === "itemized" && example) {
    const pct = totals.subtotalCents > 0 ? ((example.foodCents / totals.subtotalCents) * 100).toFixed(1) : "0";
    const name = people.find((p) => p.id === example.personId)?.short ?? "They";
    strong = "Tax and tip follow the food.";
    body = ` ${name} ordered ${formatMoney(example.foodCents)} of the ${formatMoney(totals.subtotalCents)} in food (${pct}%), so they cover ${pct}% of the ${formatMoney(totals.taxCents)} tax and ${formatMoney(totals.tipCents)} tip.`;
  } else if (method === "equal") {
    strong = "Everyone pays the same.";
    body = ` ${formatMoney(totals.grandCents)} ÷ ${n} = ${formatMoney(Math.floor(totals.grandCents / Math.max(1, n)))} each, with tax and tip included.`;
  } else {
    strong = "Amounts were set by hand.";
    body = " Each total is what you entered. Food, tax and tip are shown in proportion to each share.";
  }
  return (
    <View style={styles.explainer}>
      <ZText variant="caption" color={color.textSecondary}><ZText variant="captionStrong">{strong}</ZText>{body}</ZText>
    </View>
  );
}

/** One person card: avatar, name, percentage, total, items line and Food · Tax · Tip (· Fees) chips. The example person is inverted in By item. */
export function PersonCard({ share, person, method, totals, itemsLine, inverted }: { share: Share; person: Person; method: Method; totals: Totals; itemsLine: string; inverted?: boolean }) {
  const pct = method === "itemized"
    ? `${totals.subtotalCents > 0 ? ((share.foodCents / totals.subtotalCents) * 100).toFixed(1) : "0"}% of the food`
    : `${totals.grandCents > 0 ? ((share.totalCents / totals.grandCents) * 100).toFixed(1) : "0"}% of the bill`;
  const ink = !!inverted;
  const chips = [["Food", share.foodCents], ["Tax", share.taxCents], ["Tip", share.tipCents]] as [string, number][];
  if (share.feesCents) chips.push(["Fees", share.feesCents]);
  if (share.discountCents) chips.push(["Discount", share.discountCents]);
  return (
    <View style={[styles.card, ink ? styles.cardInk : null]} accessibilityLabel={`${person.name}, ${pct}, ${formatMoney(share.totalCents)}. ${itemsLine}. ${chips.map(([k, v]) => `${k} ${formatMoney(v)}`).join(", ")}`}>
      <View style={styles.cardHead}>
        {ink ? <View style={styles.avatarVolt}><ZText variant="captionStrong">{person.short === "You" ? "YOU" : initialsOf(person.name)}</ZText></View> : <Avatar name={person.name} uri={person.photo} size={32} />}
        <ZText variant="headline" color={ink ? color.textOnInk : color.text} style={styles.cardName} numberOfLines={1}>{person.short}</ZText>
        <ZText variant="small" color={ink ? color.outlineDashed : color.textMuted}>{pct}</ZText>
        <ZText variant="headline" tabular color={ink ? color.accentOnInk : color.text}>{formatMoney(share.totalCents)}</ZText>
      </View>
      <ZText variant="small" color={ink ? color.outlineDashed : color.textMuted} numberOfLines={2}>{itemsLine}</ZText>
      <View style={styles.chips}>
        {chips.map(([k, v]) => (
          <View key={k} style={[styles.chip, ink ? styles.chipInk : null]}><ZText variant="small" tabular color={ink ? color.textOnInk : color.text}>{k} {formatMoney(v)}</ZText></View>
        ))}
      </View>
    </View>
  );
}

/** "Food $x + tax $y + tip $z = $grand", with fees and discounts when present. */
export function CheckLine({ totals }: { totals: Totals }) {
  const parts = [`Food ${formatMoney(totals.subtotalCents)}`, `tax ${formatMoney(totals.taxCents)}`];
  if (totals.feesCents) parts.push(`fees ${formatMoney(totals.feesCents)}`);
  if (totals.discountCents) parts.push(`discounts −${formatMoney(Math.abs(totals.discountCents))}`);
  parts.push(`tip ${formatMoney(totals.tipCents)}`);
  return (
    <View style={styles.check}>
      <ZText variant="captionStrong" style={styles.checkText}>{parts.join(" + ").replace(" + discounts −", " − discounts ")}</ZText>
      <ZText variant="bodyStrong" tabular>= {formatMoney(totals.grandCents)}</ZText>
    </View>
  );
}

const styles = StyleSheet.create({
  explainer: { marginHorizontal: layout.screenGutter, backgroundColor: color.surfaceInset, borderRadius: radius.inset, paddingVertical: 10, paddingHorizontal: 14 },
  card: { marginHorizontal: layout.screenGutter, backgroundColor: palette.white, borderRadius: radius.row, padding: 14, gap: 6, ...shadow.card },
  cardInk: { backgroundColor: palette.ink },
  cardHead: { flexDirection: "row", alignItems: "center", gap: space[8] },
  cardName: { flex: 1 },
  avatarVolt: { width: 32, height: 32, borderRadius: radius.pill, backgroundColor: palette.volt, alignItems: "center", justifyContent: "center" },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  chip: { backgroundColor: color.surfaceInset, borderRadius: radius.pill, paddingHorizontal: 10, paddingVertical: 4 },
  chipInk: { backgroundColor: color.glassOnInk },
  check: { marginHorizontal: layout.screenGutter, backgroundColor: palette.white, borderRadius: radius.inset, paddingVertical: 10, paddingHorizontal: 14, flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: space[8], ...shadow.hairline },
  checkText: { flex: 1 },
});
