/** Chip labels for the supported currencies (user: USD default, then EUR, GBP, MXN). */
const LABELS: Record<string, string> = { USD: "$ USD", EUR: "€ EUR", GBP: "£ GBP", MXN: "MX$ MXN" };
export function currencyLabel(code: string): string { return LABELS[code] ?? code; }
