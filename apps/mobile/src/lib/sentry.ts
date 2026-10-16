/**
 * Crash and error reporting. A no-op until EXPO_PUBLIC_SENTRY_DSN is set (EAS secret or .env),
 * so development and Expo Go never send anything. No PII: Sentry's default user/IP capture is off
 * and we never attach names, phones, amounts or receipt content to events.
 */
import * as Sentry from "@sentry/react-native";
import Constants from "expo-constants";

const dsn = process.env.EXPO_PUBLIC_SENTRY_DSN;
export const sentryEnabled = !!dsn;

export function initSentry() {
  if (!dsn) return;
  const version = Constants.expoConfig?.version ?? "0.0.0";
  const build = Constants.expoConfig?.ios?.buildNumber ?? Constants.expoConfig?.android?.versionCode ?? "dev";
  Sentry.init({
    dsn,
    sendDefaultPii: false,
    release: `zebrasplit@${version}+${build}`,
    dist: String(build),
    environment: __DEV__ ? "development" : "production",
    tracesSampleRate: 0.1,
    enableAutoSessionTracking: true,
    beforeSend(event) {
      // belt and braces: strip anything that looks like a phone number or dollar amount from messages
      if (event.message) event.message = scrub(event.message);
      for (const ex of event.exception?.values ?? []) if (ex.value) ex.value = scrub(ex.value);
      return event;
    },
  });
}

const scrub = (s: string) => s.replace(/\+?\d[\d\s().-]{8,}\d/g, "[number]").replace(/\$\s?\d[\d,]*(\.\d{2})?/g, "[amount]");

/** Report a handled error with a few safe tags. Silent when Sentry is off. */
export function reportError(err: unknown, tags?: Record<string, string | number | boolean>) {
  if (!dsn) return;
  Sentry.withScope((scope) => {
    if (tags) scope.setTags(tags);
    Sentry.captureException(err instanceof Error ? err : new Error(String(err)));
  });
}

/** Wraps the root component with Sentry's error boundary and navigation instrumentation when enabled. */
export const wrapRoot = <P extends Record<string, unknown>>(component: React.ComponentType<P>): React.ComponentType<P> => (dsn ? Sentry.wrap(component) : component);
