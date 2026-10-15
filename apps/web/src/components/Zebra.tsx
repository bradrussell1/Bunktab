import type { ZebraMood } from "@bunktab/core";
import { BUST, BUST_VIEWBOX } from "./zebraArt";

/**
 * The zebra bust on the web: the master artwork inlined as SVG, colours from the
 * --zs-zebra-* tokens (design/zebra/svg → scripts/build-zebra-art.mjs). Same seven
 * moods as the app. Decorative busts pass `decorative` and are hidden from readers.
 */
export function ZebraBust({ mood, size = 64, label, decorative = false, bob = false, className }: { mood: ZebraMood; size?: number; label?: string; decorative?: boolean; bob?: boolean; className?: string }) {
  const h = Math.round((size * 184) / 200);
  return (
    <span
      className={["zebra", bob ? "bob" : "", className ?? ""].filter(Boolean).join(" ")}
      style={{ width: size, height: h }}
      role={decorative ? undefined : "img"}
      aria-hidden={decorative || undefined}
      aria-label={decorative ? undefined : label ?? `Zebra, ${mood}`}
    >
      <svg viewBox={BUST_VIEWBOX} width={size} height={h} dangerouslySetInnerHTML={{ __html: BUST[mood] }} />
    </span>
  );
}
