/**
 * Checkm8 design tokens - "Dusk & Pastel" (palette 01, Mist & Dusk Apricot).
 *
 * A deep near-black canvas; ONE pastel mesh-gradient hero card per screen
 * (the number that matters: your position, the trip balance, your
 * payments); everything else sits on matte carbon tiles. Peach is the only
 * call-to-action colour; dusk orange is key text and links; soft mint means
 * money coming to you and "Done". Dark only.
 *
 * Rules:
 * - Peach (`fill.primary`) is used ONLY for actions: primary buttons, the
 *   selected chip/segment, switches that are on. Never for balances.
 * - Text on peach is always ink (`text.onFill.onPrimary`), never white.
 * - On the pastel hero use the `hero.*` colours (dark ink, hero mint, hero
 *   dusk); the on-dark text colours are unreadable there.
 * - Dusk orange on the pastel card is for short bold key lines (the
 *   reference uses it at 12px bold); body copy on the hero stays ink.
 * - Mint = owed to you / Done. Dusk = you owe / attention. Red = destructive only.
 */

export const palette = {
  // canvas and tiles
  base: "#0C0E12",
  baseDeep: "#08090D",
  tile: "#14171E",
  tileRaised: "#1A1E27",
  field: "#12141C",
  line: "#252A36",
  lineSoft: "#1D222C",
  // text on dark
  textHi: "#F0F3F8",
  textMid: "#8F96A3",
  textLo: "#656C76",
  // accents
  peach: "#F6AD7B",
  peachSoft: "#FBB285",
  dusk: "#D97E4A",
  duskDeep: "#E06D44",
  mint: "#8FD9BF",
  mintDeep: "#136548",
  red: "#E0605A",
  redDeep: "#B8423D",
  // pastel mesh + ink on it
  meshA: "#F4ECC2",
  meshB: "#DCE6EE",
  meshC: "#E2E5F5",
  heroInk: "#111419",
  heroInkMid: "#656C76",
  white: "#FFFFFF",
} as const;

/** rgba() from a hex and an alpha. */
export function alpha(hex: string, a: number): string {
  const h = hex.replace("#", "");
  const n = parseInt(h.length === 3 ? h.split("").map((c) => c + c).join("") : h, 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${a})`;
}

/** Kit roles → values. Role names are stable; only values changed in the re-skin. */
export const colors = {
  background: { main: palette.base, surface: palette.tile, elevated: palette.tileRaised },
  fill: {
    primary: palette.peach,
    primaryDisabled: alpha(palette.peach, 0.35),
    secondary: palette.tileRaised,
    field: palette.field,
    warning: palette.dusk,
    destructive: palette.red,
    success: palette.mint,
  },
  text: {
    onBackground: {
      primary: palette.textHi,
      secondary: palette.textMid,
      tertiary: palette.textLo,
      accent: palette.dusk,
    },
    onFill: { onPrimary: palette.heroInk, onSecondary: palette.textHi, onDark: palette.textHi, onSuccess: palette.heroInk },
    warning: palette.dusk,
    destructive: palette.red,
    success: palette.mint,
  },
  border: { primary: palette.peach, neutral: palette.line, soft: palette.lineSoft },
  divider: { default: palette.lineSoft },
  icons: { accentOnLight: palette.dusk, accentOnDark: palette.peach, outline: palette.textMid },
  system: { cursor: palette.peach, dimming40: alpha("#000000", 0.6) },
  /** The one pastel card per screen. Gradient runs top-left → bottom-right. */
  hero: {
    gradient: [palette.meshA, palette.meshB, palette.meshC] as readonly [string, string, string],
    ink: palette.heroInk,
    inkMid: palette.heroInkMid,
    dusk: palette.dusk,
    mint: palette.mintDeep,
    cta: palette.peach,
    onCta: palette.heroInk,
    divider: alpha(palette.heroInk, 0.12),
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

/** Shadows are black on black: only the hero card and sheets get one. */
export const elevation = {
  xs: { shadowColor: "#000000", shadowOpacity: 0.35, shadowRadius: 6, shadowOffset: { width: 0, height: 2 }, elevation: 2 },
  sm: { shadowColor: "#000000", shadowOpacity: 0.55, shadowRadius: 16, shadowOffset: { width: 0, height: 12 }, elevation: 6 },
} as const;

export const theme = { palette, colors, type, spacing, screenPadding, radius, elevation } as const;
export type Theme = typeof theme;

/** CSS for the hero background (web). */
export const heroGradientCss = `linear-gradient(135deg, ${palette.meshA} 0%, ${palette.meshB} 50%, ${palette.meshC} 100%)`;

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
    `--text-success: ${colors.text.success}`,
    `--text-destructive: ${colors.text.destructive}`,
    `--text-on-primary: ${colors.text.onFill.onPrimary}`,
    `--text-on-success: ${colors.text.onFill.onSuccess}`,
    `--border-primary: ${colors.border.primary}`,
    `--border-neutral: ${colors.border.neutral}`,
    `--border-soft: ${colors.border.soft}`,
    `--divider: ${colors.divider.default}`,
    `--dimming-40: ${colors.system.dimming40}`,
    `--hero-gradient: ${heroGradientCss}`,
    `--hero-ink: ${colors.hero.ink}`,
    `--hero-ink-mid: ${colors.hero.inkMid}`,
    `--hero-dusk: ${colors.hero.dusk}`,
    `--hero-mint: ${colors.hero.mint}`,
    `--hero-divider: ${colors.hero.divider}`,
    `--radius-tag: ${radius.tag}px`,
    `--radius-control: ${radius.control}px`,
    `--radius-sheet: ${radius.sheet}px`,
    `--radius-card: ${radius.card}px`,
    `--radius-hero: ${radius.hero}px`,
    `--radius-pill: ${radius.pill}px`,
  ].join(";\n");
}
