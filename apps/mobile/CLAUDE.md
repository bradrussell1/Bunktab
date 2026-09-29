# Checkm8 mobile (Expo)

- The spec is `docs/checkm8-v1-spec.md` at the repo root. Screens, copy and
  arithmetic come from it; the arithmetic itself lives in `@checkm8/core`
  (tested) and the tokens in `@checkm8/theme` - never restyle inline.
- Colour rule (Dusk & Pastel, dark only): peach `fill.primary` ONLY on
  actions (primary buttons, selected chips, switches on), always with ink
  text, never white. Exactly one pastel `Hero` per screen (Home = your
  position, trip = balance, close-out = your payments, recap = the card);
  text on it uses `HeroText` / `colors.hero.*`, never the on-dark text
  colours. Everything else is a carbon `Tile`. Mint = owed to you / Done;
  dusk `text.accent` = you owe / key text / links; red = destructive only.
- Money is integer cents end to end. Never a float in state or a request.
- Every read and write goes through `src/lib/supabase.ts` under row-level
  security; money-changing writes that need cross-row checks are RPCs.
- Env: `EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_ANON_KEY` in `.env`
  (see `.env.example`). Never the service role key.
- `npx tsc --noEmit` and `npx expo export --platform web` are the local
  checks; there is no iOS simulator on the build machine.
