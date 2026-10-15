"use client";
import { useEffect, useId, useState, type ReactNode } from "react";
import { useReducedMotion } from "@/lib/motion";
import { trackEvent } from "@/lib/analytics";
import s from "./accordion.module.css";

export type AccordionItem = { id: string; question: string; answer: ReactNode; list?: readonly string[] };

/**
 * Real <button aria-expanded aria-controls> per question; panels animate height with a
 * grid-rows transition (instant under Reduce Motion). `/faq#<id>` opens that question.
 */
export function Accordion({ items, defaultOpen = null, mode = "multiple", headingLevel = 3 }: { items: AccordionItem[]; defaultOpen?: string | null; mode?: "single" | "multiple"; headingLevel?: 2 | 3 }) {
  const [open, setOpen] = useState<Set<string>>(() => new Set(defaultOpen ? [defaultOpen] : []));
  const reduced = useReducedMotion();
  const base = useId();
  const H = `h${headingLevel}` as "h2" | "h3";

  useEffect(() => {
    const id = decodeURIComponent(window.location.hash.slice(1));
    if (id && items.some((it) => it.id === id)) {
      setOpen((prev) => (mode === "single" ? new Set([id]) : new Set([...prev, id])));
      requestAnimationFrame(() => document.getElementById(id)?.scrollIntoView({ block: "start", behavior: reduced ? "auto" : "smooth" }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const toggle = (id: string) => {
    setOpen((prev) => {
      const isOpen = prev.has(id);
      if (!isOpen) trackEvent({ name: "faq_open", id });
      if (mode === "single") return isOpen ? new Set() : new Set([id]);
      const next = new Set(prev);
      if (isOpen) next.delete(id); else next.add(id);
      return next;
    });
  };

  return (
    <div className={s.list}>
      {items.map((it) => {
        const isOpen = open.has(it.id);
        const panelId = `${base}-${it.id}`;
        return (
          <div key={it.id} id={it.id} className={[s.item, isOpen && s.open].filter(Boolean).join(" ")}>
            <H className={s.h}>
              <button type="button" className={s.trigger} aria-expanded={isOpen} aria-controls={panelId} onClick={() => toggle(it.id)}>
                <span className={s.q}>{it.question}</span>
                <span className={s.icon} aria-hidden="true">{isOpen ? "−" : "+"}</span>
              </button>
            </H>
            <div id={panelId} role="region" aria-labelledby={undefined} className={s.panel} data-reduced={reduced ? "" : undefined} hidden={!isOpen && reduced ? true : undefined}>
              <div className={s.panelInner}>
                <div className={s.body}>
                  <p className={s.a}>{it.answer}</p>
                  {it.list?.length ? (
                    <ul className={s.pills}>
                      {it.list.map((li) => <li key={li} className={s.pillItem}>{li}</li>)}
                    </ul>
                  ) : null}
                </div>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
