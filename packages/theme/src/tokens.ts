/**
 * Zebrasplit design tokens. The single source of truth for color, type, spacing,
 * shape, elevation and motion. Every component reads from here; no raw hex values,
 * font sizes or radii anywhere else in the app (the zebra artwork is the only exception,
 * and it imports its palette from `zebra` below).
 *
 * Light mode only. Values are taken directly from the approved Claude Design canvas.
 */

export const palette = {
  // Core neutrals
  ink: '#1D1A17',          // all primary text, icons, filled stripes, outlines, dark buttons
  inkSoft: '#3A3631',      // secondary body text that still needs weight (descriptions, hover/pressed ink)
  muted: '#6E6A63',        // captions, meta lines, inactive tabs, placeholder (5.2:1 on hide)
  white: '#FFFFFF',        // card and control surfaces
  hide: '#FFFBF2',         // the zebra's hide; also light chips on dark
  cream: '#FAF7F2',        // inset panels inside cards (stripe meter rows, nudge rows)
  sand: '#F3EFE8',         // icon tiles, avatar fills, disabled / locked buttons
  line: '#F0EBE2',         // row dividers inside cards
  hairline: '#E8E2D8',     // 1.5px outlines on white pills and inputs
  ghost: '#E6E0D6',        // unfilled stripe in meters
  ghostZebra: '#EFE8DC',   // unfilled stripe on the zebra's body
  dashed: '#D3CDC3',       // dashed outlines: empty night cells, not-done avatars
  trackOff: '#DDD8CE',     // toggle track when off
  lockedBg: '#E6DFD3',     // locked primary CTA (receipt flow): visible at the bottom of the gradient
  lockedBorder: '#D3CDC3', // 1.5px border on the locked CTA
  lockedText: '#5C5852',   // label on lockedBg (5.3:1)

  // Accents (the only two colors in the product)
  volt: '#E2FF2B',         // money coming to you + the one next action. Always ink text on it.
  pink: '#FF4FA3',         // money you owe, nudges, attention. Always ink text on it (white fails: 3.0:1).
  blush: '#FFE4F1',        // soft pink surface for owed amounts and warnings
  blushText: '#A3195F',    // text on blush (6.2:1); also destructive text on white (7.3:1)
  blushTextDeep: '#7A1347',// text inside speech bubbles on blush (8.8:1)
  pinkTint: '#FFF3F8',     // avatar disc behind a done zebra bust

  // Background gradient stops
  bgTop: '#FFFFFF',
  bgMid: '#FBF8F2',
  bgBottom: '#F5F0E7',
  washPink: '#FFE9F3',     // radial wash, top right
  washVolt: '#F6FFD3',     // radial wash, upper left
} as const;

/** Semantic roles. Components use these names, not palette names. */
export const color = {
  text: palette.ink,
  textSecondary: palette.inkSoft,
  textMuted: palette.muted,
  textOnVolt: palette.ink,
  textOnPink: palette.ink,
  textOnInk: palette.white,
  accentOnInk: palette.volt, // volt text/icons on ink surfaces (15.3:1)

  surface: palette.white,
  surfaceTranslucent: 'rgba(255,255,255,0.86)', // hero cards over the gradient
  surfaceTranslucentStrong: 'rgba(255,255,255,0.90)',
  surfaceInset: palette.cream,
  surfaceTile: palette.sand,
  surfaceInk: palette.ink,
  segmentTrack: 'rgba(29,26,23,0.06)',

  divider: palette.line,
  outline: palette.hairline,
  outlineDashed: palette.dashed,

  owedToYou: palette.volt,       // pill bg for "+$" amounts and "owed to you"
  youOwe: palette.blush,         // pill bg for "−$" amounts
  youOweText: palette.blushText,
  attention: palette.pink,       // Nudge button, live dot, worried states
  disabledBg: palette.sand,
  disabledText: palette.muted,   // 4.7:1 on sand
  lockedBg: palette.lockedBg,        // every disabled primary action: a pill that says why it's locked
  lockedBorder: palette.lockedBorder,
  lockedText: palette.lockedText,    // 5.3:1 on lockedBg
  destructive: palette.blushText,
  error: palette.blushText,
  errorBg: palette.blush,
  success: palette.volt,         // success is volt + ink, never green

  scrim: 'rgba(29,26,23,0.28)',      // behind sheets and the expense sheet (ink at 28%)
  glassOnInk: 'rgba(255,255,255,0.18)', // the moving stripes on an ink button
  stripeOn: palette.ink,
  stripeOff: palette.ghost,
  stripeOffZebra: palette.ghostZebra,
  dockFade: ['rgba(245,240,231,0)', palette.bgBottom] as const, // behind a docked CTA (receipt flow)
} as const;

/** Zebra artwork palette. Only the Zebra component may use these. */
export const zebra = {
  ink: palette.ink,
  hide: palette.hide,
  muzzle: '#9B9590',
  muzzleSheen: '#ABA59F',  // at 0.7 opacity
  nostril: '#3C3833',
  earInner: '#F5A9B8',
  cheek: '#F7A8BC',
  ghostStripe: palette.ghostZebra,
  shadow: 'rgba(29,26,23,0.07)',
  sparkleVolt: palette.volt,
  sparklePink: palette.pink,
  heart: palette.pink,
  star: palette.volt,
} as const;

export const fonts = {
  // Figtree for everything. Load 400, 600, 700, 800 (and 900 for the wordmark if used).
  regular: 'Figtree_400Regular',
  semibold: 'Figtree_600SemiBold',
  bold: 'Figtree_700Bold',
  extrabold: 'Figtree_800ExtraBold',
  // Receipt read-out only (the "receipt prints in" moment). Nowhere else.
  mono: 'IBMPlexMono_400Regular',
  monoBold: 'IBMPlexMono_700Bold',
} as const;

/**
 * Type scale. letterSpacing is in px (em × size), because React Native has no em.
 * Every number that shows money uses fontVariant: ['tabular-nums'].
 */
export const type = {
  wordmark:   { fontFamily: fonts.extrabold, fontSize: 20, lineHeight: 24, letterSpacing: -0.6 },  // "zebrasplit", always lowercase
  display:    { fontFamily: fonts.extrabold, fontSize: 46, lineHeight: 46, letterSpacing: -1.38 }, // hero balance on Home
  amountL:    { fontFamily: fonts.extrabold, fontSize: 36, lineHeight: 36, letterSpacing: -1.08 }, // "Your check" on a dazzle
  title1:     { fontFamily: fonts.extrabold, fontSize: 32, lineHeight: 34, letterSpacing: -0.96 }, // screen titles ("Earn your stripes")
  title2:     { fontFamily: fonts.extrabold, fontSize: 26, lineHeight: 30, letterSpacing: -0.52 }, // section headers ("Your dazzles")
  titleCompact: { fontFamily: fonts.extrabold, fontSize: 28, lineHeight: 30, letterSpacing: -0.84 }, // receipt-flow screen titles ("Split by Item", the merchant name)
  heroAmount: { fontFamily: fonts.extrabold, fontSize: 44, lineHeight: 46, letterSpacing: -1.32 }, // the receipt-flow hero amount ("Each of 4 pays")
  headline:   { fontFamily: fonts.extrabold, fontSize: 18, lineHeight: 22, letterSpacing: -0.18 }, // card titles
  button:     { fontFamily: fonts.extrabold, fontSize: 17, lineHeight: 20 },                       // large CTA labels
  buttonS:    { fontFamily: fonts.extrabold, fontSize: 14, lineHeight: 18 },                       // pill buttons, Nudge
  amountRow:  { fontFamily: fonts.bold,      fontSize: 15, lineHeight: 20 },                       // amounts in lists
  body:       { fontFamily: fonts.regular,   fontSize: 15, lineHeight: 21 },
  bodyStrong: { fontFamily: fonts.bold,      fontSize: 15, lineHeight: 20 },                       // row titles
  label:      { fontFamily: fonts.bold,      fontSize: 14, lineHeight: 18 },                       // segment labels, chips
  caption:    { fontFamily: fonts.regular,   fontSize: 13, lineHeight: 17 },                       // meta lines ("You paid · split by nights")
  captionStrong: { fontFamily: fonts.bold,   fontSize: 13, lineHeight: 17 },                       // pill text, "3 of 6 stripes"
  small:      { fontFamily: fonts.semibold,  fontSize: 12, lineHeight: 16 },
  micro:      { fontFamily: fonts.extrabold, fontSize: 11, lineHeight: 14 },                       // night column heads, tiny counts
  overline:   { fontFamily: fonts.extrabold, fontSize: 13, lineHeight: 16, letterSpacing: 1.04, textTransform: 'uppercase' as const },
  receipt:    { fontFamily: fonts.mono,      fontSize: 12, lineHeight: 18 },
} as const;

/** 4-pt based spacing. 6 and 10 exist as half steps for tight inline gaps only. */
export const space = {
  0: 0, 2: 2, 4: 4, 6: 6, 8: 8, 10: 10, 12: 12, 14: 14, 16: 16, 20: 20, 24: 24, 32: 32, 40: 40,
} as const;

export const layout = {
  screenGutter: 16,      // card edges to screen edge
  textGutter: 20,        // headings and loose text to screen edge
  cardPadding: 18,       // list cards (16 vertical / 18 horizontal)
  heroPadding: 20,       // hero cards (22 vertical / 20 horizontal)
  topBarTopPadding: 8,   // below the safe-area inset (design shows 52–56 incl. status bar)
  bottomCtaPadding: 30,  // below the bottom CTA, above the home indicator
  listGap: 10,           // between stacked cards
  minTapTarget: 44,
} as const;

/** Radii. Nothing in the product has a sharp corner. */
export const radius = {
  stripe: 999,   // every stripe is a fully rounded rect (radius = width / 2)
  pill: 999,     // buttons, chips, amount pills, segmented controls, inputs
  tile: 14,      // icon tiles, night cells
  inset: 16,     // inset panels inside cards (meter rows, nudge rows)
  row: 22,       // single list-row cards
  card: 24,      // standard cards
  hero: 30,      // hero cards (balance, zebra stage), bottom sheet top corners
  bubble: { tl: 16, tr: 16, br: 16, bl: 4 }, // speech bubble (boop)
} as const;

/** Elevation. Soft, warm, never grey. Shadow color is always ink. */
export const shadow = {
  hairline: { shadowColor: palette.ink, shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 1, elevation: 1 },
  control:  { shadowColor: palette.ink, shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.06, shadowRadius: 8, elevation: 2 },  // round icon buttons
  card:     { shadowColor: palette.ink, shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.05, shadowRadius: 12, elevation: 2 }, // list cards
  hero:     { shadowColor: palette.ink, shadowOffset: { width: 0, height: 14 }, shadowOpacity: 0.07, shadowRadius: 18, elevation: 4 },
  sheet:    { shadowColor: palette.ink, shadowOffset: { width: 0, height: -8 }, shadowOpacity: 0.06, shadowRadius: 15, elevation: 8 },
  voltGlow: { shadowColor: '#8CA000', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.25, shadowRadius: 10, elevation: 4 }, // primary volt CTA only
} as const;

export const size = {
  ctaHeight: 58,          // primary bottom CTA
  buttonHeight: 54,       // paired footer buttons
  pillButton: 40,
  pillSmall: 32,          // Nudge, inline actions
  segmentHeight: 36,
  iconButton: 44,         // round back / profile / menu buttons
  avatar: 40,
  avatarSmall: 26,
  iconTile: 42,
  meterStripe: { width: 8, height: 22, gap: 5, angleDeg: 10 },
  nightCell: { width: 34, height: 56, stripeW: 16, stripeH: 46, angleDeg: 7 },
  toggle: { width: 52, height: 32, knob: 26 },
} as const;

/** Motion. Durations in ms; easings as cubic-bezier control points for Reanimated's Easing.bezier. */
export const motion = {
  colorChange: 220,
  moodCrossfade: 250,
  springPop: { duration: 460, bezier: [0.3, 1.5, 0.5, 1] },      // stripe fills, toggles, pops (overshoot)
  rise: { duration: 550, bezier: [0.2, 0.8, 0.2, 1] },           // cards entering
  countUp: { duration: 1300, easing: 'easeOutCubic' },           // balances ticking up
  blink: { period: 3800, closeAt: 0.94, closedScaleY: 0.1 },
  bob: { period: 3400, translateY: -5, rotateDeg: 2 },
  swish: { period: 2200, fromDeg: -8, toDeg: 14 },
  dance: { duration: 1500, bezier: [0.3, 0.7, 0.3, 1] },
  confetti: { duration: 1500, pieces: 16, secondWaveDelay: 220, bezier: [0.15, 0.7, 0.3, 1] },
  boop: { duration: 900, bezier: [0.3, 1.4, 0.5, 1], bubbleDelay: 350, bubbleDuration: 450 },
  pop: { duration: 450, scale: 1.4 },
  venmoZip: { stripePx: 14, angleDeg: 115, loopMs: 500, travelPx: 56, landDelay: 1300 },
  skeleton: { period: 1400 },                                     // loading bars shimmer ghost ↔ cream
  twinkle: { period: 2600, minOpacity: 0.45 },
  zz: { period: 2400, travelY: -6 },
  liveDot: { period: 1400, minOpacity: 0.35 },
} as const;

/**
 * Web display scale for the marketing site (apps/site). The mobile scale above tops out
 * at display 46; the approved site boards run headings fluidly (clamp) up to 84 px, so
 * those sizes live here as tokens instead of as raw numbers in site components.
 * Fluid = clamp(min px, vw, max px); lineHeight is unitless; tracking is em.
 */
export const siteType = {
  hero:      { min: 44, vw: 6.4, max: 84, lineHeight: 0.98, tracking: -0.04 },  // homepage H1
  page:      { min: 40, vw: 5.6, max: 72, lineHeight: 1,    tracking: -0.04 },  // FAQ H1
  legal:     { min: 40, vw: 5.4, max: 68, lineHeight: 1,    tracking: -0.04 },  // Privacy / Terms H1
  band:      { min: 36, vw: 5,   max: 64, lineHeight: 1,    tracking: -0.04 },  // volt band, final CTA
  section:   { min: 32, vw: 4,   max: 52, lineHeight: 1.04, tracking: -0.03 },  // section H2
  feature:   { min: 30, vw: 3.6, max: 46, lineHeight: 1.04, tracking: -0.03 },  // stripes demo H2, FAQ band
  joinTitle: { min: 34, vw: 9,   max: 40, lineHeight: 1,    tracking: -0.035 }, // /join trip name
} as const;

/** Fixed web text sizes the boards use that the mobile scale doesn't have (px, unitless line height, em tracking). */
export const siteText = {
  lead:      { size: 20, lineHeight: 1.5,  tracking: 0 },       // hero sub-copy
  bodyL:     { size: 18, lineHeight: 1.55, tracking: 0 },       // dark-band copy, FAQ question, volt-band list
  body:      { size: 17, lineHeight: 1.65, tracking: 0 },       // legal reading column, demo copy (1.55)
  bodyM:     { size: 16, lineHeight: 1.6,  tracking: 0 },       // card copy, FAQ answers
  nav:       { size: 15, lineHeight: 1.4,  tracking: 0 },       // nav and footer links
  h2:        { size: 28, lineHeight: 1.15, tracking: -0.025 },  // legal and FAQ section headings
  h3:        { size: 24, lineHeight: 1.2,  tracking: -0.02 },   // how-it-works step titles
  cardTitle: { size: 22, lineHeight: 1.2,  tracking: -0.02 },   // feature card titles
  wordmark:  { size: 26, lineHeight: 1,    tracking: -0.03 },   // nav wordmark (footer: 22)
  wordmarkS: { size: 22, lineHeight: 1,    tracking: -0.03 },
  amount:    { size: 26, lineHeight: 1,    tracking: -0.02 },   // phone-mock balance
  phoneTitle:{ size: 24, lineHeight: 1,    tracking: -0.03 },   // phone-mock screen title
} as const;

export const theme = { palette, color, zebra, fonts, type, space, layout, radius, shadow, size, motion, siteType, siteText };
export type Theme = typeof theme;
export default theme;
