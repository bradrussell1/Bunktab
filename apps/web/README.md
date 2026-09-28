# Checkm8 web (`@checkm8/web`)

Next.js 15 app: the landing page and the no-install **guest view** that invite
texts link to (spec §8). Guests verify their phone, see the trip, add and edit
expenses, and tap Done. Close-out is read-only on the web; Venmo payments
happen in the mobile app.

## Routes

| Route | What |
| --- | --- |
| `/` | Landing: pitch, how it works, store badges (placeholders), privacy/terms |
| `/privacy`, `/terms` | Placeholder policies to replace before launch |
| `/i/[token]` | Invite link: phone verify → `accept_invite_token` → redirect to the trip |
| `/t/[tripId]` | Guest trip view (balance, members + Done badges, expenses, per person, summary, close-out plan), Done toggle, install banner |
| `/t/[tripId]/expense` and `/t/[tripId]/expense/[id]` | Add / edit expense (splits via `@checkm8/core`, saved through `save_expense`) |

## Run

```
cp apps/web/.env.example apps/web/.env.local   # fill in URL + anon key
npm run web            # from the repo root → http://localhost:3000
npm run build --workspace=@checkm8/web
```

Test sign-in: +1 555 555 0100 / 0101 with code 123456 (Supabase test numbers).

## Deploy

Vercel project `checkm8-web` (scope `bradrussell16-2042s-projects`), root
directory `apps/web`, installed from the monorepo root. From the repo root:

```
npx vercel --scope bradrussell16-2042s-projects          # preview
npx vercel --prod --scope bradrussell16-2042s-projects   # production
```

Env vars `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` are set
on the project for production and preview. Never add the service role key.
