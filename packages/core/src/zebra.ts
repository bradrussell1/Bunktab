/**
 * Zebra logic (pure): stripe geometry for the full-body zebra and the mood rules from
 * DESIGN_SYSTEM.md §7. No React, no I/O. The mobile Zebra component and screens call
 * these; tests live in test/zebra.test.ts.
 */

export type ZebraMood = "hi" | "happy" | "wink" | "sleepy" | "starry" | "love" | "worried";

export const ZEBRA_STRIPE = {
  /** Torso clip: rect x 112, y 168, w 162, h 90, r 45 (master viewBox 0 -8 320 330). */
  clip: { x: 112, y: 168, width: 162, height: 90, rx: 45 },
  /** Stripes rotate 10° about (cx, 214). */
  angleDeg: 10,
  pivotY: 214,
  top: 162,
  height: 104,
  /** The six fixed centres for a six-member dazzle. */
  six: [152, 175, 198, 221, 244, 265] as const,
  first: 152,
  last: 265,
  maxWidth: 13,
  maxDrawn: 12,
  /** Stripe width = widthFactor × spacing, capped at maxWidth. The system text says
   *  0.56; the master SVG for 10 members is 7.1 wide at 12.56 spacing, i.e. 0.565, and
   *  the masters win on geometry. */
  widthFactor: 0.565,
} as const;

export type Stripe = { cx: number; width: number; done: boolean };

/**
 * One stripe per member (2–12); 6 members use the fixed centres; above 12 members
 * draw 12 and fill them proportionally (round down; all 12 only when everyone is done).
 * `done` stripes fill left to right.
 */
export function stripeLayout(members: number, done: number): Stripe[] {
  const m = Math.max(0, Math.floor(members));
  const d = Math.min(Math.max(0, Math.floor(done)), m);
  if (m === 0) return [];
  if (m === 1) return [{ cx: (ZEBRA_STRIPE.first + ZEBRA_STRIPE.last) / 2, width: ZEBRA_STRIPE.maxWidth, done: d >= 1 }];
  const drawn = Math.min(m, ZEBRA_STRIPE.maxDrawn);
  const filled = m <= ZEBRA_STRIPE.maxDrawn ? d : d === m ? drawn : Math.floor((d / m) * drawn);
  if (m === 6) return ZEBRA_STRIPE.six.map((cx, i) => ({ cx, width: ZEBRA_STRIPE.maxWidth, done: i < filled }));
  const spacing = (ZEBRA_STRIPE.last - ZEBRA_STRIPE.first) / (drawn - 1);
  const width = Math.min(ZEBRA_STRIPE.maxWidth, round1(ZEBRA_STRIPE.widthFactor * spacing));
  return Array.from({ length: drawn }, (_, i) => ({ cx: round1(ZEBRA_STRIPE.first + spacing * i), width, done: i < filled }));
}

function round1(n: number) {
  return Math.round(n * 10) / 10;
}

/** Progress rule: done < half → hi; half or more but not all → happy; everyone → starry. */
export function progressMood(members: number, done: number): ZebraMood {
  if (members <= 0) return "hi";
  if (done >= members) return "starry";
  if (done * 2 >= members) return "happy";
  return "hi";
}

export type ZebraContext =
  | { place: "home-hero"; netCents: number; openDazzles: number }
  | { place: "home-card"; youOwe: boolean }
  | { place: "dazzle-hero"; members: number; done: number }
  | { place: "stripes"; members: number; done: number }
  | { place: "person-pill-done" }
  | { place: "nights"; unclaimedCents: number }
  | { place: "payment"; paid: boolean }
  | { place: "nudge" }
  | { place: "recap" }
  | { place: "invite" }
  | { place: "login"; profileSaved: boolean }
  | { place: "empty"; kind: "no-dazzles" | "no-past" | "no-results" }
  | { place: "error" };

/**
 * Every mood rule from the §7 table in one place. Screens call this; they never
 * hard-code a mood. Places that show no zebra (a dazzle card you don't owe on)
 * return null.
 */
export function zebraMoodFor(ctx: ZebraContext): ZebraMood | null {
  switch (ctx.place) {
    case "home-hero":
      if (ctx.netCents > 0) return "happy";
      if (ctx.netCents < 0) return "worried";
      return ctx.openDazzles === 0 ? "sleepy" : "hi";
    case "home-card":
      return ctx.youOwe ? "worried" : null;
    case "dazzle-hero":
    case "stripes":
      return progressMood(ctx.members, ctx.done);
    case "person-pill-done":
      return "happy";
    case "nights":
      return ctx.unclaimedCents === 0 ? "sleepy" : "worried";
    case "payment":
      return ctx.paid ? "love" : "hi";
    case "nudge":
      return "happy";
    case "recap":
      return "starry";
    case "invite":
      return "wink";
    case "login":
      return ctx.profileSaved ? "happy" : "hi";
    case "empty":
      return ctx.kind === "no-dazzles" ? "hi" : ctx.kind === "no-past" ? "sleepy" : "worried";
    case "error":
      return "worried";
  }
}

/** "Zebra with 3 of 6 stripes, happy" for accessibilityLabel. */
export function zebraLabel(mood: ZebraMood, members?: number, done?: number): string {
  const stripes = members != null && done != null ? ` with ${done} of ${members} stripes` : "";
  return `Zebra${stripes}, ${mood}`;
}
