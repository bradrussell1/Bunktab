import { alpha, theme } from "@checkm8/theme";
import { LinearGradient } from "expo-linear-gradient";
import { useState, type ReactNode } from "react";
import {
  ActivityIndicator,
  Image,
  Pressable,
  StyleSheet,
  Text as RNText,
  TextInput,
  View,
  type PressableProps,
  type StyleProp,
  type TextInputProps,
  type TextStyle,
  type ViewStyle,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

/**
 * Base components (spec: Components mapped to screens), styled from
 * @checkm8/theme and nothing else. Dusk & Pastel: a near-black canvas,
 * carbon `Tile`s for content, exactly one pastel `Hero` per screen for the
 * number that matters, peach only on actions (ink text, never white),
 * mint = owed to you / Done, dusk = you owe / key text, red = destructive.
 */
const { colors, type, spacing, radius, screenPadding, elevation, palette } = theme;

/* ---------- layout ---------- */

export function Screen({ children, style, padded = true }: { children: ReactNode; style?: StyleProp<ViewStyle>; padded?: boolean }) {
  return (
    <SafeAreaView style={[styles.screen, style]} edges={["top", "left", "right"]}>
      <View style={[styles.screenInner, padded && { paddingHorizontal: screenPadding }]}>{children}</View>
    </SafeAreaView>
  );
}

/** Matte carbon tile: every secondary surface. */
export function Tile({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  return <View style={[styles.card, style]}>{children}</View>;
}
/** `Card` is the tile; kept as the name the screens use. */
export const Card = Tile;

/** The one pastel mesh card per screen. Text inside uses `HeroText` / `colors.hero.*`. */
export function Hero({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  return (
    <View style={[styles.heroShadow]}>
      <LinearGradient colors={[...colors.hero.gradient]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={[styles.hero, style]}>
        {children}
      </LinearGradient>
    </View>
  );
}

/** Round peach action button in a hero's corner (the reference's arrow). */
export function HeroAction({ onPress, label, glyph = "↗", size = 52 }: { onPress: () => void; label: string; glyph?: string; size?: number }) {
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={label} style={({ pressed }) => ({ width: size, height: size, borderRadius: size / 2, backgroundColor: colors.hero.cta, alignItems: "center", justifyContent: "center", opacity: pressed ? 0.85 : 1 })}>
      <RNText style={{ fontSize: size * 0.42, fontWeight: "700", color: colors.hero.onCta, lineHeight: size * 0.5 }}>{glyph}</RNText>
    </Pressable>
  );
}

export function Divider({ onHero }: { onHero?: boolean }) {
  return <View style={[styles.divider, onHero && { backgroundColor: colors.hero.divider }]} />;
}

/* ---------- type ---------- */

type Variant = keyof typeof type;
export function Text({ variant = "body", color, style, children, ...rest }: { variant?: Variant; color?: string; style?: StyleProp<TextStyle>; children: ReactNode } & Omit<React.ComponentProps<typeof RNText>, "style">) {
  return <RNText style={[type[variant] as TextStyle, { color: color ?? colors.text.onBackground.primary }, style]} {...rest}>{children}</RNText>;
}

/** Text on the pastel hero: ink by default; `tone` picks the hero's mid / dusk / mint. */
export function HeroText({ tone = "ink", color, ...rest }: { tone?: "ink" | "mid" | "dusk" | "mint" } & React.ComponentProps<typeof Text>) {
  const c = color ?? (tone === "mid" ? colors.hero.inkMid : tone === "dusk" ? colors.hero.dusk : tone === "mint" ? colors.hero.mint : colors.hero.ink);
  return <Text color={c} {...rest} />;
}

/* ---------- controls ---------- */

export type ButtonKind = "primary" | "secondary" | "text" | "destructive";
export type ButtonSize = "large" | "medium" | "small";

export function Button({ title, kind = "primary", size = "large", loading, disabled, style, ...rest }: { title: string; kind?: ButtonKind; size?: ButtonSize; loading?: boolean } & PressableProps) {
  const isDisabled = disabled || loading;
  const h = size === "large" ? 52 : size === "medium" ? 44 : 36;
  const labelStyle: TextStyle = size === "large" ? type.title2 : size === "medium" ? type.text : type.caption1Semibold;
  const fill =
    kind === "primary" ? (isDisabled ? colors.fill.primaryDisabled : colors.fill.primary)
    : kind === "secondary" ? colors.fill.secondary
    : "transparent";
  const label =
    kind === "primary" ? colors.text.onFill.onPrimary
    : kind === "secondary" ? colors.text.onFill.onSecondary
    : kind === "destructive" ? colors.text.destructive
    : colors.text.onBackground.accent;
  const border = kind === "destructive" ? colors.fill.destructive : kind === "secondary" ? colors.border.soft : "transparent";
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: !!isDisabled }}
      disabled={isDisabled}
      style={({ pressed }) => [
        styles.button,
        { height: h, backgroundColor: fill, borderColor: border, borderWidth: kind === "destructive" || kind === "secondary" ? 1 : 0, opacity: pressed ? 0.85 : kind !== "primary" && isDisabled ? 0.5 : 1, paddingHorizontal: size === "small" ? spacing.md : spacing.xl },
        kind === "text" && { height: undefined, paddingVertical: spacing.sm, paddingHorizontal: spacing.xs },
        style as StyleProp<ViewStyle>,
      ]}
      {...rest}
    >
      {loading ? <ActivityIndicator color={label} /> : <RNText style={[labelStyle, { color: label }]}>{title}</RNText>}
    </Pressable>
  );
}

export function Input({ label, error, helper, style, onFocus, onBlur, ...rest }: { label?: string; error?: string | null; helper?: string } & TextInputProps) {
  return (
    <View style={{ gap: spacing.xs }}>
      {label && <Text variant="caption1Semibold" color={colors.text.onBackground.secondary}>{label}</Text>}
      <FocusInput error={!!error} style={style} onFocus={onFocus} onBlur={onBlur} {...rest} />
      {error ? <Text variant="caption1" color={colors.text.destructive}>{error}</Text> : helper ? <Text variant="caption1" color={colors.text.onBackground.tertiary}>{helper}</Text> : null}
    </View>
  );
}
function FocusInput({ error, style, onFocus, onBlur, ...rest }: { error: boolean } & TextInputProps) {
  const [focused, setFocused] = useState(false);
  return (
    <TextInput
      placeholderTextColor={colors.text.onBackground.tertiary}
      selectionColor={colors.system.cursor}
      keyboardAppearance="dark"
      style={[styles.input, focused && { borderColor: colors.border.primary }, error && { borderColor: colors.fill.destructive }, style]}
      onFocus={(e) => { setFocused(true); onFocus?.(e); }}
      onBlur={(e) => { setFocused(false); onBlur?.(e); }}
      {...rest}
    />
  );
}
export function ListItem({ title, subtitle, left, right, onPress }: { title: string; subtitle?: string; left?: ReactNode; right?: ReactNode; onPress?: () => void }) {
  return (
    <Pressable onPress={onPress} disabled={!onPress} style={({ pressed }) => [styles.listItem, pressed && { backgroundColor: colors.fill.secondary }]} accessibilityRole={onPress ? "button" : undefined}>
      {left}
      <View style={{ flex: 1, gap: 2 }}>
        <Text variant="headline">{title}</Text>
        {subtitle ? <Text variant="caption1" color={colors.text.onBackground.secondary}>{subtitle}</Text> : null}
      </View>
      {right}
    </Pressable>
  );
}

export function Avatar({ name, uri, size = 32, onHero }: { name: string; uri?: string | null; size?: number; onHero?: boolean }) {
  const initials = name.trim().split(/\s+/).map((w) => w[0]).slice(0, 2).join("").toUpperCase() || "?";
  return (
    <View style={[styles.avatar, onHero && styles.avatarHero, { width: size, height: size, borderRadius: size / 2 }]} accessibilityLabel={name}>
      {uri
        ? <Image source={{ uri }} style={{ width: size, height: size }} accessibilityIgnoresInvertColors />
        : <RNText style={{ ...type.caption3, color: onHero ? colors.hero.ink : colors.text.onBackground.primary, fontSize: Math.max(10, size / 2.8), lineHeight: Math.max(12, size / 2.2) }}>{initials}</RNText>}
    </View>
  );
}

/** The Done badge (Caption Caps 2). Mint fill, ink text. Never peach. */
export function DoneBadge() {
  return (
    <View style={styles.doneBadge} accessibilityLabel="Done adding expenses">
      <RNText style={{ ...type.captionCaps2, color: colors.text.onFill.onSuccess }}>Done</RNText>
    </View>
  );
}

export function Segmented<K extends string>({ options, value, onChange }: { options: { key: K; label: string }[]; value: K; onChange: (k: K) => void }) {
  return (
    <View style={styles.seg} accessibilityRole="tablist">
      {options.map((o) => {
        const on = o.key === value;
        return (
          <Pressable key={o.key} onPress={() => onChange(o.key)} accessibilityRole="tab" accessibilityState={{ selected: on }} style={[styles.segItem, on && styles.segOn]}>
            <RNText style={{ ...type.caption1Semibold, color: on ? colors.text.onBackground.primary : colors.text.onBackground.secondary }}>{o.label}</RNText>
          </Pressable>
        );
      })}
    </View>
  );
}

export function EmptyState({ title, body, action }: { title: string; body: string; action?: ReactNode }) {
  return (
    <Tile style={{ alignItems: "center", gap: spacing.sm, paddingVertical: spacing.xxl }}>
      <Text variant="headline">{title}</Text>
      <Text variant="caption1" color={colors.text.onBackground.secondary} style={{ textAlign: "center" }}>{body}</Text>
      {action}
    </Tile>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background.main },
  screenInner: { flex: 1 },
  card: { backgroundColor: colors.background.surface, borderRadius: radius.card, borderWidth: 1, borderColor: colors.border.soft, padding: spacing.lg },
  heroShadow: { borderRadius: radius.hero, ...elevation.sm },
  hero: { borderRadius: radius.hero, padding: spacing.xl, overflow: "hidden" },
  divider: { height: StyleSheet.hairlineWidth, backgroundColor: colors.divider.default },
  button: { alignItems: "center", justifyContent: "center", borderRadius: radius.control, flexDirection: "row" },
  input: { ...type.body, color: colors.text.onBackground.primary, backgroundColor: colors.fill.field, borderWidth: 1, borderColor: colors.border.neutral, borderRadius: radius.control, paddingHorizontal: spacing.md, height: 48 },
  listItem: { flexDirection: "row", alignItems: "center", gap: spacing.md, paddingVertical: spacing.md, paddingHorizontal: spacing.lg, backgroundColor: colors.background.surface },
  avatar: { backgroundColor: colors.background.elevated, borderWidth: 1, borderColor: colors.border.neutral, alignItems: "center", justifyContent: "center", overflow: "hidden" },
  avatarHero: { backgroundColor: alpha(palette.peach, 0.35), borderColor: alpha(palette.heroInk, 0.15) },
  doneBadge: { backgroundColor: colors.fill.success, borderRadius: radius.tag, paddingHorizontal: 6, paddingVertical: 2 },
  seg: { flexDirection: "row", backgroundColor: colors.fill.secondary, borderRadius: radius.control, padding: 2 },
  segItem: { flex: 1, alignItems: "center", paddingVertical: spacing.sm, borderRadius: radius.control - 2 },
  segOn: { backgroundColor: palette.line },
});
