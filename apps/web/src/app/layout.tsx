import type { Metadata, Viewport } from "next";
import "../styles/tokens.css";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "Zebrasplit", template: "%s · Zebrasplit" },
  description: "Split the trip. Keep it black and white.",
};
// themeColor = the top of the gradient (--zs-bg-top); Next needs a literal here, it is the token's value.
export const viewport: Viewport = { themeColor: "#FFFFFF", colorScheme: "light", width: "device-width", initialScale: 1, viewportFit: "cover" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        {/* Zebrasplit design system: --zs-* tokens come from src/styles/tokens.css
            (generated from packages/theme/src/tokens.ts); Figtree + IBM Plex Mono from Google Fonts. */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Figtree:wght@400;600;700;800&family=IBM+Plex+Mono:wght@400;700&display=swap" />
      </head>
      <body>{children}</body>
    </html>
  );
}
