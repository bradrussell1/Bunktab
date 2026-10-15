# Zebrasplit reskin — final report

Branch: `reskin/zebrasplit-design-system` (not pushed, no PR; the owner says when).
Screenshots: `design/screens/after/` (mobile at iPhone 18 Pro 3×, web at 390 and 1280).
Design pack in repo: `design/DESIGN_SYSTEM.md`, `design/tokens.ts`, `design/zebra/`, `design/reference/boards/`, `design/DISCOVERY.md`.

## 1. What changed

### Theme and fonts
- `packages/theme/src/tokens.ts` is the Zebrasplit system v1.0: palette, semantic `color`, `zebra` colours, type scale (`text()`), space, radius, shadow, size, layout, motion. `useTheme()` for components, `theme` for everything else.
- Figtree (400/600/700/800) and IBM Plex Mono load at start in the app; Google Fonts on the web. Inter is gone from every `package.json`.
- Web: `packages/theme/scripts/build-css.mjs` emits `apps/web/src/styles/tokens.css` (`--zs-*`); `apps/web/src/app/globals.css` uses tokens only.
- The Gold & Navy theme, its `legacy*` re-exports, `components/ui.tsx` and `legacyVars.ts` are deleted.

### Primitives (`apps/mobile/src/ui/`)
ScreenBackground (gradient + washes), TopBar, Card / HeroCard / RowCard / InsetPanel, Button (primary, ink, secondary, locked, nudge, small, text), Pill / AmountPill / LiveDot, Seg, Switch, Input / AmountInput / CodeCells / NightCell, Avatar / AvatarRow / ChipAvatar / PersonPill, Stripes (meter and bars), Toast (volt), BottomSheet / ActionSheet / confirm, Bubble, Banner (offline, install), Receipt (tear + print), Money, Skeleton, ErrorPanel, Press (scale on press), inline SVG icons. A DEV-only `/design` route shows every primitive and state (`?at=<section>` scrolls there).

### Zebra (`apps/mobile/src/ui/zebra/`, `packages/core/src/zebra.ts`)
- Hand-ported full zebra and bust, seven moods (hi, happy, wink, worried, sleepy, party, star), eye groups kept mounted and crossfaded (250 ms).
- Stripes per member from `stripeLayout()` (masters' geometry, factor 0.565), moods from `zebraMoodFor()` / `progressMood()`, labels from `zebraLabel()`; 14 tests.
- Web busts are generated from the SVG masters by `apps/web/scripts/build-zebra-art.mjs` into `components/zebraArt.ts` with `var(--zs-zebra-*)` fills.

### Motion (`apps/mobile/src/ui/motion/`)
Blink, bob, swish, stripe grow (spring, from the top), done swipe, dance, confetti, rise, receipt print, count up, moon pop, Venmo zip, boop, live dot, twinkle, z's; haptics paired; one shared Reduce Motion check that stops every loop. Rule (also in `apps/mobile/CLAUDE.md`): never a `transform` string in an animated prop on an SVG element (it aborted Expo Go on the UI runtime).

### Screens
- **B1 Login + profile**: landing, phone, code cells, password, forgot, signup, profile setup on the kit; route order fixed so login no longer lands on reset-password.
- **B2 Home "Your dazzles"**: Open / Past, search icon expanding into a pill field, empty state with the hi bust, past dazzles as settled rows.
- **B3 Create a dazzle**: details, dates (DatePicker on the kit), invite from contacts with PersonPills, join-link toast.
- **B4 Dazzle page**: title + caption "… · N nights · N in the dazzle", avatar row with done stripes, balance hero (signed underline, owed-to-you / you-owe pill, zebra with stripes-per-member), "N of 6 stripes" inset with Nudge, who-hasn't-logged line, "See who pays who" accordion, Expenses · People · Summary, sheet footer (Done switch, Add expense, locked "Close out · N to go"), member details, history.
- **B5 Add / edit expense + comments**: amount with currency pill, Snap a receipt (print animation on read), who paid / who's involved chip avatars, Equal / Exact / % / Shares seg, tip, split-by-nights toggle, comments on their own route.
- **B6 Who slept where**: context pill, worried/sleepy bust switching live, "Everyone, every night" and "Back to saved", grid with moon/day/date/per-night volt pills, NightCells, pinned check line (white "adds up" / blush "unclaimed"), "Save the stripes".
- **B7 Earn your stripes + close-out**: stripe meter pill, full zebra growing stripes, member rows (ink when done), "Close out at 6 stripes · N to go", settled payments with Venmo zip, request amounts.
- **B8 Recap**: shareable recap card.
- **B9 Web guest view** (this phase): token-only stylesheet; landing (lowercase wordmark, hi bust, three steps, store note); invite and sign-in gate with bust, pill phone input, six code cells, auto-verify, worried bust on error; dazzle view mirroring B4 minus Venmo close-out (balance hero + zebra, stripes inset, who hasn't logged, who-pays-who, three tabs, close-out list, sheet footer with Done + Add expense); add/edit expense with chip avatars, split seg, night stripes and an inline delete confirm (no `window.confirm`); install banner as a white pill bar; privacy / terms / texting pages on the type classes. All RPCs and `@bunktab/core` arithmetic unchanged.
- **B10 System UI**: skeletons, blush ErrorPanel with worried bust, offline banner → volt "Synced" toast, volt toasts, FAQ.

## 2. Decisions applied and made

From `DESIGN_SYSTEM.md` §12 (all applied): obsolete theme removed (1); ink `#1D1A17` everywhere (2); "Still adding expenses" uses `muted` (3); display name Zebrasplit, scheme `zebrasplit://`, bundle id untouched (4); tabs **Expenses · People · Summary** (5, confirmed by the owner); Home **Open / Past** + search icon button (6); avatar row with done badges and the "hasn't added anything yet" line (7); "See who pays who" InsetPanel accordion (8); sand locked buttons with the reason (9); undrawn screens built from the components (10); wink on invites/joins/sharing (11); stripe formula for 2–12+ (12).

Owner answers: "dazzle" and "stripes" replace every "check" wording ("Your balance" replaced "Your check", "Earn your stripes" replaced the nudge screen, "Grab the check" is gone); web guest view included.

New decisions (noted as they came up):
- Primitives live in `apps/mobile/src/ui/`, tokens in `packages/theme` (the ticket's `src/theme/`), see `DISCOVERY.md` 1–9.
- Single payer per expense in the app's sheet (the web form keeps multi-payer because it already had it; same RPC).
- Nights grid: "Back to saved" instead of "Late arrivals" (the saved state is what it restores); 72 px name column; check line pinned above the button; Save disabled while a night is empty.
- Stripes screen: Done toggle is self-only; request label shows one amount.
- Push copy stays in SQL (not touched); FAQ keeps placeholder copy until the owner writes it.
- Web `themeColor` is the one hex literal left outside the theme (`apps/web/src/app/layout.tsx`); Next needs a literal string there. It equals `--zs-bg-top`.
- Web category tiles show a two-letter code (no icon set on the web yet); the app's tiles use the SVG icons.
- `expo lint` had no config in the repo; it generated one on first run and it is now committed. Two React Compiler advisory rules are warnings, not errors (the compiler is off in this app; Reanimated `shared.value =` in press handlers and "seed form from loaded row" effects are intentional).

## 3. Verification (ticket section, line by line)

1. **tsc, lint, tests.** `tsc --noEmit` passes in `apps/mobile` and `apps/web`. `expo lint`: 0 errors, 22 warnings (all the two advisory rules above). `apps/web` has no ESLint config (pre-existing; `next build` passes). `npm test`: 51 tests pass (core 30, zebra 14, fuzz 7) including `zebraMoodFor` and stripe-position tests.
2. **Grep proof.** No hex, `fontFamily`, `fontSize`, `borderRadius`, `shadowColor` or `elevation` literals in `apps/mobile/src` outside `src/ui/` and `src/ui/zebra/`; none in `packages/core`. Web: no `font-size`, px `border-radius` or px `box-shadow` literals in `globals.css`; the only hex outside `tokens.css` and the generated `zebraArt.ts` is the `themeColor` noted above. Inter: not in any `package.json`.
3. **Screenshots** in `design/screens/after/`: `/design` route (13 captures), Home open/past/empty, Dazzle expenses/people/summary/locked (plus 5-of-6 with your stripe), expense with receipt read, Who slept where balanced and unclaimed, Earn your stripes 2/6, 3/6, 5/6 and settled payments, Recap, Login set, and 19 web captures `b9-web-*` at 390 and 1280.
   - **Not captured: 6/6 and the unlocked close-out.** The Cabo crew dazzle's organizer is the owner's own account; the sixth stripe needs their Done tap (or "Close out anyway") and the test accounts can't act for them. 5/6 is the closest reachable state. One tap in the owner's app unlocks both captures.
4. **Board comparisons.** Main, Trip, Stripes, Nights, Delight and System boards were compared side by side in Phases 2a/2b and fixed (spacing, type, radius, shadow, copy). Deliberate departures are listed in §2. B9 has no board; it mirrors the Trip board at phone width.
5. **Reduce Motion.** With `ReduceMotionEnabled` on in the simulator, two frames of the zebra section of `/design` two seconds apart are byte-identical; with it off they differ (loops running). Capture: `design-route-reduce-motion.png`. Web: a `prefers-reduced-motion` media query disables every animation.
6. **Contrast** (WCAG AA, computed from the tokens): muted on white 5.38:1, muted on cream 5.03:1, muted on sand (locked buttons) 4.69:1, inkSoft on white 11.99:1, blushText on blush 6.16:1, ink on volt 15.32:1, volt on ink 15.32:1, ink on pink 5.69:1, ink on sand 15.11:1. No new pairing falls below 4.5:1.

Test data was restored after the captures: Done states back to 3 of 6 (Priya, Mike, Jen), the villa expense's night presence byte-identical to before.

## 4. Not done and next steps

- **Brand assets**: icon, splash and wordmark are candidates from the happy bust (`assets/brand`); the store icon is untouched until the owner's logo lands.
- **6/6 + unlocked close-out captures**: owner taps Done on Cabo crew (then can toggle back).
- **Web ESLint**: add a flat config to `apps/web` if lint should gate the web too.
- **React Compiler warnings**: if the compiler is ever enabled, revisit the 22 warnings (mostly "seed state from loaded row" effects; move to `useMemo`/derived state).
- **Push notification copy** lives in SQL and still says "Bunktab"-era phrasing in places; rewrite with the §9 voice when the owner wants it.
- **Store listing / bundle id**: out of scope per the owner.
- Push the branch and open the PR when the owner says so.
