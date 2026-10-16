import { color, layout, palette, radius, shadow, space } from "@bunktab/theme";
import { useEffect, useState } from "react";
import { StyleSheet, View } from "react-native";
import Animated, { Easing, cancelAnimation, useAnimatedStyle, useSharedValue, withRepeat, withSequence, withTiming } from "react-native-reanimated";
import { Button, TextLink, Zebra, ZText, useReducedMotion } from "@/ui";

/**
 * While the read is in flight: the receipt-print motion (printer slot bar, a blank paper
 * sliding down and back, no spinner). After 8 seconds: "Still reading… you can enter the
 * total yourself" with a button into manual entry.
 */
export function ReadingState({ onManual }: { onManual: () => void }) {
  const reduced = useReducedMotion();
  const y = useSharedValue(reduced ? 0 : -1);
  const [slow, setSlow] = useState(false);
  useEffect(() => {
    // Reduce Motion can flip on after the first render: park the paper fully in view, else loop
    if (reduced) { cancelAnimation(y); y.value = 0; }
    else y.value = withRepeat(withSequence(withTiming(0, { duration: 900, easing: Easing.out(Easing.cubic) }), withTiming(0, { duration: 600 }), withTiming(-1, { duration: 500, easing: Easing.in(Easing.cubic) })), -1, false);
    const t = setTimeout(() => setSlow(true), 8000);
    return () => { cancelAnimation(y); clearTimeout(t); };
  }, [reduced, y]);
  const slide = useAnimatedStyle(() => ({ transform: [{ translateY: y.value * 120 }] }));
  return (
    <View style={styles.wrap} accessibilityLiveRegion="polite" accessibilityLabel={slow ? "Still reading the receipt. You can enter the total yourself." : "Reading the receipt"}>
      <View style={styles.slot} />
      <View style={styles.clip}>
        <Animated.View style={[styles.paper, slide]}>
          {[0.7, 0.5, 0.8, 0.45, 0.6].map((w, i) => <View key={i} style={[styles.ghostLine, { width: `${w * 100}%` }]} />)}
          <View style={[styles.ghostLine, styles.ghostTotal]} />
        </Animated.View>
      </View>
      <ZText variant="caption" color={color.textMuted} style={styles.center}>{slow ? "Still reading… you can enter the total yourself" : "Reading every line…"}</ZText>
      {slow ? <View style={styles.center}><TextLink label="Enter the total" onPress={onManual} /></View> : null}
    </View>
  );
}

/** Failed or unreadable: worried zebra, "Couldn't read this one", Try another photo, Enter the total. */
export function FailedState({ onRetry, onManual, reason }: { onRetry: () => void; onManual: () => void; reason?: string | null }) {
  return (
    <View style={styles.failed}>
      <Zebra variant="bust" mood="worried" size={120} animate={{ blink: true }} accessibilityLabel="Zebra, worried: the receipt couldn't be read" />
      <ZText variant="title2" style={styles.center}>Couldn't read this one</ZText>
      <ZText variant="body" color={color.textSecondary} style={styles.center}>{reason === "unreadable" ? "The photo is too blurry, dark or cropped to read the lines." : reason === "scan limit reached" ? "That's the daily limit of receipt reads. You can still enter the total." : "The photo stays attached either way."}</ZText>
      <Button kind="ink" label="Try another photo" onPress={onRetry} />
      <Button kind="secondary" label="Enter the total" onPress={onManual} />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginHorizontal: layout.screenGutter, gap: space[12] },
  slot: { height: 10, borderRadius: radius.pill, backgroundColor: palette.ink, zIndex: 2, ...shadow.control },
  clip: { overflow: "hidden", height: 150, paddingTop: 2 },
  paper: { backgroundColor: palette.white, paddingVertical: 16, paddingHorizontal: 18, gap: 10, borderBottomLeftRadius: radius.tile, borderBottomRightRadius: radius.tile, ...shadow.card },
  ghostLine: { height: 10, borderRadius: radius.pill, backgroundColor: color.surfaceTile },
  ghostTotal: { width: "40%", alignSelf: "flex-end", backgroundColor: palette.volt },
  center: { textAlign: "center", alignItems: "center" },
  failed: { marginHorizontal: layout.screenGutter, backgroundColor: palette.white, borderRadius: radius.hero, padding: 22, gap: space[12], alignItems: "stretch", ...shadow.card },
});
