import * as AppleAuthentication from "expo-apple-authentication";
import * as Crypto from "expo-crypto";
import * as Linking from "expo-linking";
import * as WebBrowser from "expo-web-browser";
import { Platform } from "react-native";
import { friendlyAuthError } from "./auth";
import { supabase } from "./supabase";

/**
 * Google: Supabase's OAuth flow in a system browser sheet; Supabase hands
 * back a URL on our scheme carrying the tokens and we set the session from
 * it. Redirect is `checkm8://callback` in a real build and `exp://…/--/callback`
 * in Expo Go (Linking.createURL picks the right one); both are on the
 * project's redirect allow-list. The Google Cloud client must list
 * `https://<ref>.supabase.co/auth/v1/callback` as an authorised redirect URI.
 *
 * Apple: native Sign in with Apple on iOS (Apple requires the native sheet
 * when it's offered). The identity token goes to Supabase as an id token
 * with a nonce; the provider is enabled with the bundle id as client id, no
 * secret needed. Expo Go has no Apple entitlement, so the button explains
 * that there. Apple only sends the name on the first sign-in, so it's saved
 * to the users row right then.
 */
WebBrowser.maybeCompleteAuthSession();

export type OAuthProvider = "google" | "apple";

export async function signInWithProvider(provider: OAuthProvider): Promise<{ error: string | null }> {
  if (provider === "apple" && Platform.OS === "ios") return signInWithAppleNative();
  return signInWithBrowser(provider);
}

async function signInWithAppleNative(): Promise<{ error: string | null }> {
  if (!(await AppleAuthentication.isAvailableAsync().catch(() => false))) {
    return { error: "Apple sign-in works in the App Store / TestFlight build." };
  }
  const rawNonce = Crypto.randomUUID().replace(/-/g, "");
  const hashedNonce = await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, rawNonce);
  let credential: AppleAuthentication.AppleAuthenticationCredential;
  try {
    credential = await AppleAuthentication.signInAsync({
      requestedScopes: [AppleAuthentication.AppleAuthenticationScope.FULL_NAME, AppleAuthentication.AppleAuthenticationScope.EMAIL],
      nonce: hashedNonce,
    });
  } catch (e) {
    const code = (e as { code?: string }).code ?? "";
    if (code === "ERR_REQUEST_CANCELED" || code === "ERR_CANCELED") return { error: null };
    return { error: friendlyAuthError(e instanceof Error ? e.message : "Apple sign-in failed.", "apple") };
  }
  if (!credential.identityToken) return { error: "Apple didn't return a sign-in token. Try again." };
  const { data, error } = await supabase.auth.signInWithIdToken({ provider: "apple", token: credential.identityToken, nonce: rawNonce });
  if (error) return { error: friendlyAuthError(error.message, "apple") };
  const name = [credential.fullName?.givenName, credential.fullName?.familyName].filter(Boolean).join(" ").trim();
  if (name && data.user) {
    await supabase.from("users").update({ display_name: name }).eq("id", data.user.id).is("display_name", null).then(() => undefined, () => undefined);
  }
  return { error: null };
}

async function signInWithBrowser(provider: OAuthProvider): Promise<{ error: string | null }> {
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
