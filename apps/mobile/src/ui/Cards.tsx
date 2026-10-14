import { color, layout, palette, radius, shadow, size, space } from "@bunktab/theme";
import type { ReactNode } from "react";
import { StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";
import { Press } from "./Press";
import { ZText } from "./Text";

/** HeroCard: 86% white, radius 30, hero shadow, padding 22 × 20, overflow hidden. */
export function HeroCard({ children, style, strong }: { children: ReactNode; style?: StyleProp<ViewStyle>; strong?: boolean }) {
  return (
    <View style={[styles.hero, { backgroundColor: strong ? color.surfaceTranslucentStrong : color.surfaceTranslucent }, style]}>
      {children}
    </View>
  );
}

/** Card: white, radius 24, card shadow, padding 16 × 18. Pressable cards scale to 0.98. */
export function Card({ children, style, onPress, accessibilityLabel }: { children: ReactNode; style?: StyleProp<ViewStyle>; onPress?: () => void; accessibilityLabel?: string }) {
  if (onPress) {
    return (
      <Press onPress={onPress} scaleTo={0.98} accessibilityRole="button" accessibilityLabel={accessibilityLabel} style={[styles.card, style]}>
        {children}
      </Press>
    );
  }
  return <View style={[styles.card, style]}>{children}</View>;
}

/**
 * RowCard: white, radius 22, hairline shadow, padding 12 × 14; 42 px sand icon tile
 * left, title 15/700 + caption 12 muted, amount right-aligned with a pill under it.
 */
export function RowCard({ tile, title, caption, right, onPress, style, accessibilityLabel }: { tile?: ReactNode; title: string; caption?: string; right?: ReactNode; onPress?: () => void; style?: StyleProp<ViewStyle>; accessibilityLabel?: string }) {
  const body = (
    <View style={styles.rowInner}>
      {tile != null ? <View style={styles.tile}>{tile}</View> : null}
      <View style={styles.rowText}>
        <ZText variant="bodyStrong" numberOfLines={1}>{title}</ZText>
        {caption ? <ZText variant="small" color={color.textMuted} numberOfLines={1}>{caption}</ZText> : null}
      </View>
      {right != null ? <View style={styles.rowRight}>{right}</View> : null}
    </View>
  );
  if (onPress) {
    return (
      <Press onPress={onPress} scaleTo={0.98} accessibilityRole="button" accessibilityLabel={accessibilityLabel ?? `${title}${caption ? `, ${caption}` : ""}`} style={[styles.row, style]}>
        {body}
      </Press>
    );
  }
  return <View style={[styles.row, style]}>{body}</View>;
}

/** InsetPanel: cream, radius 16, padding 8 × 12; holds meters and nudge lines inside cards. */
export function InsetPanel({ children, style, tone = "cream" }: { children: ReactNode; style?: StyleProp<ViewStyle>; tone?: "cream" | "blush" }) {
  return <View style={[styles.inset, tone === "blush" ? { backgroundColor: color.errorBg } : null, style]}>{children}</View>;
}

const styles = StyleSheet.create({
  hero: { borderRadius: radius.hero, paddingVertical: 22, paddingHorizontal: layout.heroPadding, overflow: "hidden", ...shadow.hero },
  card: { backgroundColor: palette.white, borderRadius: radius.card, paddingVertical: 16, paddingHorizontal: layout.cardPadding, ...shadow.card },
  row: { backgroundColor: palette.white, borderRadius: radius.row, paddingVertical: 12, paddingHorizontal: 14, ...shadow.hairline },
  rowInner: { flexDirection: "row", alignItems: "center", gap: space[12] },
  tile: { width: size.iconTile, height: size.iconTile, borderRadius: radius.tile, backgroundColor: color.surfaceTile, alignItems: "center", justifyContent: "center", overflow: "hidden" },
  rowText: { flex: 1, gap: 2 },
  rowRight: { alignItems: "flex-end", gap: 4 },
  inset: { backgroundColor: color.surfaceInset, borderRadius: radius.inset, paddingVertical: 8, paddingHorizontal: 12 },
});
