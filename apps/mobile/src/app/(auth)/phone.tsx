import { theme } from "@checkm8/theme";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useState } from "react";
import { KeyboardAvoidingView, Platform, View } from "react-native";
import { Button, Input, Screen, Text } from "@/components/ui";
import { friendlyAuthError, toE164 } from "@/lib/auth";
import { supabase, supabaseConfigured } from "@/lib/supabase";

/**
 * Phone entry for the two text-code paths:
 *  - otp: "Text me a code instead" (accounts from before passwords existed)
 *  - reset: forgot password → a code, then "Set a new password"
 * Reset never creates an account, so an unknown number is told so.
 */
export default function PhoneScreen() {
  const router = useRouter();
  const { mode = "otp" } = useLocalSearchParams<{ mode?: "otp" | "reset" }>();
  const reset = mode === "reset";
  const [raw, setRaw] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function send() {
    if (raw.includes("@")) { setError("Enter the phone number on your account, not the email."); return; }
    const phone = toE164(raw);
    if (!phone) { setError("Enter a phone number, like (555) 555-0100."); return; }
    setBusy(true); setError(null);
    const { error: e } = await supabase.auth.signInWithOtp({ phone, options: { shouldCreateUser: !reset } });
    setBusy(false);
    if (e) {
      const m = e.message.toLowerCase();
      setError(reset && (m.includes("signups not allowed") || m.includes("not found")) ? "We don't have an account with that number." : friendlyAuthError(e.message));
      return;
    }
    router.push({ pathname: "/(auth)/code", params: { phone, mode } });
  }

  return (
    <Screen>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1 }}>
        <View style={{ flexDirection: "row", alignItems: "center", paddingVertical: theme.spacing.sm }}>
          <Button title="‹ Back" kind="text" size="small" onPress={() => router.back()} />
        </View>
        <View style={{ flex: 1, justifyContent: "center", gap: theme.spacing.xxl, paddingBottom: 80 }}>
          <View style={{ gap: theme.spacing.sm }}>
            <Text variant="largeTitle">{reset ? "Reset your password" : "Text me a code"}</Text>
            <Text variant="body" color={theme.colors.text.onBackground.secondary}>
              {reset ? "Enter the phone number on your account. We'll text you a code, then you can set a new password." : "No password needed. We'll text a 6-digit code to your number."}
            </Text>
          </View>
          <Input label="Phone number" keyboardType="phone-pad" textContentType="telephoneNumber" autoComplete="tel" placeholder="(555) 555-0100" value={raw} onChangeText={setRaw} error={error} helper="Standard message rates apply." onSubmitEditing={send} returnKeyType="send" autoFocus />
          <Button title="Text me a code" onPress={send} loading={busy} />
          {!supabaseConfigured && <Text variant="caption1" color={theme.colors.text.warning}>Supabase isn't configured: add EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY to apps/mobile/.env.</Text>}
        </View>
      </KeyboardAvoidingView>
    </Screen>
  );
}
