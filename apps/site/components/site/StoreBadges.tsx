"use client";
import Image from "next/image";
import { trackEvent } from "@/lib/analytics";
import s from "./storebadges.module.css";

export type StoreUrls = { appStore: string | null; playStore: string | null };

/**
 * Official Apple / Google badges when the listing URLs are set; otherwise a "Coming soon"
 * pill per store (ink on light surfaces, hide on ink). `only` narrows to one platform.
 */
export function StoreBadges({ urls, location, onInk, only, size = "md" }: { urls: StoreUrls; location: string; onInk?: boolean; only?: "ios" | "android"; size?: "md" | "lg" }) {
  const show = (p: "ios" | "android") => !only || only === p;
  return (
    <div className={[s.row, s[size]].join(" ")}>
      {show("ios") ? (
        urls.appStore ? (
          <a className={s.badge} href={urls.appStore} onClick={() => trackEvent({ name: "store_badge_click", store: "app_store", location })} aria-label="Download on the App Store">
            <Image src={onInk ? "/badges/app-store-white.svg" : "/badges/app-store.svg"} alt="" width={120} height={40} className={s.img} unoptimized />
          </a>
        ) : (
          <ComingSoon store="App Store" lead="Coming soon to the" onInk={onInk} icon={<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="6" y="2" width="12" height="20" rx="3" /><path d="M11 18h2" /></svg>} />
        )
      ) : null}
      {show("android") ? (
        urls.playStore ? (
          <a className={s.badge} href={urls.playStore} onClick={() => trackEvent({ store: "google_play", name: "store_badge_click", location })} aria-label="Get it on Google Play">
            <Image src="/badges/google-play.png" alt="" width={135} height={40} className={s.img} unoptimized />
          </a>
        ) : (
          <ComingSoon store="Google Play" lead="Coming soon on" onInk={onInk} icon={<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 3l14 9-14 9z" /></svg>} />
        )
      ) : null}
    </div>
  );
}

function ComingSoon({ store, lead, icon, onInk }: { store: string; lead: string; icon: React.ReactNode; onInk?: boolean }) {
  return (
    <span className={[s.coming, onInk && s.comingOnInk].filter(Boolean).join(" ")} role="status">
      <span className={s.icon} aria-hidden="true">{icon}</span>
      <span className={s.text}><span className={s.lead}>{lead}</span><span className={s.store}>{store}</span></span>
    </span>
  );
}
