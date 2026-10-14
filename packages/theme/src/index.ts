/**
 * @bunktab/theme
 *
 * The Zebrasplit design system (2026-10-14) lives in ./tokens — `theme`, `palette`,
 * `color`, `zebra`, `fonts`, `type`, `space`, `layout`, `radius`, `shadow`, `size`,
 * `motion`, plus `text()` and `useTheme()`. That is the system every new component reads.
 *
 * Everything below the tokens re-export is the LEGACY "Gold & Navy" theme, renamed
 * `legacy*` and kept only until Part B of the reskin has moved every screen. Do not
 * use it in new code; it is deleted in the last reskin commit.
 */
export * from "./tokens";
export * from "./text";

/**
 * LEGACY Gold & Navy light theme (2026-10-01) - deprecated, see header.
 *
 * Palette from the brief: Light #F5F5F7, Gray #E5E5E5, Gold #FCA311,
 * Blue #14213D, Black #000000. Light canvas; white tiles with a gray
 * hairline; ONE navy hero card per screen (the number that matters) with
 * white type and a gold figure; gold is the only call-to-action colour and
 * always carries black text; navy is the accent for links, badges and the
 * large titles; black is body text. Money owed to you is gold, money you
 * owe stays red.
 *
 * Rules:
 * - Gold (`fill.primary`) ONLY on actions (primary buttons, selected
 *   chips/segments, switches on) and on "owed to you" figures. Never white
 *   text on gold.
 * - On the navy hero use `hero.*` colours (white ink, gold owed, red owe).
 * - Gold on white is low-contrast at small sizes: use it for figures ≥ 15px
 *   semibold, and `text.successDeep` (dark gold) for small owed captions.
 * - Red = you owe / destructive only.
 */

export const legacyPalette = {
  light: "#F5F5F7",
  lightDeep: "#ECEDF2",
  white: "#FFFFFF",
  gray: "#E5E5E5",
  grayDeep: "#CFCFD4",
  gold: "#FCA311",
  goldDeep: "#9A6300",
  goldSoft: "#FFE8BF",
  navy: "#14213D",
  navyRaised: "#1E2E52",
  navyLine: "#2B3D66",
  black: "#000000",
  ink: "#0B0D12",
  inkMid: "#4B515C",
  inkLow: "#7A808B",
  red: "#E0605A",
  redDeep: "#B8423D",
  onNavyMid: "#C9CED8",
  onNavyLow: "#8F98AD",
} as const;

/** rgba() from a hex and an alpha. */
export function alpha(hex: string, a: number): string {
  const h = hex.replace("#", "");
  const n = parseInt(h.length === 3 ? h.split("").map((c) => c + c).join("") : h, 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${a})`;
}

/** Kit roles → values. Role names are stable across re-skins. */
export const legacyColors = {
  background: {
    main: legacyPalette.light,
    surface: legacyPalette.white,
    elevated: legacyPalette.white,
    /** Canvas: a whisper of a gradient, white at the top settling into the light gray. */
    gradient: [legacyPalette.white, legacyPalette.light, legacyPalette.lightDeep] as readonly [string, string, string],
  },
  fill: {
    primary: legacyPalette.gold,
    primaryDisabled: alpha(legacyPalette.gold, 0.4),
    secondary: legacyPalette.gray,
    field: legacyPalette.white,
    warning: legacyPalette.gold,
    destructive: legacyPalette.red,
    success: legacyPalette.gold,
  },
  text: {
    onBackground: {
      primary: legacyPalette.ink,
      secondary: legacyPalette.inkMid,
      tertiary: legacyPalette.inkLow,
      accent: legacyPalette.navy,
      title: legacyPalette.navy,
    },
    onFill: { onPrimary: legacyPalette.black, onSecondary: legacyPalette.ink, onDark: legacyPalette.white, onSuccess: legacyPalette.black },
    warning: legacyPalette.goldDeep,
    destructive: legacyPalette.red,
    success: legacyPalette.gold,
    successDeep: legacyPalette.goldDeep,
  },
  border: { primary: legacyPalette.navy, neutral: legacyPalette.gray, soft: legacyPalette.gray, focus: legacyPalette.gold },
  divider: { default: legacyPalette.gray },
  icons: { accentOnLight: legacyPalette.navy, accentOnDark: legacyPalette.gold, outline: legacyPalette.inkMid },
  system: { cursor: legacyPalette.navy, dimming40: alpha(legacyPalette.black, 0.4) },
  /** The one navy card per screen. Gradient is a subtle navy lift, top-left → bottom-right. */
  hero: {
    gradient: [legacyPalette.navy, legacyPalette.navyRaised, legacyPalette.navy] as readonly [string, string, string],
    ink: legacyPalette.white,
    inkMid: legacyPalette.onNavyMid,
    dusk: legacyPalette.red,
    mint: legacyPalette.gold,
    cta: legacyPalette.gold,
    onCta: legacyPalette.black,
    divider: alpha(legacyPalette.white, 0.14),
    chip: alpha(legacyPalette.white, 0.12),
  },
} as const;

/** Typography (Inter). size / lineHeight / weight. */
export const legacyType = {
  largeTitle: { fontSize: 32, lineHeight: 40, fontWeight: "700" as const },
  title2: { fontSize: 17, lineHeight: 24, fontWeight: "600" as const },
  title2Medium: { fontSize: 17, lineHeight: 24, fontWeight: "500" as const },
  title2Regular: { fontSize: 17, lineHeight: 24, fontWeight: "400" as const },
  headline: { fontSize: 16, lineHeight: 20, fontWeight: "500" as const },
  text: { fontSize: 15, lineHeight: 20, fontWeight: "600" as const },
  body: { fontSize: 15, lineHeight: 20, fontWeight: "400" as const },
  caption1: { fontSize: 13, lineHeight: 16, fontWeight: "400" as const },
  caption1Semibold: { fontSize: 13, lineHeight: 16, fontWeight: "600" as const },
  captionCaps2: { fontSize: 12, lineHeight: 16, fontWeight: "700" as const, letterSpacing: 0.6, textTransform: "uppercase" as const },
  caption3: { fontSize: 11, lineHeight: 16, fontWeight: "600" as const },
} as const;

export const legacySpacing = { xxs: 2, xs: 4, sm: 8, md: 12, lg: 16, xl: 20, xxl: 24 } as const;
/** Screen side padding. */
export const legacyScreenPadding = 16;

export const legacyRadius = { tag: 4, control: 8, sheet: 12, card: 16, hero: 22, pill: 24 } as const;

/** Soft shadows on a light canvas: tiles get a whisper, the hero a lift. */
export const legacyElevation = {
  xs: { shadowColor: legacyPalette.navy, shadowOpacity: 0.06, shadowRadius: 6, shadowOffset: { width: 0, height: 2 }, elevation: 1 },
  sm: { shadowColor: legacyPalette.navy, shadowOpacity: 0.22, shadowRadius: 18, shadowOffset: { width: 0, height: 10 }, elevation: 5 },
} as const;

export const legacyTheme = { palette: legacyPalette, colors: legacyColors, type: legacyType, spacing: legacySpacing, screenPadding: legacyScreenPadding, radius: legacyRadius, elevation: legacyElevation } as const;
export type LegacyTheme = typeof legacyTheme;

/** CSS for the hero background (web). */
export const heroGradientCss = `linear-gradient(135deg, ${legacyPalette.navy} 0%, ${legacyPalette.navyRaised} 50%, ${legacyPalette.navy} 100%)`;

/** The same tokens as CSS custom properties, for the Next.js web guest view. */
export function cssVariables(): string {
  return [
    `--bg-main: ${legacyColors.background.main}`,
    `--bg-surface: ${legacyColors.background.surface}`,
    `--bg-elevated: ${legacyColors.background.elevated}`,
    `--fill-primary: ${legacyColors.fill.primary}`,
    `--fill-primary-disabled: ${legacyColors.fill.primaryDisabled}`,
    `--fill-secondary: ${legacyColors.fill.secondary}`,
    `--fill-field: ${legacyColors.fill.field}`,
    `--fill-warning: ${legacyColors.fill.warning}`,
    `--fill-destructive: ${legacyColors.fill.destructive}`,
    `--fill-success: ${legacyColors.fill.success}`,
    `--text-primary: ${legacyColors.text.onBackground.primary}`,
    `--text-secondary: ${legacyColors.text.onBackground.secondary}`,
    `--text-tertiary: ${legacyColors.text.onBackground.tertiary}`,
    `--text-accent: ${legacyColors.text.onBackground.accent}`,
    `--text-title: ${legacyColors.text.onBackground.title}`,
    `--text-success: ${legacyColors.text.success}`,
    `--text-success-deep: ${legacyColors.text.successDeep}`,
    `--text-destructive: ${legacyColors.text.destructive}`,
    `--text-on-primary: ${legacyColors.text.onFill.onPrimary}`,
    `--text-on-success: ${legacyColors.text.onFill.onSuccess}`,
    `--border-primary: ${legacyColors.border.primary}`,
    `--border-neutral: ${legacyColors.border.neutral}`,
    `--border-soft: ${legacyColors.border.soft}`,
    `--border-focus: ${legacyColors.border.focus}`,
    `--divider: ${legacyColors.divider.default}`,
    `--dimming-40: ${legacyColors.system.dimming40}`,
    `--hero-gradient: ${heroGradientCss}`,
    `--hero-ink: ${legacyColors.hero.ink}`,
    `--hero-ink-mid: ${legacyColors.hero.inkMid}`,
    `--hero-dusk: ${legacyColors.hero.dusk}`,
    `--hero-mint: ${legacyColors.hero.mint}`,
    `--hero-divider: ${legacyColors.hero.divider}`,
    `--hero-chip: ${legacyColors.hero.chip}`,
    `--radius-tag: ${legacyRadius.tag}px`,
    `--radius-control: ${legacyRadius.control}px`,
    `--radius-sheet: ${legacyRadius.sheet}px`,
    `--radius-card: ${legacyRadius.card}px`,
    `--radius-hero: ${legacyRadius.hero}px`,
    `--radius-pill: ${legacyRadius.pill}px`,
  ].join(";\n");
}
