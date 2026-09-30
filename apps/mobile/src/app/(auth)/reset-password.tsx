import { theme } from "@checkm8/theme";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useState } from "react";
import { ScrollView, View } from "react-native";
import { Button, Input, Screen, Text } from "@/components/ui";
import { friendlyAuthError, useAuth } from "@/lib/auth";
import { supabase } from "@/lib/supabase";

/**
 * Reset password (user feedback #5): the identifier (read-only), New
 * password, Confirm password, Confirm.
 *  - mode=reset (default, after the forgot-password code): saving signs the
 *    user out and returns them to the landing → login with a success line.
 *  - mode=change (from Profile → "Change Password", while signed in): no
 *    code step, no sign-out; back to Profile on success.
 */
export default function ResetPasswordScreen() {
  const router = useRouter();
  const { mode = "reset", identifier } = useLocalSearchParams<{ mode?: "reset" | "change"; identifier?: string }>();
  const { session, profile, setPendingPasswordReset, setNotice, signOut } = useAuth();
  const change = mode === "change";
  const who = identifier || profile?.email || (profile?.phone ? `+${profile.phone}` : "") || session?.user.email || (session?.user.phone ? `+${session.user.phone}` : "");
  const [p1, setP1] = useState("");
  const [p2, setP2] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function confirm() {
    if (p1.length < 8) return setError("Use at least 8 characters.");
    if (p1 !== p2) return setError("The two passwords don't match.");
    setBusy(true); setError(null);
    const { error: e } = await supabase.auth.updateUser({ password: p1 });
    setBusy(false);
    if (e) return setError(friendlyAuthError(e.message));
    if (change) { router.back(); return; }
    setNotice("Password updated. Log in with your new password.");
    setPendingPasswordReset(false);
    await signOut(); // the root layout lands on the landing screen
    router.replace("/(auth)/login");
  }

  return (
    <Screen>
      <View style={{ flexDirection: "row", alignItems: "center", paddingVertical: theme.spacing.sm }}>
        {change ? <Button title="‹ Profile" kind="text" size="small" onPress={() => router.back()} /> : <View style={{ height: 36 }} />}
      </View>
      <ScrollView contentContainerStyle={{ gap: theme.spacing.xl, paddingBottom: 48 }} keyboardShouldPersistTaps="handled" automaticallyAdjustKeyboardInsets contentInsetAdjustmentBehavior="automatic">
        <View style={{ gap: theme.spacing.xs }}>
          <Text variant="largeTitle">{change ? "Change password" : "Reset password"}</Text>
          <Text variant="body" color={theme.colors.text.onBackground.secondary}>{change ? "Pick a new password for your account." : "Your number is confirmed. Pick a new password, then log in with it."}</Text>
        </View>
        <Input label="Email or phone" value={who} editable={false} selectTextOnFocus={false} style={{ opacity: 0.6 }} />
        <Input label="New password" placeholder="At least 8 characters" value={p1} onChangeText={setP1} secureTextEntry textContentType="newPassword" autoComplete="new-password" autoFocus returnKeyType="next" />
        <Input label="Confirm password" placeholder="Same again" value={p2} onChangeText={setP2} secureTextEntry textContentType="newPassword" autoComplete="new-password" error={error} onSubmitEditing={confirm} returnKeyType="done" />
        <Button title="Confirm" onPress={confirm} loading={busy} disabled={p1.length < 8 || p2.length < 8} />
        {!change && <Button title="Skip for now" kind="text" size="small" style={{ alignSelf: "center" }} onPress={() => setPendingPasswordReset(false)} />}
      </ScrollView>
    </Screen>
  );
}
