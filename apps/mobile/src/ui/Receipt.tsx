import { color, fonts, motion, palette, radius, shadow, space, type } from "@bunktab/theme";
import { useEffect, useState } from "react";
import { StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";
import Animated, { Easing, useAnimatedStyle, useSharedValue, withTiming } from "react-native-reanimated";
import Svg, { Polygon } from "react-native-svg";
import { formatMoney, ZText } from "./Text";
import { useReducedMotion } from "./motion/useReducedMotion";

export type ReceiptLine = { label: string; cents: number };

/**
 * Thermal-receipt card for the AI read-out: white, IBM Plex Mono, dotted rule before
 * TOTAL, torn zig-zag bottom edge, the total in a volt highlight. `print` plays the
 * "receipt prints in" motion: slides down from behind an ink printer-slot bar, then the
 * total counts up over 900 ms.
 */
export function Receipt({ merchant, lines, totalCents, print = true, width = 280, style }: { merchant: string; lines: ReceiptLine[]; totalCents: number; print?: boolean; width?: number; style?: StyleProp<ViewStyle> }) {
  const reduced = useReducedMotion();
  const y = useSharedValue(print && !reduced ? -1 : 0);
  const [shown, setShown] = useState(print && !reduced ? 0 : totalCents);
  useEffect(() => {
    y.value = withTiming(0, { duration: reduced ? motion.moodCrossfade : 700, easing: Easing.out(Easing.cubic) });
    if (!print || reduced) { setShown(totalCents); return; }
    const start = Date.now() + 500;
    const id = setInterval(() => {
      const t = Math.min(1, Math.max(0, (Date.now() - start) / 900));
      const eased = 1 - Math.pow(1 - t, 3);
      setShown(Math.round(totalCents * eased));
      if (t >= 1) clearInterval(id);
    }, 33);
    return () => clearInterval(id);
  }, [print, reduced, totalCents, y]);
  const slide = useAnimatedStyle(() => ({ transform: [{ translateY: y.value * 100 }] }));
  const mono = { fontFamily: type.receipt.fontFamily, fontSize: type.receipt.fontSize, lineHeight: type.receipt.lineHeight };
  return (
    <View style={[{ width, alignItems: "stretch" }, style]}>
      <View style={styles.slot} />
      <View style={styles.clip}>
        <Animated.View style={[styles.paper, slide]}>
          <ZText style={[mono, styles.center]}>{merchant.toUpperCase()}</ZText>
          <ZText style={[mono, styles.center]} color={color.textMuted}>· · · · · · · · · · · · · ·</ZText>
          {lines.map((l, i) => (
            <View key={i} style={styles.line}>
              <ZText style={mono} numberOfLines={1}>{l.label}</ZText>
              <ZText style={mono} tabular>{formatMoney(l.cents, { sign: "never" })}</ZText>
            </View>
          ))}
          <ZText style={[mono, styles.center]} color={color.textMuted}>· · · · · · · · · · · · · ·</ZText>
          <View style={styles.line}>
            <ZText style={[mono, { fontFamily: fonts.monoBold }]}>TOTAL</ZText>
            <View style={styles.total}>
              <ZText style={[mono, { fontFamily: fonts.monoBold }]} tabular>{formatMoney(shown, { sign: "never" })}</ZText>
            </View>
          </View>
          <Svg width="100%" height={10} viewBox="0 0 100 10" preserveAspectRatio="none" style={styles.tear}>
            <Polygon points={zigzag()} fill={palette.white} />
          </Svg>
        </Animated.View>
      </View>
    </View>
  );
}

function zigzag(): string {
  const pts = ["0,0"];
  for (let x = 0; x <= 100; x += 5) pts.push(`${x},${x % 10 === 0 ? 10 : 2}`);
  pts.push("100,0");
  return pts.join(" ");
}

const styles = StyleSheet.create({
  slot: { height: 10, borderRadius: 5, backgroundColor: palette.ink, zIndex: 2, ...shadow.control },
  clip: { overflow: "hidden", paddingTop: 2 },
  paper: { backgroundColor: palette.white, paddingTop: 14, paddingHorizontal: 16, gap: 2, borderTopLeftRadius: 2, borderTopRightRadius: 2, ...shadow.card },
  center: { textAlign: "center" },
  line: { flexDirection: "row", justifyContent: "space-between", gap: space[12] },
  total: { backgroundColor: palette.volt, borderRadius: radius.tile / 2, paddingHorizontal: 6 },
  tear: { marginTop: 10, marginHorizontal: -16, marginBottom: -1 },
});
