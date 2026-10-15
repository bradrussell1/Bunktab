import type { Metadata } from "next";
import { LegalPage } from "@/components/legal/LegalPage";
import { privacyIntro, privacySections } from "@/content/legal/privacy";

export const metadata: Metadata = { title: "Privacy Policy", description: "How Zebrasplit collects, uses and shares information.", alternates: { canonical: "/privacy" } };

export default function PrivacyPage() {
  return <LegalPage title="Privacy Policy" which="privacy" intro={privacyIntro} sections={privacySections} />;
}
