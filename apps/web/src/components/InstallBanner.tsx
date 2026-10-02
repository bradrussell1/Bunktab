"use client";
import { useEffect, useState } from "react";

const KEY = "bunktab.banner.dismissed";

/** Persistent recommendation to install the app (spec: Web guest view). Dismissal is per browser. */
export function InstallBanner() {
  const [hidden, setHidden] = useState(true);
  useEffect(() => { try { setHidden(localStorage.getItem(KEY) === "1"); } catch { setHidden(false); } }, []);
  if (hidden) return null;
  return (
    <div className="banner" role="region" aria-label="Get the app">
      <div className="inner">
        <span>Notifications and Venmo close-out live in the app. <a href="/#get">Get the app</a></span>
        <button type="button" aria-label="Dismiss" onClick={() => { try { localStorage.setItem(KEY, "1"); } catch { /* ignore */ } setHidden(true); }}>×</button>
      </div>
    </div>
  );
}
