/**
 * Checkm8 design tokens - "Gold & Navy" light theme (2026-10-01).
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

export const palette = {
  light: "#F5F5F7",
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
export const colors = {
  background: { main: palette.light, surface: palette.white, elevated: palette.white },
  fill: {
    primary: palette.gold,
    primaryDisabled: alpha(palette.gold, 0.4),
    secondary: palette.gray,
    field: palette.white,
    warning: palette.gold,
    destructive: palette.red,
    success: palette.gold,
  },
  text: {
    onBackground: {
      primary: palette.ink,
      secondary: palette.inkMid,
      tertiary: palette.inkLow,
      accent: palette.navy,
      title: palette.navy,
    },
    onFill: { onPrimary: palette.black, onSecondary: palette.ink, onDark: palette.white, onSuccess: palette.black },
    warning: palette.goldDeep,
    destructive: palette.red,
    success: palette.gold,
    successDeep: palette.goldDeep,
  },
  border: { primary: palette.navy, neutral: palette.gray, soft: palette.gray, focus: palette.gold },
  divider: { default: palette.gray },
  icons: { accentOnLight: palette.navy, accentOnDark: palette.gold, outline: palette.inkMid },
  system: { cursor: palette.navy, dimming40: alpha(palette.black, 0.4) },
  /** The one navy card per screen. Gradient is a subtle navy lift, top-left → bottom-right. */
  hero: {
    gradient: [palette.navy, palette.navyRaised, palette.navy] as readonly [string, string, string],
    ink: palette.white,
    inkMid: palette.onNavyMid,
    dusk: palette.red,
    mint: palette.gold,
    cta: palette.gold,
    onCta: palette.black,
    divider: alpha(palette.white, 0.14),
    chip: alpha(palette.white, 0.12),
  },
} as const;

/** Typography (Inter). size / lineHeight / weight. */
export const type = {
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

export const spacing = { xxs: 2, xs: 4, sm: 8, md: 12, lg: 16, xl: 20, xxl: 24 } as const;
/** Screen side padding. */
export const screenPadding = 16;

export const radius = { tag: 4, control: 8, sheet: 12, card: 16, hero: 22, pill: 24 } as const;

/** Soft shadows on a light canvas: tiles get a whisper, the hero a lift. */
export const elevation = {
  xs: { shadowColor: palette.navy, shadowOpacity: 0.06, shadowRadius: 6, shadowOffset: { width: 0, height: 2 }, elevation: 1 },
  sm: { shadowColor: palette.navy, shadowOpacity: 0.22, shadowRadius: 18, shadowOffset: { width: 0, height: 10 }, elevation: 5 },
} as const;

export const theme = { palette, colors, type, spacing, screenPadding, radius, elevation } as const;
export type Theme = typeof theme;

/** CSS for the hero background (web). */
export const heroGradientCss = `linear-gradient(135deg, ${palette.navy} 0%, ${palette.navyRaised} 50%, ${palette.navy} 100%)`;

/** The same tokens as CSS custom properties, for the Next.js web guest view. */
export function cssVariables(): string {
  return [
    `--bg-main: ${colors.background.main}`,
    `--bg-surface: ${colors.background.surface}`,
    `--bg-elevated: ${colors.background.elevated}`,
    `--fill-primary: ${colors.fill.primary}`,
    `--fill-primary-disabled: ${colors.fill.primaryDisabled}`,
    `--fill-secondary: ${colors.fill.secondary}`,
    `--fill-field: ${colors.fill.field}`,
    `--fill-warning: ${colors.fill.warning}`,
    `--fill-destructive: ${colors.fill.destructive}`,
    `--fill-success: ${colors.fill.success}`,
    `--text-primary: ${colors.text.onBackground.primary}`,
    `--text-secondary: ${colors.text.onBackground.secondary}`,
    `--text-tertiary: ${colors.text.onBackground.tertiary}`,
    `--text-accent: ${colors.text.onBackground.accent}`,
    `--text-title: ${colors.text.onBackground.title}`,
    `--text-success: ${colors.text.success}`,
    `--text-success-deep: ${colors.text.successDeep}`,
    `--text-destructive: ${colors.text.destructive}`,
    `--text-on-primary: ${colors.text.onFill.onPrimary}`,
    `--text-on-success: ${colors.text.onFill.onSuccess}`,
    `--border-primary: ${colors.border.primary}`,
    `--border-neutral: ${colors.border.neutral}`,
    `--border-soft: ${colors.border.soft}`,
    `--border-focus: ${colors.border.focus}`,
    `--divider: ${colors.divider.default}`,
    `--dimming-40: ${colors.system.dimming40}`,
    `--hero-gradient: ${heroGradientCss}`,
    `--hero-ink: ${colors.hero.ink}`,
    `--hero-ink-mid: ${colors.hero.inkMid}`,
    `--hero-dusk: ${colors.hero.dusk}`,
    `--hero-mint: ${colors.hero.mint}`,
    `--hero-divider: ${colors.hero.divider}`,
    `--hero-chip: ${colors.hero.chip}`,
    `--radius-tag: ${radius.tag}px`,
    `--radius-control: ${radius.control}px`,
    `--radius-sheet: ${radius.sheet}px`,
    `--radius-card: ${radius.card}px`,
    `--radius-hero: ${radius.hero}px`,
    `--radius-pill: ${radius.pill}px`,
  ].join(";\n");
}
