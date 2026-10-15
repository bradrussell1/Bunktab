import { color, palette, radius, shadow, size, space } from "@bunktab/theme";
import type { ReactNode } from "react";
import { StyleSheet, View, type StyleProp, type TextStyle, type ViewStyle } from "react-native";
import { Press } from "./Press";
import { formatMoney, ZText } from "./Text";

/**
 * AmountPill: owed to you = volt + ink "+$2,193.10"; you owe = blush + blushText
 * "−$142.50"; settled (0) = no pill, plain ink "$0.00". 13–15/800, tabular.
 */
export function AmountPill({ cents, large, style, hideZero }: { cents: number; large?: boolean; style?: StyleProp<ViewStyle>; hideZero?: boolean }) {
  const textStyle = style as StyleProp<TextStyle>;
  if (cents === 0) {
    if (hideZero) return null;
    return <ZText variant={large ? "amountRow" : "captionStrong"} tabular style={textStyle}>{formatMoney(0)}</ZText>;
  }
  const owed = cents > 0;
  const label = formatMoney(cents, { sign: "always" });
  return (
    <View
      accessibilityLabel={`${owed ? "owed to you" : "you owe"} ${formatMoney(Math.abs(cents))}`}
      style={[styles.pill, { backgroundColor: owed ? color.owedToYou : color.youOwe, paddingVertical: large ? 5 : 3, paddingHorizontal: large ? 11 : 10 }, style]}
    >
      <ZText variant={large ? "amountRow" : "captionStrong"} tabular color={owed ? color.textOnVolt : color.youOweText} style={styles.strong}>
        {label}
      </ZText>
    </View>
  );
}

/** StatusPill: small white (or volt when complete) pill for counts, "3 of 6 stripes". */
export function StatusPill({ label, complete, style }: { label: string; complete?: boolean; style?: StyleProp<ViewStyle> }) {
  return (
    <View style={[styles.status, complete ? { backgroundColor: palette.volt } : styles.whiteOutline, style]}>
      <ZText variant="captionStrong">{label}</ZText>
    </View>
  );
}

/** Context pill in the top bar: "Casa Azul villa · $3,000", 13/700, white. */
export function ContextPill({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  return (
    <View style={[styles.status, styles.whiteShadow, style]}>
      <ZText variant="captionStrong" numberOfLines={1}>{children}</ZText>
    </View>
  );
}

/** Selected-person chip: white chip with an × (create-a-dazzle invite step). */
export function Chip({ label, onRemove, style }: { label: string; onRemove?: () => void; style?: StyleProp<ViewStyle> }) {
  const inner = (
    <View style={styles.chipRow}>
      <ZText variant="label">{label}</ZText>
      {onRemove ? <ZText variant="label" color={color.textMuted}>×</ZText> : null}
    </View>
  );
  if (onRemove) {
    return (
      <Press onPress={onRemove} scaleTo={0.97} accessibilityRole="button" accessibilityLabel={`Remove ${label}`} style={[styles.chip, style]}>
        {inner}
      </Press>
    );
  }
  return <View style={[styles.chip, style]}>{inner}</View>;
}

/**
 * MemberPill (dazzle page, feedback round 1 item 12): one small pill per member, "First L.",
 * in a horizontal carousel under the balance card. quiet = sand, muted (nothing added yet);
 * adding = volt wash with a hairline, ink (logged or paid at least one expense);
 * done = ink with a volt stripe, white. Tap opens the member sheet.
 */
export function MemberPill({ label, state, onPress, accessibilityLabel, style }: { label: string; state: "quiet" | "adding" | "done"; onPress?: () => void; accessibilityLabel?: string; style?: StyleProp<ViewStyle> }) {
  const inner = (
    <>
      {state === "done" ? <View style={styles.memberStripe} /> : null}
      <ZText variant="captionStrong" color={state === "done" ? color.textOnInk : state === "adding" ? color.text : color.textMuted} numberOfLines={1}>{label}</ZText>
    </>
  );
  const base = [styles.member, state === "done" ? styles.memberDone : state === "adding" ? styles.memberAdding : styles.memberQuiet, style];
  const a11y = accessibilityLabel ?? `${label}, ${state === "done" ? "done" : state === "adding" ? "adding expenses" : "nothing added yet"}`;
  if (onPress) {
    return (
      <Press onPress={onPress} scaleTo={0.97} accessibilityRole="button" accessibilityLabel={a11y} style={base}>
        {inner}
      </Press>
    );
  }
  return <View accessibilityLabel={a11y} style={base}>{inner}</View>;
}

const styles = StyleSheet.create({
  pill: { borderRadius: radius.pill, alignSelf: "flex-start" },
  member: { flexDirection: "row", alignItems: "center", gap: space[6], borderRadius: radius.pill, paddingVertical: 8, paddingHorizontal: 12, minHeight: 34, justifyContent: "center" },
  memberQuiet: { backgroundColor: color.surfaceTile },
  memberAdding: { backgroundColor: palette.washVolt, borderWidth: 1.5, borderColor: color.outline, paddingVertical: 6.5, paddingHorizontal: 10.5 },
  memberDone: { backgroundColor: palette.ink },
  memberStripe: { width: 5, height: 14, borderRadius: 2.5, backgroundColor: palette.volt, transform: [{ rotate: "10deg" }] },
  strong: { fontFamily: undefined },
  status: { borderRadius: radius.pill, paddingVertical: 5, paddingHorizontal: 11, alignSelf: "flex-start", minHeight: 28, justifyContent: "center" },
  whiteOutline: { backgroundColor: palette.white, borderWidth: 1.5, borderColor: color.outline },
  whiteShadow: { backgroundColor: palette.white, ...shadow.control },
  chip: { backgroundColor: palette.white, borderRadius: radius.pill, paddingVertical: 8, paddingHorizontal: 14, borderWidth: 1.5, borderColor: color.outline, minHeight: size.pillButton - 4, justifyContent: "center" },
  chipRow: { flexDirection: "row", alignItems: "center", gap: 8 },
});
