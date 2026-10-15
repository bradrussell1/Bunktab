import { Zebra } from "@/components/zebra";
import { Pill } from "@/components/ui/Pill";
import { StripeMeter } from "@/components/ui/StripeMeter";
import { StoreBadges, type StoreUrls } from "@/components/site/StoreBadges";
import s from "./home.module.css";

export function Hero({ urls }: { urls: StoreUrls }) {
  return (
    <section className="container">
      <div id="top" className={s.hero}>
        <div className={s.heroCopy}>
          <span className={s.badge}><span className={s.dot} aria-hidden="true" />Free. No expense limits.</span>
          <h1 className="display display--hero">Split the trip.<br />Not the friendship.</h1>
          <p className={`lead ${s.heroSub}`}><b>Keep the dazzle organized.</b> Track the tab, earn your stripes, and when it&apos;s time to close out, everyone pays exactly once via Venmo.</p>
          <div className={s.badges}><StoreBadges urls={urls} location="hero" /></div>
          <p className={s.heroNote}>Friends can join from a link. No download needed.</p>
        </div>
        <div className={s.heroMock}><PhoneMock /></div>
      </div>
    </section>
  );
}

/** The "Your dazzles" home screen, built from the kit (never an image). */
export function PhoneMock() {
  return (
    <div className={s.phone} role="img" aria-label="Zebrasplit app showing Your dazzles: you're owed $2,193.10">
      <div className={s.screen} aria-hidden="true">
        <div className={s.screenTitle}>Your dazzles</div>
        <div className={s.balance}>
          <div className={s.balanceLabel}>You&apos;re owed</div>
          <div className={`${s.balanceAmount} tabular`}>+$2,193.10</div>
          <div className={s.balanceMeta}>across 2 open dazzles</div>
          <Zebra variant="bust" mood="happy" size={104} animate={{ bob: true }} decorative className={s.balanceZebra} />
        </div>
        <div className={`${s.trip}`} style={{ borderRadius: "var(--zs-radius-row)", background: "var(--zs-white)", padding: "var(--zs-space-14)" }}>
          <div className={s.tripRow}>
            <div><div className={s.tripName}>Cabo 2026</div><div className={s.tripMeta}>Mar 12 – 16 · 6 people</div></div>
            <Pill variant="owed" size="sm" tabular>+$2,193.10</Pill>
          </div>
          <div className={s.meterRow}><StripeMeter members={6} done={4} label={null} /><span className={s.tripMeta} style={{ fontWeight: 600 }}>4 of 6 done</span></div>
        </div>
        <div className={s.tripRow} style={{ borderRadius: "var(--zs-radius-row)", background: "var(--zs-white)", padding: "var(--zs-space-14)" }}>
          <div><div className={s.tripName}>Tahoe cabin</div><div className={s.tripMeta}>Jan 9 – 11 · 4 people</div></div>
          <Pill variant="owe" size="sm" tabular>−$142.50</Pill>
        </div>
        <div className={s.tripRow} style={{ borderRadius: "var(--zs-radius-row)", background: "var(--zs-white)", padding: "var(--zs-space-14)" }}>
          <div><div className={s.tripName}>Nashville weekend</div><div className={s.tripMeta}>Settled · 8 people</div></div>
          <Pill variant="settled" size="sm" tabular>$0.00</Pill>
        </div>
        <div className={s.startCta}>+ Start a dazzle</div>
      </div>
    </div>
  );
}
