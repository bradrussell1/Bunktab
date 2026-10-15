import { Card } from "@/components/ui/Card";
import { CtaZebra } from "./CtaZebra";
import { StoreBadges, type StoreUrls } from "@/components/site/StoreBadges";
import s from "./home.module.css";

export function FinalCta({ urls }: { urls: StoreUrls }) {
  return (
    <section id="get" className="section" aria-labelledby="get-title">
      <Card variant="ink" className={`container ${s.cta}`} style={{ paddingInline: "clamp(32px, 5vw, 64px)" }}>
        <CtaZebra className={s.ctaZebra} />
        <h2 id="get-title" className="display display--band">Create your Dazzle</h2>
        <p>Free on iPhone and Android.</p>
        <StoreBadges urls={urls} location="final_cta" onInk />
      </Card>
    </section>
  );
}
