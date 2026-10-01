import { cssVariables } from "@checkm8/theme";
import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter", display: "swap" });

export const metadata: Metadata = {
  title: { default: "Checkm8", template: "%s · Checkm8" },
  description: "Split the trip. Settle in Venmo.",
};
export const viewport: Viewport = { themeColor: "#F5F5F7", colorScheme: "light", width: "device-width", initialScale: 1, viewportFit: "cover" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={inter.variable}>
      <head>
        {/* Gold & Navy tokens, the same file the mobile app reads */}
        <style dangerouslySetInnerHTML={{ __html: `:root{${cssVariables()}}` }} />
      </head>
      <body>{children}</body>
    </html>
  );
}
