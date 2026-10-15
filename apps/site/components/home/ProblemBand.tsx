import { Card } from "@/components/ui/Card";
import s from "./home.module.css";

export function ProblemBand() {
  return (
    <section style={{ paddingInline: "var(--zs-space-24)" }}>
      <Card variant="ink" className={`container ${s.problem}`} style={{ paddingInline: "clamp(32px, 5vw, 64px)" }}>
        <div className={s.problemCopy}>
          <h2 className="display">A paywall after three expenses?<br />On a <span className={s.mark}>trip</span>?</h2>
          <p className="bodyL">Some apps cap free users at a handful of expenses a day. Zebrasplit has no daily limit and no upsell when you need it most.</p>
        </div>
        <ol aria-label="A normal travel day" className={s.day}>
          <li className={s.dayItem}><span>Breakfast tacos</span><span>1</span></li>
          <li className={s.dayItem}><span>Rideshare to the beach</span><span>2</span></li>
          <li className={s.dayItem}><span>Boat rental</span><span>3</span></li>
          <li className={`${s.dayItem} ${s.dayBlocked}`}><span>Groceries · blocked elsewhere</span><span>4</span></li>
          <li className={`${s.dayItem} ${s.dayFree}`}><span>Dinner · still free here</span><span>5</span></li>
        </ol>
      </Card>
    </section>
  );
}
