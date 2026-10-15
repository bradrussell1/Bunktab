import type { ReactNode } from "react";
import s from "./sectionheading.module.css";
export function SectionHeading({ eyebrow, title, size = "section", max, id }: { eyebrow?: string; title: ReactNode; size?: "section" | "feature"; max?: number; id?: string }) {
  return (
    <div className={s.wrap} style={max ? { maxWidth: max } : undefined}>
      {eyebrow ? <span className="eyebrow">{eyebrow}</span> : null}
      <h2 id={id} className={`display display--${size}`}>{title}</h2>
    </div>
  );
}
