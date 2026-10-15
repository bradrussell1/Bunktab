import { Card } from "@/components/ui/Card";
import s from "./home.module.css";

const Check = () => <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 12l5 5L20 7" /></svg>;

export function FreeBand() {
  return (
    <section className="section">
      <Card variant="volt" className={`container ${s.free}`} style={{ paddingInline: "clamp(32px, 5vw, 64px)" }}>
        <h2 className="display display--band">Free.<br />Actually free.</h2>
        <ul className={s.freeList}>
          <li><Check />No limit on expenses, ever</li>
          <li><Check />We never hold your money. Venmo moves it.</li>
        </ul>
      </Card>
    </section>
  );
}
