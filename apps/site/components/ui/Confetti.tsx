"use client";
/**
 * Confetti (DESIGN_SYSTEM.md §9): 16 rounded 8 × 22 stripes in ink, volt and pink thrown from
 * a point along 8 fixed trajectories, rotating up to ±220°, scaling 0.3 → 1 and fading, 1.5 s,
 * with a second wave 220 ms later. Rendered only while `fire` is set; nothing under Reduce Motion.
 */
import { useReducedMotion } from "@/lib/motion";
import s from "./confetti.module.css";

const TRAJECTORIES: [number, number][] = [[150, -110], [-150, -110], [110, -150], [-110, -150], [60, -170], [-60, -170], [170, -40], [-170, -40]];
const TONES = ["ink", "volt", "pink"] as const;

export function Confetti({ fire }: { fire: number | string | null }) {
  const reduced = useReducedMotion();
  if (!fire || reduced) return null;
  return (
    <span key={String(fire)} className={s.stage} aria-hidden="true">
      {Array.from({ length: 16 }, (_, i) => {
        const [tx, ty] = TRAJECTORIES[i % 8]!;
        const wave = i >= 8 ? 1 : 0;
        const rot = ((i * 73) % 440) - 220;
        const style = { "--tx": `${tx + wave * 18}px`, "--ty": `${ty + wave * 14}px`, "--rot": `${rot}deg`, "--wave": wave } as React.CSSProperties;
        return <i key={i} className={`${s.piece} ${s[TONES[i % 3]!]}`} style={style} />;
      })}
    </span>
  );
}
