import { theme } from "@checkm8/theme";
import { useRouter } from "expo-router";
import { useState } from "react";
import { KeyboardAvoidingView, Platform, ScrollView, View } from "react-native";
import { Button, Divider, Input, Screen, Text } from "@/components/ui";
import { friendlyAuthError, parseIdentifier } from "@/lib/auth";
import { signInWithProvider, type OAuthProvider } from "@/lib/oauth";
import { supabase } from "@/lib/supabase";

/**
 * Log in (user brief #23): email OR phone in one field, password, forgot
 * password (by text, since every account has a verified number), Google and
 * Apple, and a text-code fallback for accounts created before passwords.
 */
export default function LoginScreen() {
  const router = useRouter();
  const [id, setId] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState<"password" | OAuthProvider | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function login() {
    const who = parseIdentifier(id);
    if (!who) { setError("Enter the email or phone number on your account."); return; }
    if (!password) { setError("Enter your password."); return; }
    setBusy("password"); setError(null);
    const { error: e } = await supabase.auth.signInWithPassword({ ...who, password });
    setBusy(null);
    if (e) setError(friendlyAuthError(e.message));
  }

  async function oauth(provider: OAuthProvider) {
    setBusy(provider); setError(null);
    const { error: e } = await signInWithProvider(provider);
    setBusy(null);
    if (e) setError(e);
  }

  return (
    <Screen>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1 }}>
        <View style={{ flexDirection: "row", alignItems: "center", paddingVertical: theme.spacing.sm }}>
          <Button title="‹ Back" kind="text" size="small" onPress={() => router.back()} />
        </View>
        <ScrollView contentContainerStyle={{ gap: theme.spacing.xl, paddingBottom: 40 }} keyboardShouldPersistTaps="handled">
          <View style={{ gap: theme.spacing.xs }}>
            <Text variant="largeTitle">Log in</Text>
            <Text variant="body" color={theme.colors.text.onBackground.secondary}>Use the email or phone number on your account.</Text>
          </View>
          <Input label="Email or phone" placeholder="you@example.com or (555) 555-0100" value={id} onChangeText={setId} autoCapitalize="none" autoCorrect={false} keyboardType="email-address" textContentType="username" autoComplete="username" />
          <Input label="Password" placeholder="••••••••" value={password} onChangeText={setPassword} secureTextEntry textContentType="password" autoComplete="current-password" onSubmitEditing={login} returnKeyType="go" error={error} />
          <Button title="Log in" onPress={login} loading={busy === "password"} disabled={busy !== null && busy !== "password"} />
          <Button title="Forgot your password?" kind="text" size="small" style={{ alignSelf: "center" }} onPress={() => router.push({ pathname: "/(auth)/phone", params: { mode: "reset" } })} />

          <View style={{ flexDirection: "row", alignItems: "center", gap: theme.spacing.md }}>
            <View style={{ flex: 1 }}><Divider /></View>
            <Text variant="caption1" color={theme.colors.text.onBackground.tertiary}>or</Text>
            <View style={{ flex: 1 }}><Divider /></View>
          </View>
          <View style={{ gap: theme.spacing.sm }}>
            <Button title="Continue with Google" kind="secondary" size="medium" onPress={() => oauth("google")} loading={busy === "google"} disabled={busy !== null && busy !== "google"} />
            <Button title="Continue with Apple" kind="secondary" size="medium" onPress={() => oauth("apple")} loading={busy === "apple"} disabled={busy !== null && busy !== "apple"} />
          </View>
          <Button title="Text me a code instead" kind="text" size="small" style={{ alignSelf: "center" }} onPress={() => router.push({ pathname: "/(auth)/phone", params: { mode: "otp" } })} />
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}
