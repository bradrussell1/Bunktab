import Link from "next/link";

/** Landing: dark canvas, one pastel hero carrying the pitch, carbon tiles for the steps. */
export default function Landing() {
  return (
    <main className="col">
      <header className="landing-top">
        <span className="wordmark"><i />Checkm8</span>
        <Link href="#get" className="t-cap-strong">Get the app</Link>
      </header>

      <section className="hero landing-hero" aria-labelledby="pitch">
        <span className="hero-art" aria-hidden="true" />
        <h1 id="pitch" className="pitch">Split the trip.<br />Settle in Venmo.</h1>
        <p className="sub">Everyone logs what they covered, taps Done, and Checkm8 works out the fewest payments to make it even.</p>
        <a href="#how" className="hero-cta" aria-label="See how it works">↗</a>
      </section>

      <section className="stack" style={{ gap: 12, marginTop: 28 }} id="how">
        <h2 className="h-title2">How it works</h2>
        <ol className="steps">
          <li className="step"><b>1</b><div><p className="h-headline">Start a trip and invite the group</p><p className="t-cap">Pick people from your contacts. They get a text with a link and can join from the web without installing anything.</p></div></li>
          <li className="step"><b>2</b><div><p className="h-headline">Log what you paid as you go</p><p className="t-cap">Snap the receipt, choose who&apos;s in, split equally, exactly, by percent or shares, or by nights for lodging.</p></div></li>
          <li className="step"><b>3</b><div><p className="h-headline">Tap Done, then settle in Venmo</p><p className="t-cap">When everyone&apos;s done, close-out unlocks with the fewest payments possible. Each one opens Venmo already filled in.</p></div></li>
        </ol>
      </section>

      <section className="card stack" style={{ marginTop: 20 }} id="get">
        <p className="h-headline">Get the app</p>
        <p className="t-cap">Notifications, receipt scanning and Venmo close-out live in the app. Coming soon to both stores.</p>
        <div className="badges">
          <span className="storebadge" aria-disabled="true"><span><small>Coming soon on the</small>App Store</span></span>
          <span className="storebadge" aria-disabled="true"><span><small>Coming soon on</small>Google Play</span></span>
        </div>
      </section>

      <section className="card stack" style={{ marginTop: 12 }}>
        <p className="h-headline">Got an invite text?</p>
        <p className="t-cap">Open the link in the message. You&apos;ll verify your phone number and land straight on the trip.</p>
      </section>

      <footer className="t-cap" style={{ paddingTop: 40, display: "flex", gap: 16 }}>
        <span>© {new Date().getFullYear()} Checkm8</span><Link href="/privacy">Privacy</Link><Link href="/terms">Terms</Link>
      </footer>
    </main>
  );
}
