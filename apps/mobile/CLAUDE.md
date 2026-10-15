# Zebrasplit mobile (Expo)

- The spec is `docs/checkm8-v1-spec.md` at the repo root. Screens, copy and
  arithmetic come from it; the arithmetic itself lives in `@bunktab/core`
  (tested) and the tokens in `@bunktab/theme` - never restyle inline.
- Design system (2026-10-14): `design/DESIGN_SYSTEM.md` wins on anything visual;
  tokens in `@bunktab/theme` (`packages/theme/src/tokens.ts`), primitives in
  `src/ui/` (import from `@/ui`), the zebra in `src/ui/zebra/`, motion in
  `src/ui/motion/`. Black and white first: volt = money coming to you and the one
  primary action per screen, pink/blush = money you owe, nudges, attention;
  settled = no colour. Figtree everywhere (IBM Plex Mono only in the receipt).
  No raw hex, font size, radius or shadow outside the theme and the zebra.
  Never a `transform` string in a Reanimated animated prop on an SVG element
  (it throws on the UI thread and aborts the app) - animate `rotation`/
  `scaleY`/`translateY` with `originX/originY` instead. Review the kit on
  device at `exp://<ip>:8081/--/design` (DEV only). There is no legacy
  theme any more: `src/components/ui.tsx` and the Gold & Navy tokens are gone.
- Money is integer cents end to end. Never a float in state or a request.
- Every read and write goes through `src/lib/supabase.ts` under row-level
  security; money-changing writes that need cross-row checks are RPCs.
- Env: `EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_ANON_KEY` in `.env`
  (see `.env.example`). Never the service role key.
- `npx tsc --noEmit` and `npx expo export --platform web` are the local
  checks; there is no iOS simulator on the build machine.
