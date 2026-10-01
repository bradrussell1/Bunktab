import { theme } from "@checkm8/theme";
import { LinearGradient } from "expo-linear-gradient";
import { useEffect, useRef, useState, type ReactNode } from "react";
import {
  ActivityIndicator,
  Animated,
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
 * @checkm8/theme and nothing else. Gold & Navy: a light canvas, white
 * `Tile`s with a gray hairline, exactly one navy `Hero` per screen for the
 * number that matters, gold only on actions (black text, never white) and
 * on "owed to you" figures, red = you owe / destructive, navy = links,
 * badges and large titles.
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

/** White tile with a gray hairline: every secondary surface. */
export function Tile({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  return <View style={[styles.card, style]}>{children}</View>;
}
/** `Card` is the tile; kept as the name the screens use. */
export const Card = Tile;

/** The one navy card per screen. Text inside uses `HeroText` / `colors.hero.*`. */
export function Hero({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  return (
    <View style={[styles.heroShadow]}>
      <LinearGradient colors={[...colors.hero.gradient]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={[styles.hero, style]}>
        {children}
      </LinearGradient>
    </View>
  );
}

/** Round gold action button in a hero's corner (the reference's arrow). Black glyph. */
export function HeroAction({ onPress, label, glyph = "↗", size = 52 }: { onPress: () => void; label: string; glyph?: string; size?: number }) {
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={label} style={({ pressed }) => ({ width: size, height: size, borderRadius: size / 2, backgroundColor: colors.hero.cta, alignItems: "center", justifyContent: "center", opacity: pressed ? 0.85 : 1 })}>
      <RNText style={{ fontSize: size * 0.42, fontWeight: "700", color: colors.hero.onCta, lineHeight: size * 0.5 }}>{glyph}</RNText>
    </Pressable>
  );
}

/** On-hero link/CTA: gold pill, black text, chevron › that turns down when expanded. */
export function HeroLink({ title, onPress, expanded, expandable = expanded !== undefined }: { title: string; onPress: () => void; expanded?: boolean; expandable?: boolean }) {
  const rot = useRef(new Animated.Value(expanded ? 1 : 0)).current;
  useEffect(() => { Animated.timing(rot, { toValue: expanded ? 1 : 0, duration: 180, useNativeDriver: true }).start(); }, [expanded, rot]);
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityState={expandable ? { expanded: !!expanded } : undefined}
      style={({ pressed }) => [styles.heroLink, { opacity: pressed ? 0.85 : 1 }]}>
      <RNText style={{ ...type.caption1Semibold, color: colors.hero.onCta }}>{title}</RNText>
      <Animated.Text style={{ ...type.title2, lineHeight: 18, color: colors.hero.onCta, marginTop: -1, transform: [{ rotate: rot.interpolate({ inputRange: [0, 1], outputRange: ["0deg", "90deg"] }) }] }}>›</Animated.Text>
    </Pressable>
  );
}

export function Divider({ onHero }: { onHero?: boolean }) {
  return <View style={[styles.divider, onHero && { backgroundColor: colors.hero.divider }]} />;
}

/* ---------- type ---------- */

type Variant = keyof typeof type;
/** Body text is black; large titles default to navy (`text.onBackground.title`). */
export function Text({ variant = "body", color, style, children, ...rest }: { variant?: Variant; color?: string; style?: StyleProp<TextStyle>; children: ReactNode } & Omit<React.ComponentProps<typeof RNText>, "style">) {
  const fallback = variant === "largeTitle" ? colors.text.onBackground.title : colors.text.onBackground.primary;
  return <RNText style={[type[variant] as TextStyle, { color: color ?? fallback }, style]} {...rest}>{children}</RNText>;
}

/** Text on the navy hero: white by default; `tone` picks mid (muted white) / dusk (red, you owe) / mint (gold, owed to you). */
export function HeroText({ tone = "ink", color, ...rest }: { tone?: "ink" | "mid" | "dusk" | "mint" } & React.ComponentProps<typeof Text>) {
  const c = color ?? (tone === "mid" ? colors.hero.inkMid : tone === "dusk" ? colors.hero.dusk : tone === "mint" ? colors.hero.mint : colors.hero.ink);
  return <Text color={c} {...rest} />;
}

/* ---------- controls ---------- */

export type ButtonKind = "primary" | "secondary" | "outline" | "text" | "destructive";
export type ButtonSize = "large" | "medium" | "small";

export function Button({ title, kind = "primary", size = "large", loading, disabled, style, ...rest }: { title: string; kind?: ButtonKind; size?: ButtonSize; loading?: boolean } & PressableProps) {
  const isDisabled = disabled || loading;
  const h = size === "large" ? 52 : size === "medium" ? 44 : 36;
  const labelStyle: TextStyle = size === "large" ? type.title2 : size === "medium" ? type.text : type.caption1Semibold;
  const fill =
    kind === "primary" ? (isDisabled ? colors.fill.primaryDisabled : colors.fill.primary)
    : kind === "secondary" ? colors.fill.secondary
    : kind === "outline" ? colors.background.surface
    : "transparent";
  const label =
    kind === "primary" ? colors.text.onFill.onPrimary
    : kind === "secondary" || kind === "outline" ? colors.text.onFill.onSecondary
    : kind === "destructive" ? colors.text.destructive
    : colors.text.onBackground.accent;
  const border = kind === "destructive" ? colors.fill.destructive : kind === "outline" ? colors.border.neutral : "transparent";
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: !!isDisabled }}
      disabled={isDisabled}
      style={({ pressed }) => [
        styles.button,
        { height: h, backgroundColor: fill, borderColor: border, borderWidth: kind === "destructive" || kind === "outline" ? 1 : 0, opacity: pressed ? 0.85 : kind !== "primary" && isDisabled ? 0.5 : 1, paddingHorizontal: size === "small" ? spacing.md : spacing.xl },
        kind === "text" && { height: undefined, paddingVertical: spacing.sm, paddingHorizontal: spacing.xs },
        style as StyleProp<ViewStyle>,
      ]}
      {...rest}
    >
      {loading ? <ActivityIndicator color={label} /> : <RNText style={[labelStyle, { color: label }]}>{title}</RNText>}
    </Pressable>
  );
}

/** Field surface shared by Input and DateField: white, gray hairline, gold focus ring; `readOnly` = light gray. */
export function FieldSurface({ children, focused, error, readOnly, style }: { children: ReactNode; focused?: boolean; error?: boolean; readOnly?: boolean; style?: StyleProp<ViewStyle> }) {
  return (
    <View style={[styles.field, readOnly && styles.fieldReadOnly, focused && styles.fieldFocused, error && { borderColor: colors.fill.destructive, borderWidth: 2 }, style]}>
      {children}
    </View>
  );
}

export function Input({ label, error, helper, style, onFocus, onBlur, multiline, editable, ...rest }: { label?: string; error?: string | null; helper?: string } & TextInputProps) {
  const [focused, setFocused] = useState(false);
  const flat = (StyleSheet.flatten(style) ?? {}) as TextStyle & ViewStyle;
  const { paddingTop, textAlign, ...box } = flat;
  const readOnly = editable === false;
  return (
    <View style={{ gap: spacing.xs }}>
      {label && <Text variant="caption1Semibold" color={colors.text.onBackground.secondary}>{label}</Text>}
      <FieldSurface focused={focused} error={!!error} readOnly={readOnly} style={[multiline ? { minHeight: 48 } : { height: 48 }, box]}>
        <TextInput
          placeholderTextColor={colors.text.onBackground.tertiary}
          selectionColor={colors.text.onBackground.accent}
          keyboardAppearance="light"
          multiline={multiline}
          editable={editable}
          style={[styles.inputText, readOnly && { color: colors.text.onBackground.secondary }, multiline && { paddingVertical: 12, textAlignVertical: "top" }, paddingTop !== undefined && { paddingTop }, textAlign !== undefined && { textAlign }]}
          onFocus={(e) => { setFocused(true); onFocus?.(e); }}
          onBlur={(e) => { setFocused(false); onBlur?.(e); }}
          {...rest}
        />
      </FieldSurface>
      {error ? <Text variant="caption1" color={colors.text.destructive}>{error}</Text> : helper ? <Text variant="caption1" color={colors.text.onBackground.tertiary}>{helper}</Text> : null}
    </View>
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

/** Small pill with gold text: navy on the light canvas (e.g. "Attendees:"), translucent white when `onHero`. */
export function HeroPill({ children, style, onHero }: { children: ReactNode; style?: StyleProp<ViewStyle>; onHero?: boolean }) {
  return (
    <View style={[styles.heroPill, onHero && { backgroundColor: colors.hero.chip }, style]}>
      <RNText style={{ ...type.caption1Semibold, color: colors.hero.mint }}>{children}</RNText>
    </View>
  );
}

/** The Done badge (Caption Caps 2). Navy with white text; never gold (gold means action or money). */
export function DoneBadge() {
  return (
    <View style={styles.doneBadge} accessibilityLabel="Done adding expenses">
      <RNText style={{ ...type.captionCaps2, color: colors.text.onFill.onDark }}>Done</RNText>
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
  card: { backgroundColor: colors.background.surface, borderRadius: radius.card, borderWidth: 1, borderColor: colors.border.soft, padding: spacing.lg, ...elevation.xs },
  heroShadow: { borderRadius: radius.hero, ...elevation.sm },
  hero: { borderRadius: radius.hero, padding: spacing.xl, overflow: "hidden" },
  divider: { height: StyleSheet.hairlineWidth, backgroundColor: colors.divider.default },
  button: { alignItems: "center", justifyContent: "center", borderRadius: radius.control, flexDirection: "row" },
  field: { borderRadius: radius.control, borderWidth: 1, borderColor: colors.border.neutral, backgroundColor: colors.fill.field, overflow: "hidden", justifyContent: "center" },
  fieldReadOnly: { backgroundColor: colors.fill.secondary },
  fieldFocused: { borderColor: colors.border.focus, borderWidth: 2 },
  inputText: { ...type.body, color: colors.text.onBackground.primary, paddingHorizontal: spacing.md, flexGrow: 1, minHeight: 46 },
  heroPill: { borderRadius: radius.pill, paddingHorizontal: 12, paddingVertical: 6, alignSelf: "flex-start", backgroundColor: palette.navy },
  heroLink: { flexDirection: "row", alignItems: "center", gap: 6, alignSelf: "flex-start", backgroundColor: colors.hero.cta, borderRadius: radius.pill, paddingLeft: 14, paddingRight: 10, paddingVertical: 8 },
  listItem: { flexDirection: "row", alignItems: "center", gap: spacing.md, paddingVertical: spacing.md, paddingHorizontal: spacing.lg, backgroundColor: colors.background.surface },
  avatar: { backgroundColor: colors.fill.secondary, borderWidth: 1, borderColor: colors.border.neutral, alignItems: "center", justifyContent: "center", overflow: "hidden" },
  avatarHero: { backgroundColor: colors.hero.chip, borderColor: colors.hero.divider },
  doneBadge: { backgroundColor: palette.navy, borderRadius: radius.tag, paddingHorizontal: 6, paddingVertical: 2 },
  seg: { flexDirection: "row", backgroundColor: colors.fill.secondary, borderRadius: radius.control, padding: 2 },
  segItem: { flex: 1, alignItems: "center", paddingVertical: spacing.sm, borderRadius: radius.control - 2 },
  segOn: { backgroundColor: colors.background.surface, ...elevation.xs },
});
