import { Accordion } from "@/components/ui/Accordion";
import { Button } from "@/components/ui/Button";
import { homepageFaq } from "@/content/faq";
import s from "./home.module.css";

export function FaqPreview() {
  const items = homepageFaq();
  return (
    <section id="faq" className="section" aria-labelledby="faq-title">
      <div className={s.faqPreview}>
        <h2 id="faq-title" className="display">FAQ</h2>
        <Accordion items={items} defaultOpen={items[0]?.id ?? null} mode="single" />
        <Button variant="ink" size="md" href="/faq" className={s.seeAll} iconEnd={<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--zs-volt)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14" /><path d="M13 6l6 6-6 6" /></svg>}>See all FAQs</Button>
      </div>
    </section>
  );
}
