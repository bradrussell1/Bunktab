"use client";
import type { ZebraMood } from "@bunktab/core";
import { useState } from "react";
import { Zebra } from "@/components/zebra";
import { Button } from "@/components/ui/Button";
import { Pill } from "@/components/ui/Pill";
import { Card } from "@/components/ui/Card";
import { StripeMeter } from "@/components/ui/StripeMeter";
import { PersonPill } from "@/components/ui/PersonPill";
import { Accordion } from "@/components/ui/Accordion";
import { Confetti } from "@/components/ui/Confetti";
import { StoreBadges } from "@/components/site/StoreBadges";
import { Nav } from "@/components/site/Nav";
import { Footer } from "@/components/site/Footer";
import { homepageFaq } from "@/content/faq";

const MOODS: ZebraMood[] = ["hi", "happy", "wink", "sleepy", "starry", "love", "worried"];
const row = { display: "flex", flexWrap: "wrap" as const, gap: "var(--zs-space-16)", alignItems: "center" };
const block = { display: "flex", flexDirection: "column" as const, gap: "var(--zs-space-16)", paddingBlock: "var(--zs-space-32)" };

/** Hidden /design route: every component state, every zebra mood, the stripes at 0/3/6, and each animation with replay. */
export function DesignGallery() {
  const [danceKey, setDanceKey] = useState(0);
  const [burst, setBurst] = useState(0);
  const [done, setDone] = useState(0);
  const [pill, setPill] = useState(true);
  const [mood, setMood] = useState<ZebraMood>("hi");
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--zs-space-24)" }}>
      <h1 className="display">Design system</h1>
      <p className="bodyM">Internal review page (noindex). Tokens come from @bunktab/theme via tokens.css.</p>

      <section style={block}><h2 className="display display--feature">Buttons</h2>
        <div style={row}><Button variant="primary" size="lg">Primary · volt</Button><Button variant="ink" size="lg">Ink</Button><Button variant="secondary" size="lg">Secondary</Button><Button variant="locked" size="lg" disabled>Close out · 3 to go</Button></div>
        <div style={row}><Button variant="primary">Primary md</Button><Button variant="ink">Ink md</Button><Button variant="secondary">Secondary md</Button><Button variant="ink" size="sm">Nudge-size</Button></div>
      </section>

      <section style={block}><h2 className="display display--feature">Pills</h2>
        <div style={row}><Pill variant="owed" tabular>+$2,193.10</Pill><Pill variant="owe" tabular>−$142.50</Pill><Pill variant="settled" tabular>$0.00</Pill><Pill variant="white">White</Pill><Pill variant="ink">Ink</Pill><Pill variant="volt">All 6 stripes</Pill><Pill variant="blush">Coming soon</Pill><Pill variant="sand">Sand</Pill><Pill variant="cream">Evenly</Pill></div>
      </section>

      <section style={block}><h2 className="display display--feature">Cards</h2>
        <div style={row}><Card>Card · radius 24</Card><Card variant="hero">Hero · radius 30</Card><Card variant="row">Row · radius 22</Card><Card variant="inset">Inset · cream</Card><Card variant="ink">Ink band</Card><Card variant="volt">Volt band</Card></div>
      </section>

      <section style={block}><h2 className="display display--feature">Stripe meter</h2>
        <div style={row}><StripeMeter members={6} done={0} /><StripeMeter members={6} done={3} /><StripeMeter members={6} done={6} /><StripeMeter members={4} done={2} size="lg" /><StripeMeter members={10} done={7} /><StripeMeter members={14} done={9} /></div>
      </section>

      <section style={block}><h2 className="display display--feature">Person pill</h2>
        <div style={{ maxWidth: 420, display: "flex", flexDirection: "column", gap: 8 }}><PersonPill name="Jen" done={pill} onToggle={() => setPill(!pill)} /><PersonPill name="Priya" done={!pill} onToggle={() => setPill(!pill)} /></div>
      </section>

      <section style={block}><h2 className="display display--feature">Accordion</h2>
        <div style={{ maxWidth: 720 }}><Accordion items={homepageFaq().slice(0, 3)} defaultOpen={homepageFaq()[0]!.id} mode="single" /></div>
      </section>

      <section style={block}><h2 className="display display--feature">Store badges</h2>
        <div style={row}><StoreBadges urls={{ appStore: null, playStore: null }} location="design" /></div>
        <div style={row}><StoreBadges urls={{ appStore: "https://apps.apple.com/", playStore: "https://play.google.com/" }} location="design" /></div>
        <Card variant="ink"><div style={row}><StoreBadges urls={{ appStore: null, playStore: null }} location="design" onInk /><StoreBadges urls={{ appStore: "https://apps.apple.com/", playStore: "https://play.google.com/" }} location="design" onInk /></div></Card>
      </section>

      <section style={block}><h2 className="display display--feature">Zebra · busts, every mood</h2>
        <div style={row}>{MOODS.map((m) => <div key={m} style={{ textAlign: "center" }}><Zebra variant="bust" mood={m} size={120} animate={{ blink: true }} /><div className="caption">{m}</div></div>)}</div>
        <h3 className="display display--feature" style={{ fontSize: "var(--zs-fs-h3)" }}>Full body, every mood</h3>
        <div style={row}>{MOODS.map((m) => <div key={m} style={{ textAlign: "center" }}><Zebra variant="full" mood={m} members={6} done={3} size={160} animate={{ blink: true, swish: true }} /><div className="caption">{m}</div></div>)}</div>
        <h3 className="display display--feature" style={{ fontSize: "var(--zs-fs-h3)" }}>Stripes: 0 / 3 / 6 of 6, plus 4 and 10 members</h3>
        <div style={row}><Zebra variant="full" mood="hi" members={6} done={0} size={200} /><Zebra variant="full" mood="happy" members={6} done={3} size={200} /><Zebra variant="full" mood="starry" members={6} done={6} size={200} /><Zebra variant="full" mood="happy" members={4} done={2} size={200} /><Zebra variant="full" mood="happy" members={10} done={7} size={200} /></div>
      </section>

      <section style={block}><h2 className="display display--feature">Motion</h2>
        <div style={row}>
          <div style={{ textAlign: "center" }}><Zebra variant="bust" mood="hi" size={140} animate={{ blink: true }} /><div className="caption">blink</div></div>
          <div style={{ textAlign: "center" }}><Zebra variant="bust" mood="happy" size={140} animate={{ bob: true }} /><div className="caption">bob</div></div>
          <div style={{ textAlign: "center" }}><Zebra variant="full" mood="happy" size={200} members={6} done={3} animate={{ swish: true }} /><div className="caption">swish</div></div>
          <div style={{ textAlign: "center" }}><Zebra variant="bust" mood="sleepy" size={140} /><div className="caption">z&apos;s</div></div>
          <div style={{ textAlign: "center" }}><Zebra variant="bust" mood={mood} size={140} /><div style={row}>{MOODS.map((m) => <button key={m} type="button" onClick={() => setMood(m)} className="caption">{m}</button>)}</div><div className="caption">mood crossfade</div></div>
        </div>
        <div style={row}>
          <div style={{ position: "relative", textAlign: "center" }}>
            <Zebra variant="full" mood={done >= 6 ? "starry" : done >= 3 ? "happy" : "hi"} members={6} done={done} size={240} animate={{ dance: true, blink: true, swish: true }} danceKey={danceKey} />
            <Confetti fire={burst || null} />
            <div style={row}>
              <Button size="sm" variant="ink" onClick={() => setDanceKey((k) => k + 1)}>Replay dance</Button>
              <Button size="sm" variant="ink" onClick={() => setBurst((b) => b + 1)}>Replay confetti</Button>
              <Button size="sm" variant="secondary" onClick={() => setDone((d) => (d + 1) % 7)}>Stripe grow ({done} of 6)</Button>
            </div>
          </div>
        </div>
      </section>

      <section style={block}><h2 className="display display--feature">Nav and footer</h2><Nav /><Footer /></section>
    </div>
  );
}
