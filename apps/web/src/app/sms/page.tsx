import Link from "next/link";
export const metadata = { title: "Text messages from Checkm8" };

/**
 * SMS program disclosure (carrier / toll-free verification requirement):
 * who sends, what, how often, how consent is collected, how to opt out.
 * Linked from the invite step in the app and the landing footer.
 */
const SAMPLE = "Checkm8: Bradley added you to 'Tahoe long weekend' to split trip expenses. Open it: https://www.check-m8.io/i/3f9a1c2e Reply STOP to opt out.";
const CONSENT = "I have these people's permission to send them one text from Checkm8 about this trip. They can reply STOP to opt out. Msg & data rates may apply.";

export default function Sms() {
  return (
    <main className="col legal">
      <p style={{ paddingTop: 24 }}><Link href="/">‹ Checkm8</Link></p>
      <h1 className="h-large" style={{ margin: "24px 0 8px" }}>Text messages from Checkm8</h1>
      <p className="t-cap">Program: Checkm8 trip invites · Sender: Checkm8 (Bradley Russell, sole proprietor) · Last updated {new Date().toISOString().slice(0, 10)}.</p>

      <h2 className="h-title2">What we send</h2>
      <p className="t-body">One invitation text when a friend adds you to a trip in Checkm8. The message names the friend, the trip, and a link to view it. Login codes are a separate, on-request message: you only receive one when you ask to sign in.</p>

      <h2 className="h-title2">How often</h2>
      <p className="t-body">One message per invitation. There are no recurring messages, reminders or marketing texts from this number. Login codes are sent only when you request them.</p>

      <h2 className="h-title2">How consent is collected</h2>
      <p className="t-body">Invitations are sent by a person you know, from inside the app. Before any text goes out, the inviter must tick a required box on the &quot;Invite the group&quot; screen that reads:</p>
      <p className="card t-body" style={{ margin: "12px 0" }}>&ldquo;{CONSENT}&rdquo;</p>
      <p className="t-body">The Create button stays disabled until that box is checked. Each invitation text ends with opt-out instructions, and the sending number honours STOP and HELP automatically. Invitations are capped at 50 per person per day.</p>

      <h2 className="h-title2">Sample message</h2>
      <p className="card t-body" style={{ margin: "12px 0", fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace", fontSize: 14 }}>{SAMPLE}</p>

      <h2 className="h-title2">How to opt out</h2>
      <p className="t-body">Reply <strong>STOP</strong> to any message to stop receiving texts from Checkm8. Reply <strong>HELP</strong> for help. You can also email <a href="mailto:brad@check-m8.io">brad@check-m8.io</a> and we will remove your number.</p>

      <h2 className="h-title2">Rates and delivery</h2>
      <p className="t-body">Message and data rates may apply. Carriers are not liable for delayed or undelivered messages.</p>

      <h2 className="h-title2">Contact</h2>
      <p className="t-body">Checkm8 · Bradley Russell, sole proprietor · <a href="mailto:brad@check-m8.io">brad@check-m8.io</a> · <a href="https://www.check-m8.io">www.check-m8.io</a></p>
      <p className="t-cap" style={{ paddingTop: 16 }}><Link href="/privacy">Privacy policy</Link> · <Link href="/terms">Terms of service</Link></p>
    </main>
  );
}
