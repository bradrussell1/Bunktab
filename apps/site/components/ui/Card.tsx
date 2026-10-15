import type { CSSProperties, ElementType, ReactNode } from "react";
import s from "./card.module.css";

/** White cards (radius card/hero), ink bands, the volt band, and cream inset panels. */
export function Card({ as: Tag = "div", variant = "card", className, style, children, id }: { as?: ElementType; variant?: "card" | "hero" | "row" | "inset" | "ink" | "volt" | "band"; className?: string; style?: CSSProperties; children: ReactNode; id?: string }) {
  return <Tag id={id} className={[s.base, s[variant], className].filter(Boolean).join(" ")} style={style}>{children}</Tag>;
}
