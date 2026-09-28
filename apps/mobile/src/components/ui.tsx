import { theme } from "@checkm8/theme";
import type { ReactNode } from "react";
import {
  ActivityIndicator,
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
 * Base components from the kit's list (spec: Components mapped to screens),
 * styled from @checkm8/theme and nothing else. Primary button: Spore
 * Chartreuse fill, Cold Basalt label, 1px Cold Basalt border. Chartreuse is
 * never used for anything that isn't an action.
 */
const { colors, type, spacing, radius, screenPadding, elevation } = theme;

/* ---------- layout ---------- */

export function Screen({ children, style, padded = true }: { children: ReactNode; style?: StyleProp<ViewStyle>; padded?: boolean }) {
  return (
    <SafeAreaView style={[styles.screen, style]} edges={["top", "left", "right"]}>
      <View style={[styles.screenInner, padded && { paddingHorizontal: screenPadding }]}>{children}</View>
    </SafeAreaView>
  );
}

export function Card({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  return <View style={[styles.card, style]}>{children}</View>;
}

export function Divider() {
  return <View style={styles.divider} />;
}

/* ---------- type ---------- */

type Variant = keyof typeof type;
export function Text({ variant = "body", color, style, children, ...rest }: { variant?: Variant; color?: string; style?: StyleProp<TextStyle>; children: ReactNode } & Omit<React.ComponentProps<typeof RNText>, "style">) {
  return <RNText style={[type[variant] as TextStyle, { color: color ?? colors.text.onBackground.primary }, style]} {...rest}>{children}</RNText>;
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
    : kind === "destructive" ? colors.fill.destructive
    : "transparent";
  const label =
    kind === "primary" ? colors.text.onFill.onPrimary
    : kind === "secondary" ? colors.text.onFill.onSecondary
    : kind === "destructive" ? colors.text.onFill.onDark
    : colors.text.onBackground.accent;
  const border = kind === "primary" ? colors.border.primary : "transparent";
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: !!isDisabled }}
      disabled={isDisabled}
      style={({ pressed }) => [
        styles.button,
        { height: h, backgroundColor: fill, borderColor: border, borderWidth: kind === "primary" ? 1 : 0, opacity: pressed ? 0.85 : 1, paddingHorizontal: size === "small" ? spacing.md : spacing.xl },
        kind === "text" && { height: undefined, paddingVertical: spacing.sm, paddingHorizontal: spacing.xs },
        style as StyleProp<ViewStyle>,
      ]}
      {...rest}
    >
      {loading ? <ActivityIndicator color={label} /> : <RNText style={[labelStyle, { color: label }]}>{title}</RNText>}
    </Pressable>
  );
}

export function Input({ label, error, helper, style, ...rest }: { label?: string; error?: string | null; helper?: string } & TextInputProps) {
  return (
    <View style={{ gap: spacing.xs }}>
      {label && <Text variant="caption1Semibold" color={colors.text.onBackground.secondary}>{label}</Text>}
      <TextInput
        placeholderTextColor={colors.text.onBackground.tertiary}
        selectionColor={colors.system.cursor}
        style={[styles.input, error ? { borderColor: colors.fill.destructive } : null, style]}
        {...rest}
      />
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

export function Avatar({ name, uri, size = 32 }: { name: string; uri?: string | null; size?: number }) {
  const initials = name.trim().split(/\s+/).map((w) => w[0]).slice(0, 2).join("").toUpperCase() || "?";
  return (
    <View style={[styles.avatar, { width: size, height: size, borderRadius: size / 2 }]} accessibilityLabel={name}>
      {uri ? null : <RNText style={{ ...type.caption3, color: colors.text.onFill.onDark, fontSize: Math.max(10, size / 2.8) }}>{initials}</RNText>}
    </View>
  );
}

/** The Done badge (Caption Caps 2). Success green, never chartreuse. */
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
            <RNText style={{ ...type.caption1Semibold, color: colors.text.onBackground.primary }}>{o.label}</RNText>
          </Pressable>
        );
      })}
    </View>
  );
}

export function EmptyState({ title, body, action }: { title: string; body: string; action?: ReactNode }) {
  return (
    <Card style={{ alignItems: "center", gap: spacing.sm, paddingVertical: spacing.xxl }}>
      <Text variant="headline">{title}</Text>
      <Text variant="caption1" color={colors.text.onBackground.secondary} style={{ textAlign: "center" }}>{body}</Text>
      {action}
    </Card>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background.main },
  screenInner: { flex: 1 },
  card: { backgroundColor: colors.background.surface, borderRadius: radius.card, borderWidth: 1, borderColor: colors.border.neutral, padding: spacing.lg, ...elevation.xs },
  divider: { height: StyleSheet.hairlineWidth, backgroundColor: colors.divider.default },
  button: { alignItems: "center", justifyContent: "center", borderRadius: radius.control, flexDirection: "row" },
  input: { ...type.body, color: colors.text.onBackground.primary, backgroundColor: colors.fill.field, borderWidth: 1, borderColor: colors.border.neutral, borderRadius: radius.control, paddingHorizontal: spacing.md, height: 48 },
  listItem: { flexDirection: "row", alignItems: "center", gap: spacing.md, paddingVertical: spacing.md, paddingHorizontal: spacing.lg, backgroundColor: colors.background.surface },
  avatar: { backgroundColor: theme.palette.quarry, alignItems: "center", justifyContent: "center", overflow: "hidden" },
  doneBadge: { backgroundColor: colors.fill.success, borderRadius: radius.tag, paddingHorizontal: 6, paddingVertical: 2 },
  seg: { flexDirection: "row", backgroundColor: colors.fill.secondary, borderRadius: radius.control, padding: 2 },
  segItem: { flex: 1, alignItems: "center", paddingVertical: spacing.sm, borderRadius: radius.control - 2 },
  segOn: { backgroundColor: colors.background.surface, borderWidth: 1, borderColor: colors.border.neutral },
});
