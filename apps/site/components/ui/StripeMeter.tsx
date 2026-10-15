import { stripeLayout } from "@bunktab/core";
import s from "./stripemeter.module.css";

/**
 * Row of rounded stripes, 8 × 22 at 10°; ink = done, ghost = not (DESIGN_SYSTEM.md §6).
 * One stripe per member; above 12 members the layout rule in @bunktab/core applies.
 */
export function StripeMeter({ members, done, label, size = "sm", className }: { members: number; done: number; label?: string | null; size?: "sm" | "lg"; className?: string }) {
  const stripes = stripeLayout(members, done);
  const text = label === undefined ? `${done} of ${members} done` : label;
  return (
    <span className={[s.meter, s[size], className].filter(Boolean).join(" ")} role="img" aria-label={`${done} of ${members} people are done adding expenses`}>
      <span className={s.row} aria-hidden="true">
        {stripes.map((st, i) => <i key={i} className={[s.stripe, st.done && s.done].filter(Boolean).join(" ")} />)}
      </span>
      {text ? <span className={s.label} aria-hidden="true">{text}</span> : null}
    </span>
  );
}
