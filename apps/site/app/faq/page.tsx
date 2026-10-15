import type { Metadata } from "next";
import { Nav } from "@/components/site/Nav";
import { Footer } from "@/components/site/Footer";
import { Accordion } from "@/components/ui/Accordion";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Zebra } from "@/components/zebra";
import { faqItems, faqSections } from "@/content/faq";
import { supportMailto } from "@/content/site";
import s from "./faq.module.css";

export const metadata: Metadata = {
  title: "FAQ",
  description: "Questions? We've got stripes. How Zebrasplit splits trip costs, what the stripes mean, and how settling up in Venmo works.",
  alternates: { canonical: "/faq" },
};

export default function FaqPage() {
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faqItems.map((f) => ({
      "@type": "Question",
      name: f.question,
      acceptedAnswer: { "@type": "Answer", text: f.list ? `${f.answer} ${f.list.join(", ")}.` : f.answer },
    })),
  };
  const firstId = faqSections[0]?.items[0]?.id ?? null;
  return (
    <>
      <Nav current="faq" />
      <main id="main">
        <section className="container">
          <div className={s.head}>
            <div className={s.headCopy}>
              <span className="eyebrow">FAQ</span>
              <h1 className="display display--page">Questions?<br />We&apos;ve got stripes.</h1>
            </div>
            <Zebra variant="bust" mood="wink" size={190} animate={{ blink: true }} decorative className={s.headZebra} />
          </div>
        </section>
        <section className="container" style={{ paddingTop: "var(--zs-space-32)" }}>
          <div className={s.sections}>
            {faqSections.map((sec) => (
              <div key={sec.id} className={s.section} id={`section-${sec.id}`}>
                <div className={s.sectionHead}>
                  <h2 className={s.sectionTitle}>{sec.title}</h2>
                  <span className={s.count}>{sec.items.length} {sec.items.length === 1 ? "question" : "questions"}</span>
                </div>
                <div className={s.sectionBody}>
                  <Accordion items={sec.items} defaultOpen={sec.id === faqSections[0]?.id ? firstId : null} mode="multiple" />
                </div>
              </div>
            ))}
          </div>
        </section>
        <section className="section" style={{ paddingTop: 96 }}>
          <Card variant="ink" className={`container ${s.stuck}`} style={{ paddingInline: "clamp(32px, 5vw, 56px)" }}>
            <div className={s.stuckCopy}>
              <h2 className="display display--feature">Still have a question?</h2>
              <p className="body" style={{ color: "var(--zs-hairline)", lineHeight: 1.55 }}>Send it our way and a real person will get back to you.</p>
            </div>
            <Button variant="primary" size="lg" href={supportMailto()} icon={<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="5" width="18" height="14" rx="3" /><path d="M3 7l9 6 9-6" /></svg>}>Email support</Button>
          </Card>
        </section>
      </main>
      <Footer />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
    </>
  );
}
