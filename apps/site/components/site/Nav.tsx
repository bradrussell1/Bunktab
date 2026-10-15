import Link from "next/link";
import { Zebra } from "@/components/zebra";
import { Wordmark } from "./Wordmark";
import s from "./nav.module.css";

/** Logo → /, Features → /#features, FAQ → /faq, volt "Get the app" → /#get. Links wrap on phones; no hamburger. */
export function Nav({ current }: { current?: "home" | "faq" }) {
  return (
    <header className={s.header}>
      <nav aria-label="Main" className={`container ${s.nav}`}>
        <Link href="/" className={s.logo} aria-label="Zebrasplit home">
          <Zebra variant="bust" mood="hi" size={40} decorative />
          <Wordmark />
        </Link>
        <div className={s.links}>
          <Link href="/#features" className={s.link}>Features</Link>
          <Link href="/faq" className={s.link} aria-current={current === "faq" ? "page" : undefined}>FAQ</Link>
          <Link href="/#get" className={`${s.cta} pillFocus`}>Get the app</Link>
        </div>
      </nav>
    </header>
  );
}
