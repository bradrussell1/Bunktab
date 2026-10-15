/** Server-side env access with the defaults the build prompt specifies. */
export const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL ?? "https://zebrasplit.com").replace(/\/$/, "");
export const webAppUrl = (process.env.NEXT_PUBLIC_WEB_APP_URL ?? "https://app.zebrasplit.com").replace(/\/$/, "");
export const appStoreUrl = process.env.NEXT_PUBLIC_APP_STORE_URL || null;
export const playStoreUrl = process.env.NEXT_PUBLIC_PLAY_STORE_URL || null;
export const appStoreId = process.env.APP_STORE_ID || null;
export const deepLink = {
  teamId: process.env.TEAM_ID || null,
  bundleId: process.env.BUNDLE_ID || null,
  androidPackage: process.env.ANDROID_PACKAGE || null,
  androidFingerprints: (process.env.ANDROID_SHA256_FINGERPRINTS ?? "").split(",").map((s) => s.trim()).filter(Boolean),
};
