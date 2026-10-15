import type { Metadata, Viewport } from "next";
import { Figtree, IBM_Plex_Mono } from "next/font/google";
import { Analytics } from "@vercel/analytics/next";
import { palette } from "@bunktab/theme";
import { ScreenBackground } from "@/components/site/ScreenBackground";
import { site } from "@/content/site";
import { siteUrl } from "@/lib/env";
import "@/styles/tokens.css";
import "@/styles/globals.css";

const figtree = Figtree({ subsets: ["latin"], weight: ["400", "600", "700", "800"], display: "swap", variable: "--font-figtree" });
// IBM Plex Mono is used only by the receipt mock on the homepage.
const plexMono = IBM_Plex_Mono({ subsets: ["latin"], weight: ["400", "600"], display: "swap", variable: "--font-plex-mono" });

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: { default: site.title, template: "%s · Zebrasplit" },
  description: site.description,
  applicationName: site.name,
  manifest: "/manifest.webmanifest",
  alternates: { canonical: "/" },
  openGraph: { type: "website", siteName: site.name, locale: "en_US", title: site.title, description: site.description, url: "/" },
  twitter: { card: "summary_large_image", title: site.title, description: site.description },
  formatDetection: { telephone: false },
};

export const viewport: Viewport = { themeColor: palette.volt, width: "device-width", initialScale: 1, colorScheme: "light" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${figtree.variable} ${plexMono.variable}`}>
      <body>
        <a href="#main" className="skipLink">Skip to content</a>
        <ScreenBackground />
        {children}
        <Analytics />
      </body>
    </html>
  );
}
