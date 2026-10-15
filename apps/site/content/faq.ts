/**
 * The FAQ (design/reference/site/FAQ.dc.html), word for word. The /faq page and the homepage
 * preview both read from here, and the FAQPage JSON-LD is generated from it.
 */
export type FaqItem = { section: string; id: string; question: string; answer: string; list?: readonly string[] };
export type FaqSection = { id: string; title: string; items: FaqItem[] };

const S = (id: string, title: string, items: [string, string, string, (readonly string[])?][]): FaqSection => ({
  id,
  title,
  items: items.map(([qid, question, answer, list]) => ({ section: id, id: qid, question, answer, ...(list ? { list } : {}) })),
});

export const faqSections: FaqSection[] = [
  S("start", "Getting started", [
    ["what-is-zebrasplit", "What is Zebrasplit?", "An app for splitting group trip costs. Everyone logs what they paid, taps Done when they’re finished, and the group settles up in Venmo with the fewest payments possible."],
    ["what-is-a-dazzle", "What’s a “dazzle”?", "A group of zebras is called a dazzle. In Zebrasplit, it’s your trip: the people, the expenses and the stripes."],
    ["what-do-the-stripes-mean", "What do the stripes mean?", "Each stripe on the zebra is a person who’s finished adding expenses. When the zebra has all its stripes, the group can settle up."],
    ["how-do-i-invite-people", "How do I invite people?", "Pick them from your contacts or type a phone number. They get a text with a link and can join from the app or straight from their browser."],
    ["do-my-friends-need-to-download-the-app", "Do my friends need to download the app?", "No. They can open the invite link in a browser, verify their phone number, add expenses and tap Done. The app adds nudges and the one-tap Venmo payments."],
    ["why-do-i-log-in-with-my-phone-number", "Why do I log in with my phone number?", "There’s no password to forget. Your number also links you automatically to any trip you were already invited to."],
  ]),
  S("adding", "Adding expenses", [
    ["is-there-a-limit", "Is there a limit on how many expenses I can add?", "No. Log as many as the trip needs."],
    ["ways-to-split-a-cost", "What are the ways to split a cost?", "Five ways:", ["Evenly", "Exact amounts", "Percentages", "Shares (e.g. a family counts as 2)", "By nights stayed, for lodging"]],
    ["how-does-the-receipt-scan-work", "How does the receipt scan work?", "Snap a photo and Zebrasplit reads the total and fills it in. You can always correct it, and the photo stays on the expense as proof."],
    ["why-do-i-add-the-tip-separately", "Why do I add the tip separately?", "Receipts usually print before you write in the tip, so the tip gets its own field and is added on top of the total."],
    ["how-does-who-slept-where-work", "How does “Who slept where” work?", "Tap the nights each person stayed. Each night’s cost is shared only by the people there that night, so late arrivals pay less automatically."],
    ["can-we-use-different-currencies", "Can we use different currencies?", "Yes. Log in any currency. The exchange rate locks when you save, and everything settles in the trip’s main currency."],
    ["can-i-add-expenses-with-no-signal", "Can I add expenses with no signal?", "Yes. They’re saved on your phone and sync when you’re back online."],
  ]),
  S("done", "Done and closing out", [
    ["what-does-tapping-done-do", "What does tapping “Done” do?", "It tells the group you’ve finished adding expenses and earns your stripe. Close-out unlocks when everyone has tapped Done."],
    ["why-did-my-stripe-disappear", "Someone added an expense after I tapped Done. Why did my stripe disappear?", "The totals changed, so Zebrasplit asks you to take another look before signing off. That way nobody agrees to numbers they haven’t seen."],
    ["what-if-someone-never-taps-done", "What if someone never taps Done?", "Send a nudge, and Zebrasplit sends gentle reminders too. If they still don’t respond, the trip owner can close out anyway."],
    ["why-only-one-or-two-payments", "Why do I only have one or two payments to make?", "Zebrasplit works out the smallest number of payments that settles everyone up, so you usually pay one person instead of five."],
  ]),
  S("money", "Money and Venmo", [
    ["does-zebrasplit-handle-my-money", "Does Zebrasplit handle my money?", "No. Zebrasplit never touches or holds money and never asks for bank or card details. The Pay button opens Venmo with the amount and note already filled in, and you send it there."],
    ["do-i-need-venmo", "Do I need Venmo?", "Venmo makes settling one tap. If you pay another way, such as cash or Zelle, just mark the payment as paid."],
    ["how-do-i-know-someone-paid-me", "How do I know someone actually paid me?", "They mark the payment as paid, and you can confirm with “Got it”. The trip shows as settled once every payment is marked."],
  ]),
  S("privacy", "Privacy and security", [
    ["who-can-see-my-trip-and-receipts", "Who can see my trip and receipts?", "Only the people in that trip. Receipt photos are stored privately and deleted when the trip is deleted."],
    ["does-the-ai-keep-my-receipt-photos", "Does the AI keep my receipt photos?", "The photo is read to pull out the total and isn’t used to train AI models."],
    ["do-you-sell-my-data-or-contacts", "Do you sell my data or contacts?", "No. Contacts are used only to invite people you choose."],
  ]),
  S("pricing", "Pricing", [
    ["is-zebrasplit-free", "Is Zebrasplit free?", "Yes, everything described here is free. Paid extras may come later, but splitting and settling will stay easy."],
  ]),
  S("after", "After the trip", [
    ["what-happens-when-the-trip-is-over", "What happens when the trip is over?", "Once everyone’s settled, the trip moves to Past and you get a recap: total, cost per person, biggest expense and who fronted the most. Inactive trips also move to Past automatically after 14 days."],
    ["can-i-share-the-recap", "Can I share the recap?", "Yes. Export it as an image and send it to the group chat."],
  ]),
];

export const faqItems: FaqItem[] = faqSections.flatMap((s) => s.items);
export const faqById = (id: string) => faqItems.find((f) => f.id === id);

/** The five questions the homepage preview shows (build prompt §4), in this order. */
export const homepageFaqIds = ["is-zebrasplit-free", "does-zebrasplit-handle-my-money", "do-my-friends-need-to-download-the-app", "what-if-someone-never-taps-done", "how-does-who-slept-where-work"] as const;
export const homepageFaq = (): FaqItem[] => homepageFaqIds.map((id) => faqById(id)!).filter(Boolean);
