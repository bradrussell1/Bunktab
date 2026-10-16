import { computeTip, tipPercentOf, type TipChoice } from "@bunktab/core";
import { color, layout, palette, radius, shadow, size, space } from "@bunktab/theme";
import { useState } from "react";
import { StyleSheet, View } from "react-native";
import { Icon, Press, ZText, formatMoney, haptic } from "@/ui";
import { track } from "@/lib/analytics";
import { KeypadSheet } from "./Sheets";

const PRESETS = [18, 20, 22] as const;

/**
 * Tip card (Receipt-Read board): "Add a tip" with 18% · 20% · 22% · Custom pills (ink when
 * selected), then the Tip total inset: for a preset, "{p}% of the $food food, before tax"
 * and the amount; for Custom, "{x.x}% of the $food food · tap to type" with a − / amount / +
 * stepper (±$1) and a keypad on the amount. A printed tip preselects Custom.
 */
export function TipCard({ subtotalCents, tip, onChange, tipPrintedCents }: { subtotalCents: number; tip: TipChoice; onChange: (t: TipChoice) => void; tipPrintedCents?: number | null }) {
  const [keypad, setKeypad] = useState(false);
  const custom = tip.mode === "custom";
  const tipCents = computeTip(subtotalCents, tip.mode, tip.percent, tip.customCents);
  const food = formatMoney(subtotalCents);
  const pick = (t: TipChoice) => { haptic.light(); onChange(t); track("tip_selected", { mode: t.mode, percent: t.mode === "percent" ? t.percent ?? null : null }); };
  return (
    <View style={styles.card}>
      <View style={styles.row1}>
        <ZText variant="bodyStrong">Add a tip</ZText>
        <View style={styles.pills}>
          {PRESETS.map((p) => {
            const on = tip.mode === "percent" && tip.percent === p;
            return (
              <Press key={p} onPress={() => pick({ mode: "percent", percent: p })} scaleTo={0.97} accessibilityRole="radio" accessibilityState={{ selected: on }} accessibilityLabel={`${p} percent tip`} style={[styles.pill, on ? styles.pillOn : null]}>
                <ZText variant="captionStrong" color={on ? color.textOnInk : color.text}>{p}%</ZText>
              </Press>
            );
          })}
          <Press onPress={() => pick({ mode: "custom", customCents: tip.customCents ?? tipPrintedCents ?? 2500 })} scaleTo={0.97} accessibilityRole="radio" accessibilityState={{ selected: custom }} accessibilityLabel="Custom tip" style={[styles.pill, custom ? styles.pillOn : null]}>
            <ZText variant="captionStrong" color={custom ? color.textOnInk : color.text}>Custom</ZText>
          </Press>
        </View>
      </View>
      <View style={styles.inset}>
        <View style={styles.insetText}>
          <ZText variant="captionStrong">Tip total</ZText>
          <ZText variant="small" color={color.textMuted}>
            {custom ? `${tipPercentOf(tipCents, subtotalCents)}% of the ${food} food · tap to type` : `${tip.percent}% of the ${food} food, before tax`}
          </ZText>
          {custom && tipPrintedCents != null && tip.customCents === tipPrintedCents ? <ZText variant="small" color={color.textMuted}>Tip read from receipt</ZText> : null}
        </View>
        {custom ? (
          <View style={styles.stepper}>
            <Press onPress={() => pick({ mode: "custom", customCents: Math.max(0, tipCents - 100) })} scaleTo={0.97} accessibilityRole="button" accessibilityLabel="Take a dollar off the tip" style={styles.step}><Icon name="minus" size={16} color={color.textOnInk} stroke={2.4} /></Press>
            <Press onPress={() => setKeypad(true)} scaleTo={0.97} accessibilityRole="button" accessibilityLabel={`Tip ${formatMoney(tipCents)}, tap to type`} style={styles.amountPill}><ZText variant="bodyStrong" tabular>{formatMoney(tipCents)}</ZText></Press>
            <Press onPress={() => pick({ mode: "custom", customCents: tipCents + 100 })} scaleTo={0.97} accessibilityRole="button" accessibilityLabel="Add a dollar to the tip" style={styles.step}><Icon name="plus" size={16} color={color.textOnInk} stroke={2.4} /></Press>
          </View>
        ) : (
          <ZText variant="headline" tabular accessibilityLabel={`Tip ${formatMoney(tipCents)}`}>{formatMoney(tipCents)}</ZText>
        )}
      </View>
      <KeypadSheet open={keypad} title="Tip" cents={tipCents || 2500} onClose={() => setKeypad(false)} onSave={(c) => { setKeypad(false); pick({ mode: "custom", customCents: c }); }} helper={`${tipPercentOf(tipCents, subtotalCents)}% of the ${food} food`} />
    </View>
  );
}

const styles = StyleSheet.create({
  card: { marginHorizontal: layout.screenGutter, backgroundColor: palette.white, borderRadius: radius.row, padding: 14, gap: space[12], ...shadow.card },
  row1: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: space[8], flexWrap: "wrap" },
  pills: { flexDirection: "row", gap: 6 },
  pill: { minHeight: size.pillSmall + 4, paddingHorizontal: 12, borderRadius: radius.pill, backgroundColor: palette.white, borderWidth: 1.5, borderColor: color.outline, alignItems: "center", justifyContent: "center" },
  pillOn: { backgroundColor: palette.ink, borderColor: palette.ink },
  inset: { backgroundColor: color.surfaceInset, borderRadius: radius.inset, minHeight: 44, paddingVertical: 8, paddingHorizontal: 12, flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: space[8] },
  insetText: { flex: 1, gap: 1 },
  stepper: { flexDirection: "row", alignItems: "center", gap: 6 },
  step: { width: size.pillSmall, height: size.pillSmall, borderRadius: radius.pill, backgroundColor: palette.ink, alignItems: "center", justifyContent: "center" },
  amountPill: { minHeight: size.pillSmall + 4, minWidth: 84, paddingHorizontal: 12, borderRadius: radius.pill, backgroundColor: palette.white, borderWidth: 1.5, borderColor: palette.ink, alignItems: "center", justifyContent: "center" },
});
