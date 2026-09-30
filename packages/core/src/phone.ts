/**
 * Phone numbers (spec: Login, Create trip → Invite). Storage is E.164 digits
 * without the plus (`15555550100`); the wire format is `+15555550100`; the
 * display format for US numbers is `(555) 555-0100`. Formatting as the user
 * types keeps only digits, so pasting "+1 (555) 555-0100" works too.
 */

/** Only the digits of whatever was typed or pasted. */
export function digitsOnly(input: string): string {
  return (input ?? "").replace(/\D/g, "");
}

/** Normalise to E.164 (`+1…`). US by default: 10 digits, or 11 starting with 1. */
export function toE164(input: string, defaultCountry = "1"): string | null {
  const digits = digitsOnly(input);
  if (!digits) return null;
  if (input.trim().startsWith("+")) return digits.length >= 8 ? `+${digits}` : null;
  if (digits.length === 10) return `+${defaultCountry}${digits}`;
  if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`;
  return null;
}

/**
 * Format a US number progressively as it is typed:
 * "5" → "(5", "555" → "(555", "5555" → "(555) 5", "5555550" → "(555) 555-0",
 * "5555550100" → "(555) 555-0100". A leading 1 (or +1) is dropped for display.
 * Non-US input (starts with + and not +1) is returned as "+" plus digits.
 */
export function formatUsPhoneInput(raw: string): string {
  const trimmed = (raw ?? "").trim();
  let digits = digitsOnly(trimmed);
  if (trimmed.startsWith("+") && !digits.startsWith("1")) return digits ? `+${digits}` : "";
  if (digits.length > 10 && digits.startsWith("1")) digits = digits.slice(1);
  digits = digits.slice(0, 10);
  if (digits.length === 0) return "";
  if (digits.length <= 3) return `(${digits}`;
  if (digits.length <= 6) return `(${digits.slice(0, 3)}) ${digits.slice(3)}`;
  return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
}

/** `+15555550100` or `15555550100` → `(555) 555-0100`; other numbers unchanged. */
export function formatPhoneDisplay(e164OrDigits: string): string {
  const d = digitsOnly(e164OrDigits);
  if (d.length === 11 && d.startsWith("1")) return `(${d.slice(1, 4)}) ${d.slice(4, 7)}-${d.slice(7)}`;
  if (d.length === 10) return `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}`;
  return e164OrDigits.startsWith("+") ? e164OrDigits : `+${d}`;
}
