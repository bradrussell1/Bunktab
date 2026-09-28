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
| `send-invite` | `invites` insert trigger (pg_net), or the app with a user JWT | shared secret, or JWT (only the inviter) | `TWILIO_ACCOUNT_SID` (set), `TWILIO_AUTH_TOKEN` (**needed**), `TWILIO_FROM` (**needed**: a Messaging Service SID `MG…` or an E.164 number), `INVITE_BASE_URL` (set, `https://checkm8.app/i/`) |
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

- Twilio **Auth Token** and a **from** (toll-free number with verification
  submitted, or a Messaging Service SID). Then:
  `npx supabase secrets set TWILIO_AUTH_TOKEN=… TWILIO_FROM=…`
- **Anthropic API key** for receipt reading:
  `npx supabase secrets set ANTHROPIC_API_KEY=…`
- Optional: an Expo access token if you turn on push security for the Expo
  project (`EXPO_ACCESS_TOKEN`).
