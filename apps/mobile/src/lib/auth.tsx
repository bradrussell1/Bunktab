import type { Session } from "@supabase/supabase-js";
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { registerForPush, unregisterPush } from "./push";
import { supabase } from "./supabase";

/**
 * Session + profile for the whole app. `profile` is our users row; a user
 * whose display_name is empty is on first login and goes to the profile
 * step (spec: Login). Phone login auto-links invites by number through the
 * accept_invites_for_me RPC on every sign-in.
 */
export type Profile = {
  id: string;
  phone: string | null;
  display_name: string | null;
  photo_url: string | null;
  venmo_username: string | null;
};

type AuthState = {
  session: Session | null;
  profile: Profile | null;
  loading: boolean;
  refreshProfile: () => Promise<void>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  const loadProfile = useCallback(async (userId: string) => {
    const { data } = await supabase.from("users").select("id, phone, display_name, photo_url, venmo_username").eq("id", userId).maybeSingle();
    setProfile((data as Profile | null) ?? null);
  }, []);

  useEffect(() => {
    let alive = true;
    supabase.auth.getSession().then(async ({ data }) => {
      if (!alive) return;
      setSession(data.session);
      if (data.session) { await loadProfile(data.session.user.id); registerForPush(data.session.user.id); }
      setLoading(false);
    });
    const { data: sub } = supabase.auth.onAuthStateChange(async (event, s) => {
      setSession(s);
      if (s) {
        if (event === "SIGNED_IN") await supabase.rpc("accept_invites_for_me", { p_via: "app" }).then(() => undefined, () => undefined);
        await loadProfile(s.user.id);
        if (event === "SIGNED_IN") registerForPush(s.user.id);
      } else {
        setProfile(null);
      }
      setLoading(false);
    });
    return () => { alive = false; sub.subscription.unsubscribe(); };
  }, [loadProfile]);

  const value = useMemo<AuthState>(() => ({
    session,
    profile,
    loading,
    refreshProfile: async () => { if (session) await loadProfile(session.user.id); },
    signOut: async () => { if (session) await unregisterPush(session.user.id); await supabase.auth.signOut(); },
  }), [session, profile, loading, loadProfile]);

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
