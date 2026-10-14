import { useEffect, useState } from "react";
import { AccessibilityInfo } from "react-native";

/**
 * The one Reduce Motion check (DESIGN_SYSTEM.md §9). Every looping animation
 * (blink, bob, swish, twinkle, z's, live dot) stops when this is true; dance,
 * confetti and boop become a 250 ms fade; instant state changes stay.
 */
export function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    let alive = true;
    AccessibilityInfo.isReduceMotionEnabled().then((v) => { if (alive) setReduced(v); }).catch(() => {});
    const sub = AccessibilityInfo.addEventListener("reduceMotionChanged", setReduced);
    return () => { alive = false; sub.remove(); };
  }, []);
  return reduced;
}
