import { formatUsPhoneInput, toE164 } from "@checkm8/core";
import { useState } from "react";
import { Input } from "@/components/ui";

/**
 * Phone field that formats as you type: "(555) 555-0100" for US numbers,
 * "+44…" left alone for international. Reports the E.164 value (or null)
 * on every change so the caller never parses the display text.
 */
export function PhoneInput({ value, onChange, onSubmit, label = "Phone number", placeholder = "(555) 555-0100", helper, error, autoFocus }: {
  value: string;                                  // display text (owned by the caller)
  onChange: (display: string, e164: string | null) => void;
  onSubmit?: () => void;
  label?: string; placeholder?: string; helper?: string; error?: string | null; autoFocus?: boolean;
}) {
  const [, setTick] = useState(0);
  return (
    <Input
      label={label}
      placeholder={placeholder}
      keyboardType="phone-pad"
      textContentType="telephoneNumber"
      autoComplete="tel"
      autoFocus={autoFocus}
      value={value}
      onChangeText={(t) => {
        // deleting the ")" or "-" should delete the digit before it, not fight the formatter
        const shrinking = t.length < value.length && /[)\-\s]$/.test(value) && !/\d$/.test(t);
        const next = formatUsPhoneInput(shrinking ? t.replace(/\D+$/, "").slice(0, -1) : t);
        onChange(next, toE164(next));
        setTick((n) => n + 1);
      }}
      onSubmitEditing={onSubmit}
      returnKeyType="done"
      helper={helper}
      error={error}
    />
  );
}
