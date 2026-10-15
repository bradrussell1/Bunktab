import { legalValue, type LegalKey } from "@/content/site";
/** A legal placeholder: the configured value or the bracketed text. */
export function Ph({ k }: { k: LegalKey }) {
  return <>{legalValue(k)}</>;
}
