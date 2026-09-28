import { centsToDecimalString, type Cents } from "./money";

/**
 * Venmo close-out links (spec: Settlement logic → Venmo close-out). The
 * link format is widely used but not officially documented by Venmo, so it
 * lives here, in one place, so it is easy to fix if Venmo changes it.
 *
 * App:  venmo://paycharge?txn=pay&recipients=<username>&amount=84.50&note=...
 * Web:  https://venmo.com/?txn=pay&recipients=<username>&amount=84.50&note=...
 *
 * The user still taps Pay inside Venmo; the app never moves money.
 */

export const VENMO_NOTE_MAX = 280;
export const APP_NAME = "Checkm8";

export type VenmoLink = { app: string; web: string; note: string };

/** "<trip title> - settled via Checkm8", trimmed to Venmo's 280-character limit. */
export function venmoNote(tripTitle: string): string {
  const suffix = ` - settled via ${APP_NAME}`;
  const room = VENMO_NOTE_MAX - suffix.length;
  const title = tripTitle.trim().length > room ? `${tripTitle.trim().slice(0, room - 1)}…` : tripTitle.trim();
  return `${title}${suffix}`;
}

function build(txn: "pay" | "charge", recipients: string[], amountCents: Cents, note: string): VenmoLink {
  const params = new URLSearchParams();
  params.set("txn", txn);
  params.set("recipients", recipients.map((r) => r.replace(/^@/, "")).join(","));
  params.set("amount", centsToDecimalString(amountCents));
  params.set("note", note);
  const q = params.toString();
  return { app: `venmo://paycharge?${q}`, web: `https://venmo.com/?${q}`, note };
}

/** One payment: "Pay Mike $84.50". `recipient` is the stored Venmo username; the
 *  phone number is the fallback, which only works if it is the one linked to Venmo. */
export function venmoPayLink(recipient: string, amountCents: Cents, tripTitle: string): VenmoLink {
  if (amountCents <= 0) throw new RangeError("A payment must be more than zero.");
  return build("pay", [recipient], amountCents, venmoNote(tripTitle));
}

/** The creditor's "Request from everyone" - one charge with several recipients for the same amount. */
export function venmoChargeLink(recipients: string[], amountCents: Cents, tripTitle: string): VenmoLink {
  if (recipients.length === 0) throw new RangeError("Pick someone to request from.");
  if (amountCents <= 0) throw new RangeError("A request must be more than zero.");
  return build("charge", recipients, amountCents, venmoNote(tripTitle));
}

/** The "Check it" link on first login: the user sees their own profile before saving. */
export function venmoProfileUrl(username: string): string {
  return `https://venmo.com/u/${encodeURIComponent(username.replace(/^@/, ""))}`;
}

/** Usernames are 5–30 characters: letters, digits, hyphens, underscores. */
export function isValidVenmoUsername(username: string): boolean {
  return /^@?[A-Za-z0-9_-]{5,30}$/.test(username.trim());
}
