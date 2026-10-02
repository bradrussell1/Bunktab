import { theme } from "@bunktab/theme";
import { useRouter } from "expo-router";
import { useState } from "react";
import { ScrollView, View } from "react-native";
import { Button, Input, Screen, Text } from "@/components/ui";
import { friendlyAuthError, parseIdentifier } from "@/lib/auth";
import { supabase } from "@/lib/supabase";

/**
 * Email or phone + password (user feedback #3). One field takes either
 * (an "@" means email, otherwise the number is normalised to E.164).
 * Everything scrolls above the keyboard (#1).
 */
export default function PasswordLoginScreen() {
  const router = useRouter();
  const [id, setId] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function login() {
    const who = parseIdentifier(id);
    if (!who) { setError("Enter the email or phone number on your account."); return; }
    if (!password) { setError("Enter your password."); return; }
    setBusy(true); setError(null);
    const { error: e } = await supabase.auth.signInWithPassword({ ...who, password });
    setBusy(false);
    if (e) setError(friendlyAuthError(e.message));
  }

  return (
    <Screen>
      <View style={{ flexDirection: "row", alignItems: "center", paddingVertical: theme.spacing.sm }}>
        <Button title="‹ Back" kind="text" size="small" onPress={() => router.back()} />
      </View>
      <ScrollView contentContainerStyle={{ gap: theme.spacing.xl, paddingBottom: 48 }} keyboardShouldPersistTaps="handled" automaticallyAdjustKeyboardInsets contentInsetAdjustmentBehavior="automatic">
        <View style={{ gap: theme.spacing.xs }}>
          <Text variant="largeTitle">Log in</Text>
          <Text variant="body" color={theme.colors.text.onBackground.secondary}>Use the email or phone number on your account.</Text>
        </View>
        <Input label="Email or phone" placeholder="you@example.com or (555) 555-0100" value={id} onChangeText={setId} autoCapitalize="none" autoCorrect={false} keyboardType="email-address" textContentType="username" autoComplete="username" returnKeyType="next" />
        <Input label="Password" placeholder="••••••••" value={password} onChangeText={setPassword} secureTextEntry textContentType="password" autoComplete="current-password" onSubmitEditing={login} returnKeyType="go" error={error} />
        <Button title="Log in" onPress={login} loading={busy} />
        <Button title="Forgot your password?" kind="text" size="small" style={{ alignSelf: "center" }} onPress={() => router.push("/(auth)/forgot")} />
      </ScrollView>
    </Screen>
  );
}
