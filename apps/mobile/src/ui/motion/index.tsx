/**
 * Motion (DESIGN_SYSTEM.md §9) as reusable hooks and components. Every duration and
 * curve comes from `motion` tokens; every loop stops under Reduce Motion (one shared
 * check, useReducedMotion); dance / confetti / boop become a 250 ms fade.
 */
import { color, motion, palette, radius, size } from "@bunktab/theme";
import * as Haptics from "expo-haptics";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";
import Animated, { Easing, cancelAnimation, useAnimatedStyle, useSharedValue, withDelay, withRepeat, withSequence, withSpring, withTiming } from "react-native-reanimated";
import { Press } from "../Press";
import { ZText, formatMoney } from "../Text";
import { useReducedMotion } from "./useReducedMotion";

export { useReducedMotion };
const bez = (b: readonly number[]) => Easing.bezier(b[0], b[1], b[2], b[3]);
const riseEase = bez(motion.rise.bezier);
const popEase = bez(motion.springPop.bezier);

export const haptic = {
  light: () => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {}),
  success: () => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {}),
};

/** Loop helper: 0 → 1 → 0 over `period`, ease-in-out; returns the shared value (0 when reduced). */
function useLoop(period: number, enabled: boolean) {
  const reduced = useReducedMotion();
  const v = useSharedValue(0);
  const on = enabled && !reduced;
  useEffect(() => {
    if (!on) { cancelAnimation(v); v.value = withTiming(0, { duration: 200 }); return; }
    v.value = withRepeat(withSequence(withTiming(1, { duration: period / 2, easing: Easing.inOut(Easing.ease) }), withTiming(0, { duration: period / 2, easing: Easing.inOut(Easing.ease) })), -1, false);
    return () => cancelAnimation(v);
  }, [on, period, v]);
  return v;
}

/** Blink: scaleY → 0.1 at 94 % of a 3.8 s cycle; returns an animated style for a View wrapping eyes. */
export function useBlink(enabled = true) {
  const reduced = useReducedMotion();
  const s = useSharedValue(1);
  const on = enabled && !reduced;
  useEffect(() => {
    if (!on) { cancelAnimation(s); s.value = 1; return; }
    const p = motion.blink.period;
    s.value = withRepeat(withSequence(withTiming(1, { duration: p * motion.blink.closeAt }), withTiming(motion.blink.closedScaleY, { duration: p * 0.03 }), withTiming(1, { duration: p * 0.03 })), -1, false);
    return () => cancelAnimation(s);
  }, [on, s]);
  return useAnimatedStyle(() => ({ transform: [{ scaleY: s.value }] }));
}

/** Bob: translateY 0 → −5 → 0 and rotate −2° ↔ 2°, 3.4 s. */
export function useBob(enabled = true) {
  const v = useLoop(motion.bob.period, enabled);
  return useAnimatedStyle(() => ({ transform: [{ translateY: v.value * motion.bob.translateY }, { rotate: `${(v.value * 2 - 1) * motion.bob.rotateDeg}deg` }] }));
}

/** Tail swish: rotate −8° ↔ 14°, 2.2 s. */
export function useSwish(enabled = true) {
  const v = useLoop(motion.swish.period, enabled);
  return useAnimatedStyle(() => ({ transform: [{ rotate: `${motion.swish.fromDeg + (motion.swish.toDeg - motion.swish.fromDeg) * v.value}deg` }] }));
}

/** StripeGrow: scaleY 0 → 1 from the top edge, 460 ms spring-pop. Light haptic when it lands. */
export function StripeGrow({ on, children, style, haptics = true }: { on: boolean; children: ReactNode; style?: StyleProp<ViewStyle>; haptics?: boolean }) {
  const reduced = useReducedMotion();
  const s = useSharedValue(on ? 1 : 0);
  const first = useRef(true);
  useEffect(() => {
    if (first.current) { first.current = false; s.value = on ? 1 : 0; return; }
    s.value = withTiming(on ? 1 : 0, { duration: reduced ? motion.moodCrossfade : motion.springPop.duration, easing: popEase });
    if (on && haptics) haptic.light();
  }, [on, reduced, haptics, s]);
  const a = useAnimatedStyle(() => ({ transform: [{ scaleY: Math.max(0, s.value) }] }));
  return <Animated.View style={[{ transformOrigin: "50% 0%" }, a, style]}>{children}</Animated.View>;
}

/** DoneSwipe: a volt stripe swipes across (translateX −100 % → 0, 460 ms spring). */
export function DoneSwipe({ on, width, style }: { on: boolean; width: number; style?: StyleProp<ViewStyle> }) {
  const reduced = useReducedMotion();
  const x = useSharedValue(on ? 0 : -width);
  useEffect(() => { x.value = withTiming(on ? 0 : -width, { duration: reduced ? motion.moodCrossfade : motion.springPop.duration, easing: popEase }); }, [on, width, reduced, x]);
  const a = useAnimatedStyle(() => ({ transform: [{ translateX: x.value }, { rotate: "10deg" }] }));
  return <Animated.View pointerEvents="none" style={[styles.swipe, { width: width * 0.22, height: width * 1.4, top: -width * 0.2, left: width * 0.6, borderRadius: width * 0.11 }, a, style]} />;
}

/** Dance: once, 1.5 s; hops −18, −11, −4 with rotations −5°, 4°, −3°, 2°. `play` re-triggers. */
export function Dance({ play, children, style }: { play: number; children: ReactNode; style?: StyleProp<ViewStyle> }) {
  const reduced = useReducedMotion();
  const y = useSharedValue(0);
  const r = useSharedValue(0);
  const o = useSharedValue(1);
  useEffect(() => {
    if (play === 0) return;
    if (reduced) { o.value = withSequence(withTiming(0.4, { duration: motion.moodCrossfade / 2 }), withTiming(1, { duration: motion.moodCrossfade / 2 })); return; }
    const e = bez(motion.dance.bezier);
    const d = motion.dance.duration / 7;
    y.value = withSequence(withTiming(-18, { duration: d, easing: e }), withTiming(0, { duration: d }), withTiming(-11, { duration: d, easing: e }), withTiming(0, { duration: d }), withTiming(-4, { duration: d, easing: e }), withTiming(0, { duration: d }));
    r.value = withSequence(withTiming(-5, { duration: d * 1.5 }), withTiming(4, { duration: d * 1.5 }), withTiming(-3, { duration: d * 1.5 }), withTiming(2, { duration: d * 1.5 }), withTiming(0, { duration: d }));
  }, [play, reduced, y, r, o]);
  const a = useAnimatedStyle(() => ({ opacity: o.value, transform: [{ translateY: y.value }, { rotate: `${r.value}deg` }] }));
  return <Animated.View style={[a, style]}>{children}</Animated.View>;
}

const CONFETTI_PATHS = [[-150, -110], [-100, -140], [-50, -120], [0, -150], [50, -120], [100, -140], [150, -110], [0, -90]] as const;
const CONFETTI_COLORS = [palette.ink, palette.volt, palette.pink];

/** Confetti: 16 rounded stripes (8 × 22) in ink / volt / pink, two waves 220 ms apart, 1.5 s. Success haptic. */
export function Confetti({ play, style }: { play: number; style?: StyleProp<ViewStyle> }) {
  const reduced = useReducedMotion();
  const [key, setKey] = useState(0);
  useEffect(() => { if (play > 0) { setKey((k) => k + 1); haptic.success(); } }, [play]);
  if (play === 0 || reduced) return null;
  return (
    <View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.confettiHost, style]}>
      {Array.from({ length: motion.confetti.pieces }, (_, i) => (
        <Piece key={`${key}-${i}`} index={i} />
      ))}
    </View>
  );
}

function Piece({ index }: { index: number }) {
  const [dx, dy] = CONFETTI_PATHS[index % CONFETTI_PATHS.length];
  const wave = index >= 8 ? motion.confetti.secondWaveDelay : 0;
  const t = useSharedValue(0);
  useEffect(() => { t.value = withDelay(wave, withTiming(1, { duration: motion.confetti.duration, easing: bez(motion.confetti.bezier) })); }, [t, wave]);
  const spin = ((index * 97) % 440) - 220;
  const a = useAnimatedStyle(() => ({
    opacity: t.value < 0.7 ? 1 : 1 - (t.value - 0.7) / 0.3,
    transform: [{ translateX: dx * t.value * (index >= 8 ? 0.8 : 1) }, { translateY: dy * t.value + 60 * t.value * t.value }, { rotate: `${spin * t.value}deg` }, { scale: 0.3 + 0.7 * Math.min(1, t.value * 3) }],
  }));
  return <Animated.View style={[styles.piece, { backgroundColor: CONFETTI_COLORS[index % 3] }, a]} />;
}

/** Rise: translateY 14 → 0 + fade in, 550 ms (.2,.8,.2,1). */
export function Rise({ children, delay = 0, style, show = true }: { children: ReactNode; delay?: number; style?: StyleProp<ViewStyle>; show?: boolean }) {
  const reduced = useReducedMotion();
  const y = useSharedValue(reduced ? 0 : 14);
  const o = useSharedValue(0);
  useEffect(() => {
    if (!show) { o.value = withTiming(0, { duration: motion.colorChange }); return; }
    const d = reduced ? motion.moodCrossfade : motion.rise.duration;
    y.value = withDelay(delay, withTiming(0, { duration: d, easing: riseEase }));
    o.value = withDelay(delay, withTiming(1, { duration: d, easing: riseEase }));
  }, [show, delay, reduced, y, o]);
  const a = useAnimatedStyle(() => ({ opacity: o.value, transform: [{ translateY: y.value }] }));
  return <Animated.View style={[a, style]}>{children}</Animated.View>;
}

/** ReceiptPrint: the printer-slot slide (used by the Receipt component; exported for the design route). */
export function ReceiptPrint({ children, play }: { children: ReactNode; play: number }) {
  const reduced = useReducedMotion();
  const y = useSharedValue(-1);
  useEffect(() => { y.value = reduced ? 0 : -1; y.value = withTiming(0, { duration: reduced ? motion.moodCrossfade : 700, easing: Easing.out(Easing.cubic) }); }, [play, reduced, y]);
  const a = useAnimatedStyle(() => ({ transform: [{ translateY: y.value * 100 }] }));
  return <View style={styles.clip}><Animated.View style={a}>{children}</Animated.View></View>;
}

/** CountUp: money counts up from 0 over 1.3 s (ease-out cubic) with a volt underline stripe growing with it. */
export function CountUp({ cents, variant = "display", color: c, underline = true, play = 1 }: { cents: number; variant?: "display" | "amountL" | "amountRow"; color?: string; underline?: boolean; play?: number }) {
  const reduced = useReducedMotion();
  const [shown, setShown] = useState(reduced ? cents : 0);
  const w = useSharedValue(0);
  useEffect(() => {
    if (reduced) { setShown(cents); w.value = 1; return; }
    const start = Date.now();
    w.value = 0;
    w.value = withTiming(1, { duration: motion.countUp.duration, easing: Easing.out(Easing.cubic) });
    const id = setInterval(() => {
      const t = Math.min(1, (Date.now() - start) / motion.countUp.duration);
      setShown(Math.round(cents * (1 - Math.pow(1 - t, 3))));
      if (t >= 1) clearInterval(id);
    }, 33);
    return () => clearInterval(id);
  }, [cents, play, reduced, w]);
  const line = useAnimatedStyle(() => ({ transform: [{ scaleX: w.value }] }));
  return (
    <View style={styles.countUp}>
      <ZText variant={variant} tabular color={c} accessibilityLabel={formatMoney(cents)}>{formatMoney(shown)}</ZText>
      {underline ? <Animated.View style={[styles.underline, line]} /> : null}
    </View>
  );
}

/** MoonPop: scale 1 → 1.4 → 1, 450 ms. `play` re-triggers. */
export function MoonPop({ play, children }: { play: number; children: ReactNode }) {
  const reduced = useReducedMotion();
  const s = useSharedValue(1);
  useEffect(() => { if (play > 0 && !reduced) s.value = withSequence(withTiming(motion.pop.scale, { duration: motion.pop.duration / 2, easing: popEase }), withTiming(1, { duration: motion.pop.duration / 2 })); }, [play, reduced, s]);
  const a = useAnimatedStyle(() => ({ transform: [{ scale: s.value }] }));
  return <Animated.View style={a}>{children}</Animated.View>;
}

/** Twinkle: opacity 1 ↔ 0.45, 2.6 s. */
export function Twinkle({ children, enabled = true, style }: { children: ReactNode; enabled?: boolean; style?: StyleProp<ViewStyle> }) {
  const v = useLoop(motion.twinkle.period, enabled);
  const a = useAnimatedStyle(() => ({ opacity: 1 - v.value * (1 - motion.twinkle.minOpacity) }));
  return <Animated.View style={[a, style]}>{children}</Animated.View>;
}

/** ZzFloat: translateY 0 ↔ −6, opacity 1 ↔ 0.5, 2.4 s. */
export function ZzFloat({ children, enabled = true, style }: { children: ReactNode; enabled?: boolean; style?: StyleProp<ViewStyle> }) {
  const v = useLoop(motion.zz.period, enabled);
  const a = useAnimatedStyle(() => ({ opacity: 1 - v.value * 0.5, transform: [{ translateY: v.value * motion.zz.travelY }] }));
  return <Animated.View style={[a, style]}>{children}</Animated.View>;
}

/** LiveDot: pink dot, opacity 1 ↔ 0.35, 1.4 s. */
export function LiveDot({ size: s = 8, enabled = true, style }: { size?: number; enabled?: boolean; style?: StyleProp<ViewStyle> }) {
  const v = useLoop(motion.liveDot.period, enabled);
  const a = useAnimatedStyle(() => ({ opacity: 1 - v.value * (1 - motion.liveDot.minOpacity) }));
  return <Animated.View accessibilityLabel="live" style={[{ width: s, height: s, borderRadius: s / 2, backgroundColor: color.attention }, a, style]} />;
}

/**
 * VenmoZipButton: tap → "Opening Venmo…" with moving diagonal ink/white stripes; `paid`
 * → volt fill, "Paid, nice". Success haptic when paid lands.
 */
export function VenmoZipButton({ label, openingLabel = "Opening Venmo…", paidLabel = "Paid, nice", paid, onPress, style }: { label: string; openingLabel?: string; paidLabel?: string; paid: boolean; onPress: () => void; style?: StyleProp<ViewStyle> }) {
  const reduced = useReducedMotion();
  const [opening, setOpening] = useState(false);
  const shift = useSharedValue(0);
  useEffect(() => {
    if (!opening || paid || reduced) { cancelAnimation(shift); shift.value = 0; return; }
    shift.value = withRepeat(withTiming(motion.venmoZip.travelPx, { duration: motion.venmoZip.loopMs, easing: Easing.linear }), -1, false);
    return () => cancelAnimation(shift);
  }, [opening, paid, reduced, shift]);
  useEffect(() => { if (paid) { setOpening(false); haptic.success(); } }, [paid]);
  const stripes = useAnimatedStyle(() => ({ transform: [{ translateX: shift.value - motion.venmoZip.travelPx }] }));
  const text = paid ? paidLabel : opening ? openingLabel : label;
  return (
    <Press onPress={() => { if (paid) return; setOpening(true); onPress(); }} scaleTo={0.97} accessibilityRole="button" accessibilityLabel={text} accessibilityState={{ disabled: paid, busy: opening && !paid }} style={[styles.zip, { backgroundColor: paid ? palette.volt : palette.ink }, style]}>
      {opening && !paid ? (
        <Animated.View pointerEvents="none" style={[styles.zipStripes, stripes]}>
          {Array.from({ length: 24 }, (_, i) => <View key={i} style={[styles.zipStripe, { left: i * motion.venmoZip.stripePx * 2 }]} />)}
        </Animated.View>
      ) : null}
      <ZText variant="button" color={paid ? color.textOnVolt : color.textOnInk}>{text}</ZText>
    </Press>
  );
}

/** Boop: the nudge bust rises 46 px from behind the avatar with a wobble (900 ms); bubble pops in after 350 ms. Light haptic. */
export function Boop({ play, children, bubble }: { play: number; children: ReactNode; bubble?: ReactNode }) {
  const reduced = useReducedMotion();
  const y = useSharedValue(46);
  const r = useSharedValue(0);
  const o = useSharedValue(0);
  const [showBubble, setShowBubble] = useState(false);
  useEffect(() => {
    if (play === 0) return;
    haptic.light();
    setShowBubble(false);
    if (reduced) { y.value = 0; o.value = withTiming(1, { duration: motion.moodCrossfade }); const t = setTimeout(() => setShowBubble(true), motion.moodCrossfade); return () => clearTimeout(t); }
    const e = bez(motion.boop.bezier);
    y.value = 46; o.value = 0;
    o.value = withTiming(1, { duration: 200 });
    y.value = withTiming(0, { duration: motion.boop.duration, easing: e });
    r.value = withSequence(withTiming(-8, { duration: 250 }), withTiming(8, { duration: 250 }), withTiming(-4, { duration: 200 }), withTiming(0, { duration: 200 }));
    const t = setTimeout(() => setShowBubble(true), motion.boop.bubbleDelay);
    return () => clearTimeout(t);
  }, [play, reduced, y, r, o]);
  const a = useAnimatedStyle(() => ({ opacity: o.value, transform: [{ translateY: y.value }, { rotate: `${r.value}deg` }] }));
  if (play === 0) return null;
  return (
    <View style={styles.boopHost}>
      <Animated.View style={a}>{children}</Animated.View>
      {showBubble ? <View style={styles.boopBubble}>{bubble}</View> : null}
    </View>
  );
}

/** Spring helper for pop-to-1.12 (the love zebra). */
export function usePopScale(play: number, to = 1.12) {
  const s = useSharedValue(1);
  useEffect(() => { if (play > 0) s.value = withSequence(withSpring(to, { damping: 8, stiffness: 180 }), withSpring(1, { damping: 12, stiffness: 160 })); }, [play, to, s]);
  return useAnimatedStyle(() => ({ transform: [{ scale: s.value }] }));
}

const styles = StyleSheet.create({
  swipe: { position: "absolute", backgroundColor: palette.volt },
  confettiHost: { alignItems: "center", justifyContent: "center", overflow: "visible" },
  piece: { position: "absolute", width: 8, height: 22, borderRadius: 4 },
  clip: { overflow: "hidden" },
  countUp: { alignSelf: "flex-start" },
  underline: { height: 6, borderRadius: 3, backgroundColor: palette.volt, marginTop: 4, transformOrigin: "0% 50%" },
  zip: { height: size.ctaHeight, borderRadius: radius.pill, alignItems: "center", justifyContent: "center", overflow: "hidden", alignSelf: "stretch" },
  zipStripes: { position: "absolute", top: -20, bottom: -20, left: 0, right: -200, flexDirection: "row" },
  zipStripe: { position: "absolute", top: 0, bottom: 0, width: 14, backgroundColor: "rgba(255,255,255,0.18)", transform: [{ rotate: "25deg" }] },
  boopHost: { alignItems: "center" },
  boopBubble: { position: "absolute", bottom: "100%", left: "55%" },
});
