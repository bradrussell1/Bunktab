import type { Session } from "@supabase/supabase-js";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { registerForPush, unregisterPush } from "./push";
import { isNetworkError, supabase } from "./supabase";

/**
 * Session + profile for the whole app. `profile` is our users row; a user
 * whose display_name is empty (an old text-code login) goes to the profile
 * step. Sign-up collects the name up front, so those users skip it.
 * `pendingPasswordReset` is set by the forgot-password code screen: the
 * texted code signs the user in, and the root layout keeps them on the
 * reset-password screen until it's saved. `notice` is a one-shot line the
 * login hub shows after a reset ("Password updated…"). Every sign-in
 * auto-links invites by number through the accept_invites_for_me RPC.
 *
 * Nothing awaited in the auth listener may throw: a failed profile read or
 * invite link must never leave `loading` stuck or block navigation.
 */
export type Profile = {
  id: string;
  phone: string | null;
  email: string | null;
  display_name: string | null;
  photo_url: string | null;
  venmo_username: string | null;
};

type AuthState = {
  session: Session | null;
  profile: Profile | null;
  loading: boolean;
  pendingPasswordReset: boolean;
  setPendingPasswordReset: (v: boolean) => void;
  notice: string | null;
  setNotice: (v: string | null) => void;
  refreshProfile: () => Promise<void>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [pendingPasswordReset, setPendingPasswordReset] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const linked = useRef<string | null>(null);

  const loadProfile = useCallback(async (userId: string) => {
    try {
      const { data } = await supabase.from("users").select("id, phone, email, display_name, photo_url, venmo_username").eq("id", userId).maybeSingle();
      if (data) setProfile(data as Profile);
    } catch { /* keep whatever we had; the next focus reloads */ }
  }, []);

  useEffect(() => {
    let alive = true;
    supabase.auth.getSession().then(async ({ data }) => {
      if (!alive) return;
      setSession(data.session);
      if (data.session) { await loadProfile(data.session.user.id); registerForPush(data.session.user.id).catch(() => undefined); }
      setLoading(false);
    }).catch(() => { if (alive) setLoading(false); });
    const { data: sub } = supabase.auth.onAuthStateChange(async (event, s) => {
      setSession(s);
      try {
        if (s) {
          // link invites by number as soon as a confirmed phone is on the session:
          // at sign-in for existing accounts, after the code for new ones
          const key = `${s.user.id}:${s.user.phone ?? ""}`;
          if (s.user.phone && linked.current !== key && (event === "SIGNED_IN" || event === "USER_UPDATED" || event === "TOKEN_REFRESHED")) {
            linked.current = key;
            supabase.rpc("accept_invites_for_me", { p_via: "app" }).then(() => undefined, () => undefined);
          }
          await loadProfile(s.user.id);
          if (event === "SIGNED_IN") registerForPush(s.user.id).catch(() => undefined);
        } else {
          setProfile(null);
          setPendingPasswordReset(false);
        }
      } finally {
        setLoading(false);
      }
    });
    return () => { alive = false; sub.subscription.unsubscribe(); };
  }, [loadProfile]);

  const value = useMemo<AuthState>(() => ({
    session,
    profile,
    loading,
    pendingPasswordReset,
    setPendingPasswordReset,
    notice,
    setNotice,
    refreshProfile: async () => { if (session) await loadProfile(session.user.id); },
    signOut: async () => {
      if (session) await unregisterPush(session.user.id).catch(() => undefined);
      await supabase.auth.signOut().catch(() => undefined);
    },
  }), [session, profile, loading, pendingPasswordReset, notice, loadProfile]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth outside AuthProvider");
  return ctx;
}

/** Normalise what the user typed into E.164 (US default). */
export function toE164(input: string, defaultCountry = "1"): string | null {
  const digits = input.replace(/\D/g, "");
  if (!digits) return null;
  if (input.trim().startsWith("+")) return `+${digits}`;
  if (digits.length === 10) return `+${defaultCountry}${digits}`;
  if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`;
  return null;
}

/** Email or phone? Login takes either in one field. */
export function parseIdentifier(input: string): { email: string } | { phone: string } | null {
  const t = input.trim();
  if (!t) return null;
  if (t.includes("@")) return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(t) ? { email: t.toLowerCase() } : null;
  const phone = toE164(t);
  return phone ? { phone } : null;
}

export const isValidEmail = (s: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s.trim());

/** Supabase's wording → ours. */
export function friendlyAuthError(message: string, provider?: "google" | "apple"): string {
  const m = message.toLowerCase();
  if (isNetworkError(message)) return "Connection hiccup. Tap Log in again.";
  if (provider && (m.includes("not enabled") || m.includes("unsupported provider") || m.includes("provider is not"))) {
    return `${provider === "google" ? "Google" : "Apple"} sign-in isn't switched on yet.`;
  }
  if (m.includes("invalid login credentials")) return "That email or phone and password don't match.";
  if (m.includes("user already registered") || m.includes("already been registered")) return "There's already an account with that number. Log in instead.";
  if (m.includes("rate limit") || m.includes("too many")) return "Too many tries. Wait a minute and try again.";
  if (m.includes("token has expired") || m.includes("otp_expired")) return "That code has expired. Request a new one.";
  if (m.includes("invalid") && m.includes("otp")) return "That code isn't right. Check the text and try again.";
  return message;
}
