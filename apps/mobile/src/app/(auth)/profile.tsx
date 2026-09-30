import { isValidVenmoUsername, venmoProfileUrl } from "@checkm8/core";
import { theme } from "@checkm8/theme";
import { openBrowserAsync } from "expo-web-browser";
import { useState } from "react";
import { ScrollView, View } from "react-native";
import { Button, Input, Screen, Text } from "@/components/ui";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/lib/supabase";

/**
 * First login: display name, Venmo username (photo comes with the trip
 * screens phase). "Check it" opens venmo.com/u/<username> so the user sees
 * their own profile before saving - the app cannot look up Venmo accounts.
 */
export default function ProfileScreen() {
  const { session, profile, refreshProfile } = useAuth();
  const [name, setName] = useState(profile?.display_name ?? "");
  const [venmo, setVenmo] = useState(profile?.venmo_username ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    if (name.trim().length < 2) { setError("Enter the name your friends know you by."); return; }
    if (venmo.trim() && !isValidVenmoUsername(venmo)) { setError("Venmo usernames are 5–30 letters, numbers, hyphens or underscores."); return; }
    setBusy(true); setError(null);
    const { error: e } = await supabase.from("users").update({ display_name: name.trim(), venmo_username: venmo.trim().replace(/^@/, "") || null }).eq("id", session!.user.id);
    setBusy(false);
    if (e) { setError(e.message); return; }
    await refreshProfile();
  }

  return (
    <Screen>
      <ScrollView contentContainerStyle={{ flexGrow: 1, justifyContent: "center", gap: theme.spacing.xxl, paddingBottom: 48 }} keyboardShouldPersistTaps="handled" automaticallyAdjustKeyboardInsets contentInsetAdjustmentBehavior="automatic">
        <View style={{ gap: theme.spacing.sm }}>
          <Text variant="largeTitle">Almost there</Text>
          <Text variant="body" color={theme.colors.text.onBackground.secondary}>How should your trip mates see you, and where should they send money?</Text>
        </View>
        <Input label="Display name" placeholder="Bradley" value={name} onChangeText={setName} autoCapitalize="words" textContentType="name" />
        <View style={{ gap: theme.spacing.xs }}>
          <Input label="Venmo username" placeholder="your-venmo" value={venmo} onChangeText={setVenmo} autoCapitalize="none" autoCorrect={false} helper="Optional now, needed before close-out. Payments to you open Venmo pre-filled with this." />
          {venmo.trim().length >= 5 && <Button title="Check it on venmo.com ↗" kind="text" size="small" style={{ alignSelf: "flex-start" }} onPress={() => openBrowserAsync(venmoProfileUrl(venmo))} />}
        </View>
        {error && <Text variant="caption1" color={theme.colors.text.destructive}>{error}</Text>}
        <Button title="Save and continue" onPress={save} loading={busy} />
      </ScrollView>
    </Screen>
  );
}
