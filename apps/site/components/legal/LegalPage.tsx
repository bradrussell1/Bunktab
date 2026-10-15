import type { ReactNode } from "react";
import { Nav } from "@/components/site/Nav";
import { Footer } from "@/components/site/Footer";
import { Ph } from "@/content/legal/Ph";
import type { LegalSection } from "@/content/legal/privacy";
import { warnUnsetPlaceholders } from "@/content/site";
import s from "./legal.module.css";

/** Legal layout: eyebrow "Legal", H1, dates, then numbered <h2> sections in an 820px reading column. */
export function LegalPage({ title, which, intro, notice, sections }: { title: string; which: "privacy" | "terms"; intro: ReactNode; notice?: string; sections: LegalSection[] }) {
  warnUnsetPlaceholders(`/${which}`);
  return (
    <>
      <Nav />
      <main id="main">
        <section className="container">
          <div className={`reading ${s.head}`}>
            <span className="eyebrow">Legal</span>
            <h1 className="display display--legal">{title}</h1>
            <p className={s.dates}>Effective <Ph k="effectiveDate" /> · Last updated <Ph k="lastUpdatedDate" /></p>
          </div>
        </section>
        <section className="container">
          <div className={`reading ${s.content}`}>
            <div className={s.block}>
              {intro}
              {notice ? <p className={s.notice}>{notice}</p> : null}
            </div>
            {sections.map((sec) => (
              <section key={sec.id} id={sec.id} className={s.block} aria-labelledby={`${sec.id}-h`}>
                <h2 id={`${sec.id}-h`} className={s.h2}>{sec.title}</h2>
                {sec.body}
              </section>
            ))}
          </div>
        </section>
      </main>
      <Footer current={which} />
    </>
  );
}
