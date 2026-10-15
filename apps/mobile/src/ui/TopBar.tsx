import { layout, space } from "@bunktab/theme";
import type { ReactNode } from "react";
import { StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { IconButton } from "./Button";
import { ZText } from "./Text";

/**
 * TopBar: safe-area inset + 8; round 44 px white icon buttons; optional context pill
 * (centre) or the wordmark (left, Home). `right` takes one or two IconButtons.
 */
export function TopBar({ onBack, wordmark, center, right, style }: { onBack?: () => void; wordmark?: boolean; center?: ReactNode; right?: ReactNode; style?: StyleProp<ViewStyle> }) {
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.bar, { paddingTop: insets.top + layout.topBarTopPadding }, style]}>
      <View style={styles.side}>
        {onBack ? <IconButton name="chevronLeft" label="Back" onPress={onBack} /> : null}
        {wordmark ? <Wordmark /> : null}
      </View>
      <View style={styles.center}>{center}</View>
      <View style={[styles.side, styles.right]}>{right}</View>
    </View>
  );
}

/** "zebrasplit", always lowercase, 20/800 −0.03em. */
export function Wordmark({ display }: { display?: boolean }) {
  return <ZText variant={display ? "title1" : "wordmark"} accessibilityRole="header">zebrasplit</ZText>;
}

const styles = StyleSheet.create({
  bar: { flexDirection: "row", alignItems: "center", paddingHorizontal: layout.screenGutter, paddingBottom: space[8], minHeight: 44 },
  side: { flexDirection: "row", alignItems: "center", gap: space[8], minWidth: 44 },
  right: { justifyContent: "flex-end" },
  center: { flex: 1, alignItems: "center" },
});
