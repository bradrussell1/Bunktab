"use client";
import { useEffect, useState } from "react";
import { ZebraBust } from "./Zebra";

const KEY = "bunktab.banner.dismissed";

/** Persistent top banner (ticket B9): white pill, wink bust, one line, an ink Install pill. Dismissal is per browser. */
export function InstallBanner() {
  const [hidden, setHidden] = useState(true);
  useEffect(() => { try { setHidden(localStorage.getItem(KEY) === "1"); } catch { setHidden(false); } }, []);
  if (hidden) return null;
  return (
    <div className="banner" role="region" aria-label="Get the app">
      <div className="pill-bar">
        <ZebraBust mood="wink" size={34} decorative />
        <span className="copy">Get the app for nudges and Venmo close-out</span>
        <a href="/#get" className="pill ink">Install</a>
        <button type="button" className="dismiss" aria-label="Dismiss" onClick={() => { try { localStorage.setItem(KEY, "1"); } catch { /* ignore */ } setHidden(true); }}>×</button>
      </div>
    </div>
  );
}
