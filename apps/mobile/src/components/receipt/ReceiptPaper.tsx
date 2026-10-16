import { color, fonts, layout, palette, radius, shadow, space, type } from "@bunktab/theme";
import { useEffect, useState } from "react";
import { StyleSheet, View } from "react-native";
import Animated, { Easing, useAnimatedStyle, useSharedValue, withTiming } from "react-native-reanimated";
import Svg, { Polygon, Polyline } from "react-native-svg";
import { Press, TextLink, ZText, formatMoney, useReducedMotion } from "@/ui";
import type { ReceiptChargeRow, ReceiptItemRow } from "@/lib/receipts";

/**
 * The itemized thermal receipt (Receipt-Read board): IBM Plex Mono 12 on white paper with
 * a torn bottom edge. One row per line - NAME in caps, "2 @ 12.00" muted, the total right
 * aligned - then a dashed rule, SUBTOTAL, each tax/fee/discount line and TOTAL in a volt
 * highlight. Rows are buttons that open the edit sheet; a pink dot marks the suspect line
 * when the read needs review. Prints in from behind the slot bar on first show.
 */
export function ReceiptPaper({ merchant, items, charges, subtotalCents, totalCents, taxIncluded, suspectPosition, onEditLine, onAddLine, print = true, readOnly }: {
  merchant: string;
  items: ReceiptItemRow[];
  charges: ReceiptChargeRow[];
  subtotalCents: number;
  totalCents: number;
  taxIncluded?: boolean;
  suspectPosition?: number | null;
  onEditLine?: (item: ReceiptItemRow) => void;
  onAddLine?: () => void;
  print?: boolean;
  readOnly?: boolean;
}) {
  const reduced = useReducedMotion();
  const y = useSharedValue(print && !reduced ? -1 : 0);
  const [shown, setShown] = useState(print && !reduced ? 0 : totalCents);
  useEffect(() => {
    y.value = withTiming(0, { duration: reduced ? 250 : 700, easing: Easing.out(Easing.cubic) });
    if (!print || reduced) { setShown(totalCents); return; }
    const start = Date.now() + 500;
    const id = setInterval(() => {
      const t = Math.min(1, Math.max(0, (Date.now() - start) / 900));
      setShown(Math.round(totalCents * (1 - Math.pow(1 - t, 3))));
      if (t >= 1) clearInterval(id);
    }, 33);
    return () => clearInterval(id);
  }, [print, reduced, totalCents, y]);
  const slide = useAnimatedStyle(() => ({ transform: [{ translateY: y.value * 100 }] }));
  const mono = { fontFamily: type.receipt.fontFamily, fontSize: type.receipt.fontSize, lineHeight: type.receipt.lineHeight };
  const money = (c: number) => formatMoney(c, { sign: c < 0 ? "auto" : "never" }).replace("$", "");
  const money2 = (c: number) => (c / 100).toFixed(2);
  const itemDiscounts = Object.fromEntries(charges.filter((c) => c.kind === "discount" && c.item_id).map((c) => [c.item_id!, c]));
  return (
    <View style={styles.wrap}>
      <View style={styles.slot} />
      <View style={styles.clip}>
        <Animated.View style={[styles.paper, slide]}>
          <ZText style={[mono, styles.center]}>{merchant.toUpperCase()}</ZText>
          <ZText style={[mono, styles.center]} color={color.textMuted}>· · · · · · · · · · · · · · · · · ·</ZText>
          {items.map((it) => {
            const suspect = suspectPosition != null && it.position === suspectPosition;
            const disc = itemDiscounts[it.id];
            const a11y = `${it.name}, ${it.quantity > 1 ? `${it.quantity} at ${money2(Math.round(it.line_total_cents / it.quantity))}, ` : ""}${money2(it.line_total_cents)}${suspect ? ", check this line" : ""}${readOnly ? "" : ". Tap to edit"}`;
            return (
              <View key={it.id}>
                <Press onPress={onEditLine ? () => onEditLine(it) : undefined} disabled={!onEditLine} scaleTo={0.98} accessibilityRole={onEditLine ? "button" : "text"} accessibilityLabel={a11y} style={styles.line}>
                  <View style={styles.lineLeft}>
                    {suspect ? <View style={styles.dot} /> : null}
                    <ZText style={mono} numberOfLines={1} color={it.edited_by_user ? color.textSecondary : color.text}>{it.name.toUpperCase()}</ZText>
                  </View>
                  <ZText style={mono} tabular>{money2(it.line_total_cents)}</ZText>
                </Press>
                {it.quantity > 1 ? <ZText style={[mono, styles.qty]} color={color.textMuted}>{it.quantity} @ {money2(Math.round(it.line_total_cents / it.quantity))}</ZText> : null}
                {disc ? <View style={styles.line}><ZText style={[mono, styles.qty]} color={color.textMuted}>{(disc.label ?? "DISCOUNT").toUpperCase()}</ZText><ZText style={mono} tabular color={color.textMuted}>{money(disc.amount_cents)}</ZText></View> : null}
              </View>
            );
          })}
          <ZText style={[mono, styles.center]} color={color.textMuted}>- - - - - - - - - - - - - - - - - -</ZText>
          <Row mono={mono} label="SUBTOTAL" value={money2(subtotalCents)} />
          {charges.filter((c) => c.kind !== "discount" || !c.item_id).map((c) => (
            <Row key={c.id} mono={mono} label={(c.label ?? c.kind.replace("_", " ")).toUpperCase() + (taxIncluded && c.kind === "tax" ? " (INCL.)" : "")} value={c.kind === "discount" ? `-${money2(Math.abs(c.amount_cents))}` : money2(c.amount_cents)} muted={taxIncluded && c.kind === "tax"} />
          ))}
          <View style={[styles.line, styles.totalRow]}>
            <ZText style={[mono, { fontFamily: fonts.monoBold }]}>TOTAL</ZText>
            <View style={styles.total}><ZText style={[mono, { fontFamily: fonts.monoBold }]} tabular>{money2(shown)}</ZText></View>
          </View>
          <Svg width="100%" height={10} viewBox="0 0 100 10" preserveAspectRatio="none" style={styles.tear}>
            <Polygon points={zigzag()} fill={palette.white} />
            <Polyline points={zigzagEdge()} fill="none" stroke={color.outline} strokeWidth={1.2} strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
          </Svg>
        </Animated.View>
      </View>
      {onAddLine && !readOnly ? <View style={styles.add}><TextLink label="+ Add a line the AI missed" onPress={onAddLine} /></View> : null}
    </View>
  );
}

function Row({ mono, label, value, muted }: { mono: object; label: string; value: string; muted?: boolean }) {
  return (
    <View style={styles.line}>
      <ZText style={mono} color={muted ? color.textMuted : color.text}>{label}</ZText>
      <ZText style={mono} tabular color={muted ? color.textMuted : color.text}>{value}</ZText>
    </View>
  );
}

function zigzagEdge(): string { const pts: string[] = []; for (let x = 0; x <= 100; x += 5) pts.push(`${x},${x % 10 === 0 ? 10 : 2}`); return pts.join(" "); }
function zigzag(): string { const pts = ["0,0"]; for (let x = 0; x <= 100; x += 5) pts.push(`${x},${x % 10 === 0 ? 10 : 2}`); pts.push("100,0"); return pts.join(" "); }

const styles = StyleSheet.create({
  wrap: { marginHorizontal: layout.screenGutter },
  slot: { height: 10, borderRadius: radius.pill, backgroundColor: palette.ink, zIndex: 2, ...shadow.control },
  clip: { overflow: "hidden", paddingTop: 2 },
  paper: { backgroundColor: palette.white, paddingTop: 14, paddingHorizontal: 18, gap: 2, ...shadow.card },
  center: { textAlign: "center" },
  line: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: space[12], minHeight: 24 },
  lineLeft: { flexDirection: "row", alignItems: "center", gap: 6, flex: 1 },
  dot: { width: 7, height: 7, borderRadius: radius.pill, backgroundColor: color.attention },
  qty: { paddingLeft: 12, marginTop: -4 },
  totalRow: { marginTop: 2 },
  total: { backgroundColor: palette.volt, borderRadius: radius.tile / 2, paddingHorizontal: 6 },
  tear: { marginTop: 10, marginHorizontal: -18, marginBottom: -1 },
  add: { alignItems: "center", paddingTop: space[10] },
});
