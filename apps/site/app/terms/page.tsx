import type { Metadata } from "next";
import { LegalPage } from "@/components/legal/LegalPage";
import { termsIntro, termsNotice, termsSections } from "@/content/legal/terms";

export const metadata: Metadata = { title: "Terms of Service", description: "The agreement that governs your use of Zebrasplit.", alternates: { canonical: "/terms" } };

export default function TermsPage() {
  return <LegalPage title="Terms of Service" which="terms" intro={termsIntro} notice={termsNotice} sections={termsSections} />;
}
