# Checkm8 mobile — QA report A (black-box product test)

Date: 2026-10-01 · Build under test: working tree at commit `06fd335` + uncommitted canvas gradient / Inter (Expo Go, iOS 27 simulator, iPhone 18 Pro) · Backend: Supabase project `qywowvkkkxldgxoatdsh` (live) · Tester: QA agent A (independent; no code changes made).

Method: drove the app by deep link on the simulator (no tapping possible) and the backend through the REST API as the test users (Bradley Test, Jordan Test, Sam Rivera, Priya Patel, Mike Chen, Jen Alvarez). All numbers in the UI were cross-checked against the raw `expenses` / `expense_payers` / `expense_shares` rows recomputed independently. Throwaway trips were created and deleted; the Tahoe and Cabo seed trips were left as found. Screenshots are in the session scratchpad as `qaA-*.png`.

Severity key: P0 blocker · P1 major (wrong money / wrong state / blocks a core journey) · P2 minor (wrong but recoverable, or spec drift) · P3 polish.

Totals: **P0 0 · P1 5 · P2 9 · P3 7 · spec drift 2**

---

## P1 — major

### A-1 · Home "Your position" adds balances across different currencies
- Area: Home hero, `home.tsx` line 56 (`open.reduce((s, t) => s + t.net_cents)`), also `TripHistoryList.tsx` line 27.
- Repro: sign in as Jordan Test (0101) who is on a EUR trip (+€842.58) and two USD trips (−$739.47, −$518.25). Open Home.
- Expected: either per-currency lines ("You're owed €842.58 · You owe $1,257.72") or a conversion to one currency.
- Actual: hero reads "You owe $415.14 across 3 open trips" (= −73947 −51825 +84258 cents, three currencies summed as dollars). Trip history also shows the EUR trip as "+$842.58".
- Evidence: `qaA-home-jordan.png`, `qaA-history.png`; recomputed nets: Tahoe −51825 USD, Cabo −73947 USD, stress trip +84258 EUR.
- Fix: group `net_cents` by `base_currency`; render one line per currency and pass the currency to `formatCents` in the history list.

### A-2 · Close-out screen tells a locked trip "Nothing to settle · Everyone is even."
- Area: `trip/[id]/closeout.tsx` (lines 34, 59). Reachable while locked via the owner override path and by deep link; the "Close out" button on the trip page is disabled, but the screen itself has no guard.
- Repro: as Jordan Test open `--/trip/6c77ba88…/closeout` (Cabo: 3 of 6 Done, five people owe money). Also any trip with zero expenses.
- Expected: a clear "Close out is locked until everyone taps Done (3 of 6 so far)" state, no settlement figures.
- Actual: a raw error string "close out is still locked" in red at the top, then a navy hero "NOTHING TO SETTLE / Everyone is even." A user who owes $739.47 is told they are even.
- Evidence: `qaA-cabo-closeout-locked.png`, `qaA-empty-closeout.png`.
- Fix: when `generate_settlements` returns the locked error (or `closeoutUnlocked` is false and no settlements exist) render a locked state and hide the "Nothing to settle" hero; map the error code to friendly copy.

### A-3 · One marked payment settles the whole trip, after which the plan can never catch up with the ledger
- Area: `mark_settlement` (trip → `settled` when no `pending` rows remain) + `save_expense` (refuses on settled) + `generate_settlements` (returns the existing plan once any row is non-pending).
- Repro (REST, throwaway trip with Sam/Priya/Mike): plan = B→A $5.00. Priya marks it paid → `trips.status = settled` immediately. Mike then adds a $10 expense that only Priya shares → `save_expense` 400 "this trip is settled". Even after Priya *unmarks* (204), the trip stays `settled` (status is never reverted).
- Expected: a trip with one of N payments marked is not settled; unmarking reopens it; late expenses after a mark either regenerate the remaining pending rows or are blocked with a message that explains why.
- Actual: as above. Also with a single-payment plan the payer alone can "settle" the trip for everyone by tapping Mark as paid.
- Evidence: flow log lines "payer marks paid => 204", "late expense after a mark => 400", "unmark on settled trip: 204 settled".
- Fix: in `mark_settlement` revert `status` to `open` on `unmark` when any row is pending; consider requiring all payments (or recipient confirmation) before flipping to `settled`; surface a copy change on the Mark button ("This settles the trip").

### A-4 · Server trusts client-supplied base amounts (FX) — a €10 expense can post as €9,999.99 to the ledger
- Area: `save_expense`: it validates that payers/shares sum to `base_amount_cents` but accepts whatever `base_amount_cents` the client sends relative to `amount_cents × fx_rate`.
- Repro (REST): `amount_cents 1000, currency EUR, fx_rate 1.1, base_amount_cents 999999`, payers/shares 999999 → 200. The trip total and every balance now include €9,999.99 for a €10 receipt.
- Expected: server recomputes `base = round((amount + tip) × fx_rate)` (±1 cent) and rejects mismatches, or ignores the client value.
- Actual: accepted; the row shows `base_amount_cents 999999`.
- Evidence: flow log "fx mismatch base => 200"; expenses dump `x:999999`.
- Fix: in `save_expense` derive `v_base` server-side from `v_amount + v_tip` and `v_fx` and raise when the client value differs by more than 1 cent per row.

### A-5 · Any member can delete anyone's expense, and any member can log an expense naming someone else as the payer
- Area: `delete_expense` (checks `is_trip_member` only), `save_expense` (payer id is taken from the payload). The app's "payer = creator" rule is UI-only.
- Repro (REST): Priya calls `delete_expense` on Sam's expense → 204, gone from totals. Sam logs an expense with `payers: [Priya]` → 200; Priya's balance changes without her doing anything.
- Expected: delete limited to the creator (and owner); payer forced to `auth.uid()` on insert unless the caller is the owner.
- Actual: both allowed. (Note the seed script relies on the second behaviour to log Bradley's expenses; that is a seed convenience, not a product rule.)
- Evidence: flow log "B deletes A's expense: 204", "payer != caller => 200".
- Fix: add `created_by = auth.uid() or is_trip_owner(trip)` to `delete_expense`; in `save_expense` on insert set payer to `auth.uid()` (or validate it equals the caller).

## P2 — minor

### A-6 · "hasn't added anything yet" is driven by `created_by`, not by paying
- Repro: Cabo trip. Bradley is payer on 4 expenses (logged on his behalf) → page reads "Bradley hasn't added anything yet." while his rows show "Bradley paid".
- Fix: `membersWithNoExpenses` should consider payer rows as well as `created_by` (`trips.ts` line 100). Low risk once A-5 is fixed, but still wrong for owner-logged expenses.

### A-7 · Zero-amount expenses are accepted
- Repro (REST): `amount_cents 0, tip 0` with one share of 0 → 200. The row then shows "$0.00" and "even".
- Fix: require `amount_cents + tip_cents > 0` in `save_expense` and disable Add below 1 cent in the form (it already disables at empty).

### A-8 · A new expense clears Done for members who are not on it
- Repro (REST): A, B, C all Done. C adds an expense shared only by A and C. Result: A, B and C are all cleared (B is untouched by the expense).
- Spec: "Any new expense after a member tapped Done clears that member's badge" is ambiguous; clearing people not on the expense generates needless nudges in a 20-person trip.
- Fix: in `reset_done_on_new_expense` clear only share/payer participants (plus the creator), or make the spec explicit.

### A-9 · Calendar sheet and month-jump overlay open behind the keyboard
- Repro: `--/trip/new?openDate=start` (and `&jump=1`). The Title field has `autoFocus` (`new.tsx` line 165) so the keyboard is up; the sheet renders under it and only the first calendar row and the first three "Jump to" months are visible.
- Fix: `Keyboard.dismiss()` when a `DateField` opens, or drop `autoFocus` on Title.
- Evidence: `qaA-calendar.png`, `qaA-calendar-jump.png`.

### A-10 · Home sticky CTA floats over the last trip card
- Repro: Jordan Test with 4 trips. "Grab the Check" and "Sign out" overlap the cover photo and title of the last card; list `paddingBottom` is 140 but the footer is taller than that with the Sign out link.
- Fix: measure the footer or raise the bottom padding; or move Sign out to Profile (it already exists there) and drop it from Home.
- Evidence: `qaA-home-jordan.png`.

### A-11 · Recap still shows "Per person" (removed from Summary at the user's request) and is reachable on an open trip
- Repro: `--/trip/<tahoe>/recap` on an open trip → full recap with "PER PERSON $611.75".
- Fix: drop per-person from the recap (same reasoning the user gave for Summary) and guard the route to settled/archived trips.
- Evidence: `qaA-tahoe-recap.png`. Spec drift, not a crash.

### A-12 · Edited-expense "Who's involved" toggle label reads "Everyone" while most people are already ticked
- Repro: edit any 4-of-6 expense. Header button says "Everyone" (it is the action: select everyone), which reads like a state ("everyone is involved").
- Fix: "Select all" / "Clear" wording, or move the state to a count ("4 of 6").
- Evidence: `qaA-expense-edit.png`.

### A-13 · Sign-up copy still describes Venmo as "username" with the old helper text
- Repro: `--/signup`: "Venmo username (optional)" + "Needed before close-out. Payments to you open Venmo pre-filled with this." Profile was renamed to "Venmo Handle" and that helper removed; sign-up was not updated.
- Fix: align labels and helper with the Profile screen.
- Evidence: `qaA-signup.png`.

### A-14 · Owner can set a trip to `archived`/`settled` directly through the table
- Repro (REST): owner `PATCH trips set status='archived'` → 200 and the trip drops to Past with no history row or notification. Non-owners are correctly blocked (0 rows).
- Fix: restrict `status` updates to the RPCs (column-level `revoke update (status)` or a trigger), so archiving always goes through the cron/notify path.

## P3 — polish

### A-15 · Trip currency symbol missing in several places
- Member screen is right (€3,345.08) but Home cards and Trip history use `formatCents(n)` with the USD default (A-1 covers the hero). Home card for the EUR trip reads "You're owed $842.58".

### A-16 · Attendees row: members beyond the first two are off-screen with no affordance
- Six-person trip shows "Mike Chen DONE · Bradley · JA…" and nothing hints the row scrolls; with 20 people the Done count is invisible. Suggest a "3 of 6 done" caption in the pill or a trailing "+3".

### A-17 · `set_done` from a non-member returns 204 instead of 403
- Harmless (updates 0 rows) but inconsistent with `save_expense` (403). Consider `if not is_trip_member then raise`.

### A-18 · Long titles wrap to three lines in the trip header and push the hero down a screen
- `qaA-stress-top.png`. Consider `numberOfLines={2}` on the trip title.

### A-19 · Comments header shows the expense description, no amount/payer context; "Send" button is low-contrast (disabled gold) until typing
- Fine functionally; a one-line "€238.57 · Jen paid" subtitle would help.

### A-20 · Home trip card avatar order differs from the trip page order (Cabo: PP MC JA SR B vs MC B SR JA PP)
- Cosmetic; consider sorting members (owner first, then alphabetical) in one place.

### A-21 · Terminology: "Trip" everywhere except the create screen title ("Grab the Check") and the Home CTA; close-out copy says "Got it is optional" with straight quotes inside a sentence already using quotes
- Decide whether "check" is a product noun; if so use it consistently (e.g. "Your Check" is, "Trip total" is not).

## Spec drift (for the owner to confirm, not bugs)

- SD-1 · Spec §4: "Expense feed … category icon" — the app shows two-letter glyphs (TR, DI, GR…). Readable, but not icons.
- SD-2 · Spec §3: "Invitees get a text with a link" — now only non-members get a text; existing users are added silently with a push. Matches the 2026-09-30 decision; the sign-up helper text still promises the old behaviour (see A-13).

---

## What works (verified)

- Ledger math: Your Check, per-row "owed to you / you owe", All Expenses, Summary trip total, Paid-so-far, Member screen Paid/Share/Net all match independent recomputation on Tahoe (3 expenses), Cabo (24) and the 60-expense stress trip; every expense's payers and shares sum to its base amount; nets sum to zero.
- Lodging split by nights: €/$ per-night shares match presence (Jordan 4 nights, Jen 4 nights, others 5).
- Realtime: clearing Jordan's Done from another session removed the badge on Bradley's open trip page and re-locked Close out without a reload (`qaA-tahoe-jordan-undone-live.png`).
- Done gate: `gate_open` false until all Done; `generate_settlements` refused while locked; Close out button disabled with a caption.
- Settlement plan on Tahoe (Jordan → Bradley $518.25) equals the preview and the independent greedy result.
- Settled-up switch: on → outgoing marked, incoming confirmed, trip settled; off → exact restore (verified `marked_paid → confirmed → marked_paid`).
- Validation: shares that don't sum (400), negative amount (400), empty description (400), 5,000-char description (400), share to a non-member (403), 80-char title limit, invalid category pair, remove-member-with-expenses (400), non-owner remove/override (403), non-member reads (0 rows), direct table writes to shares / other members' Done / member rows (0 rows under RLS).
- History: creates, edits, deletes, Done set/clear all logged; deleted expense hidden from the feed but present in history.
- Read-only history view: no footer, no menu, chips/rows not tappable, "‹ History" back.
- Empty trip: "No expenses yet" hero, "You haven't added anything yet", Summary $0.00 with no category bars.
- 60 expenses / 6 members: all three tabs render and scroll with no visible lag; no JS errors in the dev-server log during the whole session (`grep -c ERROR expo.log` → 0).
- Auth screens render in the new theme; keyboard return key on Forgot is a plain done key; Google/Apple-first login hub; sign-up and forgot copy is coherent.
- Profile: read-only identifier and password fields, Change Password link, Venmo Handle + View on Venmo, Stats/History tabs, History list sorted by recency.

## Coverage

| # | Journey | Status | Notes |
|---|---|---|---|
| 1 | Landing / login / sign-up / forgot | Covered (visual) | Could not type; keyboard overlap judged from layout. A-13. |
| 2 | Home math, search, Past tab | Covered | A-1, A-10, A-15. Search not exercised (no typing); Past tab logic verified in code + an archived trip visible in data. |
| 3 | Create trip: calendar, invite step, consent, sheets | Partly | Calendar bounds (±6 months) verified in overlay; end-before-start not exercised (no tapping); A-9. Friends/contacts sheets verified earlier in the session by the parent. |
| 4 | Trip page: attendees, Your Check, preview, tabs | Covered | All math verified. A-6, A-16, A-18. |
| 5 | Expense form: categories, lodging, weekdays, validation, FX | Partly | Category gating and lodging switch visible; weekday labels verified earlier (Fr/Sa/Su); exact/percent and FX fetch not exercised (no typing); server validation covered (A-4, A-7). |
| 6 | Edit / delete / history | Covered | A-5 (authorisation), A-12. |
| 7 | Done gate, reset on new expense, owner override | Covered | A-8. Override only via REST (403 for non-owner). |
| 8 | Close-out: marks, settled-up, trip settles | Covered | A-2, A-3. Venmo deep link not exercisable in the simulator. |
| 9 | Read-only history trip | Covered | OK. |
| 10 | Profile fields and Stats | Covered (visual) | Stats numbers below the fold not captured; History list verified (A-15). |
| 11 | Members screen / removal rules | Covered | Owner card shows no Remove (correct); removal rules verified by REST. |
| 12 | Empty states | Covered | OK; A-2 for empty close-out. |
| 13 | Long content (6 members / 60 expenses, mixed currency) | Covered | Layout holds; A-18. 20-member trip not created (only 6 test accounts exist). |
| 14 | Copy / terminology / contrast | Covered | A-21; contrast fine in the light theme (gold only on figures ≥15 px, dark gold on captions). |
| 15 | Crashes | Covered | None; dev log clean. |

## Not tested / limitations

- No tap input on the simulator: anything requiring typing, scrolling or a tap (search, exact/percent split entry, FX fetch, contacts picker selection, Venmo button, photo pickers, Share recap) was verified by code reading or earlier parent screenshots only.
- Push notifications, SMS invites and Sign in with Apple need a device build.
- Only six accounts exist, so the 20-member layout case was not produced.
