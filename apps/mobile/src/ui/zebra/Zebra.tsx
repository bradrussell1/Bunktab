import { stripeLayout, zebraLabel, type ZebraMood, ZEBRA_STRIPE } from "@bunktab/core";
import { motion, zebra as z } from "@bunktab/theme";
import { useEffect, useMemo, useRef, useState } from "react";
import { View, type StyleProp, type ViewStyle } from "react-native";
import Animated, { Easing, cancelAnimation, useAnimatedProps, useAnimatedStyle, useSharedValue, withDelay, withRepeat, withSequence, withTiming, type SharedValue } from "react-native-reanimated";
import Svg, { G, Rect } from "react-native-svg";
import { useReducedMotion } from "../motion/useReducedMotion";
import { BUST_VIEWBOX, Defs_, Ears, EYE_CY, Eyes, FULL_VIEWBOX, Head, Legs, Mane, BodyFill, NeckStripes, Outline, Shadow, Sparkles, SweatDrop, Tail, TAIL_ROOT, Tuft, Zs } from "./parts";

const AG = Animated.createAnimatedComponent(G);
const ARect = Animated.createAnimatedComponent(Rect);
const bez = (b: readonly number[]) => Easing.bezier(b[0], b[1], b[2], b[3]);
const MOODS: ZebraMood[] = ["hi", "happy", "wink", "sleepy", "starry", "love", "worried"];

export type ZebraProps = {
  variant?: "full" | "bust";
  mood?: ZebraMood;
  /** Full only: members in the dazzle and how many are done. */
  members?: number;
  done?: number;
  /** Rendered width; height follows the viewBox. */
  size?: number;
  animate?: { blink?: boolean; bob?: boolean; swish?: boolean; dance?: boolean; sparkles?: boolean };
  /** Tail up (the recap / dazzled pose). Defaults to true when every stripe is in. */
  tailUp?: boolean;
  accessibilityLabel?: string;
  /** Decorative busts inside pills are hidden from screen readers. */
  decorative?: boolean;
  style?: StyleProp<ViewStyle>;
};

/**
 * The zebra (DESIGN_SYSTEM.md §7). Geometry from the masters; one stripe per member
 * on the full body (ink = done, ghost = not). Moods crossfade their eye groups over
 * 250 ms. Blink, bob, swish and dance are opt-in and all stop under Reduce Motion.
 */
export function Zebra({ variant = "full", mood = "hi", members = 6, done = 0, size = 244, animate, tailUp, accessibilityLabel, decorative, style }: ZebraProps) {
  const reduced = useReducedMotion();
  const vb = variant === "bust" ? BUST_VIEWBOX : FULL_VIEWBOX;
  const height = size * (vb.h / vb.w);
  // Outline stays crisp at small sizes: thicker strokes below ~200 px.
  const sw = size >= 200 ? 1 : size >= 120 ? 1.25 : 1.6;
  const stripes = useMemo(() => stripeLayout(members, done), [members, done]);
  const allIn = members > 0 && done >= members;
  const up = tailUp ?? (variant === "full" && mood === "starry");

  // ── mood crossfade: every mood's eye group is mounted; opacity animates ──
  const opac = MOODS.map((m) => useSharedValue(m === mood ? 1 : 0)); // eslint-disable-line react-hooks/rules-of-hooks
  useEffect(() => {
    MOODS.forEach((m, i) => { opac[i].value = withTiming(m === mood ? 1 : 0, { duration: motion.moodCrossfade }); });
  }, [mood]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── blink (hi, worried, wink's open eye): scaleY → 0.1 at 94 % of a 3.8 s cycle ──
  const blink = useSharedValue(1);
  const blinks = !!animate?.blink && !reduced && (mood === "hi" || mood === "worried" || mood === "wink");
  useEffect(() => {
    if (!blinks) { cancelAnimation(blink); blink.value = 1; return; }
    const p = motion.blink.period;
    blink.value = withRepeat(withSequence(withTiming(1, { duration: p * motion.blink.closeAt }), withTiming(motion.blink.closedScaleY, { duration: p * 0.03 }), withTiming(1, { duration: p * 0.03 })), -1, false);
    return () => cancelAnimation(blink);
  }, [blinks, blink]);
  const blinkProps = useAnimatedProps(() => ({ transform: `translate(0 ${EYE_CY}) scale(1 ${blink.value}) translate(0 ${-EYE_CY})` }));

  // ── tail swish: rotate −8° ↔ 14° about the tail root, 2.2 s ──
  const swish = useSharedValue<number>(motion.swish.fromDeg);
  const swishes = !!animate?.swish && !reduced && variant === "full";
  useEffect(() => {
    if (!swishes) { cancelAnimation(swish); swish.value = 0; return; }
    swish.value = withRepeat(withSequence(withTiming(motion.swish.toDeg, { duration: motion.swish.period / 2, easing: Easing.inOut(Easing.ease) }), withTiming(motion.swish.fromDeg, { duration: motion.swish.period / 2, easing: Easing.inOut(Easing.ease) })), -1, false);
    return () => cancelAnimation(swish);
  }, [swishes, swish]);
  const tailProps = useAnimatedProps(() => ({ transform: `rotate(${swish.value} ${TAIL_ROOT.x} ${TAIL_ROOT.y})` }));

  // ── bob: translateY 0 → −5 → 0, rotate −2° ↔ 2°, 3.4 s, origin bottom centre ──
  const bob = useSharedValue(0);
  const bobs = !!animate?.bob && !reduced;
  useEffect(() => {
    if (!bobs) { cancelAnimation(bob); bob.value = withTiming(0, { duration: 200 }); return; }
    bob.value = withRepeat(withSequence(withTiming(1, { duration: motion.bob.period / 2, easing: Easing.inOut(Easing.ease) }), withTiming(0, { duration: motion.bob.period / 2, easing: Easing.inOut(Easing.ease) })), -1, false);
    return () => cancelAnimation(bob);
  }, [bobs, bob]);

  // ── dance: once, 1.5 s; hops −18, −11, −4 with rotations −5, 4, −3, 2 ──
  const hop = useSharedValue(0);
  const tilt = useSharedValue(0);
  const danceKey = animate?.dance ? 1 : 0;
  useEffect(() => {
    if (!animate?.dance) return;
    if (reduced) return;
    const e = bez(motion.dance.bezier);
    const d = motion.dance.duration / 7;
    hop.value = withSequence(withTiming(-18, { duration: d, easing: e }), withTiming(0, { duration: d }), withTiming(-11, { duration: d, easing: e }), withTiming(0, { duration: d }), withTiming(-4, { duration: d, easing: e }), withTiming(0, { duration: d }));
    tilt.value = withSequence(withTiming(-5, { duration: d * 1.5 }), withTiming(4, { duration: d * 1.5 }), withTiming(-3, { duration: d * 1.5 }), withTiming(2, { duration: d * 1.5 }), withTiming(0, { duration: d }));
  }, [danceKey, reduced, hop, tilt, animate?.dance]);

  const container = useAnimatedStyle(() => ({
    transform: [
      { translateY: bob.value * motion.bob.translateY + hop.value },
      { rotate: `${(bob.value * 2 - 1) * motion.bob.rotateDeg * (bobs ? 1 : 0) + tilt.value}deg` },
    ],
  }));

  // ── z's float (sleepy) ──
  const zz = useSharedValue(0);
  const floats = mood === "sleepy" && !reduced;
  useEffect(() => {
    if (!floats) { cancelAnimation(zz); zz.value = 0; return; }
    zz.value = withRepeat(withSequence(withTiming(1, { duration: motion.zz.period / 2, easing: Easing.inOut(Easing.ease) }), withTiming(0, { duration: motion.zz.period / 2, easing: Easing.inOut(Easing.ease) })), -1, false);
    return () => cancelAnimation(zz);
  }, [floats, zz]);
  const zzProps = useAnimatedProps(() => ({ transform: `translate(0 ${zz.value * motion.zz.travelY})`, opacity: 1 - zz.value * 0.5 }));

  const label = accessibilityLabel ?? zebraLabel(mood, variant === "full" ? members : undefined, variant === "full" ? done : undefined);

  return (
    <Animated.View
      style={[{ width: size, height }, container, style]}
      accessible={!decorative}
      accessibilityRole={decorative ? undefined : "image"}
      accessibilityLabel={decorative ? undefined : label}
      accessibilityElementsHidden={decorative}
      importantForAccessibility={decorative ? "no-hide-descendants" : "auto"}
    >
      <Svg width={size} height={height} viewBox={`${vb.x} ${vb.y} ${vb.w} ${vb.h}`}>
        <Defs_ />
        {variant === "full" ? (
          <>
            <Shadow />
            <AG animatedProps={tailProps}><Tail up={up} sw={sw} /></AG>
            <Legs sw={sw} />
          </>
        ) : null}
        <Mane sw={sw} />
        <BodyFill bust={variant === "bust"} />
        {variant === "full" ? (
          <G clipPath="url(#zs-torso)">
            {stripes.map((s, i) => <BodyStripe key={`${members}-${i}`} cx={s.cx} width={s.width} done={s.done} index={i} reduced={reduced} />)}
          </G>
        ) : null}
        <NeckStripes bust={variant === "bust"} sw={sw} />
        <Outline bust={variant === "bust"} sw={sw} />
        <G>
          <Ears mood={mood} sw={sw} />
          <Head mood={mood} sw={sw} />
          {MOODS.map((m, i) => (
            <MoodEyes key={m} mood={m} opacity={opac[i]} blinkProps={m === "hi" || m === "worried" || m === "wink" ? blinkProps : undefined} sw={sw} />
          ))}
          <Tuft sw={sw} />
          <AG animatedProps={zzProps}>{mood === "sleepy" ? <Zs /> : null}</AG>
        </G>
        {variant === "full" && (animate?.sparkles || (allIn && mood === "starry")) ? <Sparkles sw={sw} /> : null}
      </Svg>
    </Animated.View>
  );
}

function MoodEyes({ mood, opacity, blinkProps, sw }: { mood: ZebraMood; opacity: SharedValue<number>; blinkProps?: ReturnType<typeof useAnimatedProps>; sw: number }) {
  const fade = useAnimatedProps(() => ({ opacity: opacity.value }));
  const inner = <Eyes mood={mood} sw={sw} />;
  return (
    <AG animatedProps={fade}>
      {blinkProps ? <AG animatedProps={blinkProps}>{inner}</AG> : inner}
      {mood === "worried" ? <SweatDrop sw={sw} /> : null}
    </AG>
  );
}

/** One body stripe: grows down from its top edge (460 ms spring-pop) when it becomes done. */
function BodyStripe({ cx, width, done, index, reduced }: { cx: number; width: number; done: boolean; index: number; reduced: boolean }) {
  const grow = useSharedValue(done ? 1 : 0);
  const first = useRef(true);
  useEffect(() => {
    if (first.current) { first.current = false; grow.value = done ? 1 : 0; return; }
    grow.value = reduced ? withTiming(done ? 1 : 0, { duration: motion.moodCrossfade }) : withDelay(index * 40, withTiming(done ? 1 : 0, { duration: motion.springPop.duration, easing: bez(motion.springPop.bezier) }));
  }, [done, index, reduced, grow]);
  const x = cx - width / 2;
  const top = ZEBRA_STRIPE.top;
  const fillProps = useAnimatedProps(() => ({ transform: `rotate(${ZEBRA_STRIPE.angleDeg} ${cx} ${ZEBRA_STRIPE.pivotY}) translate(0 ${top}) scale(1 ${Math.max(0, grow.value)}) translate(0 ${-top})` }));
  return (
    <>
      <Rect x={x} y={top} width={width} height={ZEBRA_STRIPE.height} rx={width / 2} transform={`rotate(${ZEBRA_STRIPE.angleDeg} ${cx} ${ZEBRA_STRIPE.pivotY})`} fill={z.ghostStripe} />
      <ARect x={x} y={top} width={width} height={ZEBRA_STRIPE.height} rx={width / 2} animatedProps={fillProps} fill={z.ink} />
    </>
  );
}

/** A convenience for the "zebra stage": re-mounts the dance when `trigger` changes. */
export function useDanceTrigger() {
  const [key, setKey] = useState(0);
  return { danceKey: key, dance: () => setKey((k) => k + 1) };
}

export const zebraPalette = z;
export { View as ZebraStage };
