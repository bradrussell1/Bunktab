# Checkm8 — split trip expenses, settle up in Venmo

A group logs shared trip expenses, everyone taps **Done**, and close-out
opens Venmo with each payment pre-filled, using the fewest payments possible.
The spec is [`docs/checkm8-v1-spec.md`](docs/checkm8-v1-spec.md).

## Layout

| Path | What |
| --- | --- |
| `apps/mobile` | Expo (React Native) app, iOS + Android, expo-router |
| `packages/core` | Pure logic: money, split types, lodging nights, settlement, Venmo links, categories, currency. Tested with vitest. No I/O. |
| `packages/theme` | Design tokens: the Pretty Good kit's roles re-coloured with Basalt & Spore |
| `supabase/` | Postgres schema, row-level security, RPCs, storage policies (`migrations/`), Edge Functions (`functions/`) |
| `apps/web` | Next.js web guest view + landing page (phase 5, not yet created) |

## Run

```sh
npm install
npm test                      # packages/core
npm run typecheck             # every workspace
cp apps/mobile/.env.example apps/mobile/.env   # add the anon key
npm run mobile                # Expo dev server; scan the QR with Expo Go
```

## Database

```sh
npx supabase login
npx supabase link --project-ref qywowvkkkxldgxoatdsh
npx supabase db push          # applies supabase/migrations
```

Keys never enter the repo. The anon key goes in `apps/mobile/.env`; the
service role key only in Supabase and Vercel environment variables.

## Rules

- Money is integer cents everywhere.
- Spore Chartreuse means "tap this" and nothing else.
- Every table has row-level security; a user sees a trip's data only as a
  member of that trip. Split and payer sums are re-checked in the database.
- The Venmo link format is undocumented; it lives in one function
  (`packages/core/src/venmo.ts`).
