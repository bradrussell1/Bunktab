"use client";
import { progressMood } from "@bunktab/core";
import { useEffect, useRef, useState } from "react";
import { Zebra } from "@/components/zebra";
import { Confetti } from "@/components/ui/Confetti";
import { PersonPill } from "@/components/ui/PersonPill";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { trackEvent } from "@/lib/analytics";
import s from "./home.module.css";

const NAMES = ["Apollo", "Jen", "Mike", "Priya", "Sam", "Dev"] as const;
const START = [true, true, true, false, true, false];

/**
 * Earn your stripes: six PersonPill toggles drive the full zebra. Progress rule from
 * @bunktab/core; at 6 of 6 the zebra goes starry, dances once, confetti fires and the
 * locked button becomes the volt Close out link.
 */
export function StripesDemo() {
  const [done, setDone] = useState<boolean[]>(START);
  const [burst, setBurst] = useState(0);
  const wasAll = useRef(false);
  const count = done.filter(Boolean).length;
  const all = count === NAMES.length;
  const mood = progressMood(NAMES.length, count);

  useEffect(() => {
    if (all && !wasAll.current) {
      setBurst((b) => b + 1);
      trackEvent({ name: "stripes_demo_complete" });
    }
    wasAll.current = all;
  }, [all]);

  return (
    <section className="section" aria-labelledby="stripes-title">
      <Card variant="band" className={`container ${s.demo}`} style={{ paddingInline: "clamp(28px, 5vw, 64px)" }}>
        <div className={s.stage}>
          <Zebra variant="full" mood={mood} members={NAMES.length} done={count} size={320} animate={{ blink: true, swish: true, dance: all }} danceKey={burst} label={`Zebra with ${count} of 6 stripes, ${mood}`} />
          <Confetti fire={burst || null} />
          <div className={s.stageLabel} aria-live="polite">{count} of 6 stripes earned</div>
        </div>
        <div className={s.demoCopy}>
          <span className="eyebrow">Try it · tap a friend</span>
          <h2 id="stripes-title" className="display display--feature">Earn your Stripes</h2>
          <p className="body" style={{ lineHeight: 1.55 }}><b>Nobody settles up until everyone has finished adding expenses</b>. That means no &quot;<i>wait, I forgot the gas</i>&quot; after you&apos;ve already paid.</p>
          <ul className={s.people}>
            {NAMES.map((n, i) => (
              <li key={n}><PersonPill name={n} done={done[i]!} onToggle={() => setDone((d) => d.map((v, j) => (j === i ? !v : v)))} /></li>
            ))}
          </ul>
          {all ? (
            <Button variant="primary" size="lg" href="#get" className={s.demoCta}>Close out · pay Mike $84.50 in Venmo</Button>
          ) : (
            <Button variant="locked" size="lg" disabled className={s.demoCta}>Close out unlocks at 6 of 6</Button>
          )}
        </div>
      </Card>
    </section>
  );
}
