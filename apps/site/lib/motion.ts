"use client";
import { useEffect, useState } from "react";

/**
 * The one Reduce Motion check for the site (DESIGN_SYSTEM.md §9). Looping animations
 * (blink, bob, swish, z's) stop when this is true; dance and confetti become a 250 ms
 * fade or an instant state change. Starts false on the server and settles after hydration.
 */
export function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const sync = () => setReduced(mq.matches);
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);
  return reduced;
}
