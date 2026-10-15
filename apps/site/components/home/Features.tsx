import { Card } from "@/components/ui/Card";
import { Pill } from "@/components/ui/Pill";
import { StripeMeter } from "@/components/ui/StripeMeter";
import { SectionHeading } from "@/components/site/SectionHeading";
import s from "./home.module.css";

export function Features() {
  return (
    <section id="features" className="section">
      <div className={`container ${s.stack}`} style={{ paddingInline: 0 }}>
        <SectionHeading eyebrow="Built for trips" title="The expense sharing app you'll actually enjoy" max={741} />
        <ul className={s.grid}>
          <Card as="li" className={s.feature}>
            <div className={s.mini} role="img" aria-label="Settle up: Mike pays you $84.50, Jen pays you $57.50, Priya pays you $212.00">
              {[["Mike → You", "$84.50"], ["Jen → You", "$57.50"], ["Priya → You", "$212.00"]].map(([who, amt]) => (
                <div key={who} className={s.settleRow}><span>{who}</span><Pill variant="owed" size="sm" tabular>{amt}</Pill></div>
              ))}
            </div>
            <h3 className={s.featureTitle}>One payment each</h3>
            <p className="bodyM">Zebrasplit nets out every expense so most people pay one person, once. Close out opens Venmo pre-filled. You just tap Pay.</p>
          </Card>

          <Card as="li" className={s.feature}>
            <div className={`${s.mini} ${s.nights}`} role="img" aria-label="Who slept where: Apollo and Jen stayed Friday to Sunday, Mike only Saturday and Sunday">
              <span /><span className={s.nightHead}>Fri</span><span className={s.nightHead}>Sat</span><span className={s.nightHead}>Sun</span>
              <span className={s.nightName}>Apollo</span><span className={s.nightOn} /><span className={s.nightOn} /><span className={s.nightOn} />
              <span className={s.nightName}>Jen</span><span className={s.nightOn} /><span className={s.nightOn} /><span className={s.nightOn} />
              <span className={s.nightName}>Mike</span><span className={s.nightOff} /><span className={s.nightOn} /><span className={s.nightOn} />
            </div>
            <h3 className={s.featureTitle}>Who slept where</h3>
            <p className="bodyM">Select the nights each person stayed and the Airbnb splits itself. Showed up Saturday? You pay for Saturday.</p>
          </Card>

          <Card as="li" className={s.feature}>
            <div className={s.mini} role="img" aria-label="Add expense screen: Dinner at Mariscos, $184.00, paid by Jen, split evenly between 4 people">
              <div className={s.miniHead}><span className={s.miniTitle}>Add expense</span><span className={s.miniMeta}>Cabo 2026</span></div>
              <div className={s.amountRow}><span className={s.nightName}>Dinner at Mariscos</span><span className={`${s.amountBig} tabular`}>$184.00</span></div>
              <div className={s.chips}><span className={s.chipLabel}>Paid by</span><span className={s.chip}>Jen</span></div>
              <div className={s.chips}><span className={s.chipLabel}>Split with</span><span className={s.chip}>You</span><span className={s.chip}>Jen</span><span className={s.chip}>Mike</span><span className={s.chip}>Priya</span><span className={s.chipOff}>Sam</span></div>
              <div className={s.segments}><span className={`${s.segment} ${s.segmentOn}`}>Evenly</span><span className={s.segment}>By item</span><span className={s.segment}>By night</span></div>
              <div className={s.each}>$46.00 each</div>
            </div>
            <h3 className={s.featureTitle}>Intuitive group creation, invites, and expense splitting</h3>
            <p className="bodyM">Start a Dazzle, invite the group in seconds, and log an expense in a few taps: who paid, how much, and who was in.</p>
          </Card>

          <Card as="li" className={s.feature}>
            <div className={`${s.mini} ${s.receiptWrap}`}>
              <div className={s.receipt} role="img" aria-label="Receipt: tacos al pastor 14.00 Jen, margarita x2 22.00 Mike, guac 9.00 all, total 51.30">
                <div className={s.receiptLine}><span>Tacos al pastor</span><span>14.00 · Jen</span></div>
                <div className={s.receiptLine}><span>Margarita x2</span><span>22.00 · Mike</span></div>
                <div className={s.receiptLine}><span>Guac</span><span>9.00 · All</span></div>
                <div className={`${s.receiptLine} ${s.receiptTotal}`}><span>TOTAL</span><span className={s.receiptHi}>51.30</span></div>
              </div>
            </div>
            <div className={s.featureTitleRow}><h3 className={s.featureTitle}>Split the receipt by item</h3><Pill variant="blush" size="sm">Coming soon</Pill></div>
            <p className="bodyM">Snap the receipt, everyone taps what they ordered, and tax is shared to match. No more paying for someone else&apos;s steak.</p>
          </Card>

          <Card as="li" className={s.feature}>
            <div className={s.mini} role="img" aria-label="Done toggle switched on for you, 6 of 6 locked in, and the Close out button unlocked">
              <div className={s.doneRow}>
                <span className={s.doneText}><span className={s.doneTitle}>Done adding</span><span className={s.doneSub}>Stripe earned</span></span>
                <span className={s.toggle}><span className={s.knob} /></span>
              </div>
              <div className={s.lockedRow}><StripeMeter members={6} done={6} label={null} /><span className={s.lockedLabel}>6 of 6 locked in</span></div>
              <div className={s.closeOut}>Close out</div>
            </div>
            <h3 className={s.featureTitle}>No confusion when to close out</h3>
            <p className="bodyM">Lock the expenses. Earn your stripe. Signal to the group that you&apos;re done adding. Once the whole Dazzle is locked in, close out.</p>
          </Card>

          <Card as="li" className={s.feature}>
            <div className={`${s.mini} ${s.miniWash}`} role="img" aria-label="Home screen header: Your dazzles, all square at $0.00, with 3 closed trips archived">
              <div className={s.homeHead}>
                <span className={s.homeTitle}>Your dazzles</span>
                <span style={{ display: "flex", gap: "var(--zs-space-6)" }}>
                  <span className={s.iconBtn}><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" /><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" /></svg></span>
                  <span className={s.avatarBtn}>A</span>
                </span>
              </div>
              <div className={s.square}>
                <span style={{ display: "flex", flexDirection: "column", gap: "var(--zs-space-2)" }}><span className={s.squareLabel}>All square</span><span className={`${s.squareAmount} tabular`}>$0.00</span></span>
                <span className={s.squareLabel}>Nothing open</span>
              </div>
              <div className={s.archived}>
                <span className={s.archivedLabel}><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="5" rx="1.5" /><path d="M5 9v9a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V9" /><path d="M10 13h4" /></svg>Archived</span>
                <span className={s.squareLabel}>3 closed dazzles</span>
              </div>
            </div>
            <h3 className={s.featureTitle}>No more lingering expenses</h3>
            <p className="bodyM">Once the group is closed, all previous trip notifications are archived. Access it again at your leisure.</p>
          </Card>
        </ul>
      </div>
    </section>
  );
}
