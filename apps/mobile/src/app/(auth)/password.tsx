import { useRouter } from "expo-router";
import { useState } from "react";
import { AuthScreen } from "@/components/AuthScreen";
import { Button, Input, TextLink } from "@/ui";
import { friendlyAuthError, parseIdentifier } from "@/lib/auth";
import { supabase } from "@/lib/supabase";

/**
 * Email or phone + password. One field takes either (an "@" means email,
 * otherwise the number is normalised to E.164).
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
    <AuthScreen
      onBack={() => router.back()}
      title="Log in"
      lead="Use the email or phone number on your account."
      footer={
        <>
          <Button label="Log in" onPress={login} loading={busy} />
          <TextLink label="Forgot your password?" muted style={{ alignSelf: "center" }} onPress={() => router.push("/(auth)/forgot")} />
        </>
      }
    >
      <Input label="Email or phone" placeholder="you@example.com or (555) 555-0100" value={id} onChangeText={setId} autoCapitalize="none" autoCorrect={false} keyboardType="email-address" textContentType="username" autoComplete="username" returnKeyType="next" />
      <Input label="Password" placeholder="••••••••" value={password} onChangeText={setPassword} secureTextEntry textContentType="password" autoComplete="current-password" onSubmitEditing={login} returnKeyType="go" error={error} />
    </AuthScreen>
  );
}
