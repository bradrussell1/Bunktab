import { Card } from "@/components/ui/Card";
import { SectionHeading } from "@/components/site/SectionHeading";
import s from "./home.module.css";

const STEPS = [
  { title: "Start a Dazzle", body: <>A group of zebras is a Dazzle. Create the trip, add the dates, and invite participants.</> },
  { title: "Track what you paid", body: <>Track expenses by who paid, how much, and who was in. Split it evenly, by item, or by the nights each person stayed.</> },
  { title: "Earn your stripes, close out", body: <>Tap <b>Done</b> when you&apos;re finished adding. When every stripe is in, Closing out opens Venmo with the person, amount and note pre-filled.</> },
];

export function HowItWorks() {
  return (
    <section id="how" className="section">
      <div className={`container ${s.stack}`} style={{ paddingInline: 0 }}>
        <SectionHeading eyebrow="How it works" title="Three steps. Simplified." max={640} />
        <ol className={s.steps}>
          {STEPS.map((st, i) => (
            <Card as="li" key={st.title} className={s.step}>
              <span className={s.stepNo} aria-hidden="true">{i + 1}</span>
              <h3 className={s.stepTitle}>{st.title}</h3>
              <p className="bodyM">{st.body}</p>
            </Card>
          ))}
        </ol>
      </div>
    </section>
  );
}
