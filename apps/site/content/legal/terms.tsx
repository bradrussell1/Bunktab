import type { ReactNode } from "react";
import Link from "next/link";
import { legalValue } from "@/content/site";
import { Ph } from "./Ph";
import type { LegalSection } from "./privacy";

export const termsIntro: ReactNode = (
  <p>These Terms of Service ("Terms") are an agreement between you and <Ph k="companyLegalName" /> ("Zebrasplit", "we", "us") and govern your use of the Zebrasplit mobile apps, the website at zebrasplit.com, and related services (the "Service"). By creating an account or using the Service, you agree to these Terms and to our <Link href="/privacy"><b>Privacy Policy</b></Link>. If you don't agree, don't use the Service.</p>
);

export const termsNotice = "Please note: Section 14 contains an arbitration agreement and class action waiver that affect how disputes between you and Zebrasplit are resolved.";

export const termsSections: LegalSection[] = [
  { id: "eligibility", title: "1. Eligibility", body: <p>You must be at least 18 years old, or the age of majority where you live, to use the Service. By using it, you confirm that you meet this requirement and that you're able to enter into these Terms.</p> },
  { id: "your-account", title: "2. Your account", body: <p>You sign in with your mobile phone number and a one-time code. You agree to provide accurate information, keep your phone and account secure, and tell us promptly about any unauthorized use. You're responsible for activity on your account. By providing your number, you agree to receive text messages for verification and service notifications. Message and data rates may apply.</p> },
  { id: "what-zebrasplit-does", title: "3. What Zebrasplit does, and doesn't do", body: (<>
    <p>Zebrasplit is a tool for recording shared expenses, calculating who owes whom, and preparing payment requests. Specifically:</p>
    <ul>
      <li><b>We aren't a bank, money transmitter or payment processor.</b> We never hold, receive, send or transfer funds.</li>
      <li><b>Payments happen outside the Service.</b> When you tap Pay or Request, we open Venmo (or another payment method) with details filled in. Any payment you make is between you and the other person, through that provider, under its own terms.</li>
      <li><b>Balances depend on what users enter.</b> Calculations, receipt scans, currency conversions and suggested payments are provided for convenience. Review them before you pay. We aren't responsible for errors in the information users add or for amounts you choose to send.</li>
      <li><b>We don't settle disputes between users.</b> If you disagree with someone in your group about who owes what, you'll need to work it out together.</li>
      <li><b>We don't give financial, tax or legal advice.</b></li>
    </ul>
  </>) },
  { id: "trips-invites-and-other-people", title: "4. Trips, invites and other people", body: <p>When you create a trip, you become its owner and can invite others, edit trip details and close out the trip. Only invite people you know and who would expect to hear from you. You confirm that you have permission to share the names and phone numbers of the people you invite. Anyone you invite will see the trip's expenses, receipts and balances.</p> },
  { id: "your-content", title: "5. Your content", body: <p>You keep ownership of the content you add, such as trip names, expenses, comments and photos ("Your Content"). You give Zebrasplit a worldwide, non-exclusive, royalty-free license to host, store, process, display and share Your Content only as needed to operate and improve the Service, including showing it to the members of your trips. You're responsible for Your Content and confirm you have the right to share it.</p> },
  { id: "acceptable-use", title: "6. Acceptable use", body: (<>
    <p>You agree not to:</p>
    <ul>
      <li>Use the Service for anything illegal, fraudulent or deceptive, including requesting money you aren't owed.</li>
      <li>Harass, spam or send unwanted invites or messages to others.</li>
      <li>Upload content that is unlawful, abusive, or infringes someone else's rights.</li>
      <li>Impersonate anyone or misrepresent your connection to anyone.</li>
      <li>Interfere with, disrupt, reverse engineer or try to gain unauthorized access to the Service or its systems.</li>
      <li>Use bots, scrapers or automated means to access the Service without our permission.</li>
    </ul>
  </>) },
  { id: "third-party-services", title: "7. Third-party services", body: <p>The Service works with third-party services such as Venmo, app stores, and messaging providers. We don't control them and aren't responsible for them. Your use of them is governed by their own terms and privacy policies. Venmo is a trademark of PayPal, Inc., and Zebrasplit is not affiliated with, endorsed by or sponsored by Venmo or PayPal.</p> },
  { id: "fees", title: "8. Fees", body: <p>The Service is currently free. We may introduce paid features or plans in the future. If we do, we'll tell you the price and terms before you're charged, and you'll choose whether to buy. Purchases made through the App Store or Google Play are subject to their payment and refund policies.</p> },
  { id: "our-intellectual-property", title: "9. Our intellectual property", body: <p>The Service, including its software, design, the Zebrasplit name, logo and zebra character, is owned by Zebrasplit and protected by law. We give you a personal, limited, non-exclusive, non-transferable, revocable license to use the apps for your own non-commercial use, under these Terms. If you send us feedback or ideas, we may use them without any obligation to you.</p> },
  { id: "changes-to-the-service", title: "10. Changes to the Service and ending your use", body: <p>We may change, add or remove features, or suspend or stop the Service, at any time. You can stop using the Service and delete your account whenever you like. We may suspend or end your access if you violate these Terms, create risk or legal exposure for us or others, or if we're required to by law. Sections that by their nature should survive termination will survive, including Sections 5, 9, 11, 12, 13 and 14.</p> },
  { id: "disclaimers", title: "11. Disclaimers", body: <p className="legalCaps">THE SERVICE IS PROVIDED "AS IS" AND "AS AVAILABLE," WITHOUT WARRANTIES OF ANY KIND, WHETHER EXPRESS OR IMPLIED, INCLUDING IMPLIED WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, TITLE AND NON-INFRINGEMENT. WE DON'T WARRANT THAT THE SERVICE WILL BE UNINTERRUPTED, SECURE OR ERROR-FREE, OR THAT CALCULATIONS, RECEIPT SCANS OR CURRENCY CONVERSIONS WILL BE ACCURATE. SOME JURISDICTIONS DON'T ALLOW THESE DISCLAIMERS, SO THEY MAY NOT APPLY TO YOU.</p> },
  { id: "limitation-of-liability", title: "12. Limitation of liability", body: <p className="legalCaps">TO THE FULLEST EXTENT PERMITTED BY LAW, ZEBRASPLIT AND ITS OWNERS, EMPLOYEES AND AGENTS WON'T BE LIABLE FOR ANY INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL OR PUNITIVE DAMAGES, OR ANY LOSS OF PROFITS, DATA OR GOODWILL, OR FOR ANY PAYMENT YOU MAKE, RECEIVE OR FAIL TO RECEIVE FROM ANOTHER USER, ARISING FROM YOUR USE OF THE SERVICE. OUR TOTAL LIABILITY FOR ANY CLAIM RELATING TO THE SERVICE IS LIMITED TO THE GREATER OF $100 OR THE AMOUNT YOU PAID US IN THE 12 MONTHS BEFORE THE CLAIM.</p> },
  { id: "indemnity", title: "13. Indemnity", body: <p>You agree to defend and hold harmless Zebrasplit from claims, losses and expenses (including reasonable legal fees) arising from Your Content, your use of the Service, your dealings with other users, or your violation of these Terms or the law.</p> },
  { id: "disputes-and-arbitration", title: "14. Disputes and arbitration", body: <p>If you have a concern, please contact us first at <Ph k="supportEmail" /> and we'll try to resolve it informally within 60 days. If we can't, you and Zebrasplit agree to resolve any dispute through final and binding individual arbitration administered by <Ph k="arbitrationProvider" /> under its consumer rules, instead of in court, except that either party may bring an individual claim in small claims court. <b>You and Zebrasplit waive any right to a jury trial and to participate in a class action or class-wide arbitration.</b> You may opt out of this arbitration agreement by emailing us within 30 days of first accepting these Terms.</p> },
  { id: "governing-law", title: "15. Governing law", body: <p>These Terms are governed by the laws of the State of <Ph k="governingState" />, without regard to its conflict-of-law rules. For any matter not subject to arbitration, you and Zebrasplit agree to the exclusive jurisdiction of the state and federal courts located in <Ph k="venueCounty" />.</p> },
  { id: "changes-to-these-terms", title: "16. Changes to these Terms", body: <p>We may update these Terms from time to time. If we make material changes, we'll notify you in the app or by other means before they take effect. If you keep using the Service after changes take effect, you accept the updated Terms.</p> },
  { id: "general", title: "17. General", body: <p>These Terms and the Privacy Policy are the entire agreement between you and Zebrasplit about the Service. If any provision is found unenforceable, the rest stays in effect. Our failure to enforce a provision isn't a waiver. You may not transfer these Terms without our consent; we may transfer them in connection with a merger, acquisition or sale of assets.</p> },
  { id: "contact-us", title: "18. Contact us", body: <p>Questions about these Terms? Email <a href={`mailto:${legalValue("supportEmail")}`}><b><Ph k="supportEmail" /></b></a> or write to <Ph k="companyLegalName" />, <Ph k="mailingAddress" />.</p> },
];
