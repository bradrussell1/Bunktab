import { theme } from "@checkm8/theme";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useState } from "react";
import { View } from "react-native";
import { Button, Input, Screen, Text } from "@/components/ui";
import { supabase } from "@/lib/supabase";

/** Login step 2: the six-digit code. Success flips the protected routes on its own. */
export default function VerifyScreen() {
  const router = useRouter();
  const { phone } = useLocalSearchParams<{ phone: string }>();
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function verify() {
    if (code.replace(/\D/g, "").length < 6) { setError("Enter the 6-digit code."); return; }
    setBusy(true); setError(null);
    const { error: e } = await supabase.auth.verifyOtp({ phone: phone!, token: code.replace(/\D/g, ""), type: "sms" });
    setBusy(false);
    if (e) setError(e.message);
  }
  async function resend() {
    setError(null);
    const { error: e } = await supabase.auth.signInWithOtp({ phone: phone! });
    if (e) setError(e.message);
  }

  return (
    <Screen>
      <View style={{ flex: 1, justifyContent: "center", gap: theme.spacing.xxl }}>
        <View style={{ gap: theme.spacing.sm }}>
          <Text variant="largeTitle">Enter your code</Text>
          <Text variant="body" color={theme.colors.text.onBackground.secondary}>We texted a 6-digit code to {phone}.</Text>
        </View>
        <Input label="Code" keyboardType="number-pad" textContentType="oneTimeCode" autoComplete="sms-otp" placeholder="123456" value={code} onChangeText={setCode} error={error} maxLength={6} autoFocus onSubmitEditing={verify} />
        <Button title="Verify" onPress={verify} loading={busy} />
        <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
          <Button title="Use a different number" kind="text" size="small" onPress={() => router.back()} />
          <Button title="Resend code" kind="text" size="small" onPress={resend} />
        </View>
      </View>
    </Screen>
  );
}
