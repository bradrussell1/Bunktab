import { cssVariables } from "./legacyVars";
import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "../styles/tokens.css";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter", display: "swap" });

export const metadata: Metadata = {
  title: { default: "Zebrasplit", template: "%s · Zebrasplit" },
  description: "Split the trip. Settle in Venmo.",
};
export const viewport: Viewport = { themeColor: "#F5F5F7", colorScheme: "light", width: "device-width", initialScale: 1, viewportFit: "cover" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={inter.variable}>
      <head>
        {/* Zebrasplit design system: --zs-* tokens come from src/styles/tokens.css
            (generated from packages/theme/src/tokens.ts); Figtree + IBM Plex Mono from Google Fonts. */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Figtree:wght@400;600;700;800&family=IBM+Plex+Mono:wght@400;700&display=swap" />
        {/* LEGACY Gold & Navy variables, kept until the guest view is rebuilt in Part B (B9) */}
        <style dangerouslySetInnerHTML={{ __html: `:root{${cssVariables()}}` }} />
      </head>
      <body>{children}</body>
    </html>
  );
}
