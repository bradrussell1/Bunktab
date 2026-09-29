import * as Linking from "expo-linking";
import * as WebBrowser from "expo-web-browser";
import { friendlyAuthError } from "./auth";
import { supabase } from "./supabase";

/**
 * Google / Apple sign-in through Supabase's OAuth flow in a system browser
 * sheet: Supabase hands back a URL on our scheme carrying the tokens, and we
 * set the session from it. Neither provider is enabled in the project yet
 * (no Google OAuth client, no Apple Services ID); until then Supabase
 * answers "provider is not enabled" and the caller shows a friendly line.
 *
 * Redirect: `checkm8://callback` in a real build, `exp://…/--/callback` in
 * Expo Go (Linking.createURL picks the right one). Both patterns are on the
 * project's redirect allow-list.
 */
WebBrowser.maybeCompleteAuthSession();

export type OAuthProvider = "google" | "apple";

export async function signInWithProvider(provider: OAuthProvider): Promise<{ error: string | null }> {
  const redirectTo = Linking.createURL("callback");
  const { data, error } = await supabase.auth.signInWithOAuth({ provider, options: { redirectTo, skipBrowserRedirect: true } });
  if (error || !data?.url) return { error: friendlyAuthError(error?.message ?? "Couldn't start sign-in.", provider) };

  const result = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);
  if (result.type !== "success") return { error: null }; // cancelled: no message

  const { params, errorCode } = parseCallback(result.url);
  if (errorCode) return { error: friendlyAuthError(params.error_description ?? errorCode, provider) };
  if (params.access_token && params.refresh_token) {
    const { error: e } = await supabase.auth.setSession({ access_token: params.access_token, refresh_token: params.refresh_token });
    return { error: e ? friendlyAuthError(e.message, provider) : null };
  }
  if (params.code) {
    const { error: e } = await supabase.auth.exchangeCodeForSession(params.code);
    return { error: e ? friendlyAuthError(e.message, provider) : null };
  }
  return { error: "Sign-in didn't complete. Try again." };
}

/** Tokens arrive in the URL fragment (implicit) or as ?code= (PKCE). */
export function parseCallback(url: string): { params: Record<string, string>; errorCode: string | null } {
  const params: Record<string, string> = {};
  const [base, hash] = url.split("#");
  const query = base.includes("?") ? base.slice(base.indexOf("?") + 1) : "";
  for (const part of [query, hash ?? ""]) {
    for (const kv of part.split("&")) {
      if (!kv) continue;
      const [k, v = ""] = kv.split("=");
      params[decodeURIComponent(k!)] = decodeURIComponent(v.replace(/\+/g, " "));
    }
  }
  return { params, errorCode: params.error ?? params.error_code ?? null };
}
