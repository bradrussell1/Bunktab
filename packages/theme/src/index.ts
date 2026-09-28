/**
 * Checkm8 design tokens (V1 spec → Design system).
 *
 * The Pretty Good Cross-Platform Mobile Design System's roles, re-coloured
 * with the Basalt & Spore palette as a light theme on a warm cream
 * background. Components, type and spacing are the kit's; only colour
 * values change. This is the one theme file every component reads - a
 * colour change later is a one-line edit here. V1 ships light mode only.
 *
 * Rules carried from the spec:
 * - Spore Chartreuse is used ONLY for actions (primary buttons, the active
 *   tab indicator, selected states). Balances, charts and badges never use
 *   it, so chartreuse always means "tap this".
 * - Primary button: chartreuse fill, Cold Basalt label, 1px Cold Basalt
 *   border (chartreuse on cream is 1.3:1, so the edge needs the border).
 * - Never white text on chartreuse (1.4:1). Spore Deep is the only
 *   chartreuse-family colour used as text on light surfaces.
 * - Dawn Lilac is for borders, dividers and disabled fills, never text.
 */

export const palette = {
  cream: "#FAF7F2",
  white: "#FFFFFF",
  basalt: "#1B1E22",
  quarry: "#3A414A",
  lilac: "#B8BAC8",
  chartreuse: "#C5EB38",
  sporeDeep: "#587000",
  amber: "#A15C00",
  crimson: "#C62839",
  success: "#00806C",
} as const;

/** rgba() from a hex and an alpha - the kit's "at 40%" style values. */
export function alpha(hex: string, a: number): string {
  const h = hex.replace("#", "");
  const n = parseInt(h.length === 3 ? h.split("").map((c) => c + c).join("") : h, 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${a})`;
}

/** Kit roles → our values (spec: Token mapping). */
export const colors = {
  background: { main: palette.cream, surface: palette.white },
  fill: {
    primary: palette.chartreuse,
    primaryDisabled: alpha(palette.chartreuse, 0.4),
    secondary: alpha(palette.lilac, 0.35),
    field: palette.white,
    warning: palette.amber,
    destructive: palette.crimson,
    success: palette.success,
  },
  text: {
    onBackground: {
      primary: palette.basalt,
      secondary: palette.quarry,
      tertiary: alpha(palette.quarry, 0.75),
      accent: palette.sporeDeep,
    },
    onFill: { onPrimary: palette.basalt, onSecondary: palette.basalt, onDark: palette.white },
    warning: palette.amber,
    destructive: palette.crimson,
    success: palette.success,
  },
  border: { primary: palette.basalt, neutral: palette.lilac },
  divider: { default: palette.lilac },
  icons: { accentOnLight: palette.sporeDeep, accentOnDark: palette.chartreuse, outline: alpha(palette.quarry, 0.75) },
  system: { cursor: palette.basalt, dimming40: alpha(palette.basalt, 0.4) },
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

export const radius = { tag: 4, control: 8, sheet: 12, card: 16, pill: 24 } as const;

/** Elevation XS for cards that need to read as separate from cream. */
export const elevation = {
  xs: { shadowColor: palette.basalt, shadowOpacity: 0.06, shadowRadius: 4, shadowOffset: { width: 0, height: 1 }, elevation: 1 },
  sm: { shadowColor: palette.basalt, shadowOpacity: 0.1, shadowRadius: 10, shadowOffset: { width: 0, height: 4 }, elevation: 3 },
} as const;

export const theme = { palette, colors, type, spacing, screenPadding, radius, elevation } as const;
export type Theme = typeof theme;

/** The same tokens as CSS custom properties, for the Next.js web guest view. */
export function cssVariables(): string {
  return [
    `--bg-main: ${colors.background.main}`,
    `--bg-surface: ${colors.background.surface}`,
    `--fill-primary: ${colors.fill.primary}`,
    `--fill-primary-disabled: ${colors.fill.primaryDisabled}`,
    `--fill-secondary: ${colors.fill.secondary}`,
    `--fill-warning: ${colors.fill.warning}`,
    `--fill-destructive: ${colors.fill.destructive}`,
    `--fill-success: ${colors.fill.success}`,
    `--text-primary: ${colors.text.onBackground.primary}`,
    `--text-secondary: ${colors.text.onBackground.secondary}`,
    `--text-tertiary: ${colors.text.onBackground.tertiary}`,
    `--text-accent: ${colors.text.onBackground.accent}`,
    `--text-on-primary: ${colors.text.onFill.onPrimary}`,
    `--border-primary: ${colors.border.primary}`,
    `--border-neutral: ${colors.border.neutral}`,
    `--divider: ${colors.divider.default}`,
    `--dimming-40: ${colors.system.dimming40}`,
    `--radius-tag: ${radius.tag}px`,
    `--radius-control: ${radius.control}px`,
    `--radius-sheet: ${radius.sheet}px`,
    `--radius-card: ${radius.card}px`,
    `--radius-pill: ${radius.pill}px`,
  ].join(";\n");
}
