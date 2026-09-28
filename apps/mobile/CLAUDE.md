# Checkm8 mobile (Expo)

- The spec is `docs/checkm8-v1-spec.md` at the repo root. Screens, copy and
  arithmetic come from it; the arithmetic itself lives in `@checkm8/core`
  (tested) and the tokens in `@checkm8/theme` - never restyle inline.
- Colour rule: Spore Chartreuse only on actions; never white text on it;
  primary buttons carry the 1px Cold Basalt border. Light mode only.
- Money is integer cents end to end. Never a float in state or a request.
- Every read and write goes through `src/lib/supabase.ts` under row-level
  security; money-changing writes that need cross-row checks are RPCs.
- Env: `EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_ANON_KEY` in `.env`
  (see `.env.example`). Never the service role key.
- `npx tsc --noEmit` and `npx expo export --platform web` are the local
  checks; there is no iOS simulator on the build machine.
