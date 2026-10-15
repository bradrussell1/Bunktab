# @bunktab/site — zebrasplit.com

The marketing site and invite landing pages. Next.js App Router, TypeScript, CSS Modules; tokens from `@bunktab/theme`, zebra logic from `@bunktab/core`.

```sh
npm install                       # from the repo root
cp apps/site/.env.example apps/site/.env.local   # fill in Supabase URL + anon key
npm run dev --workspace=@bunktab/site            # http://localhost:3100
npm run build --workspace=@bunktab/site          # prebuild regenerates styles/tokens.css and runs the hex check
```

- `styles/tokens.css` is generated (`predev`/`prebuild`) by `packages/theme/scripts/build-css.mjs`; never edit it.
- `scripts/check-hex.mjs` fails the build on any raw colour outside `tokens.css`.
- `/design` is a hidden review page (noindex) with every component state and zebra mood.
- `/join/<code>` reads `get_invite_preview(code)` (Supabase, anon key, server only).
