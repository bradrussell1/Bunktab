# Reskin discovery (Step 0), 2026-10-14

Branch `reskin/zebrasplit-design-system`. Repo: Expo SDK 57 + expo-router (`apps/mobile/src/app`), Next.js 15 guest view (`apps/web`), `packages/core` (pure logic, vitest), `packages/theme` (tokens, read by both apps as `@bunktab/theme`; the npm name stays, see README).

## Stack facts that shape Part A

| Item | Today | Reskin |
|---|---|---|
| Theme | `packages/theme/src/index.ts`: "Gold & Navy" (2026-10-01) roles `colors.*`, `type`, `spacing`, `radius`, `elevation`, `cssVariables()` for web | New `packages/theme/src/tokens.ts` = `design/tokens.ts`; old exports kept but deprecated until Part B's last step |
| Fonts | Inter 300–800 via `@expo-google-fonts/inter`, loaded in `app/_layout.tsx`, applied by `IText`/`ITextInput` wrappers in `components/ui.tsx`; web: `next/font/google` Inter | Figtree 400/600/700/800 + IBM Plex Mono 400/700 (`@expo-google-fonts/figtree`, `@expo-google-fonts/ibm-plex-mono`, installed 0.4.1); web: Google Fonts link |
| Icons | None. Glyphs are text ("↗", "›", "✓") | Inline stroke SVG icons in `src/ui/icons.tsx` (react-native-svg) |
| SVG | `react-native-svg` 15.15.4 (installed, used for nothing yet) | Zebra + ScreenBackground |
| Animation | `react-native-reanimated` 4.5.1 + `react-native-worklets` 0.10.1 (installed; babel plugin present) | All motion in `src/ui/motion/` |
| Haptics | `expo-haptics` 57.0.3 (installed, unused) | Wired per §9 |
| Dark mode | None (light only already) | Unchanged |
| Shared primitives | `components/ui.tsx` (Screen, Tile/Card, Hero, HeroAction/Link/Pill/Text, Divider, Text, Button, FieldSurface, Input, ListItem, Avatar, DoneBadge, Segmented, EmptyState), `NotchedHero`, `RotaryCarousel`, `CategoryPicker`, `DatePicker`, `ContactSheet`, `PhoneInput`, `TripHistoryList` | New `src/ui/` set per §6; old wrappers removed in Part B |
| Web | `apps/web/src/components/*` (Avatar, ExpenseForm, InviteAccept, InstallBanner, PhoneVerify, TripGate, TripView), `globals.css` reads `cssVariables()` | `tokens.css` (`--zs-*`) + components rebuilt in B9 |

## Every screen and state → Part B section

| Route | What it is today | States seen in code | Part B |
|---|---|---|---|
| `index` | Redirect by session | — | — |
| `(auth)/landing` | Wordmark + Login / Sign-Up | — | B1 |
| `(auth)/login` | Hub: Google, Apple, or email/phone | inline error | B1 |
| `(auth)/password` | Email/phone + password | inline error | B1 |
| `(auth)/phone` | Phone → text me a code | inline error | B1 |
| `(auth)/code` | 6-digit code entry | inline error | B1 (six 48 px cells) |
| `(auth)/forgot` | Phone → code → new password | inline errors | B1 |
| `(auth)/signup` | Name, email, password, phone, Venmo, terms | inline error | B1 |
| `(auth)/add-phone` | Attach a phone to an OAuth account | inline error | B1 |
| `(auth)/profile` | Display name + Venmo (first run) | inline error | B1 (profile step; zebra hi → happy) |
| `(auth)/reset-password` | Set a new password (mode=change too) | inline error | B1 |
| `(auth)/callback` | OAuth return | spinner | B10 loading |
| `dev-login` (DEV) | Test sign-in | spinner | B10 |
| `(app)/home` | Trips hero + Open/Archived segmented + cards | empty (3 variants), hero | B2 |
| `(app)/trip/new` | Details + invite (contact sheet, date sheet) | inline errors | B3 |
| `(app)/trip/[id]/index` | Trip: balance hero, tabs Expenses/All/Summary, Done switch, close-out CTA | action sheet ×3, alerts ×5, spinner, errors | B4 |
| `(app)/trip/[id]/expense` | Add/edit expense: amount, payer, split, category rows, lodging nights, receipt | action sheets, alerts, category picker, errors | B5 |
| `(app)/trip/[id]/comments` | Comment thread on an expense | error | B5 (SpeechBubble rows) |
| `(app)/trip/[id]/closeout` | Done gate + settlement plan + Venmo + settled-up | spinner, errors, hero ×11 | B7 |
| `(app)/trip/[id]/recap` | Settled recap card + share | spinner, hero | B8 |
| `(app)/trip/[id]/history` | Trip event log | spinner, error | B4 (menu → history; no board, keep as list) |
| `(app)/trip/[id]/members` | Member list / remove | spinner, alerts, error | B4 (member details sheet) |
| `(app)/history` | Your archived trips | spinner | B2 Past |
| `(app)/settings` | Profile, Venmo, password, sign out, delete | alert, errors, segmented Stats/History | B1 profile + B10 |
| `(app)/faq` | Placeholder (lorem ipsum) | error | B10 (copy TBD) |
| Web `/i/[token]` | Invite accept | — | B9 |
| Web `/t/[tripId]` | Guest trip view + Done toggle | — | B9 |
| Web `/t/[tripId]/expense/[[...id]]` | Guest add/edit expense | — | B9 |
| Web `/`, `/sms`, `/privacy`, `/terms` | Marketing + legal | — | B9 (tokens only) |

Toasts: none today (alerts and inline text). Offline banner: none. Loading: spinners (to become skeletons). Search on Home: none (B2 adds). Settlement preview accordion: exists on the trip page as `HeroLink` expandable (B4 InsetPanel). "Who hasn't logged yet": not built (B4 adds). Member avatar row: not built (B4 adds). Who slept where: lodging nights exist inside the expense form as a toggle + weekday labels, not as a screen (B6 builds the board as its own sheet). Recap: built. Trip history: built but not in the spec's screen list (kept, restyled). Comments: built (spec yes). FAQ: built, spec no (placeholder copy).

Spec screens not built: Who slept where as a screen (B6), search on Home (B2), offline banner (B10), skeletons (B10). Built but not in the spec: trip history log, FAQ, dev-login.

## Decisions taken in Step 0 (ticket: decide and note)

1. Primitives live in `apps/mobile/src/ui/` (new), tokens in `packages/theme/src/tokens.ts` (the repo's theme package), motion in `apps/mobile/src/ui/motion/`, zebra in `apps/mobile/src/ui/zebra/`. The ticket's `src/theme/` maps to the package.
2. The old Gold & Navy exports stay in `packages/theme/src/index.ts` as `legacy*`/deprecated re-exports until every screen has moved (Part B), so the app builds at every commit.
3. Icons: the app has no icon set; Part A adds a small inline-SVG icon module (chevron, plus, search, person, more, camera, check, close, link, moon, send) sized to the 1.8–2.4 stroke the system asks for.
4. Haptics, Reanimated and SVG were already installed and SDK-57 compatible; only the two font packages were added.
5. The Zebra port keeps the masters' geometry to the decimal; colours come from `theme.zebra`. Outline widths scale with size (3.5 at 320, up to 6 below 120) per §7.

## Part A notes (added while building)

6. **Crash root cause, fixed before any screen work.** Expo Go aborted on `/design` (SIGABRT, main thread, `HermesRuntimeImpl::throwPendingError` under `worklets::AnimationFrameBatchinator::flush`). An uncaught JS exception inside a UI-runtime worklet: the zebra's `useAnimatedProps` returned SVG-syntax `transform` strings (`rotate(10 152 214)`, `translate(…) scale(…)`), and Reanimated 4 parses a `transform` prop on the UI thread as CSS (`rotate(10deg)`), throwing on the SVG form. Worklet-thread errors never reach Metro, which is why the console showed nothing. Fix: animate react-native-svg's numeric props instead (`rotation` with `originX/originY` for the tail swish, `scaleY` with `originY` for the blink and the body stripes, `translateY` + `opacity` for the z's); static SVG rotations stay as `transform` strings on plain `<G>`/`<Rect>` elements, which are never touched by Reanimated. `transformOrigin` on Animated.Views uses percentages (`50% 0%`) rather than keywords. Rule for Part B: never put a `transform` string in an animated prop on an SVG element.
7. Native module versions match SDK 57's bundled list exactly (`react-native-reanimated` 4.5.1, `react-native-worklets` 0.10.1, `react-native-svg` 15.15.4, gesture-handler 2.32, haptics 57.0.3). `npx expo install --check` lists ten JS-side Expo packages one patch behind (expo 57.0.26 → .29 etc.); not touched in this phase, not related to the crash.
8. Stripe width factor is 0.565, not the system text's 0.56: the 10-member master draws 7.1-wide stripes at 12.56 spacing, and the masters win on geometry (test pins both masters).
9. The `Zebra` keeps every mood's eye group mounted and crossfades opacity (250 ms) rather than swapping nodes, so a mood change never flashes.
