"use client";
import { useEffect, useRef, useState, type ReactNode } from "react";
/** Renders children with `inView` once the element scrolls into view (for one-shot motion). */
export function InView({ children, threshold = 0.4, className }: { children: (inView: boolean) => ReactNode; threshold?: number; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [inView, setInView] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el || inView) return;
    if (!("IntersectionObserver" in window)) { setInView(true); return; }
    const io = new IntersectionObserver((entries) => { if (entries.some((e) => e.isIntersecting)) { setInView(true); io.disconnect(); } }, { threshold });
    io.observe(el);
    return () => io.disconnect();
  }, [inView, threshold]);
  return <div ref={ref} className={className}>{children(inView)}</div>;
}
