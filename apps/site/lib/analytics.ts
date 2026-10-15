"use client";
import { track } from "@vercel/analytics";

/** The four custom events from the build prompt. No cookies; Vercel Analytics is cookieless. */
export type SiteEvent =
  | { name: "store_badge_click"; store: "app_store" | "google_play"; location: string }
  | { name: "join_cta_click"; action: "join" | "browser" }
  | { name: "faq_open"; id: string }
  | { name: "stripes_demo_complete" };

export function trackEvent(e: SiteEvent) {
  const { name, ...props } = e;
  try {
    track(name, props as Record<string, string>);
  } catch {
    // analytics must never break the page
  }
}
