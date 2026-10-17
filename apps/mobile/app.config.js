// Extends app.json. Sentry's Expo plugin wires source-map upload for EAS builds; without
// SENTRY_AUTH_TOKEN it logs a warning and skips the upload, so builds never depend on it.
// Runtime reporting is separate and only starts when EXPO_PUBLIC_SENTRY_DSN is set (see src/lib/sentry.ts).
module.exports = ({ config }) => ({
  ...config,
  plugins: [
    ...(config.plugins ?? []),
    [
      "@sentry/react-native/expo",
      {
        organization: process.env.SENTRY_ORG ?? "zebrasplit",
        project: process.env.SENTRY_PROJECT ?? "zebrasplit-mobile",
        url: "https://sentry.io/",
      },
    ],
  ],
});
