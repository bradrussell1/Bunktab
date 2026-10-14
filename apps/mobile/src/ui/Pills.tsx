import { color, palette, radius, shadow, size } from "@bunktab/theme";
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
      <ZText variant="captionStrong">{children}</ZText>
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

const styles = StyleSheet.create({
  pill: { borderRadius: radius.pill, alignSelf: "flex-start" },
  strong: { fontFamily: undefined },
  status: { borderRadius: radius.pill, paddingVertical: 5, paddingHorizontal: 11, alignSelf: "flex-start", minHeight: 28, justifyContent: "center" },
  whiteOutline: { backgroundColor: palette.white, borderWidth: 1.5, borderColor: color.outline },
  whiteShadow: { backgroundColor: palette.white, ...shadow.control },
  chip: { backgroundColor: palette.white, borderRadius: radius.pill, paddingVertical: 8, paddingHorizontal: 14, borderWidth: 1.5, borderColor: color.outline, minHeight: size.pillButton - 4, justifyContent: "center" },
  chipRow: { flexDirection: "row", alignItems: "center", gap: 8 },
});
