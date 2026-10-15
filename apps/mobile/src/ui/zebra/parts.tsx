/**
 * The zebra's parts, ported by hand from design/zebra/svg/* (geometry identical to the
 * masters; colours from theme.zebra). Each part is a plain function so Zebra.tsx can
 * stack them in the master's paint order: shadow, tail, legs, mane, body, stripes,
 * neck stripes, outline, head (ears, head, muzzle, cheeks), eyes per mood, extras.
 */
import { fonts, zebra as z } from "@bunktab/theme";
import type { ZebraMood } from "@bunktab/core";
import { Circle, ClipPath, Defs, Ellipse, G, Path, Rect, Text as SvgText } from "react-native-svg";

export const FULL_VIEWBOX = { x: 0, y: -8, w: 320, h: 330 } as const;
export const BUST_VIEWBOX = { x: 30, y: -8, w: 200, h: 184 } as const;

export const BODY_PATH = "M124 140 C114 168 110 196 116 222 C122 246 138 258 160 258 L232 258 C258 258 274 240 274 212 C274 186 258 168 236 168 L206 168 C192 168 184 150 186 124 L140 110 Z";
export const NECK_PATH = "M124 140 C114 168 110 196 116 222 L206 222 C192 168 184 150 186 124 L140 110 Z";
export const MANE_PATH = "M141.3 52.2 L152.8 50.0 L168.6 45.0 L170.6 61.4 L187.0 60.9 L184.5 77.1 L200.5 80.5 L194.2 95.6 L209.0 102.5 L199.3 115.7 L212.0 124.9 L200.3 134.3 L213.0 138.4 L202.8 146.0 L215.1 143.8 L208.0 154.2 L208.7 163.1 L201.2 171.1 L195.5 165.7 L190.6 159.4 L187.0 152.3 L184.6 144.5 L183.4 135.8 L183.0 126.4 L182.5 117.9 L180.9 109.7 L178.3 101.7 L174.8 94.0 L170.5 86.7 L165.3 80.1 L159.4 74.3 L152.9 69.4 L145.8 65.5 L137.7 62.6 Z";
const TUFT_PATH = "M100 52 C96 40 102 30 112 28 C110 36 116 40 120 34 C120 26 128 20 138 22 C132 30 136 38 144 38 C140 50 124 58 100 52 Z";

/** Tail root: (270, 196). `up` is the starry/dazzled pose. */
export const TAIL_ROOT = { x: 270, y: 196 } as const;

export function Defs_() {
  return (
    <Defs>
      <ClipPath id="zs-torso"><Rect x="112" y="168" width="162" height="90" rx="45" /></ClipPath>
      <ClipPath id="zs-body"><Path d={BODY_PATH} /></ClipPath>
    </Defs>
  );
}

export function Shadow() {
  return <Ellipse cx="190" cy="312" rx="100" ry="9" fill={z.ink} opacity={0.07} />;
}

export function Tail({ up, sw }: { up?: boolean; sw: number }) {
  return up ? (
    <>
      <Path d="M270 196 C290 190 300 166 296 146" stroke={z.ink} strokeWidth={5 * sw} fill="none" strokeLinecap="round" />
      <Path d="M288 152 C282 136 288 120 302 118 C310 130 310 146 298 156 Z" fill={z.ink} />
    </>
  ) : (
    <>
      <Path d="M270 196 C292 200 298 232 288 254" stroke={z.ink} strokeWidth={5 * sw} fill="none" strokeLinecap="round" />
      <Path d="M280 246 C270 262 276 282 290 286 C302 276 302 258 292 246 Z" fill={z.ink} />
    </>
  );
}

export function Legs({ sw }: { sw: number }) {
  const legs = [[208, 226, 80], [238, 222, 84], [128, 226, 80], [160, 230, 76]] as const;
  const hooves = [[208, 290, 262, 276], [238, 290, 258, 272], [128, 290, 262, 276], [160, 290, 266, 280]] as const;
  return (
    <G>
      {legs.map(([x, y, h]) => <Rect key={x} x={x} y={y} width={26} height={h} rx={13} fill={z.hide} stroke={z.ink} strokeWidth={3.5 * sw} />)}
      <G fill={z.ink}>
        {hooves.map(([x, hoofY, s1, s2]) => (
          <G key={x}>
            <Rect x={x} y={hoofY} width={26} height={18} rx={9} />
            <Rect x={x} y={s1} width={26} height={7} rx={3.5} />
            <Rect x={x} y={s2} width={26} height={6} rx={3} />
          </G>
        ))}
      </G>
    </G>
  );
}

export function Mane({ sw }: { sw: number }) {
  return <Path d={MANE_PATH} fill={z.ink} stroke={z.ink} strokeWidth={6 * sw} strokeLinejoin="round" />;
}

export function BodyFill({ bust }: { bust?: boolean }) {
  return <Path d={bust ? NECK_PATH : BODY_PATH} fill={z.hide} />;
}

export function NeckStripes({ bust, sw }: { bust?: boolean; sw: number }) {
  return bust ? (
    <Path d="M162 152 Q178 146 192 150" stroke={z.ink} strokeWidth={10 * sw} fill="none" strokeLinecap="round" />
  ) : (
    <G clipPath="url(#zs-body)">
      <Path d="M164 158 Q178 152 192 156 M114 190 Q130 184 146 188" stroke={z.ink} strokeWidth={10 * sw} fill="none" strokeLinecap="round" />
    </G>
  );
}

export function Outline({ bust, sw }: { bust?: boolean; sw: number }) {
  return <Path d={bust ? NECK_PATH : BODY_PATH} fill="none" stroke={z.ink} strokeWidth={3.5 * sw} strokeLinejoin="round" />;
}

const DROOPY: ZebraMood[] = ["sleepy", "worried"];
const BIG_CHEEKS: ZebraMood[] = ["happy", "starry", "love"];

export function Ears({ mood, sw }: { mood: ZebraMood; sw: number }) {
  const tilt = DROOPY.includes(mood) ? 52 : 24;
  return (
    <>
      <G transform={`rotate(${-tilt} 82 58)`}>
        <Ellipse cx="82" cy="40" rx="15" ry="27" fill={z.hide} stroke={z.ink} strokeWidth={3.5 * sw} />
        <Ellipse cx="82" cy="44" rx="7.5" ry="17" fill={z.earInner} />
      </G>
      <G transform={`rotate(${tilt} 158 58)`}>
        <Ellipse cx="158" cy="40" rx="15" ry="27" fill={z.hide} stroke={z.ink} strokeWidth={3.5 * sw} />
        <Ellipse cx="158" cy="44" rx="7.5" ry="17" fill={z.earInner} />
      </G>
    </>
  );
}

export function Head({ mood, sw }: { mood: ZebraMood; sw: number }) {
  const big = BIG_CHEEKS.includes(mood);
  return (
    <>
      <Ellipse cx="120" cy="98" rx="60" ry="54" fill={z.ink} stroke={z.ink} strokeWidth={7 * sw} />
      <Ellipse cx="120" cy="140" rx="42" ry="28" fill={z.ink} stroke={z.ink} strokeWidth={7 * sw} />
      <Ellipse cx="120" cy="98" rx="60" ry="54" fill={z.hide} />
      <Ellipse cx="120" cy="140" rx="42" ry="28" fill={z.muzzle} />
      <Ellipse cx="120" cy="134" rx="30" ry="12" fill={z.muzzleSheen} opacity={0.7} />
      <Path d="M104 136 q-3 6 2 9 M136 136 q3 6 -2 9" stroke={z.nostril} strokeWidth={4 * sw} fill="none" strokeLinecap="round" />
      <Ellipse cx="76" cy="118" rx={big ? 12 : 10} ry={big ? 7.5 : 6.5} fill={z.cheek} />
      <Ellipse cx="164" cy="118" rx={big ? 12 : 10} ry={big ? 7.5 : 6.5} fill={z.cheek} />
    </>
  );
}

export function Tuft({ sw }: { sw: number }) {
  return <Path d={TUFT_PATH} fill={z.ink} stroke={z.ink} strokeWidth={3 * sw} strokeLinejoin="round" />;
}

/** The glossy open eye (hi/wink's left eye); `small` is the worried size. */
export function OpenEye({ cx, small }: { cx: number; small?: boolean }) {
  return (
    <>
      <Ellipse cx={cx} cy="96" rx={small ? 7 : 8.5} ry={small ? 8 : 10} fill={z.ink} />
      <Circle cx={cx + 3} cy="92" r={small ? 2.6 : 3.2} fill="#FFFFFF" />
      <Circle cx={cx - 2} cy="100" r={1.4} fill="#FFFFFF" />
    </>
  );
}

/** Eye group per mood. Eyes only; ears, cheeks and extras are handled by their own parts. */
export function Eyes({ mood, sw }: { mood: ZebraMood; sw: number }) {
  switch (mood) {
    case "hi":
      return <><OpenEye cx={97} /><OpenEye cx={143} /></>;
    case "worried":
      return <><OpenEye cx={97} small /><OpenEye cx={143} small /></>;
    case "happy":
      return <Path d="M88 100 q9 -11 18 0 M134 100 q9 -11 18 0" stroke={z.ink} strokeWidth={5 * sw} fill="none" strokeLinecap="round" />;
    case "wink":
      return <><OpenEye cx={97} /><Path d="M134 100 q9 -11 18 0" stroke={z.ink} strokeWidth={5 * sw} fill="none" strokeLinecap="round" /></>;
    case "sleepy":
      return <Path d="M88 98 q9 8 18 0 M134 98 q9 8 18 0" stroke={z.ink} strokeWidth={5 * sw} fill="none" strokeLinecap="round" />;
    case "starry":
      return (
        <>
          <Path d="M97.0 81.0 L101.2 90.2 L111.3 91.4 L103.8 98.2 L105.8 108.1 L97.0 103.2 L88.2 108.1 L90.2 98.2 L82.7 91.4 L92.8 90.2 Z" fill={z.star} stroke={z.ink} strokeWidth={2.5 * sw} strokeLinejoin="round" />
          <Path d="M143.0 81.0 L147.2 90.2 L157.3 91.4 L149.8 98.2 L151.8 108.1 L143.0 103.2 L134.2 108.1 L136.2 98.2 L128.7 91.4 L138.8 90.2 Z" fill={z.star} stroke={z.ink} strokeWidth={2.5 * sw} strokeLinejoin="round" />
        </>
      );
    case "love":
      return (
        <>
          <Path d="M97 107.0 C79.5 95.75 83.25 82.0 90.75 83.25 C94.5 83.25 97 87.0 97 89.5 C97 87.0 99.5 83.25 103.25 83.25 C110.75 82.0 114.5 95.75 97 107.0 Z" fill={z.heart} stroke={z.ink} strokeWidth={2.5 * sw} strokeLinejoin="round" />
          <Path d="M143 107.0 C125.5 95.75 129.25 82.0 136.75 83.25 C140.5 83.25 143 87.0 143 89.5 C143 87.0 145.5 83.25 149.25 83.25 C156.75 82.0 160.5 95.75 143 107.0 Z" fill={z.heart} stroke={z.ink} strokeWidth={2.5 * sw} strokeLinejoin="round" />
        </>
      );
  }
}

/** Sweat drop (worried). */
export function SweatDrop({ sw }: { sw: number }) {
  return <Path d="M168 66 C168 66 159 79 159 85 A9 9 0 0 0 177 85 C177 79 168 66 168 66 Z" fill="#FFFFFF" stroke={z.ink} strokeWidth={2.5 * sw} />;
}

/** Two floating z's (sleepy). Animated by the caller through the group's transform. */
export function Zs() {
  return (
    <G fill={z.ink}>
      <SvgText x="150" y="20" fontSize={24} fontFamily={fonts.extrabold} fontWeight="900">z</SvgText>
      <SvgText x="170" y="4" fontSize={17} fontFamily={fonts.extrabold} fontWeight="900">z</SvgText>
    </G>
  );
}

/** Volt and pink sparkles (the dazzled/starry full zebra and the recap). */
export function Sparkles({ sw }: { sw: number }) {
  return (
    <G>
      <Path d="M222 48 l4 10 l10 4 l-10 4 l-4 10 l-4 -10 l-10 -4 l10 -4 Z" fill={z.sparkleVolt} stroke={z.ink} strokeWidth={2 * sw} />
      <Path d="M256 84 l3 7 l7 3 l-7 3 l-3 7 l-3 -7 l-7 -3 l7 -3 Z" fill={z.sparklePink} />
    </G>
  );
}

/** The eye centre line (blink scales about y = 96). */
export const EYE_CY = 96;
