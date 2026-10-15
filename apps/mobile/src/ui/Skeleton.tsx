import { color, layout, motion, radius, shadow, palette, size, space } from "@bunktab/theme";
import { useEffect } from "react";
import { StyleSheet, View, type DimensionValue, type StyleProp, type ViewStyle } from "react-native";
import Animated, { Easing, cancelAnimation, interpolateColor, useAnimatedStyle, useSharedValue, withRepeat, withSequence, withTiming } from "react-native-reanimated";
import { useReducedMotion } from "./motion/useReducedMotion";

/**
 * Loading skeletons (DESIGN_SYSTEM.md §8, RESKIN_PROMPT B10): ghost rounded bars that
 * shimmer from ghost to cream. Never a spinner on a full screen. One shared shimmer
 * phase per bar keeps the whole screen breathing together; Reduce Motion holds it still.
 */
function useShimmer() {
  const reduced = useReducedMotion();
  const v = useSharedValue(0);
  useEffect(() => {
    if (reduced) { cancelAnimation(v); v.value = 0; return; }
    v.value = withRepeat(withSequence(withTiming(1, { duration: motion.skeleton.period / 2, easing: Easing.inOut(Easing.ease) }), withTiming(0, { duration: motion.skeleton.period / 2, easing: Easing.inOut(Easing.ease) })), -1, false);
    return () => cancelAnimation(v);
  }, [reduced, v]);
  return useAnimatedStyle(() => ({ backgroundColor: interpolateColor(v.value, [0, 1], [color.stripeOff, color.surfaceInset]) }));
}

/** One ghost bar. `width` may be a number or a percentage. */
export function Skeleton({ width = "100%", height = 14, round, style }: { width?: DimensionValue; height?: number; round?: boolean; style?: StyleProp<ViewStyle> }) {
  const shimmer = useShimmer();
  return <Animated.View accessible={false} importantForAccessibility="no" style={[{ width, height, borderRadius: round ? height / 2 : radius.stripe }, shimmer, style]} />;
}

/** A RowCard-shaped ghost: tile, two lines, an amount. */
export function RowSkeleton({ style }: { style?: StyleProp<ViewStyle> }) {
  return (
    <View style={[styles.row, style]}>
      <Skeleton width={size.iconTile} height={size.iconTile} style={styles.tile} />
      <View style={styles.rowText}>
        <Skeleton width="62%" height={14} />
        <Skeleton width="40%" height={11} />
      </View>
      <Skeleton width={64} height={16} />
    </View>
  );
}

/** A hero-card ghost: label, big amount, a pill. */
export function HeroSkeleton({ style }: { style?: StyleProp<ViewStyle> }) {
  return (
    <View style={[styles.hero, style]}>
      <Skeleton width="34%" height={12} />
      <Skeleton width="58%" height={34} />
      <Skeleton width={96} height={24} round />
    </View>
  );
}

/** Whole-screen placeholder under a TopBar: a hero and `rows` row ghosts, announced once. */
export function ScreenSkeleton({ rows = 4, hero = true, label = "Loading" }: { rows?: number; hero?: boolean; label?: string }) {
  return (
    <View style={styles.screen} accessibilityLabel={label} accessibilityRole="progressbar" accessibilityLiveRegion="polite">
      {hero ? <HeroSkeleton /> : null}
      {Array.from({ length: rows }, (_, i) => <RowSkeleton key={i} />)}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { paddingHorizontal: layout.screenGutter, paddingTop: space[8], gap: layout.listGap },
  row: { flexDirection: "row", alignItems: "center", gap: space[12], backgroundColor: palette.white, borderRadius: radius.row, paddingVertical: 12, paddingHorizontal: 14, ...shadow.hairline },
  tile: { borderRadius: radius.tile },
  rowText: { flex: 1, gap: 6 },
  hero: { backgroundColor: palette.white, borderRadius: radius.hero, paddingVertical: 22, paddingHorizontal: layout.heroPadding, gap: space[10], ...shadow.hero },
});
