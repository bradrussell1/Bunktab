import type { ReactNode } from "react";
import s from "./pill.module.css";

/** Amount and status pills. owed = volt + ink; owe = blush + blushText; settled = no pill, plain ink. */
export type PillVariant = "owed" | "owe" | "settled" | "white" | "ink" | "volt" | "blush" | "sand" | "cream";

export function Pill({ variant = "white", size = "md", className, children, tabular, ariaLabel }: { variant?: PillVariant; size?: "sm" | "md" | "lg"; className?: string; children: ReactNode; tabular?: boolean; ariaLabel?: string }) {
  return <span className={[s.pill, s[variant], s[size], tabular && "tabular", className].filter(Boolean).join(" ")} aria-label={ariaLabel}>{children}</span>;
}
