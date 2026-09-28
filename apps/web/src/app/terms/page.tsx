import Link from "next/link";
export const metadata = { title: "Terms" };
export default function Terms() {
  return (
    <main className="col legal">
      <p style={{ paddingTop: 24 }}><Link href="/">‹ Checkm8</Link></p>
      <h1 className="h-large" style={{ margin: "24px 0 8px" }}>Terms of service</h1>
      <p className="t-cap">Placeholder. Replace before launch. Last updated {new Date().toISOString().slice(0, 10)}.</p>
      <h2 className="h-title2">The service</h2>
      <p className="t-body">Checkm8 helps groups track shared expenses and work out who owes whom. It prepares payments for Venmo but does not send, receive or hold money and cannot see whether a payment completed. Amounts marked paid are self-reported by members.</p>
      <h2 className="h-title2">Your account</h2>
      <p className="t-body">You sign in with your phone number. Keep your device secure; activity under your number is treated as yours. You must be at least 18 or the age of majority where you live.</p>
      <h2 className="h-title2">Acceptable use</h2>
      <p className="t-body">Don&apos;t use Checkm8 to harass, spam or defraud. Invites are rate-limited. We may suspend accounts that abuse the service.</p>
      <h2 className="h-title2">No warranty</h2>
      <p className="t-body">Checkm8 is provided as is. Check the figures before you pay; we are not liable for payments made in Venmo or elsewhere.</p>
      <h2 className="h-title2">Contact</h2>
      <p className="t-body">legal@checkm8.app (placeholder).</p>
    </main>
  );
}
