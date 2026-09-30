import { theme } from "@checkm8/theme";
import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { ScrollView, View } from "react-native";
import { Button, Divider, Screen, Text } from "@/components/ui";
import { useAuth } from "@/lib/auth";
import { signInWithProvider, type OAuthProvider } from "@/lib/oauth";

/**
 * Login hub (user feedback #2): Google, Apple, an "or" rule, then
 * "Continue with email or phone" → the password page. "Text me a code
 * instead" stays at the bottom for accounts that predate passwords. A
 * one-shot notice (e.g. after a password reset) shows above the buttons.
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
    <Screen>
      <View style={{ flexDirection: "row", alignItems: "center", paddingVertical: theme.spacing.sm }}>
        <Button title="‹ Back" kind="text" size="small" onPress={() => router.back()} />
      </View>
      <ScrollView contentContainerStyle={{ gap: theme.spacing.xl, paddingBottom: 48, flexGrow: 1 }} keyboardShouldPersistTaps="handled" automaticallyAdjustKeyboardInsets contentInsetAdjustmentBehavior="automatic">
        <View style={{ gap: theme.spacing.xs }}>
          <Text variant="largeTitle">Log in</Text>
          <Text variant="body" color={theme.colors.text.onBackground.secondary}>Pick how you'd like to sign in.</Text>
        </View>
        {notice && <Text variant="caption1Semibold" color={theme.colors.text.success}>{notice}</Text>}
        <View style={{ gap: theme.spacing.sm }}>
          <Button title="Continue with Google" kind="secondary" onPress={() => oauth("google")} loading={busy === "google"} disabled={busy !== null && busy !== "google"} />
          <Button title="Continue with Apple" kind="secondary" onPress={() => oauth("apple")} loading={busy === "apple"} disabled={busy !== null && busy !== "apple"} />
        </View>
        <View style={{ flexDirection: "row", alignItems: "center", gap: theme.spacing.md }}>
          <View style={{ flex: 1 }}><Divider /></View>
          <Text variant="caption1" color={theme.colors.text.onBackground.tertiary}>or</Text>
          <View style={{ flex: 1 }}><Divider /></View>
        </View>
        <Button title="Continue with email or phone" onPress={() => router.push("/(auth)/password")} disabled={busy !== null} />
        {error && <Text variant="caption1" color={theme.colors.text.destructive} style={{ textAlign: "center" }}>{error}</Text>}
        <View style={{ flex: 1 }} />
        <Button title="Text me a code instead" kind="text" size="small" style={{ alignSelf: "center" }} onPress={() => router.push({ pathname: "/(auth)/phone", params: { mode: "otp" } })} />
      </ScrollView>
    </Screen>
  );
}
