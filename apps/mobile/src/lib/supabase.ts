import "react-native-url-polyfill/auto";
import { createClient } from "@supabase/supabase-js";
import * as SecureStore from "expo-secure-store";
import { AppState, Platform } from "react-native";

/**
 * The one Supabase client. The app ships only the public anon key; row-level
 * security does the rest (spec: Security → Access control). Sessions live in
 * the phone's secure storage (Keychain / Keystore). SecureStore caps a value
 * at 2048 bytes and a Supabase session is larger, so the adapter chunks it.
 * On web the session falls back to AsyncStorage (localStorage).
 *
 * Auth requests get one automatic retry on a transport failure ("Network
 * request failed" on a flaky cellular hop): those calls are safe to repeat
 * and a first-tap failure at login was the reported symptom. Data calls are
 * not retried here, so a write can never be applied twice.
 */
const CHUNK = 1800;

const chunkedSecureStore = {
  async getItem(key: string): Promise<string | null> {
    const count = await SecureStore.getItemAsync(`${key}.n`);
    if (!count) return SecureStore.getItemAsync(key);
    const parts: string[] = [];
    for (let i = 0; i < Number(count); i++) parts.push((await SecureStore.getItemAsync(`${key}.${i}`)) ?? "");
    return parts.join("");
  },
  async setItem(key: string, value: string): Promise<void> {
    await this.removeItem(key);
    if (value.length <= CHUNK) { await SecureStore.setItemAsync(key, value); return; }
    const n = Math.ceil(value.length / CHUNK);
    for (let i = 0; i < n; i++) await SecureStore.setItemAsync(`${key}.${i}`, value.slice(i * CHUNK, (i + 1) * CHUNK));
    await SecureStore.setItemAsync(`${key}.n`, String(n));
  },
  async removeItem(key: string): Promise<void> {
    const count = await SecureStore.getItemAsync(`${key}.n`);
    if (count) {
      for (let i = 0; i < Number(count); i++) await SecureStore.deleteItemAsync(`${key}.${i}`);
      await SecureStore.deleteItemAsync(`${key}.n`);
    }
    await SecureStore.deleteItemAsync(key);
  },
};

// Web: localStorage when there is a window; a no-op store during static
// prerender (expo export renders routes in Node, where there is none).
const webStorage = {
  getItem: async (k: string) => (typeof window === "undefined" ? null : window.localStorage.getItem(k)),
  setItem: async (k: string, v: string) => { if (typeof window !== "undefined") window.localStorage.setItem(k, v); },
  removeItem: async (k: string) => { if (typeof window !== "undefined") window.localStorage.removeItem(k); },
};

const url = process.env.EXPO_PUBLIC_SUPABASE_URL ?? "";
const anonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? "";
export const supabaseConfigured = Boolean(url && anonKey);

/** True for the transport-level failures RN's fetch throws before any response. */
export function isNetworkError(e: unknown): boolean {
  const m = e instanceof Error ? e.message.toLowerCase() : String(e).toLowerCase();
  return m.includes("network request failed") || m.includes("fetch failed") || m.includes("load failed") || m.includes("the internet connection appears to be offline");
}

const retryingFetch: typeof fetch = async (input, init) => {
  const target = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
  const method = (init?.method ?? (typeof input === "object" && "method" in input ? input.method : "GET") ?? "GET").toUpperCase();
  // only idempotent auth calls: reads, and the token grant (refresh / password). Never sign-up,
  // OTP sends or code verification: a retry there can double-send a text or burn a code.
  const retryable = target.includes("/auth/v1/") && (method === "GET" || target.includes("/auth/v1/token"));
  try {
    return await fetch(input, init);
  } catch (e) {
    if (!retryable || !isNetworkError(e)) throw e;
    await new Promise((r) => setTimeout(r, 250));
    return fetch(input, init);
  }
};

export const supabase = createClient(url || "https://placeholder.supabase.co", anonKey || "placeholder", {
  auth: {
    storage: Platform.OS === "web" ? webStorage : chunkedSecureStore,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
  global: { fetch: retryingFetch },
});

// Refresh tokens only while the app is in the foreground. supabase-js
// serialises refreshes with sign-in behind its own lock, so a foreground
// event during a login can't race it.
if (Platform.OS !== "web") {
  AppState.addEventListener("change", (state) => {
    if (state === "active") supabase.auth.startAutoRefresh();
    else supabase.auth.stopAutoRefresh();
  });
}
