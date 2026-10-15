import type { NextConfig } from "next";
import path from "node:path";

const webApp = (process.env.NEXT_PUBLIC_WEB_APP_URL ?? "https://app.zebrasplit.com").replace(/\/$/, "");
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";

// Strict by allow-list: self, Vercel Analytics, and the Supabase project (the site only
// calls Supabase from the server, but the URL is allowed so a future client call isn't a
// surprise). 'unsafe-inline' for scripts/styles is what fully static Next pages need
// without a nonce middleware; see the report.
const csp = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline' https://va.vercel-scripts.com",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self' data:",
  `connect-src 'self' https://va.vercel-scripts.com https://vitals.vercel-insights.com ${supabaseUrl}`.trim(),
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "object-src 'none'",
  "upgrade-insecure-requests",
].join("; ");

const securityHeaders = [
  { key: "Content-Security-Policy", value: csp },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=()" },
];

const nextConfig: NextConfig = {
  transpilePackages: ["@bunktab/core", "@bunktab/theme"],
  outputFileTracingRoot: path.join(__dirname, "../../"),
  reactStrictMode: true,
  poweredByHeader: false,
  async headers() {
    return [
      { source: "/(.*)", headers: securityHeaders },
      { source: "/join/:code*", headers: [{ key: "X-Robots-Tag", value: "noindex, nofollow" }] },
      { source: "/design", headers: [{ key: "X-Robots-Tag", value: "noindex, nofollow" }] },
      {
        source: "/.well-known/:file*",
        headers: [{ key: "Cache-Control", value: "public, max-age=300, s-maxage=3600" }],
      },
    ];
  },
  // The existing guest view (apps/web) keeps its routes on app.zebrasplit.com. The links in
  // old texts point at zebrasplit.com/i/<token>, so those paths move over with a redirect
  // (not a rewrite: proxying another Next app would break its /_next assets and auth cookies).
  async redirects() {
    return [
      { source: "/i/:path*", destination: `${webApp}/i/:path*`, permanent: false },
      { source: "/t/:path*", destination: `${webApp}/t/:path*`, permanent: false },
      { source: "/sms", destination: `${webApp}/sms`, permanent: false },
    ];
  },
};

export default nextConfig;
