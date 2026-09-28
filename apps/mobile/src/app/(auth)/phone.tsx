import { theme } from "@checkm8/theme";
import { useRouter } from "expo-router";
import { useState } from "react";
import { KeyboardAvoidingView, Platform, View } from "react-native";
import { Button, Input, Screen, Text } from "@/components/ui";
import { toE164 } from "@/lib/auth";
import { supabase, supabaseConfigured } from "@/lib/supabase";

/** Login step 1 (spec: Screens → Login): phone number, then a one-time text code. No passwords. */
export default function PhoneScreen() {
  const router = useRouter();
  const [raw, setRaw] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function send() {
    const phone = toE164(raw);
    if (!phone) { setError("Enter a phone number, like (555) 555-0100."); return; }
    setBusy(true); setError(null);
    const { error: e } = await supabase.auth.signInWithOtp({ phone });
    setBusy(false);
    if (e) { setError(e.message); return; }
    router.push({ pathname: "/(auth)/verify", params: { phone } });
  }

  return (
    <Screen>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1, justifyContent: "center", gap: theme.spacing.xxl }}>
        <View style={{ gap: theme.spacing.sm }}>
          <Text variant="largeTitle">Checkm8</Text>
          <Text variant="body" color={theme.colors.text.onBackground.secondary}>Split trip expenses. Settle up in Venmo with the fewest payments.</Text>
        </View>
        <Input label="Phone number" keyboardType="phone-pad" textContentType="telephoneNumber" autoComplete="tel" placeholder="(555) 555-0100" value={raw} onChangeText={setRaw} error={error} helper="We'll text you a code. Standard rates apply." onSubmitEditing={send} returnKeyType="send" />
        <Button title="Text me a code" onPress={send} loading={busy} />
        {!supabaseConfigured && <Text variant="caption1" color={theme.colors.text.warning}>Supabase isn't configured: add EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY to apps/mobile/.env.</Text>}
      </KeyboardAvoidingView>
    </Screen>
  );
}
