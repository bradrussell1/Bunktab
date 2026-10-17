/**
 * Site-wide config and the legal placeholders. Every bracketed value in Privacy / Terms comes
 * from `legal` below: set a string to replace the bracket; leave null and the bracketed text
 * stays visible and the build logs a warning. Don't invent values.
 */
export const site = {
  name: "Zebrasplit",
  tagline: "Split the trip. Not the friendship.",
  title: "Zebrasplit · Split the trip. Not the friendship.",
  description: "Keep the Dazzle organized. Track the tab, earn your stripes, and when it's time to close out, everyone pays exactly once via Venmo.",
  joinDescription: "Join the Dazzle to add expenses and settle up.",
} as const;

export type LegalKey = "companyLegalName" | "mailingAddress" | "effectiveDate" | "lastUpdatedDate" | "supportEmail" | "privacyEmail" | "arbitrationProvider" | "deletionDays" | "governingState" | "venueCounty";

export const legal: Record<LegalKey, string | null> = {
  // Launching as a sole proprietor (owner's decision, 2026-10-16). Every value below is published
  // on the Privacy and Terms pages; unsetPlaceholders() warns at build time if one goes back to null.
  companyLegalName: "Bradley Russell, doing business as Zebrasplit",
  mailingAddress: "1801 Broadway, San Francisco, CA 94109",
  effectiveDate: "October 16, 2026",
  lastUpdatedDate: "October 16, 2026",
  supportEmail: "support@zebrasplit.com",
  privacyEmail: "privacy@zebrasplit.com",
  arbitrationProvider: "the American Arbitration Association (AAA)",
  deletionDays: "30",
  // Governing law and venue: one place to change if the owner's state is not California.
  governingState: "California",
  venueCounty: "San Francisco County, California",
};

export const legalPlaceholders: Record<LegalKey, string> = {
  companyLegalName: "[COMPANY LEGAL NAME]",
  mailingAddress: "[MAILING ADDRESS]",
  effectiveDate: "[EFFECTIVE DATE]",
  lastUpdatedDate: "[LAST UPDATED DATE]",
  supportEmail: "[SUPPORT EMAIL]",
  privacyEmail: "[PRIVACY EMAIL]",
  arbitrationProvider: "[ARBITRATION PROVIDER]",
  deletionDays: "[30]",
  governingState: "[GOVERNING STATE]",
  venueCounty: "[VENUE COUNTY]",
};

export const legalValue = (k: LegalKey) => legal[k] ?? legalPlaceholders[k];
export const unsetPlaceholders = () => (Object.keys(legal) as LegalKey[]).filter((k) => !legal[k]);

let warned = false;
/** Logs once per build which placeholders are still bracketed (called from the legal pages at render). */
export function warnUnsetPlaceholders(where: string) {
  if (warned) return;
  const unset = unsetPlaceholders();
  if (unset.length) {
    warned = true;
    console.warn(`[content/site.ts] ${where}: ${unset.length} legal placeholder(s) unset, bracketed text is live: ${unset.map((k) => legalPlaceholders[k]).join(", ")}`);
  }
}

/** mailto: for the support email; the bracketed placeholder when unset (dead link, flagged in the report). */
export const supportMailto = () => `mailto:${legalValue("supportEmail")}`;
