/**
 * The zebra as a static SVG string: OG images (next/og), favicons, and anywhere the mascot
 * doesn't animate or change mood. Same geometry as Zebra.tsx via geometry.ts.
 */
import type { ZebraMood } from "@bunktab/core";
import { stripeLayout, ZEBRA_STRIPE } from "@bunktab/core";
import { zebra as z } from "@bunktab/theme";
import { bodyFill, BUST_VIEWBOX, ears, eyes, FULL_VIEWBOX, head, legs, mane, neckStripes, nodesToString, outline, shadow, sparkles, strokeScale, sweatDrop, tail, tuft, zs, BODY_PATH } from "./geometry";

export type StaticZebraOptions = {
  variant?: "full" | "bust";
  mood?: ZebraMood;
  members?: number;
  done?: number;
  /** Nominal rendered width in px; only affects the stroke weight rule. */
  size?: number;
  tailUp?: boolean;
  sparkles?: boolean;
  /** Extra attributes on the root <svg>. */
  attrs?: string;
};

export function zebraSvg({ variant = "bust", mood = "hi", members = 6, done = 0, size = 244, tailUp, sparkles: wantSparkles, attrs = "" }: StaticZebraOptions = {}): string {
  const bust = variant === "bust";
  const vb = bust ? BUST_VIEWBOX : FULL_VIEWBOX;
  const sw = strokeScale(size);
  const up = tailUp ?? (!bust && mood === "starry");
  const allIn = members > 0 && done >= members;
  const parts: string[] = [];
  parts.push(`<defs><clipPath id="zs-torso"><rect x="${ZEBRA_STRIPE.clip.x}" y="${ZEBRA_STRIPE.clip.y}" width="${ZEBRA_STRIPE.clip.width}" height="${ZEBRA_STRIPE.clip.height}" rx="${ZEBRA_STRIPE.clip.rx}"/></clipPath><clipPath id="zs-body"><path d="${BODY_PATH}"/></clipPath></defs>`);
  if (!bust) parts.push(nodesToString(shadow()), nodesToString(tail(up, sw)), nodesToString(legs(sw)));
  parts.push(nodesToString(mane(sw)), nodesToString(bodyFill(bust)));
  if (!bust) {
    const stripes = stripeLayout(members, done)
      .map((s) => {
        const x = s.cx - s.width / 2;
        return `<g transform="rotate(${ZEBRA_STRIPE.angleDeg} ${s.cx} ${ZEBRA_STRIPE.pivotY})"><rect x="${x}" y="${ZEBRA_STRIPE.top}" width="${s.width}" height="${ZEBRA_STRIPE.height}" rx="${s.width / 2}" fill="${s.done ? z.ink : z.ghostStripe}"/></g>`;
      })
      .join("");
    parts.push(`<g clip-path="url(#zs-torso)">${stripes}</g>`);
    parts.push(`<g clip-path="url(#zs-body)">${nodesToString(neckStripes(false, sw))}</g>`);
  } else parts.push(nodesToString(neckStripes(true, sw)));
  parts.push(nodesToString(outline(bust, sw)));
  for (const ear of ears(mood, sw)) parts.push(`<g transform="${ear.transform}">${nodesToString(ear.nodes)}</g>`);
  parts.push(nodesToString(head(mood, sw)));
  if (mood === "worried") parts.push(nodesToString(sweatDrop(sw)));
  parts.push(nodesToString(eyes(mood, sw)), nodesToString(tuft(sw)));
  if (!bust && (wantSparkles || (allIn && mood === "starry"))) parts.push(nodesToString(sparkles(sw)));
  if (mood === "sleepy") parts.push(nodesToString(zs()));
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${vb.x} ${vb.y} ${vb.w} ${vb.h}" ${attrs}>${parts.join("")}</svg>`;
}

export const zebraDataUri = (o: StaticZebraOptions = {}) => `data:image/svg+xml;charset=utf-8,${encodeURIComponent(zebraSvg(o))}`;
