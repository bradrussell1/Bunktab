import Link from "next/link";
import { Wordmark } from "./Wordmark";
import s from "./footer.module.css";

export function Footer({ current }: { current?: "privacy" | "terms" }) {
  return (
    <footer className={s.footer}>
      <div className={`container ${s.inner}`}>
        <div className={s.brand}>
          <Wordmark size="footer" />
          <span className={s.legal}>© 2026 Zebrasplit. Venmo is a trademark of PayPal, Inc. Zebrasplit is not affiliated with Venmo.</span>
        </div>
        <nav aria-label="Footer" className={s.links}>
          <Link href="/privacy" className={s.link} aria-current={current === "privacy" ? "page" : undefined}>Privacy</Link>
          <Link href="/terms" className={s.link} aria-current={current === "terms" ? "page" : undefined}>Terms</Link>
          <Link href="/faq" className={s.link}>Support</Link>
          {/* Press kit: placeholder until the kit exists (see report). */}
          <span className={`${s.link} ${s.placeholder}`} aria-disabled="true">Press kit<span className="srOnly"> (coming soon)</span></span>
        </nav>
      </div>
    </footer>
  );
}
