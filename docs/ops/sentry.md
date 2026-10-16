# Sentry

Error reporting is wired in three places and is **off until a DSN exists**. Nothing is sent from
development, Expo Go or CI.

| Where | Variable | Set it as | Effect when set |
|---|---|---|---|
| Mobile app runtime | `EXPO_PUBLIC_SENTRY_DSN` | EAS secret (`eas secret:create --scope project --name EXPO_PUBLIC_SENTRY_DSN --value …`), or `apps/mobile/.env` for a local dev build | `src/lib/sentry.ts` initialises `@sentry/react-native`, wraps the root layout in the error boundary, tags release `zebrasplit@<version>+<build>`. `sendDefaultPii` is false and messages are scrubbed of number runs and dollar amounts. |
| Mobile source maps (EAS build step) | `SENTRY_AUTH_TOKEN`, optional `SENTRY_ORG`, `SENTRY_PROJECT` | EAS secrets | `app.config.js` adds the `@sentry/react-native/expo` plugin (defaults: org `zebrasplit`, project `zebrasplit-mobile`). Without the token the plugin logs a warning and skips the upload; the build still succeeds. |
| Edge Functions | `SENTRY_DSN`, optional `SENTRY_ENV`, `FUNCTIONS_RELEASE` | Supabase secret (`supabase secrets set SENTRY_DSN=… --project-ref qywowvkkkxldgxoatdsh`) | `_shared/sentry.ts` posts an envelope for any uncaught error in `receipt-parse`, `receipt-save`, `send-invite`, `push` (via `withSentry`) with function name and method tags. No request bodies, item names or phone numbers are sent. |

## Setting it up

1. Create a Sentry org (free tier is fine) and two projects: **React Native** (`zebrasplit-mobile`) and **Deno** or plain **JavaScript** (`zebrasplit-functions`). Each project page shows its DSN.
2. Put the mobile DSN in EAS and the functions DSN in Supabase secrets, as above. Redeploy the functions once (`supabase functions deploy …`) so they pick up the secret; cut a new EAS build for the app.
3. Optional: an organization auth token with `project:releases` and `org:read` scopes as `SENTRY_AUTH_TOKEN` in EAS, so stack traces are symbolicated.
4. Alerts worth turning on in Sentry: a new issue in production, and more than 10 events of one issue in an hour.

## What is deliberately not sent

Receipt images or text, item names, amounts, phone numbers, user names or emails. Error messages are
scrubbed before leaving the device or function. If a stack trace ever needs more context, add a tag with an
id (trip, expense, receipt), never content.
