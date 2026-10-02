import Link from "next/link";
export const metadata = { title: "Terms" };
export default function Terms() {
  return (
    <main className="col legal">
      <p style={{ paddingTop: 24 }}><Link href="/">‹ Bunktab</Link></p>
      <h1 className="h-large" style={{ margin: "24px 0 8px" }}>Terms of service</h1>
      <p className="t-cap">Placeholder. Replace before launch. Last updated {new Date().toISOString().slice(0, 10)}.</p>
      <h2 className="h-title2">The service</h2>
      <p className="t-body">Bunktab helps groups track shared expenses and work out who owes whom. It prepares payments for Venmo but does not send, receive or hold money and cannot see whether a payment completed. Amounts marked paid are self-reported by members.</p>
      <h2 className="h-title2">Your account</h2>
      <p className="t-body">You sign in with your phone number. Keep your device secure; activity under your number is treated as yours. You must be at least 18 or the age of majority where you live.</p>
      <h2 className="h-title2">Acceptable use</h2>
      <p className="t-body">Don&apos;t use Bunktab to harass, spam or defraud. Invites are rate-limited. We may suspend accounts that abuse the service.</p>
      <h2 className="h-title2">Text messages and invitations</h2>
      <p className="t-body">When you add people to a trip, Bunktab sends each person who does not already have a Bunktab account one text message inviting them to that trip, from our toll-free number. People who already use Bunktab are added to the trip and notified in the app instead; they receive no text. By ticking &quot;I agree to the Terms &amp; Conditions&quot; on the invite screen you confirm that you have these people&apos;s permission to have Bunktab text them about the trip. One message is sent per invitation; there are no recurring or marketing messages. Recipients can reply STOP at any time to opt out and HELP for help. Message and data rates may apply; carriers are not liable for delayed or undelivered messages. Full details, the sample message and our contact address are at <Link href="/sms">bunktab.com/sms</Link>.</p>
      <h2 className="h-title2">No warranty</h2>
      <p className="t-body">Bunktab is provided as is. Check the figures before you pay; we are not liable for payments made in Venmo or elsewhere.</p>
      <h2 className="h-title2">Contact</h2>
      <p className="t-body">brad@bunktab.com</p>
    </main>
  );
}
