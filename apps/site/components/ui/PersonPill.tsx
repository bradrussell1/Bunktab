"use client";
import { Zebra } from "@/components/zebra";
import s from "./personpill.module.css";

/**
 * PersonPill (DESIGN_SYSTEM.md §6). Done: ink fill, happy bust in a pink-tint disc, name in
 * white, "Done · Stripe earned" in volt, a white rotated mark on the right. Not done: white
 * with a hairline, dashed initial circle, "Still adding expenses" in muted, a ghost mark.
 */
export function PersonPill({ name, done, onToggle, disabled }: { name: string; done: boolean; onToggle?: () => void; disabled?: boolean }) {
  const initial = name.trim().charAt(0).toUpperCase();
  return (
    <button type="button" className={[s.pill, done && s.done, "pillFocus"].filter(Boolean).join(" ")} aria-pressed={done} onClick={onToggle} disabled={disabled}>
      <span className={s.disc} aria-hidden="true">
        {done ? <Zebra variant="bust" mood="happy" size={32} decorative /> : <span className={s.initial}>{initial}</span>}
      </span>
      <span className={s.name}>{name}</span>
      <span className={s.status}>{done ? "Done · Stripe earned" : "Still adding expenses"}</span>
      <i className={s.mark} aria-hidden="true" />
    </button>
  );
}
