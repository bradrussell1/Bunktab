"use client";
import { Button } from "@/components/ui/Button";
import { StoreBadges, type StoreUrls } from "@/components/site/StoreBadges";
import { trackEvent } from "@/lib/analytics";
import s from "./join.module.css";

/** Join → the platform's store (or "Coming soon" pills); Continue in browser → the web guest view. */
export function JoinButtons({ storeHref, browserHref, platform, urls }: { storeHref: string | null; browserHref: string; platform: "ios" | "android" | "other"; urls: StoreUrls }) {
  return (
    <div className={s.actions}>
      {storeHref ? (
        <Button variant="primary" size="lg" full href={storeHref} onClick={() => trackEvent({ name: "join_cta_click", action: "join" })}>Join</Button>
      ) : platform === "other" && (urls.appStore || urls.playStore) ? (
        <StoreBadges urls={urls} location="join" size="lg" />
      ) : (
        <div className={s.coming}><StoreBadges urls={{ appStore: null, playStore: null }} location="join" only={platform === "other" ? undefined : platform} /></div>
      )}
      <Button variant="secondary" size="lg" full href={browserHref} onClick={() => trackEvent({ name: "join_cta_click", action: "browser" })}>Continue in browser</Button>
    </div>
  );
}
