import { color, fonts, type, theme, type Theme } from "./tokens";

export type TypeStyle = keyof typeof type;

/**
 * The text style for a type-scale name, ready to spread into a React Native `Text`
 * style or a CSS rule. Money figures should add `tabular()`.
 *
 *   <Text style={[text("headline"), { color: color.textMuted }]}>…</Text>
 */
export function text(style: TypeStyle, overrides?: { color?: string }) {
  const t = type[style];
  return { ...t, color: overrides?.color ?? color.text } as const;
}

/** `fontVariant: ['tabular-nums']` for every number that shows money. */
export const tabular: { fontVariant: ("tabular-nums")[] } = { fontVariant: ["tabular-nums"] };

/** Hook form of the theme; the theme is static, so this is a plain accessor. */
export function useTheme(): Theme {
  return theme;
}

export { fonts };
