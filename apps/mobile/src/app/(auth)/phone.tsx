import { theme } from "@checkm8/theme";
import { useRouter } from "expo-router";
import { useState } from "react";
import { ScrollView, View } from "react-native";
import { Button, Input, Screen, Text } from "@/components/ui";
import { friendlyAuthError, toE164 } from "@/lib/auth";
import { supabase, supabaseConfigured } from "@/lib/supabase";

/**
 * "Text me a code instead": the password-free login for accounts created
 * before passwords existed. Forgot-password has its own screen (forgot.tsx)
 * that also takes an email.
 */
export default function PhoneScreen() {
  const router = useRouter();
  const [raw, setRaw] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function send() {
    if (raw.includes("@")) { setError("Enter your phone number here. To use your email, go back and pick email or phone."); return; }
    const phone = toE164(raw);
    if (!phone) { setError("Enter a phone number, like (555) 555-0100."); return; }
    setBusy(true); setError(null);
    const { error: e } = await supabase.auth.signInWithOtp({ phone });
    setBusy(false);
    if (e) { setError(friendlyAuthError(e.message)); return; }
    router.push({ pathname: "/(auth)/code", params: { phone, mode: "otp" } });
  }

  return (
    <Screen>
      <View style={{ flexDirection: "row", alignItems: "center", paddingVertical: theme.spacing.sm }}>
        <Button title="‹ Back" kind="text" size="small" onPress={() => router.back()} />
      </View>
      <ScrollView contentContainerStyle={{ gap: theme.spacing.xl, paddingBottom: 48 }} keyboardShouldPersistTaps="handled" automaticallyAdjustKeyboardInsets contentInsetAdjustmentBehavior="automatic">
        <View style={{ gap: theme.spacing.sm }}>
          <Text variant="largeTitle">Text me a code</Text>
          <Text variant="body" color={theme.colors.text.onBackground.secondary}>No password needed. We'll text a 6-digit code to your number.</Text>
        </View>
        <Input label="Phone number" keyboardType="phone-pad" textContentType="telephoneNumber" autoComplete="tel" placeholder="(555) 555-0100" value={raw} onChangeText={setRaw} error={error} helper="Standard message rates apply." onSubmitEditing={send} returnKeyType="done" autoFocus />
        <Button title="Continue" onPress={send} loading={busy} />
        {!supabaseConfigured && <Text variant="caption1" color={theme.colors.text.warning}>Supabase isn't configured: add EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY to apps/mobile/.env.</Text>}
      </ScrollView>
    </Screen>
  );
}
