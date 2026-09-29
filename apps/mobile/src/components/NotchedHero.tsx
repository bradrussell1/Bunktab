import { theme } from "@checkm8/theme";
import { useState, type ReactNode } from "react";
import { View, type LayoutChangeEvent, type StyleProp, type ViewStyle } from "react-native";
import Svg, { ClipPath, Defs, LinearGradient, Path, Rect, Stop } from "react-native-svg";

/**
 * A pastel hero with one corner cut away so a round or pill-shaped action
 * sits in the dark gap, the card edge flowing around it (the reference's
 * inverted-radius "notch"). The card is one SVG path: rounded rect, and at
 * `corner` a convex fillet → concave arc around the slot (inflated by
 * `gap`) → convex fillet back onto the edge, so the outline is a smooth
 * S-curve with no kinks. The slot itself is rendered by `renderSlot`,
 * absolutely positioned flush to the card's outer bounds.
 *
 * Geometry is computed in a "top-right" frame and mirrored into the other
 * corners through the clip path's transform; the gradient is painted on an
 * untransformed rect, so it always runs top-left → bottom-right.
 */
export type NotchCorner = "tr" | "br" | "bl" | "tl";

type Props = {
  corner: NotchCorner;
  /** Slot size (the button's outer box). Width is re-measured from the slot if it renders wider. */
  slotWidth: number;
  slotHeight: number;
  gap?: number;
  fillet?: number;
  renderSlot: () => ReactNode;
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  /** Padding for the content layer; defaults to the hero's padding. */
  contentStyle?: StyleProp<ViewStyle>;
};

const { colors, radius, spacing, elevation } = theme;

/** Path for the card in a frame where the notch is top-right. */
function notchPath(W: number, H: number, R: number, sw: number, sh: number, g: number, f: number): string {
  const r = sh / 2 + g;                       // inflated slot radius
  const cy = sh / 2;
  const clx = W - sw + sh / 2;                // left arc centre of the (stadium) slot
  const crx = W - sh / 2;                     // right arc centre
  const d = r + f;                            // fillet centre ↔ slot centre distance
  // fillet off the top edge: centre (fx, f), tangent to y=0 and to the left slot circle
  const fx = clx - Math.sqrt(Math.max(0, d * d - (f - cy) * (f - cy)));
  const px = fx + (clx - fx) * (f / d), py = f + (cy - f) * (f / d);
  // fillet off the right edge: centre (W - f, gy), tangent to x=W and to the right slot circle
  const gy = cy + Math.sqrt(Math.max(0, d * d - (W - f - crx) * (W - f - crx)));
  const qx = (W - f) + (crx - (W - f)) * (f / d), qy = gy + (cy - gy) * (f / d);
  const bottom = cy + r;                      // straight run under a pill (zero-length for a circle)
  const n = (v: number) => Math.round(v * 100) / 100;
  return [
    `M ${n(R)} 0`,
    `L ${n(fx)} 0`,
    `A ${n(f)} ${n(f)} 0 0 1 ${n(px)} ${n(py)}`,          // convex fillet, turning down
    `A ${n(r)} ${n(r)} 0 0 0 ${n(clx)} ${n(bottom)}`,     // concave, around the slot's left arc
    `L ${n(crx)} ${n(bottom)}`,
    `A ${n(r)} ${n(r)} 0 0 0 ${n(qx)} ${n(qy)}`,          // concave, around the slot's right arc
    `A ${n(f)} ${n(f)} 0 0 1 ${n(W)} ${n(gy)}`,           // convex fillet onto the right edge
    `L ${n(W)} ${n(H - R)}`,
    `A ${n(R)} ${n(R)} 0 0 1 ${n(W - R)} ${n(H)}`,
    `L ${n(R)} ${n(H)}`,
    `A ${n(R)} ${n(R)} 0 0 1 0 ${n(H - R)}`,
    `L 0 ${n(R)}`,
    `A ${n(R)} ${n(R)} 0 0 1 ${n(R)} 0`,
    "Z",
  ].join(" ");
}

function mirror(corner: NotchCorner, W: number, H: number): string | undefined {
  switch (corner) {
    case "tr": return undefined;
    case "br": return `translate(0, ${H}) scale(1, -1)`;
    case "bl": return `translate(${W}, ${H}) scale(-1, -1)`;
    case "tl": return `translate(${W}, 0) scale(-1, 1)`;
  }
}

export function NotchedHero({ corner, slotWidth, slotHeight, gap = 10, fillet = 14, renderSlot, children, style, contentStyle }: Props) {
  const [size, setSize] = useState({ w: 0, h: 0 });
  const [measured, setMeasured] = useState<{ w: number; h: number } | null>(null);
  // the measured slot wins once it has laid out; the props are the first-frame guess
  const sw = measured?.w ?? slotWidth;
  const sh = measured?.h ?? slotHeight;
  const onLayout = (e: LayoutChangeEvent) => { const { width, height } = e.nativeEvent.layout; if (width !== size.w || height !== size.h) setSize({ w: width, h: height }); };
  const onSlotLayout = (e: LayoutChangeEvent) => { const { width, height } = e.nativeEvent.layout; if (width !== measured?.w || height !== measured?.h) setMeasured({ w: width, h: height }); };
  const ready = size.w > 0 && size.h > 0;
  const R = radius.hero;
  const slotPos: ViewStyle = corner === "tr" ? { top: 0, right: 0 } : corner === "br" ? { bottom: 0, right: 0 } : corner === "bl" ? { bottom: 0, left: 0 } : { top: 0, left: 0 };
  const [g1, g2, g3] = colors.hero.gradient;

  return (
    <View style={[{ borderRadius: R }, elevation.sm, style]} onLayout={onLayout}>
      {ready && (
        <Svg width={size.w} height={size.h} style={{ position: "absolute", left: 0, top: 0 }} pointerEvents="none">
          <Defs>
            <LinearGradient id="mesh" x1="0" y1="0" x2={size.w} y2={size.h} gradientUnits="userSpaceOnUse">
              <Stop offset="0" stopColor={g1} />
              <Stop offset="0.5" stopColor={g2} />
              <Stop offset="1" stopColor={g3} />
            </LinearGradient>
            <ClipPath id="notch">
              <Path d={notchPath(size.w, size.h, R, sw, sh, gap, fillet)} transform={mirror(corner, size.w, size.h)} />
            </ClipPath>
          </Defs>
          <Rect x="0" y="0" width={size.w} height={size.h} fill="url(#mesh)" clipPath="url(#notch)" />
        </Svg>
      )}
      <View style={[{ padding: spacing.xl }, contentStyle]}>{children}</View>
      <View style={[{ position: "absolute" }, slotPos]} onLayout={onSlotLayout}>{renderSlot()}</View>
    </View>
  );
}

/** How far content must stay from the notched corner: the slot plus the gap and fillet. */
export function notchInset(slotWidth: number, slotHeight: number, gap = 10, fillet = 14): { width: number; height: number } {
  return { width: slotWidth + gap + fillet, height: slotHeight + gap + fillet };
}
