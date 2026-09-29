# Checkm8 server jobs

Postgres decides who is told what; Edge Functions do the sending. Every
outbound message is first a row in `notification_log`, which is also the
audit trail and the source of the 24-hour nudge cap.

## How the database reaches the functions

`public.notify(user, kind, title, body, data, trip, dedupe)` inserts the log
row, then `private.call_function('push', …)` issues a `net.http_post` (pg_net)
to `https://qywowvkkkxldgxoatdsh.supabase.co/functions/v1/<name>` with the
header `x-checkm8-secret`. The secret lives in Supabase Vault under the name
`checkm8_internal_secret` and, with the same value, in the function secret
`CHECKM8_INTERNAL_SECRET`. Rotate both together:

```sql
select vault.update_secret((select id from vault.secrets where name = 'checkm8_internal_secret'), '<new value>');
```
```sh
npx supabase secrets set CHECKM8_INTERNAL_SECRET=<new value> --project-ref qywowvkkkxldgxoatdsh
```

The functions base URL is in `private.config` (`functions_url`); no secrets
are stored in the repo or in `public`.

## Functions

| Function | Trigger | Auth | Secrets |
| --- | --- | --- | --- |
| `push` | `public.notify` (pg_net) | shared secret | `EXPO_ACCESS_TOKEN` (optional, only if Expo push security is enabled) |
| `send-invite` | `invites` insert trigger (pg_net), or the app with a user JWT | shared secret, or JWT (only the inviter) | `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_FROM` (all set; `TWILIO_FROM` is Messaging Service `MG017e294d00a0daa9ae26697f5bbb8e26` holding toll-free +1 833 612 7553, which US carriers block until toll-free verification is approved), `INVITE_BASE_URL` (set to the Vercel URL until checkm8.app exists) |
| `read-receipt` | the app, after uploading to `receipts/<trip_id>/<name>.jpg` | user JWT; membership enforced through RLS | `ANTHROPIC_API_KEY` (**needed**; model `claude-sonnet-5`) |

`SUPABASE_URL`, `SUPABASE_ANON_KEY` and `SUPABASE_SERVICE_ROLE_KEY` are
injected by Supabase.

Missing secrets fail soft: `send-invite` logs `{"error":"twilio not
configured","missing":[…]}` on the `invite.sms` row; `read-receipt` returns
`{ total_cents: null, currency: null, confidence: null, error: "not configured" }`.

### Notification events (spec table → kind)

| Event | kind | Fired from |
| --- | --- | --- |
| Invited to a trip | `invite.sms` (text) / `trip.invited` (push if already a user) | `send-invite` |
| New expense that includes you | `expense.new` | `save_expense` (new rows only) |
| Expense deleted | `expense.deleted` | `delete_expense` |
| Your Done badge was reset | `done.reset` | `reset_done_on_new_expense` trigger (replaces `expense.new` for that person) |
| Nudge | `nudge.inactive` (cron) / `nudge.last_one` (`set_done`) | `run_nudges`, `set_done` (24h cap per member via `trip_members.last_nudged_at`) |
| Close out unlocked | `closeout.unlocked` | `set_done` |
| Owner closed out early | `closeout.override` | `owner_closeout` |
| Removed from a trip | `member.removed` | `remove_member` |
| Payment marked paid | `payment.marked` | `mark_settlement` |
| New comment | `comment.new` | `comments` insert trigger |

## Cron (pg_cron)

| Job | Schedule (UTC) | Does |
| --- | --- | --- |
| `checkm8_nudges` | `15 * * * *` | `run_nudges()`: open, started trips with expenses; members not Done and quiet for 24h |
| `checkm8_auto_archive` | `30 9 * * *` | `run_auto_archive()`: open trips quiet for 14 days → `archived` (activity flips them back) |
| `checkm8_invite_expiry` | `45 9 * * *` | `run_invite_expiry()`: pending invites past `expires_at` → `expired` |

Also enforced in the database: 50 invites per user per day
(`guard_invite_rate`), phone numbers normalised to digits.

## Deploy

```sh
export SUPABASE_ACCESS_TOKEN=sbp_…            # personal access token, never committed
npx supabase functions deploy push        --project-ref qywowvkkkxldgxoatdsh --no-verify-jwt
npx supabase functions deploy send-invite --project-ref qywowvkkkxldgxoatdsh --no-verify-jwt
npx supabase functions deploy read-receipt --project-ref qywowvkkkxldgxoatdsh
npx supabase secrets set TWILIO_AUTH_TOKEN=… TWILIO_FROM=… ANTHROPIC_API_KEY=… --project-ref qywowvkkkxldgxoatdsh
```

`--no-verify-jwt` is used only where the function checks the shared secret
(or the JWT) itself. Migrations apply with
`SUPABASE_ACCESS_TOKEN=… node scripts/db-apply.mjs supabase/migrations/<file>.sql`
(Management API; no database password on the build machine).

## Test

`npm run smoke:server` (with `SUPABASE_ACCESS_TOKEN` set for the postgres-role
checks) drives the whole path as the two test numbers: Done reset, new
expense, last-one-out, close-out unlocked, comment, delete, payment marked,
invite cap + text attempts, pg_net delivery, push auth, auto-archive and
un-archive, nudge cap, invite expiry, read-receipt auth. Cleans up after.

## Still needed from you

- **Toll-free verification** for +1 833 612 7553 (Twilio Console → Messaging →
  Regulatory compliance → Toll-free verification): needs a mailing address and
  the app website. Until approved, US carriers drop invite texts.
- **`ANTHROPIC_WORKSPACE_ID`**, or replace `ANTHROPIC_API_KEY` with a key
  created inside a workspace.
- Optional: an Expo access token if you turn on push security for the Expo
  project (`EXPO_ACCESS_TOKEN`).

## Phone login (Supabase Auth)

Login codes go through **Twilio Verify** (service `VAf406e76f8503f527b61d0f38f81e8256`, Supabase `sms_provider = twilio_verify`), which needs no registered number. Test numbers +1 555 555 0100/0101/0102 still take code 123456. Invite texts are separate and use the Messaging Service above.

## Receipt reading key

`ANTHROPIC_API_KEY` is set. If the key is not scoped to a workspace, also set `ANTHROPIC_WORKSPACE_ID` (Console → Workspaces), or the API answers 400.

## Accounts (mobile)

- **Sign-up** = name, email, password, phone, Venmo (optional) → "Enter the
  code we just sent you". Under the hood the account is created on
  email + password (`mailer_autoconfirm` is ON because no SMTP provider is
  configured, so the email is trusted without a confirmation mail), then
  `updateUser({ phone })` texts a code through Twilio Verify and
  `verifyOtp(type: "phone_change")` confirms it. The trigger
  `handle_new_auth_user` copies `display_name` / `venmo_username` from the
  sign-up metadata and keeps `users.email`/`users.phone` in step with
  `auth.users`. An account whose phone isn't confirmed is held on the
  add-phone/code step by the app's root layout (that also covers Google and
  Apple accounts, which arrive without a phone).
- Why not phone first: GoTrue refuses `updateUser({ email })` on a
  phone-created account without a mailer ("Email address "" is invalid"),
  so email + password login would never work.
- **Login** = email or phone + password (`signInWithPassword`). "Text me a
  code instead" keeps the old OTP login for accounts that predate passwords
  (the three test numbers).
- **Forgot password** = phone → texted code (`shouldCreateUser: false`, so an
  unknown number is told so) → the code signs the user in → "Set a new
  password" (`updateUser({ password })`).
- **Google / Apple**: wired through `signInWithOAuth` + `expo-web-browser`
  with redirect `checkm8://callback` (Expo Go: `exp://…/--/callback`; both on
  the redirect allow-list). NOT enabled in Supabase yet: needs a Google
  OAuth client id + secret and an Apple Services ID + key (Apple Developer
  account). Until then the buttons show "… isn't switched on yet".
- Auth config set 2026-09-28: `password_min_length` 8, `mailer_autoconfirm`
  true, `mailer_secure_email_change_enabled` false, `site_url`
  https://www.check-m8.io, redirect allow-list `checkm8://**, exp://**,
  https://www.check-m8.io/**`. Turn email confirmation back on once an SMTP
  provider exists.
- Deleting an account now clears its email too, and a taken email never
  fails a sign-up (the new row just gets no email; migration 0014).
- The web guest view (apps/web) still uses the phone-code login only.
