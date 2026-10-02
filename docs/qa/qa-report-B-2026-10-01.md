# QA report B — security, data integrity, engineering

Date: 2026-10-01 (evening, Pacific). Scope: Supabase project `qywowvkkkxldgxoatdsh` as deployed at commit `06fd335`, `packages/core`, `apps/mobile/src/lib`, Edge Functions. Method: code review of every migration and function, live REST probes as the test accounts (owner Sam Rivera, members Priya Patel / Jen Alvarez, outsider Mike Chen, throwaway email-only accounts), read-only Management API queries (`EXPLAIN`, catalog, `pg_cron`), and a seeded property-test suite. All probe trips and throwaway accounts were deleted afterwards; the user's account and the Tahoe/Cabo trips were not touched.

Scripts (re-runnable, all leave nothing behind): `scripts/qa-b-probe.mjs`, `scripts/qa-b-verify2.mjs`, `scripts/qa-b-auth.mjs`, `scripts/qa-b-perf.mjs`, `packages/core/test/qa-fuzz.test.ts` (`npm test`, seed `QA_SEED`).

Severity: **P0** exploitable by any signed-in user with real-money impact · **P1** breaks ledger integrity or bypasses an owner-only control · **P2** should fix before external testers · **P3** hardening.

Counts: P0 1 · P1 4 · P2 9 · P3 8.

---

## P0

### B-01 Any member can promote themselves to owner, then delete the trip
- Area: RLS, `trip_members`
- Proof: as Priya (member): `PATCH /rest/v1/trip_members?trip_id=eq.<T>&user_id=eq.<priya>` `{"role":"owner"}` → 200; owner's read shows `role=owner`. Then `DELETE /rest/v1/trips?id=eq.<T>` as Priya → 200, 1 row deleted (`V2.self_promoted_member_deletes_trip`). The whole ledger, members, settlements and history cascade away.
- Cause: `members_update_self` is `using (user_id = auth.uid()) with check (user_id = auth.uid() and removed_at is null)`; it lets the row owner change any column, including `role`.
- Fix: restrict the self-update policy to the columns a member may touch. Simplest: a `before update` trigger (or `with check`) that rejects `new.role <> old.role` unless `is_trip_owner(trip_id)`, and likewise freezes `trip_id`, `user_id`, `joined_at`, `last_nudged_at`, `settled_up_at`, `settled_up_undo` for non-owners (Done and settled-up already go through RPCs). Alternatively drop `members_update_self` entirely since `set_done`/`set_settled_up` are security-definer.

## P1

### B-02 Any member can rewrite an expense's money fields directly, leaving payers/shares unchanged
- Area: RLS, `expenses`
- Proof: as Priya: `PATCH /rest/v1/expenses?id=eq.<E>` `{"amount_cents":1,"base_amount_cents":1}` → 200; row now says 1 cent while payers/shares still sum to 3000 (`INT.direct_patch_expense_amount`). `created_by` can be changed the same way (`INT.direct_patch_created_by`), which rewrites "who paid" captions and the "hasn't added anything" line.
- Cause: `expenses_update` allows members to update every column; the sum check (`validate_expense_sums`) only fires on `expense_payers`/`expense_shares` changes, not on `expenses`.
- Fix: either revoke direct `UPDATE` on `expenses` for `authenticated` (all edits go through `save_expense`, which is security-definer and does its own checks) and keep a narrow policy for `receipt_url` only, or add the same deferred constraint trigger on `expenses` and freeze `trip_id`/`created_by` in a `before update` trigger.

### B-03 Any member can move an expense into another trip
- Area: RLS, `expenses`
- Proof: Priya creates her own trip, then `PATCH /rest/v1/expenses?id=eq.<E>` `{"trip_id":"<her trip>"}` → 200; the owner of the original trip can no longer see the expense (`INT.direct_patch_expense_trip_id`: `visible to owner=false`). Shares/payers for people who are not members of the destination trip ride along; both ledgers are now wrong.
- Cause: `expenses_update ... with check (is_trip_member(trip_id))` is evaluated against the *new* trip_id, which she is a member of.
- Fix: same as B-02 (freeze `trip_id` on update).

### B-04 Direct insert into `expenses` bypasses payer/share validation
- Area: RLS, `expenses`
- Proof: as Priya: `POST /rest/v1/expenses` with amount 5000 and no payers/shares → 201 (`INT.direct_insert_expense_without_shares`). The expense counts toward the trip total and the Summary but moves no balances, so "trip total" and "paid so far" disagree.
- Cause: `expenses_insert` permits direct inserts; validation lives on the child tables only.
- Fix: remove the direct insert policy (the app only inserts via `save_expense`), or add an "every expense has ≥1 payer and ≥1 share" check in a deferred constraint trigger on `expenses`.

### B-05 Any member can add any Checkm8 user to a trip, including people the owner removed
- Area: invites trigger `attach_known_user_invite` (migration 20260930000010)
- Proof: owner removes Jen (`remove_member`), then Priya (member) `POST /rest/v1/invites {phone: jen}` → 201 and Jen's `removed_at` is back to null (`ESC.member.invite_readds_removed_member`). Likewise Priya invites Mike (never a member) → invite `accepted`, Mike is a member (`ESC.member.invite_adds_known_user`). `trip_members` inserts are otherwise owner-only (`members_insert`).
- Impact: the owner's removal decision can be undone by anyone; membership is effectively member-controlled; combined with B-01 this is full takeover.
- Fix: in the trigger, only re-activate a removed member when `auth.uid()` is the owner (or never: require the owner to re-add); decide whether non-owners may invite at all (`invites_insert` currently allows any member). `accept_invites_for_me` and `accept_invite_token` also `do update set removed_at = null` — same question.

## P2

### B-06 Settlement plan freezes once any payment is marked paid; later expenses never settle
- Area: `generate_settlements`
- Proof (3-member trip, `V2.settlement_frozen_after_one_marked_paid`): plan A = Priya→Sam 3000, Mike→Sam 3000. Priya marks paid. Mike adds a $60 expense split three ways (now Mike is owed $40 net). Everyone taps Done, `generate_settlements` returns the old plan unchanged. After Priya unmarks, the plan regenerates correctly (Priya→Sam 4000, Priya→Mike 1000). The trip page's live preview (core `settle`) shows the new numbers while the close-out screen shows the old ones. This is the spec's open "regeneration after a late expense" question; today the answer is "silently stale".
- Fix options: (a) when a trip has non-pending settlements and the ledger changes, append *delta* settlements for the difference instead of refusing; (b) block new expenses once any payment is marked (clear error in the app); (c) at minimum show a banner on close-out when `nets` no longer match the plan.

### B-07 Un-marking a payment does not reopen a settled trip
- Area: `mark_settlement`
- Proof: 2-member trip, single payment marked → trip `settled`; `mark_settlement(unmark)` → settlement `pending` again but `trips.status` stays `settled` (`INT.unmark_reopens_trip`). Adding an expense is then refused ("this trip is settled") with no way back except `set_settled_up(false)` or the owner editing status. (`set_settled_up` off *does* reopen — inconsistent.)
- Fix: in the `unmark` branch, `update trips set status='open', settled_at=null where id = trip and status='settled'`.

### B-08 `save_expense` trusts client-supplied `fx_rate` / `base_*` cents, including 0 and negative
- Area: `save_expense`
- Proof: `fx_rate:-1, base_amount_cents:-3000` with matching negative base shares → 200 (`INT.save_expense.fx_negative`); `fx_rate:0, base 0` → 200 (`fx_zero`): the expense exists but moves no money; `fx_rate:1.1` with `base_amount_cents:999999` → 200 (`base_mismatch_vs_fx`). Nets are computed from `base_*`, so a tampered client can shrink or inflate its own debt.
- Fix: in `save_expense`, require `fx_rate > 0`, recompute `base_amount_cents = round((amount+tip) * fx_rate)` server-side and derive base payer/share cents from the expense-currency cents (largest-remainder) instead of accepting them; reject `base_*` that disagree by more than rounding.

### B-09 `request_password_reset` returns the full phone number for any email, to anonymous callers
- Area: auth RPC (migration 20260930000001)
- Proof: anon `POST /rest/v1/rpc/request_password_reset {"p_identifier":"+15555550103"}` → `"+15555550103"`; unknown → `null` (`AUTH.reset_lookup_enumerates`). For an email identifier it returns the account's phone in clear.
- Impact: account enumeration (documented trade-off) plus phone-number disclosure by email, which is more than the flow needs.
- Fix: return a boolean (or a masked "•••• 6230") and have the RPC itself call out to send the code (or return an opaque handle the client passes to `signInWithOtp`); add a per-IP rate limit via a small `private.reset_attempts` table.

### B-10 Email-only sign-ups are auto-confirmed and fully functional
- Area: auth config (`mailer_autoconfirm = true`)
- Proof: `POST /auth/v1/signup {email:"qa-b-…@example.invalid", password}` → 200 with a live session; that account creates a trip (`AUTH.phoneless_account_can_write`). The app routes such users to the add-phone step, but the API does not require it.
- Impact: unlimited unverified accounts; invite spam vector (each can send 50 invites/day → Twilio cost); the `attach_known_user_invite` match is by phone so these can't be auto-added, but they can create trips and invite.
- Fix: until SMTP exists, gate writes on a confirmed phone in RLS (`exists (select 1 from auth.users where id = auth.uid() and phone_confirmed_at is not null)` via a helper), or turn autoconfirm off and add an SMTP provider.

### B-11 Auth retry wrapper re-POSTs non-idempotent requests
- Area: `apps/mobile/src/lib/supabase.ts` (`retryingFetch`)
- Evidence: code review. Every `/auth/v1/*` call is retried once on a transport error, including `POST /auth/v1/signup`, `/otp`, `/verify` and `/token`. A request that reached the server but whose response was lost is replayed: sign-up shows "already registered" on a successful registration, `/otp` sends a second text (and trips the 60 s limit), `/verify` burns the code.
- Fix: retry only `GET` and `/token?grant_type=refresh_token`, or add an idempotency check (`signup` → on 422 "already registered" after a retry, continue to the code step).

### B-12 Co-members can read each other's phone number (and email when set); invite phone numbers and tokens are visible to every member
- Area: `users_select`, `invites_select`
- Proof: Priya reads `users?select=phone,email&id=eq.<sam>` → phone returned (`PRIV.comember.reads.phone_email`); any member reads `invites?select=phone,token` for the trip (`PRIV.member.reads.invite_phones_tokens`). Tokens can't be used by the wrong phone (`V2.accept_token_wrong_phone` → 403), but the numbers of non-users are exposed to the whole group.
- Fix: a `users_public` view (id, display_name, photo_url, venmo_username) for co-members and keep `phone`/`email` self-only; drop `phone`/`token` from what members can select on `invites` (column-level grant or a view).

### B-13 Home/expenses RLS forces a sequential scan with a function call per row
- Area: performance
- Proof: `EXPLAIN select trip_id from expenses where deleted_at is null and is_trip_member(trip_id)` → `Seq Scan on expenses … Filter: is_trip_member(trip_id)`. Every Home load evaluates the policy function over every expense row in the database, not just the user's. At today's size (120 rows) it is 240 ms / 118 KB; it grows linearly with the whole table.
- Fix: rewrite the policies as `trip_id in (select trip_id from trip_members where user_id = auth.uid() and removed_at is null)` so the planner can semi-join on the index; same for `expense_payers`/`expense_shares` (`expense_trip()` per row).

### B-14 Members can set their own bookkeeping columns
- Area: RLS, `trip_members`
- Proof: Priya `PATCH` her row `{"last_nudged_at":"2030-…","settled_up_at":"2026-01-01"}` → 200 (`ESC.member.patch_bookkeeping_cols`). Setting `settled_up_at` directly skips the settlement side-effects of `set_settled_up`; `last_nudged_at` far in the future disables nudges; `last_active_at` likewise.
- Fix: covered by the B-01 fix (freeze columns for non-owners).

## P3

### B-15 Negative base share from `convertSharesToBase` at tiny rates
- Area: `packages/core/src/currency.ts`
- Proof (fuzz, seed 20261001): shares `{1,1,1,0}` at rate 0.531 → base `{1,1,1,-1}`: the last key absorbs the rounding drift and goes negative. The app passes base shares straight to `save_expense`, which accepts them (sum still matches).
- Fix: distribute base cents with largest-remainder over the converted exact values instead of "last one takes the remainder".

### B-16 Helper functions are callable by `anon` through PostgREST
- Area: grants
- Proof: anon `rpc/first_name {p_user}` → `"Sam"`; `rpc/expense_trip {p_expense}` → trip id; `is_trip_member`, `shares_trip_with`, `gate_open`, `set_done` (no-op, 204) all answer anon. UUIDs are required, so disclosure is limited, but none of these should be reachable.
- Fix: `revoke execute … from anon, authenticated` on the helpers and mark them for internal use; keep only the app RPCs granted to `authenticated` (and `request_password_reset`/`accept_invite_token` to anon where needed).

### B-17 Access token stays valid for ~60 min after `delete_my_account`
- Proof: after `delete_my_account` → 204, REST with the old JWT still returns 200 (`[]`), `/auth/v1/user` → 403, refresh → 400 (`AUTH.jwt_after_delete`). RLS still evaluates with the deleted uid; the anonymised `users` row and memberships with expenses remain readable to that token until expiry.
- Fix: acceptable for V1; shorten JWT expiry (e.g. 15 min) or have the client discard the session immediately (it does sign out).

### B-18 Receipt/cover objects are orphaned when a trip is deleted
- Proof: upload `covers/<T>/cover.jpg`, delete the trip; the object remains (Management API: `receipts` bucket already has 1 orphaned object from earlier testing; `ORPHAN_CHECK` upload 200 then sign → 400 because nobody is a member any more). Nobody can delete them afterwards.
- Fix: a trigger on `trips` delete that enqueues an Edge Function (service role) to remove `covers/<id>/*` and `receipts/<id>/*`, or a daily sweep; spec says receipts are "deleted with the trip".

### B-19 Zero-amount expenses and inconsistent night data are accepted
- Proof: `amount_cents:0` → 200 (`INT.save_expense.zero_amount`); `nights:3` with a 2-element `night_presence` → 200 (`nights_presence_len_mismatch`).
- Fix: `amount + tip > 0` check; `array_length(night_presence,1) = nights` and `nights = count(true)`.

### B-20 Comments can't be edited or deleted by their author
- Proof: own comment `PATCH`/`DELETE` → 200 with 0 rows affected (no policy) (`V2.comments.no_edit_or_delete_policy`). The spec says text-only comments; deletion of one's own comment is a reasonable expectation and an App Store "user-generated content" review point.
- Fix: `comments_delete using (user_id = auth.uid())` (and optionally update within 5 minutes).

### B-21 The inviter can re-trigger the invite text without limit
- Proof: `POST /functions/v1/send-invite {invite_id}` with the inviter's JWT → 200 and a Twilio attempt each time (`FN.send-invite.resend_by_inviter_spams_twilio`); the 50/day cap counts invite rows, not sends.
- Fix: dedupe on `notification_log.dedupe_key = 'invite.sms:<id>'` (the row exists but is not checked before sending), or cap resends per invite.

### B-22 Self-invite is accepted as a pending invite
- Proof: owner invites their own number → 201 `pending` (`V2.invite_self`); a text to yourself is attempted.
- Fix: reject `phone = inviter's phone` in `guard_invite_rate`.

---

## Verified OK

| Check | Result |
|---|---|
| Outsider reads on all 11 tables scoped by trip | 0 rows each (`AC.read.*`); users row of a stranger not visible to a true outsider |
| Outsider write attempts (`PATCH expenses`, insert member/invite, `save_expense`, `delete_expense`, `set_settled_up`) | all refused (403 / 0 rows) |
| Member calling owner RPCs (`remove_member`, `owner_closeout`) | 403 with clear messages |
| `save_expense` with foreign expense id + other trip | "expense not found" |
| Payer/participant who is not an active member (clean trip) | 403 "not a member" (deferred trigger works) |
| Sum mismatches, negative amount/tip, fractional cents, integer overflow, bad category pairs, 300-char description, empty description, duplicate share rows | all rejected with the right constraint |
| Direct `DELETE` of a share row | 400 (deferred sum check) |
| Member `PATCH`/`DELETE` on `trips`, `settlements` | 0 rows |
| Storage: sign another trip's cover, upload into another user's avatar path, upload a receipt into a foreign trip, anon list of `avatars`/`site-assets` | all refused |
| Edge Functions: `push` without/with wrong secret → 401; `send-invite` without auth → 401, another member's invite → 403; `read-receipt` non-member → 401, path traversal `<mine>/../<theirs>/x` → 404, bucket switch → 400 | OK |
| Anon RPCs: `save_expense`, `generate_settlements`, `delete_my_account`, `notify`, `run_*` | refused |
| Password policy enforced server-side (3 chars → 422 weak_password) | OK |
| OTP verify: 6 wrong codes on a test number → `otp_expired` each, no account impact | OK (no lockout observed either; Supabase per-IP limits apply) |
| Concurrent `save_expense` on one id | both 200, last write wins, sums intact |
| Edit/delete after soft-delete | "expense not found" |
| Done: edits keep Done; a new expense clears it | OK |
| Settled-up on/off/on/on/off | idempotent, state restored exactly |
| Settlement regeneration while all payments pending | regenerates correctly |
| Core fuzz (7 property tests, ~8k random cases): equal/percent/exact/nights sums, no negatives, settlement clears nets with ≤ N−1 payments, deterministic, currency sums | all pass (`npm test`: 37 passed) |
| Cron: three jobs active and succeeding on schedule; nudge query honours `last_active_at` (updated by expenses/comments/Done), 24 h cap, trips not yet started are skipped; archive at 14 d and un-archive on activity; invite expiry | code-verified |
| Indexes present on every foreign key path used by the app; `expense_history` grows one row per create/edit/delete/Done change (150 creates → 150 rows) | OK |
| Trip page at 150 expenses / 4 members: 4 queries, 300 ms worst, 154 KB; Home for a user in 5 trips: 240 ms, 118 KB; `save_expense` ≈ 250 ms including push fan-out | acceptable for V1 (see B-13 for the scaling caveat) |
| `notification_log` payloads: first names, descriptions, amounts, trip ids; self-readable only | acceptable |

## Coverage

| Area | Covered | Not covered |
|---|---|---|
| Access control (tables, RPCs, storage, functions) | yes | realtime channel authorization (not probed) |
| Data integrity (`save_expense`, triggers, settlements, settled-up, Done) | yes | multi-currency rate *fetching* (`fx.ts`) correctness |
| Core math | fuzzed | `formatUsPhoneInput` edge cases (unit tests exist) |
| Auth | password policy, autoconfirm, enumeration, deleted-token lifetime, anon RPCs | Google/Apple id-token path (needs device), OTP per-IP limits beyond 6 tries |
| Edge Functions & cron | auth paths, traversal, resend, cron state | actual push delivery (no device), Twilio delivery (number unverified) |
| Performance | 150-expense trip, 263-expense Home | 20 members (only 7 accounts available), >1k expenses |
| Privacy | users/invites/notification_log/storage | web guest view (apps/web) not in scope |

## Suggested order of fixes

1. B-01 + B-14 + B-05 (one migration: freeze member columns, owner-only re-activation) — closes the takeover path.
2. B-02/B-03/B-04 (one migration: drop direct `expenses` insert/update for members, or add the deferred checks) — protects the ledger.
3. B-08, B-07, B-06 — money correctness in `save_expense` / `mark_settlement` / `generate_settlements`.
4. B-09, B-10, B-11, B-12 — before inviting external testers.
5. P3 items opportunistically.
