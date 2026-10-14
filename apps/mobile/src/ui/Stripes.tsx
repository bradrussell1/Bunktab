import { color, palette, radius, shadow, size, space } from "@bunktab/theme";
import { useEffect, type ReactNode } from "react";
import { Image, StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";
import Animated, { useAnimatedStyle, useSharedValue, withDelay, withTiming, Easing } from "react-native-reanimated";
import { motion } from "@bunktab/theme";
import { Press } from "./Press";
import { ZText } from "./Text";
import { useReducedMotion } from "./motion/useReducedMotion";

const springPop = Easing.bezier(...(motion.springPop.bezier as [number, number, number, number]));

/** One rounded stripe that grows from its top edge when it becomes done (460 ms spring-pop). */
export function Stripe({ done, width, height, angleDeg, onColor = color.stripeOn, offColor = color.stripeOff, delay = 0, style }: { done: boolean; width: number; height: number; angleDeg: number; onColor?: string; offColor?: string; delay?: number; style?: StyleProp<ViewStyle> }) {
  const reduced = useReducedMotion();
  const grow = useSharedValue(done ? 1 : 0);
  useEffect(() => {
    grow.value = reduced ? withTiming(done ? 1 : 0, { duration: motion.moodCrossfade }) : withDelay(delay, withTiming(done ? 1 : 0, { duration: motion.springPop.duration, easing: springPop }));
  }, [done, delay, reduced, grow]);
  const fill = useAnimatedStyle(() => ({ transform: [{ scaleY: Math.max(0, Math.min(1.08, grow.value)) }] }));
  return (
    <View style={[{ width, height, borderRadius: width / 2, backgroundColor: offColor, overflow: "hidden", transform: [{ rotate: `${angleDeg}deg` }] }, style]}>
      <Animated.View style={[StyleSheet.absoluteFill, { backgroundColor: onColor, borderRadius: width / 2, transformOrigin: "50% 0%" }, fill]} />
    </View>
  );
}

/** StripeMeter: 8 × 22 stripes, radius 4, gap 5, rotated 10°; label "3 of 6 stripes" beside it. */
export function StripeMeter({ members, done, label, style, allInk }: { members: number; done: number; label?: string; style?: StyleProp<ViewStyle>; allInk?: boolean }) {
  const { width, height, gap, angleDeg } = size.meterStripe;
  const text = label ?? `${done} of ${members} stripe${members === 1 ? "" : "s"}`;
  return (
    <View accessibilityRole="progressbar" accessibilityLabel={`${done} of ${members} people are done adding expenses`} accessibilityValue={{ min: 0, max: members, now: done }} style={[styles.meter, style]}>
      <View style={[styles.meterRow, { gap }]}>
        {Array.from({ length: Math.min(members, 12) }, (_, i) => (
          <Stripe key={i} done={allInk || i < done} width={width} height={height} angleDeg={angleDeg} delay={i * 40} />
        ))}
      </View>
      <ZText variant="small" color={allInk ? color.text : color.textMuted}>{text}</ZText>
    </View>
  );
}

/**
 * NightCell: 34 × 56, radius 14; a 16 × 46 stripe rotated 7°: dashed when empty, ink
 * growing from the top when on; cream background when on.
 */
export function NightCell({ on, label, onPress, disabled }: { on: boolean; label: string; onPress: () => void; disabled?: boolean }) {
  const { width, height, stripeW, stripeH, angleDeg } = size.nightCell;
  return (
    <Press
      onPress={onPress}
      disabled={disabled}
      scaleTo={0.97}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ selected: on, disabled: !!disabled }}
      hitSlop={4}
      style={[styles.night, { width, height, borderRadius: radius.tile, backgroundColor: on ? color.surfaceInset : "transparent" }]}
    >
      {on ? (
        <Stripe done width={stripeW} height={stripeH} angleDeg={angleDeg} offColor="transparent" />
      ) : (
        <View style={{ width: stripeW, height: stripeH, borderRadius: stripeW / 2, borderWidth: 1.5, borderStyle: "dashed", borderColor: color.outlineDashed, transform: [{ rotate: `${angleDeg}deg` }] }} />
      )}
    </Press>
  );
}

function initials(name: string) {
  return name.trim().split(/\s+/).slice(0, 2).map((p) => p[0]?.toUpperCase() ?? "").join("") || "?";
}

/**
 * Avatar: 40 px circle, sand fill, initials 13/800. Done = ink with a volt stripe
 * swiped across (DoneSwipe); not done = dashed outline.
 */
export function Avatar({ name, uri, size: s = size.avatar, done, notDone, style, onHero }: { name: string; uri?: string | null; size?: number; done?: boolean; notDone?: boolean; style?: StyleProp<ViewStyle>; onHero?: boolean }) {
  const reduced = useReducedMotion();
  const swipe = useSharedValue(done ? 0 : -1);
  useEffect(() => {
    swipe.value = withTiming(done ? 0 : -1, { duration: reduced ? motion.moodCrossfade : motion.springPop.duration, easing: springPop });
  }, [done, reduced, swipe]);
  const stripe = useAnimatedStyle(() => ({ transform: [{ translateX: swipe.value * s }, { rotate: "10deg" }], opacity: done ? 1 : 0 }));
  return (
    <View
      accessibilityLabel={done ? `${name}, done` : notDone ? `${name}, still adding` : name}
      style={[styles.avatar, { width: s, height: s, borderRadius: s / 2, backgroundColor: done ? palette.ink : uri ? "transparent" : color.surfaceTile }, notDone && !done ? styles.avatarDashed : null, onHero ? styles.avatarRing : null, style]}
    >
      {done ? <Animated.View pointerEvents="none" style={[styles.avatarStripe, { width: Math.round(s * 0.22), height: s * 1.4, top: -s * 0.2, left: s * 0.6, borderRadius: s * 0.11 }, stripe]} /> : null}
      {uri && !done ? <Image source={{ uri }} style={{ width: s, height: s, borderRadius: s / 2 }} accessibilityIgnoresInvertColors /> : null}
      {!uri || done ? <ZText variant="captionStrong" color={done ? color.textOnInk : color.text} style={{ fontSize: Math.round(s * 0.33) }}>{initials(name)}</ZText> : null}
    </View>
  );
}

/** Overlapping avatar row (the dazzle page member row). */
export function AvatarRow({ children, overlap = 10, style }: { children: ReactNode; overlap?: number; style?: StyleProp<ViewStyle> }) {
  return <View style={[styles.avatarRow, { marginLeft: 0 }, style]}>{Array.isArray(children) ? children.map((c, i) => <View key={i} style={{ marginLeft: i === 0 ? 0 : -overlap, zIndex: 100 - i }}>{c}</View>) : children}</View>;
}

/**
 * PersonPill: full-width pill. Done: ink fill, happy bust in a pink-tint disc, name white
 * 15/700, "Done · stripe N earned" volt 12/700, white rotated mark. Not done: white fill,
 * hairline, dashed initials circle, "Still adding expenses" muted, ghost mark, optional Nudge.
 */
export function PersonPill({ name, done, stripeIndex, bust, action, onPress, isYou }: { name: string; done: boolean; stripeIndex?: number; bust?: ReactNode; action?: ReactNode; onPress?: () => void; isYou?: boolean }) {
  const sub = done ? `Done · stripe ${stripeIndex ?? 1} earned` : "Still adding expenses";
  const inner = (
    <View style={styles.pillRow}>
      {done ? (
        <View style={styles.bustDisc}>{bust}</View>
      ) : (
        <View style={[styles.avatar, styles.avatarDashed, { width: size.avatar, height: size.avatar, borderRadius: size.avatar / 2, backgroundColor: "transparent" }]}>
          <ZText variant="captionStrong">{initials(name)}</ZText>
        </View>
      )}
      <View style={styles.pillText}>
        <ZText variant="bodyStrong" color={done ? color.textOnInk : color.text} numberOfLines={1}>{isYou ? `${name} (you)` : name}</ZText>
        <ZText variant="small" color={done ? color.accentOnInk : color.textMuted}>{sub}</ZText>
      </View>
      {action ?? <View style={[styles.mark, { backgroundColor: done ? palette.white : color.stripeOff }]} />}
    </View>
  );
  const base = [styles.pill, done ? { backgroundColor: palette.ink } : styles.pillOff];
  if (onPress) {
    return (
      <Press onPress={onPress} scaleTo={0.98} accessibilityRole="button" accessibilityLabel={`${name}, ${sub}`} accessibilityState={{ selected: done }} style={base}>
        {inner}
      </Press>
    );
  }
  return <View accessibilityLabel={`${name}, ${sub}`} style={base}>{inner}</View>;
}

const styles = StyleSheet.create({
  meter: { flexDirection: "row", alignItems: "center", gap: space[10] },
  meterRow: { flexDirection: "row", alignItems: "center" },
  night: { alignItems: "center", justifyContent: "center" },
  avatar: { alignItems: "center", justifyContent: "center", overflow: "hidden" },
  avatarDashed: { borderWidth: 1.5, borderStyle: "dashed", borderColor: color.outlineDashed },
  avatarRing: { borderWidth: 2, borderColor: palette.white },
  avatarStripe: { position: "absolute", backgroundColor: palette.volt },
  avatarRow: { flexDirection: "row", alignItems: "center" },
  pill: { borderRadius: radius.pill, paddingVertical: 10, paddingLeft: 10, paddingRight: 16, minHeight: 64, justifyContent: "center", ...shadow.hairline },
  pillOff: { backgroundColor: palette.white, borderWidth: 1.5, borderColor: color.outline },
  pillRow: { flexDirection: "row", alignItems: "center", gap: space[12] },
  bustDisc: { width: 44, height: 44, borderRadius: 22, backgroundColor: palette.pinkTint, alignItems: "center", justifyContent: "center", overflow: "hidden" },
  pillText: { flex: 1, gap: 2 },
  mark: { width: 8, height: 22, borderRadius: 4, transform: [{ rotate: "10deg" }] },
});
