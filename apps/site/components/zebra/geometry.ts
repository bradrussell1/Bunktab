/**
 * The zebra's geometry, ported from apps/mobile/src/ui/zebra/parts.tsx (itself a hand port
 * of design/zebra/svg/*). Every part is a list of plain SVG nodes so the same data renders
 * as React (Zebra.tsx, animated) and as a string (static.ts, for OG images and icons).
 * Anatomy is locked: nothing here is adjusted per placement. Colours come from theme.zebra.
 */
import type { ZebraMood } from "@bunktab/core";
import { palette, zebra as z } from "@bunktab/theme";

export type SvgNode = { t: "path" | "ellipse" | "circle" | "rect" | "text"; a: Record<string, string | number>; text?: string };

export const FULL_VIEWBOX = { x: 0, y: -8, w: 320, h: 330 } as const;
export const BUST_VIEWBOX = { x: 30, y: -8, w: 200, h: 184 } as const;
export type ViewBox = typeof FULL_VIEWBOX | typeof BUST_VIEWBOX;

export const BODY_PATH = "M124 140 C114 168 110 196 116 222 C122 246 138 258 160 258 L232 258 C258 258 274 240 274 212 C274 186 258 168 236 168 L206 168 C192 168 184 150 186 124 L140 110 Z";
export const NECK_PATH = "M124 140 C114 168 110 196 116 222 L206 222 C192 168 184 150 186 124 L140 110 Z";
const MANE_PATH = "M141.3 52.2 L152.8 50.0 L168.6 45.0 L170.6 61.4 L187.0 60.9 L184.5 77.1 L200.5 80.5 L194.2 95.6 L209.0 102.5 L199.3 115.7 L212.0 124.9 L200.3 134.3 L213.0 138.4 L202.8 146.0 L215.1 143.8 L208.0 154.2 L208.7 163.1 L201.2 171.1 L195.5 165.7 L190.6 159.4 L187.0 152.3 L184.6 144.5 L183.4 135.8 L183.0 126.4 L182.5 117.9 L180.9 109.7 L178.3 101.7 L174.8 94.0 L170.5 86.7 L165.3 80.1 L159.4 74.3 L152.9 69.4 L145.8 65.5 L137.7 62.6 Z";
const TUFT_PATH = "M100 52 C96 40 102 30 112 28 C110 36 116 40 120 34 C120 26 128 20 138 22 C132 30 136 38 144 38 C140 50 124 58 100 52 Z";

/** Tail root (270, 196): the swish rotates about it. */
export const TAIL_ROOT = { x: 270, y: 196 } as const;
/** The eye centre line; blinks scale about it. */
export const EYE_CY = 96;

const path = (d: string, a: Record<string, string | number> = {}): SvgNode => ({ t: "path", a: { d, ...a } });
const ellipse = (cx: number, cy: number, rx: number, ry: number, a: Record<string, string | number> = {}): SvgNode => ({ t: "ellipse", a: { cx, cy, rx, ry, ...a } });
const circle = (cx: number, cy: number, r: number, a: Record<string, string | number> = {}): SvgNode => ({ t: "circle", a: { cx, cy, r, ...a } });
const rect = (x: number, y: number, width: number, height: number, rx: number, a: Record<string, string | number> = {}): SvgNode => ({ t: "rect", a: { x, y, width, height, rx, ...a } });
const stroke = (w: number, extra: Record<string, string | number> = {}) => ({ stroke: z.ink, strokeWidth: w, fill: "none", strokeLinecap: "round", ...extra });

export const shadow = (): SvgNode[] => [ellipse(190, 312, 100, 9, { fill: z.ink, opacity: 0.07 })];

export const tail = (up: boolean, sw: number): SvgNode[] =>
  up
    ? [path("M270 196 C290 190 300 166 296 146", stroke(5 * sw)), path("M288 152 C282 136 288 120 302 118 C310 130 310 146 298 156 Z", { fill: z.ink })]
    : [path("M270 196 C292 200 298 232 288 254", stroke(5 * sw)), path("M280 246 C270 262 276 282 290 286 C302 276 302 258 292 246 Z", { fill: z.ink })];

export function legs(sw: number): SvgNode[] {
  const legs = [[208, 226, 80], [238, 222, 84], [128, 226, 80], [160, 230, 76]] as const;
  const hooves = [[208, 290, 262, 276], [238, 290, 258, 272], [128, 290, 262, 276], [160, 290, 266, 280]] as const;
  return [
    ...legs.map(([x, y, h]) => rect(x, y, 26, h, 13, { fill: z.hide, stroke: z.ink, strokeWidth: 3.5 * sw })),
    ...hooves.flatMap(([x, hoofY, s1, s2]) => [rect(x, hoofY, 26, 18, 9, { fill: z.ink }), rect(x, s1, 26, 7, 3.5, { fill: z.ink }), rect(x, s2, 26, 6, 3, { fill: z.ink })]),
  ];
}

export const mane = (sw: number): SvgNode[] => [path(MANE_PATH, { fill: z.ink, stroke: z.ink, strokeWidth: 6 * sw, strokeLinejoin: "round" })];
export const bodyFill = (bust: boolean): SvgNode[] => [path(bust ? NECK_PATH : BODY_PATH, { fill: z.hide })];
/** The full body's neck stripes are clipped to the body (clip id supplied by the renderer). */
export const neckStripes = (bust: boolean, sw: number): SvgNode[] =>
  bust ? [path("M162 152 Q178 146 192 150", stroke(10 * sw))] : [path("M164 158 Q178 152 192 156 M114 190 Q130 184 146 188", stroke(10 * sw))];
export const outline = (bust: boolean, sw: number): SvgNode[] => [path(bust ? NECK_PATH : BODY_PATH, { fill: "none", stroke: z.ink, strokeWidth: 3.5 * sw, strokeLinejoin: "round" })];

const DROOPY: ZebraMood[] = ["sleepy", "worried"];
const BIG_CHEEKS: ZebraMood[] = ["happy", "starry", "love"];

/** Ears, as [left, right] with their rotation transforms baked in. */
export function ears(mood: ZebraMood, sw: number): { transform: string; nodes: SvgNode[] }[] {
  const tilt = DROOPY.includes(mood) ? 52 : 24;
  return [
    { transform: `rotate(${-tilt} 82 58)`, nodes: [ellipse(82, 40, 15, 27, { fill: z.hide, stroke: z.ink, strokeWidth: 3.5 * sw }), ellipse(82, 44, 7.5, 17, { fill: z.earInner })] },
    { transform: `rotate(${tilt} 158 58)`, nodes: [ellipse(158, 40, 15, 27, { fill: z.hide, stroke: z.ink, strokeWidth: 3.5 * sw }), ellipse(158, 44, 7.5, 17, { fill: z.earInner })] },
  ];
}

export function head(mood: ZebraMood, sw: number): SvgNode[] {
  const big = BIG_CHEEKS.includes(mood);
  return [
    ellipse(120, 98, 60, 54, { fill: z.ink, stroke: z.ink, strokeWidth: 7 * sw }),
    ellipse(120, 140, 42, 28, { fill: z.ink, stroke: z.ink, strokeWidth: 7 * sw }),
    ellipse(120, 98, 60, 54, { fill: z.hide }),
    ellipse(120, 140, 42, 28, { fill: z.muzzle }),
    ellipse(120, 134, 30, 12, { fill: z.muzzleSheen, opacity: 0.7 }),
    path("M104 136 q-3 6 2 9 M136 136 q3 6 -2 9", { stroke: z.nostril, strokeWidth: 4 * sw, fill: "none", strokeLinecap: "round" }),
    ellipse(76, 118, big ? 12 : 10, big ? 7.5 : 6.5, { fill: z.cheek }),
    ellipse(164, 118, big ? 12 : 10, big ? 7.5 : 6.5, { fill: z.cheek }),
  ];
}

export const tuft = (sw: number): SvgNode[] => [path(TUFT_PATH, { fill: z.ink, stroke: z.ink, strokeWidth: 3 * sw, strokeLinejoin: "round" })];

const openEye = (cx: number, small?: boolean): SvgNode[] => [
  ellipse(cx, 96, small ? 7 : 8.5, small ? 8 : 10, { fill: z.ink }),
  circle(cx + 3, 92, small ? 2.6 : 3.2, { fill: palette.white }),
  circle(cx - 2, 100, 1.4, { fill: palette.white }),
];

/** Eyes only; the zebra never has a mouth. */
export function eyes(mood: ZebraMood, sw: number): SvgNode[] {
  switch (mood) {
    case "hi": return [...openEye(97), ...openEye(143)];
    case "worried": return [...openEye(97, true), ...openEye(143, true)];
    case "happy": return [path("M88 100 q9 -11 18 0 M134 100 q9 -11 18 0", stroke(5 * sw))];
    case "wink": return [...openEye(97), path("M134 100 q9 -11 18 0", stroke(5 * sw))];
    case "sleepy": return [path("M88 98 q9 8 18 0 M134 98 q9 8 18 0", stroke(5 * sw))];
    case "starry": return [
      path("M97.0 81.0 L101.2 90.2 L111.3 91.4 L103.8 98.2 L105.8 108.1 L97.0 103.2 L88.2 108.1 L90.2 98.2 L82.7 91.4 L92.8 90.2 Z", { fill: z.star, stroke: z.ink, strokeWidth: 2.5 * sw, strokeLinejoin: "round" }),
      path("M143.0 81.0 L147.2 90.2 L157.3 91.4 L149.8 98.2 L151.8 108.1 L143.0 103.2 L134.2 108.1 L136.2 98.2 L128.7 91.4 L138.8 90.2 Z", { fill: z.star, stroke: z.ink, strokeWidth: 2.5 * sw, strokeLinejoin: "round" }),
    ];
    case "love": return [
      path("M97 107.0 C79.5 95.75 83.25 82.0 90.75 83.25 C94.5 83.25 97 87.0 97 89.5 C97 87.0 99.5 83.25 103.25 83.25 C110.75 82.0 114.5 95.75 97 107.0 Z", { fill: z.heart, stroke: z.ink, strokeWidth: 2.5 * sw, strokeLinejoin: "round" }),
      path("M143 107.0 C125.5 95.75 129.25 82.0 136.75 83.25 C140.5 83.25 143 87.0 143 89.5 C143 87.0 145.5 83.25 149.25 83.25 C156.75 82.0 160.5 95.75 143 107.0 Z", { fill: z.heart, stroke: z.ink, strokeWidth: 2.5 * sw, strokeLinejoin: "round" }),
    ];
  }
}

export const sweatDrop = (sw: number): SvgNode[] => [path("M168 66 C168 66 159 79 159 85 A9 9 0 0 0 177 85 C177 79 168 66 168 66 Z", { fill: palette.white, stroke: z.ink, strokeWidth: 2.5 * sw })];

export const zs = (): SvgNode[] => [
  { t: "text", a: { x: 150, y: 20, fontSize: 24, fontWeight: 800, fill: z.ink, fontFamily: "inherit" }, text: "z" },
  { t: "text", a: { x: 170, y: 4, fontSize: 17, fontWeight: 800, fill: z.ink, fontFamily: "inherit" }, text: "z" },
];

export const sparkles = (sw: number): SvgNode[] => [
  path("M222 48 l4 10 l10 4 l-10 4 l-4 10 l-4 -10 l-10 -4 l10 -4 Z", { fill: z.sparkleVolt, stroke: z.ink, strokeWidth: 2 * sw }),
  path("M256 84 l3 7 l7 3 l-7 3 l-3 7 l-3 -7 l-7 -3 l7 -3 Z", { fill: z.sparklePink }),
];

/** Outline weight: thicker below ~200 px so the ink stays crisp (same rule as the app). */
export const strokeScale = (size: number) => (size >= 200 ? 1 : size >= 120 ? 1.25 : 1.6);
export const BLINKING: ZebraMood[] = ["hi", "worried", "wink"];
export const MOODS: ZebraMood[] = ["hi", "happy", "wink", "sleepy", "starry", "love", "worried"];

const kebab = (s: string) => s.replace(/[A-Z]/g, (c) => "-" + c.toLowerCase());
/** Serialise nodes to SVG markup (for OG images and icons). */
export function nodesToString(nodes: SvgNode[]): string {
  return nodes
    .map((n) => {
      const attrs = Object.entries(n.a).map(([k, v]) => `${kebab(k)}="${v}"`).join(" ");
      return n.text != null ? `<${n.t} ${attrs}>${n.text}</${n.t}>` : `<${n.t} ${attrs}/>`;
    })
    .join("");
}
