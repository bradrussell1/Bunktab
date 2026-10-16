import Link from "next/link";
import { ZebraBust } from "@/components/Zebra";

/** Landing: the zebra over the lowercase wordmark and the line, three plain steps, the store note. Black and white; one volt action. */
export default function Landing() {
  return (
    <main className="col">
      <header className="topbar">
        <span className="t-wordmark">zebrasplit</span>
        <Link href="#get" className="pill white">Get the app</Link>
      </header>

      <section className="landing-hero" aria-labelledby="pitch">
        <ZebraBust mood="hi" size={160} label="Zebra" bob />
        <h1 id="pitch" className="t-title1" style={{ marginTop: "var(--zs-space-8)" }}>Split the trip.<br />Keep it black and white.</h1>
        <p className="t-body t-soft" style={{ maxWidth: "36ch" }}>Everyone logs what they covered, taps Done to earn their stripe, and Zebrasplit works out the fewest payments to make it even.</p>
      </section>

      <section className="stack" style={{ marginTop: "var(--zs-space-24)" }} id="how">
        <h2 className="t-title2 col-text">How it works</h2>
        <ol className="steps">
          <li className="step card"><span className="n">1</span><div className="stack-tight"><p className="t-headline">Start a Dazzle and invite the group</p><p className="t-caption t-muted">Pick people from your contacts. They get a text with a link and can join from the web without installing anything.</p></div></li>
          <li className="step card"><span className="n">2</span><div className="stack-tight"><p className="t-headline">Log what you paid as you go</p><p className="t-caption t-muted">Snap the receipt, choose who&apos;s in, split equally, exactly, by percent or shares, or by nights for lodging.</p></div></li>
          <li className="step card"><span className="n">3</span><div className="stack-tight"><p className="t-headline">Earn your stripes, then settle in Venmo</p><p className="t-caption t-muted">When everyone&apos;s done, close-out unlocks with the fewest payments possible. Each one opens Venmo already filled in.</p></div></li>
        </ol>
      </section>

      <section className="card stack" style={{ marginTop: "var(--zs-space-20)" }} id="get">
        <p className="t-headline">Get the app</p>
        <p className="t-caption t-muted">Nudges, receipt reading and Venmo close-out live in the app. Coming soon to both stores.</p>
        <div className="chips">
          <span className="pill outline" aria-disabled="true">App Store · coming soon</span>
          <span className="pill outline" aria-disabled="true">Google Play · coming soon</span>
        </div>
      </section>

      <section className="card stack" style={{ marginTop: "var(--zs-space-12)" }}>
        <p className="t-headline">Got an invite text?</p>
        <p className="t-caption t-muted">Open the link in the message. You&apos;ll verify your phone number and land straight on the Dazzle.</p>
      </section>

      <footer className="t-caption t-muted row" style={{ paddingTop: "var(--zs-space-40)", gap: "var(--zs-space-16)", flexWrap: "wrap" }}>
        <span>© {new Date().getFullYear()} Zebrasplit</span><Link href="/privacy" className="t-link">Privacy</Link><Link href="/terms" className="t-link">Terms</Link><Link href="/sms" className="t-link">Texting</Link>
      </footer>
    </main>
  );
}
