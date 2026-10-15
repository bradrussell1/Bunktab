/**
 * Names (feedback round 1): the users table keeps first_name and last_name; display_name
 * stays the composed "First Last" every existing reader (web, SQL first_name(), friends,
 * history) already uses. These helpers are the one place the split / join / short form
 * live, so the app and the migration agree. Pure, no I/O.
 */

/** "Mike Chen" → { first: "Mike", last: "Chen" }; "Cher" → { first: "Cher", last: null }; "  " → nulls. */
export function splitName(full: string | null | undefined): { first: string | null; last: string | null } {
  const t = (full ?? "").trim().replace(/\s+/g, " ");
  if (!t) return { first: null, last: null };
  const i = t.indexOf(" ");
  if (i < 0) return { first: t, last: null };
  return { first: t.slice(0, i), last: t.slice(i + 1) };
}

/** The display name from its parts: "Mike Chen"; only one part → that part; neither → null. */
export function joinName(first: string | null | undefined, last: string | null | undefined): string | null {
  const f = (first ?? "").trim(), l = (last ?? "").trim();
  const j = [f, l].filter(Boolean).join(" ");
  return j || null;
}

/** Pill label "First L.": "Mike Chen" → "Mike C."; one word → "Mike"; nothing → fallback. */
export function shortName(first: string | null | undefined, last: string | null | undefined, fallback = "Member"): string {
  const f = (first ?? "").trim(), l = (last ?? "").trim();
  if (!f && !l) return fallback;
  if (!f) return l;
  const initial = l ? `${l[0]!.toUpperCase()}.` : "";
  return initial ? `${f} ${initial}` : f;
}

/** shortName straight from a display name ("Mike Chen" → "Mike C."). */
export function shortNameFromDisplay(display: string | null | undefined, fallback = "Member"): string {
  const { first, last } = splitName(display);
  return shortName(first, last, fallback);
}

/** Sign-up / Account validation: both parts, at least one letter each. */
export function isValidNamePart(s: string): boolean {
  return /\p{L}/u.test(s.trim());
}
