> **Product renamed Bunktab on 2026-10-01; references to Checkm8 below are historical.**

# Checkm8 — V1 Product Spec

Sep 28, 2026 · @Apollo

## Overview

V1 is a mobile app that lets a group log shared trip expenses, confirm they are finished, and settle up in Venmo with the fewest payments possible. The app is called Checkm8.

**The problem.** Splitwise has made its free tier hard to use for trips. Free users are capped at roughly 3 to 4 expenses per day, and receipt scanning, currency conversion, charts and search sit behind a paywall of about $5 per month. A normal travel day hits that cap by lunch. Splitwise also never knows when a group is finished logging, so settling up drags on for weeks.

**What makes this different.**

- A "Done adding expenses" gate: close-out only unlocks once every member confirms they are finished.
- One-tap close-out into Venmo, with the recipient, amount and note pre-filled.
- Unlimited expenses, receipt photo reading and multi-currency in the base product, with no daily cap.
- Nights-based lodging splits for people who arrive late or leave early.

**V1 principles.**

1. The app holds expense data and login credentials only. No bank accounts, cards or money movement.
2. Venmo does the paying. The app only prepares the payment.
3. Invitees can take part through a web link without installing the app, though installing is recommended.
4. Every change to money is visible and traceable.

## Core user flow

Every trip moves through six steps, and close-out stays locked until the whole group has tapped Done.

&#91;embedded content: trip lifecycle · 6 steps, 1 gate, 2 loops\]

1. **Create a trip.** Title, optional description, invite members.
2. **Add expenses.** Anyone in the group logs what they paid and who it covers.
3. **Tap Done.** A badge appears next to your name.
4. **Get nudged if needed.** A reminder goes out after 24 hours of inactivity without Done, or when everyone else is done but you.
5. **Close out.** Once every member has the badge, the Close out button unlocks and opens Venmo with the payment pre-filled. If someone never responds, the trip owner can override the gate.
6. **Mark as paid.** If you paid outside the button, or later, you record it yourself.

A late expense added after someone tapped Done clears their badge and sends them a notification, so nobody signs off on totals that changed.

## Design system

V1 is built on the [Pretty Good Cross-Platform Mobile Design System](https://www.figma.com/design/c1PpW4Mh3PHXQmat3KhWQS/Pretty-Good-Cross-Platform-Mobile-Design-System---UI-kit--Community-?node-id=90-2) for components, type and spacing, re-colored with the Basalt & Spore palette as a light theme on a warm cream background.

### What the kit provides

- **37 component groups** across four areas: Controls, Views, Bars and System.
- **iOS and Android variants** for status bars, home indicators and platform controls, which fits the Expo build.
- **Inter** as the single typeface, with a named type scale.
- **Tokens** for spacing, padding, corner radius, elevation and color, named by role (for example `fill/primary`, `text/onBackground/secondary`).

The kit ships in a light blue theme. We keep its components, type and spacing exactly, and replace only its color values.

### Palette: Basalt & Spore

| Color | Hex | Role in the app |
| --- | --- | --- |
| Cream (added) | #FAF7F2 | App background |
| Stark White | #FFFFFF | Cards, sheets, input fields, list rows, tab bar |
| Cold Basalt | #1B1E22 | Primary text and headings; text and border on Spore Chartreuse buttons |
| Quarry Grey | #3A414A | Secondary text, captions, icons |
| Dawn Lilac | #B8BAC8 | Borders, dividers, disabled states, secondary button fill |
| Spore Chartreuse | #C5EB38 | All calls to action: primary buttons, active tab indicator, selected states |
| Spore Deep (added) | #587000 | Chartreuse-family text only: links and text buttons |

**CTA rule:** Spore Chartreuse is used only for actions. Balances, charts and badges never use it, so chartreuse always means "tap this." Cream and Spore Deep are the two additions to your palette; both are explained under Accessibility checks.

**Primary button spec:** Spore Chartreuse fill, Cold Basalt label, and a 1 px Cold Basalt border. Chartreuse on cream is only 1.3 to 1, so without the border the button shape nearly disappears into the background. The label stays highly readable either way.

### Token mapping (kit → our theme)

| Kit token | Kit value | New value |
| --- | --- | --- |
| background/main | #F3F7FC | Cream #FAF7F2 |
| background/surface, fill/field | #FFFFFF | Stark White #FFFFFF (unchanged) |
| fill/primary, icons/accent (on dark surfaces) | #1B6ED4 | Spore Chartreuse #C5EB38 |
| border/primary, system/cursor | #1B6ED4 | Cold Basalt #1B1E22 |
| text/onBackground/accent, icons/accent (on light surfaces) | #1B6ED4 | Spore Deep #587000 |
| fill/primaryDisabled | #1B6ED4 at 40% | Spore Chartreuse at 40% |
| text/onFill/onPrimary | #FFFFFF | Cold Basalt #1B1E22 |
| fill/secondary | #CDE1F9 | Dawn Lilac at 35% |
| text/onFill/onSecondary | #1659AC | Cold Basalt #1B1E22 |
| text/onBackground/primary | #051529 | Cold Basalt #1B1E22 |
| text/onBackground/secondary | #525666 | Quarry Grey #3A414A |
| text/onBackground/tertiary, icons/outline | #727688, #A6AABA | Quarry Grey at 75% |
| divider/default, border/neutral | #C5C8D3, #A6AABA | Dawn Lilac #B8BAC8 |
| fill/warning | #FF6600 | Dark amber #A15C00 |
| fill/destructive | #E64037 | Crimson #C62839 |
| fill/success | #00806C | #00806C (kit value kept) |
| dimming/dimming-40 | black at 40% | Cold Basalt at 40% |

The three status colors are approved additions to the palette. The kit's success green (#00806C) is a blue-leaning teal, so it stays distinct from yellow-leaning Spore Chartreuse.

### Accessibility checks

Contrast ratios measured against the WCAG AA standard (4.5 to 1 for normal text, 3 to 1 for large text and icons).

| Pairing | Ratio | Result |
| --- | --- | --- |
| Cold Basalt on Cream | 15.7 | Passes |
| Quarry Grey on Cream | 9.7 | Passes |
| Cold Basalt on Spore Chartreuse | 12.2 | Passes easily; use for all CTA labels |
| Stark White on Spore Chartreuse | 1.4 | Fails; never put white text on chartreuse |
| Spore Chartreuse on Cream | 1.3 | Fails for text and for the button's edge; hence the Cold Basalt border |
| Spore Chartreuse on Cold Basalt | 12.2 | Passes; chartreuse icons and text work on dark surfaces |
| Spore Deep on Cream | 5.3 | Passes; use for links and text buttons |
| Spore Deep on Stark White | 5.6 | Passes |
| Dawn Lilac on Cream | 1.8 | Borders and dividers only, never text |
| Cold Basalt on Dawn Lilac | 8.7 | Passes; secondary buttons |
| Crimson, dark amber, green on Cream | 5.2, 4.9, 4.6 | Pass |

White cards on Cream are low contrast by design, so cards get a 1 px Dawn Lilac border or the kit's XS elevation to read as separate.

### Typography (from the kit, Inter)

| Style | Size / line height | Weight | Used for |
| --- | --- | --- | --- |
| Large Title | 32 / 40 | Bold | Trip title, balance amount |
| Title 2 | 17 / 24 | Semibold, Medium, Regular | Screen headers, button labels (large) |
| Headline | 16 / 20 | Medium | List row titles, expense names |
| Text | 15 / 20 | Semibold | Button labels (medium), body |
| Caption 1 | 13 / 16 | Regular, Semibold | Payer and date lines, helper text |
| Caption Caps 2 | 12 / 16 | Bold | Section labels, Done badge text |
| Caption 3 | 11 / 16 | Semibold | Tags, tab bar labels |

### Spacing and shape (from the kit)

- Spacing steps: 2, 4, 8, 12, 16, 20, 24.
- Corner radius: 4 (tags), 8 (buttons, inputs), 12 (sheets), 16 (cards), 24 (pills, close buttons).
- Screen side padding: 16.

### Components mapped to screens

| Screen or element | Kit components |
| --- | --- |
| Login | Input Field (Type=Phone), Button (Primary, Large), Input Stepper for the code |
| Home | Header (Large Title), List Item, Avatar group, Search Bar, Fixed Tab Bar (Current, Past) |
| Create trip | Navigation Bar, Input Field, Text Area (250 limit with counter), Progress Bar for step 1 of 2, Button Bar |
| Invite | Search Bar, List Item with Checkbox, Chips for selected people |
| Trip page | Header, Avatar with Badge (Done), card built from Grouped List, Segmented Control (Expenses, Per person, Summary), List Item, Button Bar in the footer |
| Settlement preview | Grouped List inside an accordion under the balance card |
| Add expense | Modal Card or Action Sheet, Input Field, Dropdown Menu for category and subcategory, Segmented Control for split type, Checkbox list for who's involved, Toggle Switch for lodging |
| Close out | List Item per payment with Button (Primary, Small), Checkbox for mark as paid |
| Notifications and nudges | Snackbar, Toast |
| Comments | Text Area, List Item |
| Delete and destructive actions | Action Sheet with destructive item |

### Build notes

- Duplicate the Figma file and swap the color variables per the mapping above, so designs and code share one source of truth.
- In the app, the tokens live in one theme file that every component reads. Changing a color later is a one-line edit.
- V1 ships light mode only. A dark theme can be added later by mapping the same tokens to dark values.

## Screens

V1 has eight screens; the trip page is the center of the app and carries most of the features.

### 1. Login

- Phone number plus a one-time text code. No passwords.
- First login asks for display name, optional photo, and Venmo username.
- The Venmo username is confirmed with a "Check it" link that opens venmo.com/u/\<username>, so the user sees their own profile before saving. The app cannot look up Venmo accounts itself.
- Phone login automatically links any trips the user was already invited to by that number.

### 2. Home

- **Current trips**: open trips, each card showing title, cover photo, member avatars, and your balance ("You're owed $142" or "You owe $58").
- **Past trips (archive)**: closed trips plus any trip with no activity for 14 days, which moves here automatically.
- **Search** across trips by title or member name.
- **"New Shared Expense"** button, always visible.

### 3. Create trip (two steps)

1. **Details**: title (required) and description (optional, up to 250 characters), and trip start and end dates (required; used to pre-fill lodging nights and shown on the recap). Cover photo optional here or later.
2. **Invite**: pick from the phone's contact list or type a number manually. Invitees get a text with a link.

On finish, the trip is created and the user lands on its trip page.

### 4. Trip page

- **Header**: title, cover photo (tap to add or change), member avatars. A Done badge shows next to each member who has tapped Done. Tapping a member shows their details; the owner can remove members who have no expenses (see Members).
- **Balance card**: your net position in large type. An accordion under it expands into the **settlement preview**, the live payment plan (for example "Mike pays you $84.50").
- **Who hasn't logged yet**: a line under the balance card listing members who have added no expenses ("Jen hasn't added anything yet").
- **Expense feed**: newest first. Each row shows description, amount, payer, who's included, category icon, and a receipt thumbnail if one exists.
- **Tabs or segments**: Expenses · Per person · Summary.
- **Per person view**: leads with you (what you paid, your share, your net), then every other member's figures below.
- **Summary view**: trip total, cost per person, and a category breakdown bar chart by top-level category.
- **Sticky footer**: "Add expense" button, "Done adding expenses" toggle, and the **Close out** button, disabled until every member has the Done badge. The owner also gets "Close out anyway" in the trip menu (see Done gate).

### 5. Add or edit expense

- Amount and currency.
- **Who paid** (defaults to you; supports multiple payers).
- **Who's involved**, with everyone selected by default.
- Split type (see Feature specs).
- Description, plus category and subcategory from two linked dropdowns (see Categories).
- Receipt photo, which pre-fills the amount (see Receipt reading).
- Tip as a separate optional field.
- Lodging toggle, which switches the split to nights-based.
- Comments thread on the saved expense.

### 6. Close out and pay

- Shows your payments only: "Pay Mike $84.50" as a button per payment.
- Each button opens Venmo with the recipient, amount and note pre-filled.
- Each payment has a "Mark as paid" control; the recipient can optionally confirm with "Got it", which is not required.
- The trip shows as settled when every payment is marked paid.

### 7. Trip recap

Shown when a trip is fully settled, and saved on the archived trip.

- Cover photo, trip dates, trip total, cost per person.
- Biggest expense, top category, who fronted the most.
- A share button that exports the recap as an image.

### 8. Web guest view

- Opened from the invite link, no install required.
- Guests verify with their phone number and a text code.
- They can view the trip, add and edit expenses, and tap Done.
- A persistent banner recommends installing the app for notifications and Venmo close-out.

## Feature specs

These features make up V1; the Done gate, receipt reading and lodging splits are the ones Splitwise lacks.

### Split types

| Type | How it works | Example |
| --- | --- | --- |
| Equal | Amount divided evenly among selected people | $120 dinner, 4 people, $30 each |
| Exact amounts | Each person's share typed in; must sum to the total | Groceries: $40, $25, $35 |
| Percentages | Each person's share as a percent; must sum to 100% | Car rental: 50/25/25 |
| Shares | Weighted units | Gas: 2 shares for the driver's family, 1 for others |
| Nights (lodging) | Prorated by nights stayed | See Lodging splits |

Rounding: leftover cents go to the payer so totals always match exactly.

### Categories

Every expense takes a category, and a subcategory where one exists, from two linked dropdowns. The list is fixed in V1.

- Travel & Lodging
  - Airlines & Airfare
  - Hotels & Resorts
  - Rentals: Airbnb/Vrbo/Camp
  - Vacations Misc
- Dining, Food, Beverage
  - Restaurants
  - Bars, Lounges & Nightlife
  - Food Delivery
  - Catering
- Groceries
- Beer, Wine, Spirits
- Transportation
  - Rideshare
  - Parking
  - Misc
- Recreation
- Other

Categories with no subcategories hide the second dropdown. Picking Hotels & Resorts or Rentals turns on the nights-based lodging split by default. The Summary view charts spending by top-level category.

### Receipt reading

1. User snaps a photo of the receipt.
2. An AI vision model reads the **total only** and pre-fills the amount field. The user can correct it.
3. The user enters **tip** manually in its own field, since receipts often print before the tip is written in. The expense amount is the receipt total plus tip, split among the same people.
4. The user selects **who's involved**.
5. The photo is saved on the expense as proof.

If the model can't read a total with confidence, the amount field stays blank and the photo still attaches.

### Lodging splits (nights-based)

- Enter the lodging total and the number of nights.
- Tick which nights each person stayed; everyone is ticked for every night by default.
- Each night's cost is split among the people present that night.
- Example: $1,200 for 3 nights is $400 per night. Four people stay Friday and Saturday; two stay Sunday. Friday and Saturday cost $100 each per person; Sunday costs $200 each.

### Done gate

- Each member has a "Done adding expenses" toggle. Tapping it shows a badge next to their name.
- A member can un-tap Done themselves.
- **Any new expense** after a member tapped Done clears that member's badge and notifies them. Edits to existing expenses do not reset Done or send a notification; they are recorded in the edit history.
- Close out unlocks when every member has the badge. If a member never responds, the trip owner can tap "Close out anyway" at any time, after a confirmation warning. The override is logged in the trip history, every member is notified, and the non-responding member's logged expenses still count.

### Members

- The trip owner can remove a member only if that member has no expenses, as payer or as someone included.
- Members with any expenses cannot be removed in V1, which keeps every balance intact.
- Removal takes effect immediately and the removed member is notified.

### Auto-nudges

- **Inactivity**: 24 hours with no activity from a member who hasn't tapped Done sends them a reminder.
- **Last one out**: when everyone else is done, the remaining member gets a nudge right away.
- Nudges repeat no more than once every 24 hours per member.

### Who hasn't logged yet

The trip page lists members with zero logged expenses. It shows from trip creation and disappears once each person logs something.

### Push notifications

| Event | Who gets it |
| --- | --- |
| Invited to a trip | Invitee (text message if not on the app) |
| New expense that includes you | Everyone included |
| Expense deleted | Everyone included |
| Your Done badge was reset | That member |
| Nudge (inactivity or last one out) | That member |
| Close out is unlocked | Everyone |
| Owner closed out without everyone done | Everyone |
| Removed from a trip | That member |
| Payment marked paid | The recipient |
| New comment on an expense | Everyone included |

### Edit and delete history

- Every create, edit and delete is logged with who, when, and the old and new values.
- Expenses show an "Edited" tag that opens the history.
- Deleted expenses are soft-deleted: hidden from totals but kept in history.

### Comments

A simple thread on each expense. Text only in V1.

### Multi-currency

- Each trip has a base currency set at creation (default USD).
- Expenses can be logged in any currency.
- The exchange rate is fetched and locked at the time the expense is entered, and shown on the expense.
- All balances and settlement are in the base currency.

### Offline entry

- Expenses and receipt photos can be added with no signal; they queue on the device.
- The queue syncs automatically when the connection returns.
- Conflicting edits resolve as last write wins, with both versions kept in history.

### Unlimited expenses

No daily or per-trip cap.

### Auto-archive

A trip with no activity for 14 days moves to Past trips. Any new activity moves it back to Current.

## Settlement logic and Venmo close-out

V1 uses Splitwise's greedy method: it is a few lines of code, and a group of N people never needs more than N minus 1 payments.

### Algorithm

1. For each member, net = total they paid minus total of their shares.
2. Positive net = owed money (creditor). Negative net = owes money (debtor).
3. Take the largest debtor and the largest creditor. The debtor pays the smaller of the two amounts.
4. Subtract that payment from both. Whoever reaches zero drops out.
5. Repeat until everyone is at zero.

**Worked example.** Four people; nets are Apollo +$150, Sam +$30, Mike -$100, Jen -$80.

| Round | Payment | Remaining nets |
| --- | --- | --- |
| 1 | Mike pays Apollo $100 | Apollo +50, Sam +30, Jen -80 |
| 2 | Jen pays Apollo $50 | Sam +30, Jen -30 |
| 3 | Jen pays Sam $30 | All zero |

Three payments for four people. Mike pays one person; Jen pays two, which is acceptable per the V1 decision.

Amounts are computed in integer cents to avoid rounding errors. The settlement preview on the trip page runs the same calculation live, so the close-out plan never surprises anyone.

### Venmo close-out

Each payment button builds a Venmo link with everything pre-filled:

```
venmo://paycharge?txn=pay&recipients=<venmo_username>&amount=84.50&note=<trip title> - settled via Checkm8
```

- **Recipient**: the member's stored Venmo username. The phone number from contacts is the fallback, which only works if that number is the one linked to their Venmo.
- **Amount**: exact, two decimals.
- **Note**: trip title plus app name (Venmo requires a note and allows up to 280 characters).
- **Fallback**: if the Venmo app isn't installed, open the web link `https://venmo.com/?txn=pay&...` with the same fields.
- **Creditor option**: a "Request from everyone" button using `txn=charge` with multiple recipients.

The user still taps Pay inside Venmo. The app never moves money and cannot see whether the payment went through, so each payment has a "Mark as paid" control and an optional recipient "Got it" confirmation. A trip counts as settled once every payment is marked paid; "Got it" is not required.

The link format is widely used but not officially documented by Venmo. Keep the link builder in one isolated function so it is easy to fix if Venmo changes it.

## Data model

Ten tables cover V1, and none of them holds bank, card or payment-account data.

| Table | Key fields | Notes |
| --- | --- | --- |
| users | id, phone, display\_name, photo\_url, venmo\_username, created\_at | Phone is the login identity |
| trips | id, title, description (max 250), cover\_photo\_url, start\_date, end\_date, base\_currency, status (open, settled, archived), closeout\_override\_by, closeout\_override\_at, last\_activity\_at, created\_by | Dates required; override fields record an owner's forced close-out; last\_activity\_at drives the 14-day auto-archive |
| trip\_members | trip\_id, user\_id, role (owner, member), done\_at, joined\_via (app, web), removed\_at | done\_at null = not done; cleared on new expenses. Removal is blocked if the member has any payer or share rows |
| invites | trip\_id, phone, token, status, expires\_at | Token powers the web guest link |
| expenses | id, trip\_id, description, category, subcategory, amount\_cents, currency, fx\_rate, base\_amount\_cents, tip\_cents, split\_type, receipt\_url, created\_by, deleted\_at | Category and subcategory from the fixed list; soft delete via deleted\_at |
| expense\_payers | expense\_id, user\_id, amount\_cents | Supports multiple payers |
| expense\_shares | expense\_id, user\_id, share\_cents, nights | nights used only for lodging splits |
| expense\_history | expense\_id, actor\_id, action, before\_json, after\_json, at | The audit trail, including owner overrides and member removals |
| comments | id, expense\_id, user\_id, body, created\_at | Text only |
| settlements | id, trip\_id, from\_user, to\_user, amount\_cents, status (pending, marked\_paid, confirmed), marked\_at, confirmed\_at | Written when close-out unlocks; confirmed is optional |

Money is always stored as integer cents. Receipt photos and cover photos live in private file storage, not in the database.

## Security and privacy

Because the app never touches money or bank data, the main risks are leaking one group's expenses to another and abuse of phone login. These measures cover both.

### Access control

- **Row-level security on every table.** A user can read or write a trip's data only if they are a member of that trip. This is the single most important control; it is enforced in the database, not just the app.
- **Server keys stay on the server.** The app ships only the public key. Admin keys live in server functions and environment variables, never in the app bundle or GitHub.
- **Validate on the server.** Amounts, split totals and membership are rechecked server-side, so a tampered app cannot write bad numbers.

### Login

- Phone plus one-time code, with rate limits per number and per device. Text-code endpoints are a known target for SMS fraud that runs up messaging bills.
- Sessions stored in the phone's secure storage (Keychain on iOS, Keystore on Android), with refresh tokens that expire.

### Invite links and web guests

- Long random tokens, scoped to one trip. An unused invite expires after 14 days; once a guest has verified their phone, the link plus a fresh text code gets them back in.
- Web guests must verify their phone number with a code before seeing any trip data.
- Limit how many invites one user can send per day to stop spam.

### Files and receipts

- Receipt and cover photos in a **private** storage bucket, served only through short-lived signed links.
- Receipts can show partial card numbers and addresses. They are visible only to trip members and deleted with the trip.
- Receipt reading runs through a server function. Choose an AI provider that does not keep or train on submitted images.

### Contacts

- The contact list is read on the device only. Only the numbers the user actually picks are sent to the server.
- Required by Apple and Google, and a common App Store review issue.

### Data protection and compliance

- Encryption in transit (HTTPS) and at rest, both standard on Supabase.
- **In-app account deletion**, required by the App Store. Deleting an account removes personal data and anonymizes the user's name on shared trips so other members' totals stay correct.
- A privacy policy and terms of service, required for both app stores.
- California privacy law (CCPA) rights: users can see and delete their data. Account deletion plus a data export covers this.
- Daily database backups with point-in-time restore.

### Operations

- Error and crash monitoring with personal data scrubbed from logs.
- Automated dependency vulnerability alerts on GitHub.
- Two-factor authentication on every admin account: GitHub, Supabase, Vercel, Apple, Google.

## Tech stack and build plan

Claude Code can build all of V1 on Supabase, Vercel and GitHub; the only parts it can't do for you are creating accounts and submitting to the app stores.

### Stack

| Layer | Choice | Why |
| --- | --- | --- |
| Mobile app | Expo (React Native), iOS and Android from one codebase | Native contacts access, Venmo deep links, push, camera, offline storage |
| Backend and database | Supabase (Postgres) | Phone login, row-level security, file storage, realtime updates for the Done badges |
| Server logic | Supabase Edge Functions | Settlement calculation, receipt reading, nudges, notifications |
| Scheduled jobs | Supabase cron | 24-hour nudges, 14-day auto-archive, invite expiry |
| Web guest view and landing page | Next.js on Vercel | Invite links open here with no install |
| Text messages | Twilio (or similar), connected to Supabase phone login | Login codes and invite texts |
| Push notifications | Expo push service | One API for iOS and Android |
| Receipt reading | An AI vision model, called from an Edge Function | Reads the total from the photo |
| Exchange rates | A currency rate API, called when an expense is saved | Locks the rate per expense |
| Code and CI | GitHub | Source, pull requests, dependency alerts |
| App builds and store submission | Expo EAS | Builds signed apps and uploads them to the stores |

### Accounts you set up

- GitHub, Supabase, Vercel (you have these planned).
- Apple Developer Program ($99 per year) and Google Play Console ($25 one-time), both needed to publish.
- Twilio or another SMS provider, billed per text.
- An Expo account for builds.

### Project links

| Service | Link | Notes |
| --- | --- | --- |
| GitHub repo | [bradrussell1/Checkm8](https://github.com/bradrussell1/Checkm8) | Source of truth for the code; needs at least one commit before parallel worktree sessions |
| Supabase project | [qywowvkkkxldgxoatdsh](https://supabase.com/dashboard/project/qywowvkkkxldgxoatdsh) | Database, phone login, storage, Edge Functions, cron |
| Vercel | [bradrussell16-2042s-projects](https://vercel.com/bradrussell16-2042s-projects) | Web guest view and landing page; connect it to the GitHub repo |

Keys never go in this doc or in the repo. The Supabase anon key goes in the app's environment config; the service role key goes only in Supabase and Vercel environment variables.

### Build order

The foundation goes first in one session and gets committed; the next three phases can then run in parallel Claude Code sessions using worktrees.

1. **Foundation**: project setup, theme tokens and base components from the design system, database tables, row-level security policies, phone login.
2. **Core logic** (parallel): split types, lodging nights, settlement algorithm, Venmo link builder, currency conversion, all with automated tests.
3. **Mobile screens** (parallel): Home, create trip, trip page, add expense, close-out.
4. **Server jobs** (parallel): notifications, nudges, auto-archive, receipt reading.
5. **Web guest view** on Vercel.
6. **Polish**: trip recap, offline sync, edit history, comments.
7. **Test with a real trip**, then submit to TestFlight and Play Store internal testing.

The settlement and split logic should be written test-first. It is the part where a bug costs people real money, and it is easy to test in isolation.

## Phase 2 roadmap and decisions

Four items are deferred past V1, fourteen decisions are settled, and no questions are open.

### Phase 2

- **Households**: a couple or family counts as one party with one balance.
- **Pre-trip deposits**: collect money into a pool before the trip.
- **Guest participants**: members with just a name and Venmo handle, no phone verification.
- **Paid version**: likely a one-time purchase. V1 launches free with no in-app purchases.

Removed from V1: day-by-day view.

### Decisions log

| Decision | Answer |
| --- | --- |
| App name | Checkm8 |
| Platforms | iOS and Android at launch, fully cross-platform within a trip |
| Business model | Free at launch; a one-time purchase likely later |
| Settlement method | Splitwise-style fewest payments; some people may make two |
| Done gate override | Trip owner can close out at any time when a member never responds |
| Late additions | New expenses reset Done and notify; edits do neither |
| Removing members | Only members with no expenses; members with expenses stay in V1 |
| Categories | Fixed two-level list (see Categories) |
| Trip dates | Required at trip creation |
| "Got it" confirmation | Optional; not required to settle |
| Theme | Light mode on Cream #FAF7F2 |
| Primary buttons | Spore Chartreuse with a 1 px Cold Basalt border |
| Status colors | Dark amber, crimson and green, as specced |
| Infrastructure | GitHub Checkm8 repo, Supabase, Vercel (see Project links) |

### Open questions

None right now. New questions get added here as they come up.
