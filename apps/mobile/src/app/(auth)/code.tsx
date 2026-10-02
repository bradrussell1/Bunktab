import { theme } from "@bunktab/theme";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { ScrollView, View } from "react-native";
import { Button, Input, Screen, Text } from "@/components/ui";
import { friendlyAuthError, useAuth } from "@/lib/auth";
import { supabase } from "@/lib/supabase";

/**
 * "Enter your code": six digits, auto-submits, resend after 30 s. Callers:
 *  - phone_change: sign-up (or add-phone) attached a number to a signed-in
 *    account; the code confirms it. The root layout then lets them in.
 *  - otp: a plain text-code login for accounts without a password.
 *  - reset: forgot password; the code signs the user in and the root layout
 *    keeps them on "Reset password" (pendingPasswordReset) until saved.
 * Success flips the protected routes on its own.
 */
type Mode = "phone_change" | "otp" | "reset";

export default function CodeScreen() {
  const router = useRouter();
  const { phone, mode = "otp" } = useLocalSearchParams<{ phone: string; mode?: Mode }>();
  const { setPendingPasswordReset, signOut, session } = useAuth();
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [wait, setWait] = useState(30);
  const submitted = useRef(false);

  useEffect(() => {
    if (wait <= 0) return;
    const t = setTimeout(() => setWait((w) => w - 1), 1000);
    return () => clearTimeout(t);
  }, [wait]);

  const verify = useCallback(async (digits: string) => {
    if (submitted.current) return;
    submitted.current = true;
    setBusy(true); setError(null);
    if (mode === "reset") setPendingPasswordReset(true); // before the session flips
    const { error: e } = await supabase.auth.verifyOtp({ phone: phone!, token: digits, type: mode === "phone_change" ? "phone_change" : "sms" });
    if (e) {
      if (mode === "reset") setPendingPasswordReset(false);
      setBusy(false); submitted.current = false;
      setError(friendlyAuthError(e.message));
      return;
    }
    if (mode === "phone_change") await supabase.auth.refreshSession().then(() => undefined, () => undefined); // pick up phone_confirmed_at
    setBusy(false);
  }, [mode, phone, setPendingPasswordReset]);

  function onChange(v: string) {
    const digits = v.replace(/\D/g, "").slice(0, 6);
    setCode(digits);
    if (digits.length === 6) verify(digits);
  }

  async function resend() {
    setError(null);
    const { error: e } = mode === "phone_change"
      ? await supabase.auth.updateUser({ phone: phone! })
      : await supabase.auth.signInWithOtp({ phone: phone!, options: { shouldCreateUser: mode === "otp" } });
    if (e) { setError(friendlyAuthError(e.message)); return; }
    setWait(30); setCode(""); submitted.current = false;
  }

  const title = mode === "phone_change" ? "Enter the code we just sent you" : "Enter your code";
  // mid sign-up the account already exists; "back" means change the number, not abandon it
  const back = () => (mode === "phone_change" && session ? router.replace("/(auth)/add-phone") : router.back());
  const masked = phone ? phone.replace(/^(\+\d)(\d+)(\d{4})$/, (_, a, b, c) => `${a} ${"•".repeat(Math.max(0, b.length))} ${c}`) : "";

  return (
    <Screen>
      <View style={{ flexDirection: "row", alignItems: "center", paddingVertical: theme.spacing.sm }}>
        <Button title="‹ Back" kind="text" size="small" onPress={back} />
      </View>
      <ScrollView contentContainerStyle={{ gap: theme.spacing.xl, paddingBottom: 48 }} keyboardShouldPersistTaps="handled" automaticallyAdjustKeyboardInsets contentInsetAdjustmentBehavior="automatic">
        <View style={{ gap: theme.spacing.sm }}>
          <Text variant="largeTitle">{title}</Text>
          <Text variant="body" color={theme.colors.text.onBackground.secondary}>We texted a 6-digit code to {mode === "reset" ? masked : phone}.{mode === "phone_change" ? " Entering it confirms your number and you're in." : ""}</Text>
        </View>
        <Input label="Code" keyboardType="number-pad" textContentType="oneTimeCode" autoComplete="sms-otp" placeholder="123456" value={code} onChangeText={onChange} error={error} maxLength={6} autoFocus onSubmitEditing={() => code.length === 6 && verify(code)} returnKeyType="done" style={{ fontSize: 24, letterSpacing: 8, textAlign: "center" }} />
        <Button title={mode === "phone_change" ? "Confirm and continue" : "Continue"} onPress={() => verify(code)} loading={busy} disabled={code.length < 6} />
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
          <Button title={mode === "reset" ? "Wrong account?" : "Wrong number?"} kind="text" size="small" onPress={back} />
          {wait > 0
            ? <Text variant="caption1" color={theme.colors.text.onBackground.tertiary}>Resend in {wait}s</Text>
            : <Button title="Resend code" kind="text" size="small" onPress={resend} />}
        </View>
        {mode === "phone_change" && session && <Button title="Sign out" kind="text" size="small" style={{ alignSelf: "center" }} onPress={signOut} />}
      </ScrollView>
    </Screen>
  );
}
