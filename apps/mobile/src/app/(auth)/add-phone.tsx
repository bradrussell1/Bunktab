import { theme } from "@bunktab/theme";
import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { ScrollView, View } from "react-native";
import { Button, Input, Screen, Text } from "@/components/ui";
import { friendlyAuthError, toE164, useAuth } from "@/lib/auth";
import { supabase } from "@/lib/supabase";

/**
 * A signed-in account with no verified phone lands here (the root layout
 * holds it): a sign-up that stopped before the code, or a Google/Apple
 * login. Sign-up itself normally skips this screen: signup.tsx already
 * asked for the phone, so when a pending number exists we go straight to
 * the code. Phone is the identity invites are matched on, so it isn't
 * optional.
 */
export default function AddPhoneScreen() {
  const router = useRouter();
  const { signOut } = useAuth();
  const [raw, setRaw] = useState("");
  const [busy, setBusy] = useState(false);
  const [checking, setChecking] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.auth.getUser().catch(() => ({ data: { user: null } }));
      const pending = (data.user as { new_phone?: string } | null)?.new_phone;
      if (pending) router.replace({ pathname: "/(auth)/code", params: { phone: `+${pending.replace(/^\+/, "")}`, mode: "phone_change" } });
      else setChecking(false);
    })();
  }, [router]);

  async function send() {
    const phone = toE164(raw);
    if (!phone) { setError("Enter a phone number, like (555) 555-0100."); return; }
    setBusy(true); setError(null);
    const { error: e } = await supabase.auth.updateUser({ phone });
    setBusy(false);
    if (e) { setError(friendlyAuthError(e.message)); return; }
    router.push({ pathname: "/(auth)/code", params: { phone, mode: "phone_change" } });
  }

  if (checking) return <Screen><View /></Screen>;
  return (
    <Screen>
      <ScrollView contentContainerStyle={{ gap: theme.spacing.xl, paddingTop: theme.spacing.xxl, paddingBottom: 48 }} keyboardShouldPersistTaps="handled" automaticallyAdjustKeyboardInsets contentInsetAdjustmentBehavior="automatic">
        <View style={{ gap: theme.spacing.sm }}>
          <Text variant="largeTitle">Add your phone number</Text>
          <Text variant="body" color={theme.colors.text.onBackground.secondary}>Friends invite you by number, so we need to confirm one. We'll text you a code.</Text>
        </View>
        <Input label="Phone number" keyboardType="phone-pad" textContentType="telephoneNumber" autoComplete="tel" placeholder="(555) 555-0100" value={raw} onChangeText={setRaw} error={error} onSubmitEditing={send} returnKeyType="done" autoFocus />
        <Button title="Continue" onPress={send} loading={busy} />
        <Button title="Sign out" kind="text" size="small" style={{ alignSelf: "center" }} onPress={signOut} />
      </ScrollView>
    </Screen>
  );
}
