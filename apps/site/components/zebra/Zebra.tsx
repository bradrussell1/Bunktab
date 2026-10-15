"use client";
/**
 * The zebra for the web (DESIGN_SYSTEM.md §7), ported from apps/mobile/src/ui/zebra with
 * the same props. One inline <svg>; motion is CSS (zebra.module.css) driven by the motion
 * tokens; every mood's eye group is mounted and crossfades over 250 ms; a body stripe is a
 * ghost rect with an ink rect that scales down from its top edge (460 ms spring-pop) when
 * that member is done. Everything looping stops under Reduce Motion.
 */
import type { ZebraMood } from "@bunktab/core";
import { stripeLayout, zebraLabel, ZEBRA_STRIPE } from "@bunktab/core";
import { zebra as z } from "@bunktab/theme";
import { createElement, useId, type CSSProperties } from "react";
import { useReducedMotion } from "@/lib/motion";
import { BLINKING, bodyFill, BODY_PATH, BUST_VIEWBOX, ears, eyes, FULL_VIEWBOX, head, legs, mane, MOODS, neckStripes, outline, shadow, sparkles, strokeScale, sweatDrop, TAIL_ROOT, tail, tuft, zs, type SvgNode } from "./geometry";
import s from "./zebra.module.css";

export type ZebraProps = {
  variant?: "full" | "bust";
  mood?: ZebraMood;
  /** Full only: members in the dazzle and how many are done. */
  members?: number;
  done?: number;
  /** Rendered width in px; height follows the viewBox. */
  size?: number;
  animate?: { blink?: boolean; bob?: boolean; swish?: boolean; dance?: boolean; sparkles?: boolean };
  /** Change this to replay the dance. */
  danceKey?: number | string;
  /** Tail up (the dazzled pose). Defaults to true when every stripe is in. */
  tailUp?: boolean;
  label?: string;
  /** Decorative zebras (inside pills, next to a heading) are hidden from screen readers. */
  decorative?: boolean;
  className?: string;
  style?: CSSProperties;
};

const cx = (...c: (string | false | undefined | null)[]) => c.filter(Boolean).join(" ");
const render = (nodes: SvgNode[]) => nodes.map((n, i) => createElement(n.t, { key: i, ...n.a }, n.text));

export function Zebra({ variant = "full", mood = "hi", members = 6, done = 0, size = 244, animate, danceKey = 0, tailUp, label, decorative, className, style }: ZebraProps) {
  const reduced = useReducedMotion();
  const uid = useId().replace(/[^a-zA-Z0-9]/g, "");
  const torsoClip = `zs-torso-${uid}`;
  const bodyClip = `zs-body-${uid}`;
  const bust = variant === "bust";
  const vb = bust ? BUST_VIEWBOX : FULL_VIEWBOX;
  const height = size * (vb.h / vb.w);
  const sw = strokeScale(size);
  const stripes = stripeLayout(members, done);
  const allIn = members > 0 && done >= members;
  const up = tailUp ?? (!bust && mood === "starry");
  const blinks = !!animate?.blink && !reduced && BLINKING.includes(mood);
  const swishes = !!animate?.swish && !reduced && !bust;
  const bobs = !!animate?.bob && !reduced;
  const dances = !!animate?.dance && !reduced;
  const a11yLabel = label ?? zebraLabel(mood, bust ? undefined : members, bust ? undefined : done);

  return (
    <span
      className={cx(s.root, className)}
      style={{ width: size, height, ...style }}
      role={decorative ? undefined : "img"}
      aria-label={decorative ? undefined : a11yLabel}
      aria-hidden={decorative ? true : undefined}
      data-reduced={reduced ? "" : undefined}
      data-mood={mood}
    >
      <span key={String(danceKey)} className={cx(s.layer, dances && s.dance)}>
        <svg className={cx(s.svg, bobs && s.bob)} width={size} height={height} viewBox={`${vb.x} ${vb.y} ${vb.w} ${vb.h}`} focusable="false" aria-hidden="true">
          <defs>
            <clipPath id={torsoClip}><rect x={ZEBRA_STRIPE.clip.x} y={ZEBRA_STRIPE.clip.y} width={ZEBRA_STRIPE.clip.width} height={ZEBRA_STRIPE.clip.height} rx={ZEBRA_STRIPE.clip.rx} /></clipPath>
            <clipPath id={bodyClip}><path d={BODY_PATH} /></clipPath>
          </defs>
          {!bust ? render(shadow()) : null}
          {!bust ? (
            <g className={cx(swishes && s.swish)} style={{ transformOrigin: `${TAIL_ROOT.x - vb.x}px ${TAIL_ROOT.y - vb.y}px` }}>{render(tail(up, sw))}</g>
          ) : null}
          {!bust ? render(legs(sw)) : null}
          {render(mane(sw))}
          {render(bodyFill(bust))}
          {!bust ? (
            <g clipPath={`url(#${torsoClip})`}>
              {stripes.map((st, i) => {
                const x = st.cx - st.width / 2;
                return (
                  <g key={`${members}-${i}`} transform={`rotate(${ZEBRA_STRIPE.angleDeg} ${st.cx} ${ZEBRA_STRIPE.pivotY})`}>
                    <rect x={x} y={ZEBRA_STRIPE.top} width={st.width} height={ZEBRA_STRIPE.height} rx={st.width / 2} fill={z.ghostStripe} />
                    <rect className={s.stripeInk} x={x} y={ZEBRA_STRIPE.top} width={st.width} height={ZEBRA_STRIPE.height} rx={st.width / 2} fill={z.ink} style={{ transform: st.done ? "scaleY(1)" : "scaleY(0)", transitionDelay: `${i * 40}ms` }} />
                  </g>
                );
              })}
            </g>
          ) : null}
          {bust ? render(neckStripes(true, sw)) : <g clipPath={`url(#${bodyClip})`}>{render(neckStripes(false, sw))}</g>}
          {render(outline(bust, sw))}
          {ears(mood, sw).map((ear, i) => <g key={i} transform={ear.transform}>{render(ear.nodes)}</g>)}
          {render(head(mood, sw))}
          {MOODS.map((m) => (
            <g key={m} className={s.fade} style={{ opacity: m === mood ? 1 : 0 }}>
              {m === "worried" ? render(sweatDrop(sw)) : null}
              <g className={cx(BLINKING.includes(m) && blinks && s.blink)}>{render(eyes(m, sw))}</g>
            </g>
          ))}
          {render(tuft(sw))}
          {!bust && (animate?.sparkles || (allIn && mood === "starry")) ? render(sparkles(sw)) : null}
          {mood === "sleepy" ? <g className={cx(!reduced && s.zz)}>{render(zs())}</g> : null}
        </svg>
      </span>
    </span>
  );
}
