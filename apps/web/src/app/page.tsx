import Link from "next/link";

export default function Landing() {
  return (
    <main className="col">
      <header style={{ paddingTop: 24 }}><span className="wordmark"><i />Checkm8</span></header>
      <section className="hero">
        <h1 className="h-large" style={{ fontSize: 40, lineHeight: "46px" }}>Split the trip.<br />Settle in Venmo.</h1>
        <p className="t-body t-muted">One place for everything the group paid for. Everyone logs what they covered, taps Done, and Checkm8 works out the fewest payments to make it even, then opens Venmo pre-filled for each one.</p>
        <div className="badges" id="get">
          <span className="storebadge" aria-disabled="true"><span><small>Coming soon on the</small>App Store</span></span>
          <span className="storebadge" aria-disabled="true"><span><small>Coming soon on</small>Google Play</span></span>
        </div>
      </section>
      <section className="stack" style={{ gap: 16 }}>
        <h2 className="h-title2">How it works</h2>
        <ol className="steps" style={{ padding: 0, margin: 0, listStyle: "none" }}>
          <li className="step"><b>1</b><div><p className="h-headline">Start a trip and invite the group</p><p className="t-cap">Pick people from your contacts. They get a text with a link and can join from the web without installing anything.</p></div></li>
          <li className="step"><b>2</b><div><p className="h-headline">Log what you paid as you go</p><p className="t-cap">Snap the receipt, choose who&apos;s in, split equally, exactly, by percent or shares, or by nights for lodging.</p></div></li>
          <li className="step"><b>3</b><div><p className="h-headline">Tap Done, then settle in Venmo</p><p className="t-cap">When everyone&apos;s done, close-out unlocks with the fewest payments possible. Each one opens Venmo already filled in.</p></div></li>
        </ol>
      </section>
      <section className="card stack" style={{ marginTop: 32 }}>
        <p className="h-headline">Got an invite text?</p>
        <p className="t-cap">Open the link in the message. You&apos;ll verify your phone number and land straight on the trip.</p>
      </section>
      <footer className="t-cap" style={{ paddingTop: 40, display: "flex", gap: 16 }}>
        <span>© {new Date().getFullYear()} Checkm8</span><Link href="/privacy">Privacy</Link><Link href="/terms">Terms</Link>
      </footer>
    </main>
  );
}
