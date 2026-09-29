import { theme } from "@checkm8/theme";
import { useState } from "react";
import { KeyboardAvoidingView, Platform, View } from "react-native";
import { Button, Input, Screen, Text } from "@/components/ui";
import { friendlyAuthError, useAuth } from "@/lib/auth";
import { supabase } from "@/lib/supabase";

/**
 * After a forgot-password code: the texted code already signed the user
 * in, so this just saves the new password. The root layout holds them here
 * (pendingPasswordReset) until it's saved or skipped.
 */
export default function NewPasswordScreen() {
  const { setPendingPasswordReset } = useAuth();
  const [p1, setP1] = useState("");
  const [p2, setP2] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    if (p1.length < 8) return setError("Use at least 8 characters.");
    if (p1 !== p2) return setError("The two passwords don't match.");
    setBusy(true); setError(null);
    const { error: e } = await supabase.auth.updateUser({ password: p1 });
    setBusy(false);
    if (e) return setError(friendlyAuthError(e.message));
    setPendingPasswordReset(false);
  }

  return (
    <Screen>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1, justifyContent: "center", gap: theme.spacing.xxl, paddingBottom: 80 }}>
        <View style={{ gap: theme.spacing.sm }}>
          <Text variant="largeTitle">Set a new password</Text>
          <Text variant="body" color={theme.colors.text.onBackground.secondary}>Your number is confirmed. Pick a password for next time.</Text>
        </View>
        <Input label="New password" placeholder="At least 8 characters" value={p1} onChangeText={setP1} secureTextEntry textContentType="newPassword" autoComplete="new-password" autoFocus />
        <Input label="Repeat it" placeholder="Same again" value={p2} onChangeText={setP2} secureTextEntry textContentType="newPassword" autoComplete="new-password" error={error} onSubmitEditing={save} returnKeyType="done" />
        <Button title="Save password" onPress={save} loading={busy} />
        <Button title="Skip for now" kind="text" size="small" style={{ alignSelf: "center" }} onPress={() => setPendingPasswordReset(false)} />
      </KeyboardAvoidingView>
    </Screen>
  );
}
