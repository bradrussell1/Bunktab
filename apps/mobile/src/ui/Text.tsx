import { color, text as textStyle, tabular, type TypeStyle } from "@bunktab/theme";
import type { ReactNode } from "react";
import { Text as RNText, type StyleProp, type TextProps, type TextStyle } from "react-native";

export type ZTextProps = Omit<TextProps, "style"> & {
  /** Type-scale name (DESIGN_SYSTEM.md §4). Default: body (Figtree 400, 15/21, ink). */
  variant?: TypeStyle;
  color?: string;
  /** Tabular numerals: every money figure. */
  tabular?: boolean;
  style?: StyleProp<TextStyle>;
  children?: ReactNode;
};

/** The one Text. Figtree 400 ink by default; never pass a raw font family or size. */
export function ZText({ variant = "body", color: c, tabular: tab, style, children, maxFontSizeMultiplier, ...rest }: ZTextProps) {
  const big = variant === "display" || variant === "amountL";
  return (
    <RNText
      {...rest}
      maxFontSizeMultiplier={maxFontSizeMultiplier ?? (big ? 1.15 : 1.3)}
      style={[textStyle(variant, { color: c ?? color.text }), tab ? tabular : null, style]}
    >
      {children}
    </RNText>
  );
}

const minus = "−";

/** $2,193.10 with cents always, the real minus sign, tabular numerals. */
export function formatMoney(cents: number, opts?: { sign?: "auto" | "always" | "never"; currency?: string }): string {
  const sign = opts?.sign ?? "auto";
  const abs = Math.abs(cents);
  const whole = Math.floor(abs / 100);
  const frac = String(abs % 100).padStart(2, "0");
  const body = `${opts?.currency ?? "$"}${whole.toLocaleString("en-US")}.${frac}`;
  if (cents < 0 && sign !== "never") return `${minus}${body}`;
  if (cents > 0 && sign === "always") return `+${body}`;
  return body;
}

export type MoneyProps = Omit<ZTextProps, "children" | "tabular"> & {
  cents: number;
  /** "auto": − for negatives only; "always": + and −; "never": magnitude only. */
  sign?: "auto" | "always" | "never";
  currency?: string;
};

/** Money text: tabular, true minus, cents always. Color follows the parent unless given. */
export function Money({ cents, sign, currency, variant = "amountRow", ...rest }: MoneyProps) {
  return (
    <ZText variant={variant} tabular {...rest}>
      {formatMoney(cents, { sign, currency })}
    </ZText>
  );
}
