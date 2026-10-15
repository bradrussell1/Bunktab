import { space } from "@bunktab/theme";
import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { View } from "react-native";
import { AuthScreen, FormError, OrRule } from "@/components/AuthScreen";
import { Button, InsetPanel, TextLink, ZText } from "@/ui";
import { useAuth } from "@/lib/auth";
import { signInWithProvider, type OAuthProvider } from "@/lib/oauth";

/**
 * Login hub: Google, Apple, an "or" rule, then "Continue with email or phone"
 * (the one volt action) → the password page. "Text me a code instead" stays at
 * the bottom for accounts that predate passwords. A one-shot notice (after a
 * password reset) shows above the buttons.
 */
export default function LoginScreen() {
  const router = useRouter();
  const { notice, setNotice } = useAuth();
  const [busy, setBusy] = useState<OAuthProvider | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => () => setNotice(null), [setNotice]); // clear the notice when leaving

  async function oauth(provider: OAuthProvider) {
    setBusy(provider); setError(null);
    const { error: e } = await signInWithProvider(provider);
    setBusy(null);
    if (e) setError(e);
  }

  return (
    <AuthScreen
      onBack={() => router.back()}
      title="Log in"
      lead="Pick how you'd like to sign in."
      footer={<TextLink label="Text me a code instead" muted style={{ alignSelf: "center" }} onPress={() => router.push({ pathname: "/(auth)/phone", params: { mode: "otp" } })} />}
    >
      {notice ? <InsetPanel><ZText variant="captionStrong">{notice}</ZText></InsetPanel> : null}
      <View style={{ gap: space[10] }}>
        <Button label="Continue with Google" kind="secondary" onPress={() => oauth("google")} loading={busy === "google"} disabled={busy !== null && busy !== "google"} />
        <Button label="Continue with Apple" kind="secondary" onPress={() => oauth("apple")} loading={busy === "apple"} disabled={busy !== null && busy !== "apple"} />
      </View>
      <OrRule />
      <Button label="Continue with email or phone" onPress={() => router.push("/(auth)/password")} disabled={busy !== null} />
      <FormError>{error}</FormError>
    </AuthScreen>
  );
}
