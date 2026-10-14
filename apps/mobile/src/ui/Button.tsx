import { color, palette, radius, shadow, size, type } from "@bunktab/theme";
import type { ReactNode } from "react";
import { ActivityIndicator, StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";
import { Icon, type IconName } from "./icons";
import { Press, type PressProps } from "./Press";
import { ZText } from "./Text";

type Kind = "primary" | "ink" | "secondary" | "locked" | "nudge";

export type ButtonProps = Omit<PressProps, "children" | "scaleTo"> & {
  label: string;
  kind?: Kind;
  icon?: IconName;
  /** Small pill (40) or inline (32) instead of the 58 CTA. */
  height?: number;
  loading?: boolean;
  /** Secondary on a white surface gets the hairline instead of the control shadow. */
  onWhite?: boolean;
  style?: StyleProp<ViewStyle>;
  right?: ReactNode;
};

const fill: Record<Kind, string> = { primary: palette.volt, ink: palette.ink, secondary: palette.white, locked: palette.sand, nudge: palette.pink };
const ink: Record<Kind, string> = { primary: color.textOnVolt, ink: color.textOnInk, secondary: color.text, locked: color.disabledText, nudge: color.textOnPink };

/**
 * Button.Primary (volt, one per screen), Button.Ink, Button.Secondary, Button.Locked
 * (sand, muted label, always says why), Button.Nudge (pink, 32 tall, 13/800).
 */
export function Button({ label, kind = "primary", icon, height, loading, onWhite, style, right, disabled, accessibilityLabel, ...rest }: ButtonProps) {
  const h = height ?? (kind === "nudge" ? size.pillSmall : size.ctaHeight);
  const small = h <= size.pillButton;
  const locked = kind === "locked";
  const shadowStyle = kind === "primary" ? shadow.voltGlow : kind === "secondary" ? (onWhite ? null : shadow.control) : locked ? null : shadow.card;
  const textVariant = kind === "nudge" || small ? "buttonS" : "button";
  return (
    <Press
      {...rest}
      scaleTo={0.97}
      disabled={disabled || locked || loading}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={{ disabled: !!disabled || locked, busy: !!loading }}
      style={[styles.base, { height: h, borderRadius: radius.pill, backgroundColor: fill[kind], paddingHorizontal: small ? 14 : 22 }, onWhite && kind === "secondary" ? styles.hairline : null, shadowStyle, style]}
    >
      {loading ? (
        <ActivityIndicator color={ink[kind]} />
      ) : (
        <View style={styles.row}>
          {icon ? <Icon name={icon} size={small ? 16 : 20} color={kind === "ink" ? palette.volt : ink[kind]} stroke={2.2} /> : null}
          <ZText variant={textVariant} color={ink[kind]}>{label}</ZText>
          {right}
        </View>
      )}
    </Press>
  );
}

export function IconButton({ name, label, onPress, size: s = size.iconButton, style, ...rest }: { name: IconName; label: string; onPress?: () => void; size?: number; style?: StyleProp<ViewStyle> } & Omit<PressProps, "children" | "style">) {
  return (
    <Press {...rest} onPress={onPress} scaleTo={0.97} accessibilityRole="button" accessibilityLabel={label} hitSlop={6} style={[styles.icon, { width: s, height: s, borderRadius: s / 2 }, shadow.control, style]}>
      <Icon name={name} size={Math.round(s * 0.5)} stroke={2.1} />
    </Press>
  );
}

const styles = StyleSheet.create({
  base: { alignItems: "center", justifyContent: "center", alignSelf: "stretch" },
  row: { flexDirection: "row", alignItems: "center", gap: 8 },
  hairline: { borderWidth: 1.5, borderColor: color.outline },
  icon: { backgroundColor: palette.white, alignItems: "center", justifyContent: "center" },
});

export const buttonType = type.button;
