import { theme } from "@checkm8/theme";
import { useRouter } from "expo-router";
import { useState } from "react";
import { ScrollView, View } from "react-native";
import { Button, Input, Screen, Text } from "@/components/ui";
import { friendlyAuthError, parseIdentifier } from "@/lib/auth";
import { supabase } from "@/lib/supabase";

/**
 * Forgot password (user feedback #4): same shape as the login page with a
 * single "Email or phone" field and Continue. The reset code always goes by
 * text, so an email is resolved to the phone on that account by the
 * request_password_reset RPC (anon-callable; it answers null for anything
 * it doesn't know). Then → "Enter your code" → "Reset password".
 */
export default function ForgotScreen() {
  const router = useRouter();
  const [id, setId] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function next() {
    const who = parseIdentifier(id);
    if (!who) { setError("Enter the email or phone number on your account."); return; }
    setBusy(true); setError(null);
    const { data: phone, error: e1 } = await supabase.rpc("request_password_reset", { p_identifier: "email" in who ? who.email : who.phone });
    if (e1) { setBusy(false); setError(friendlyAuthError(e1.message)); return; }
    if (!phone) { setBusy(false); setError("We don't have an account with that " + ("email" in who ? "email." : "number.")); return; }
    const { error: e2 } = await supabase.auth.signInWithOtp({ phone, options: { shouldCreateUser: false } });
    setBusy(false);
    if (e2) { setError(friendlyAuthError(e2.message)); return; }
    router.push({ pathname: "/(auth)/code", params: { phone, mode: "reset" } });
  }

  return (
    <Screen>
      <View style={{ flexDirection: "row", alignItems: "center", paddingVertical: theme.spacing.sm }}>
        <Button title="‹ Back" kind="text" size="small" onPress={() => router.back()} />
      </View>
      <ScrollView contentContainerStyle={{ gap: theme.spacing.xl, paddingBottom: 48 }} keyboardShouldPersistTaps="handled" automaticallyAdjustKeyboardInsets contentInsetAdjustmentBehavior="automatic">
        <View style={{ gap: theme.spacing.xs }}>
          <Text variant="largeTitle">Forgot your password?</Text>
          <Text variant="body" color={theme.colors.text.onBackground.secondary}>Enter the email or phone number on your account. We'll text a code to the number we have for you.</Text>
        </View>
        <Input label="Email or phone" placeholder="you@example.com or (555) 555-0100" value={id} onChangeText={setId} autoCapitalize="none" autoCorrect={false} keyboardType="email-address" textContentType="username" autoComplete="username" onSubmitEditing={next} returnKeyType="done" error={error} autoFocus />
        <Button title="Continue" onPress={next} loading={busy} />
      </ScrollView>
    </Screen>
  );
}
