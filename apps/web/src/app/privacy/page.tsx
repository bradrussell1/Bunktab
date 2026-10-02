import Link from "next/link";
export const metadata = { title: "Privacy" };
export default function Privacy() {
  return (
    <main className="col legal">
      <p style={{ paddingTop: 24 }}><Link href="/">‹ Bunktab</Link></p>
      <h1 className="h-large" style={{ margin: "24px 0 8px" }}>Privacy policy</h1>
      <p className="t-cap">Placeholder. Replace before launch. Last updated {new Date().toISOString().slice(0, 10)}.</p>
      <h2 className="h-title2">What we collect</h2>
      <p className="t-body">Your phone number (to sign you in and match invites), the display name and optional photo and Venmo username you enter, and the trips, expenses, receipts and comments you and your trip mates create.</p>
      <h2 className="h-title2">What we don&apos;t collect</h2>
      <p className="t-body">Bunktab never touches money. We do not collect bank, card or payment-account details. Venmo payments happen in Venmo under Venmo&apos;s terms. Your contact list is read on your device only; only the numbers you pick to invite are sent to us.</p>
      <h2 className="h-title2">Who can see your data</h2>
      <p className="t-body">Only members of a trip can see that trip. Receipt photos are stored privately and served only to trip members. We do not sell personal data.</p>
      <h2 className="h-title2">SMS / Text messaging</h2>
      <p className="t-body">We collect your phone number to sign you in and to match trip invitations to you. When a trip member invites friends, the numbers they pick are sent to us and used only to send that one invitation text (see <Link href="/sms">how Bunktab texts work</Link>); the inviter must first confirm they have those people&apos;s permission. Login codes are sent only when you request them. We do not share phone numbers with third parties for marketing, and we do not send marketing texts. Reply STOP to any message to opt out, or email <a href="mailto:brad@bunktab.com">brad@bunktab.com</a>. Message and data rates may apply.</p>
      <h2 className="h-title2">Your rights</h2>
      <p className="t-body">You can delete your account from inside the app. Deletion removes your personal data and anonymizes your name on shared trips so other members&apos; totals stay correct. California residents may request access to or deletion of their data at any time.</p>
      <h2 className="h-title2">Contact</h2>
      <p className="t-body"><a href="mailto:brad@bunktab.com">brad@bunktab.com</a></p>
    </main>
  );
}
