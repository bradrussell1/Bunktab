import { isValidVenmoUsername, venmoProfileUrl } from "@checkm8/core";
import { theme } from "@checkm8/theme";
import { useRouter } from "expo-router";
import { openBrowserAsync } from "expo-web-browser";
import { useState } from "react";
import { Alert, Pressable, ScrollView, View } from "react-native";
import { Avatar, Button, Card, Input, Screen, Text } from "@/components/ui";
import { useAuth } from "@/lib/auth";
import { pickImage, uploadImage } from "@/lib/storage";
import { supabase } from "@/lib/supabase";

/** Profile settings: photo, display name, Venmo username, sign out. */
export default function SettingsScreen() {
  const router = useRouter();
  const { session, profile, refreshProfile, signOut } = useAuth();
  const uid = session!.user.id;
  const [name, setName] = useState(profile?.display_name ?? "");
  const [venmo, setVenmo] = useState(profile?.venmo_username ?? "");
  const [busy, setBusy] = useState(false);
  const [photoBusy, setPhotoBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [pw1, setPw1] = useState("");
  const [pw2, setPw2] = useState("");
  const [pwBusy, setPwBusy] = useState(false);
  const [pwMsg, setPwMsg] = useState<{ ok: boolean; text: string } | null>(null);

  async function changePassword() {
    if (pw1.length < 8) { setPwMsg({ ok: false, text: "Use at least 8 characters." }); return; }
    if (pw1 !== pw2) { setPwMsg({ ok: false, text: "The two passwords don't match." }); return; }
    setPwBusy(true); setPwMsg(null);
    const { error: e } = await supabase.auth.updateUser({ password: pw1 });
    setPwBusy(false);
    if (e) { setPwMsg({ ok: false, text: e.message }); return; }
    setPw1(""); setPw2(""); setPwMsg({ ok: true, text: "Password updated." });
  }

  async function changePhoto() {
    setError(null);
    const uri = await pickImage([1, 1]);
    if (!uri) return;
    setPhotoBusy(true);
    try {
      const url = await uploadImage("avatars", `${uid}/avatar.jpg`, uri);
      const { error: e } = await supabase.from("users").update({ photo_url: url }).eq("id", uid);
      if (e) throw e;
      await refreshProfile();
    } catch (e) { setError(e instanceof Error ? e.message : "Couldn't upload the photo."); }
    setPhotoBusy(false);
  }

  async function save() {
    if (name.trim().length < 2) { setError("Enter the name your friends know you by."); return; }
    if (venmo.trim() && !isValidVenmoUsername(venmo)) { setError("Venmo usernames are 5–30 letters, numbers, hyphens or underscores."); return; }
    setBusy(true); setError(null); setSaved(false);
    const { error: e } = await supabase.from("users").update({ display_name: name.trim(), venmo_username: venmo.trim().replace(/^@/, "") || null }).eq("id", uid);
    setBusy(false);
    if (e) { setError(e.message); return; }
    await refreshProfile(); setSaved(true);
  }

  function deleteAccount() {
    Alert.alert("Delete your account?", "Your name comes off every trip as \"Former member\" so the group's totals still add up. Your phone, photo and Venmo username are removed and you're signed out. This can't be undone.", [
      { text: "Cancel", style: "cancel" },
      { text: "Delete account", style: "destructive", onPress: async () => {
        await supabase.storage.from("avatars").remove([`${uid}/avatar.jpg`]).catch(() => null);
        const { error: e } = await supabase.rpc("delete_my_account");
        if (e) { setError(e.message); return; }
        await signOut();
      } },
    ]);
  }

  return (
    <Screen>
      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingVertical: theme.spacing.sm }}>
        <Button title="‹ Trips" kind="text" size="small" onPress={() => router.back()} />
        <Text variant="title2">Profile</Text>
        <View style={{ width: 60 }} />
      </View>
      <ScrollView contentContainerStyle={{ gap: theme.spacing.xl, paddingBottom: 40 }} keyboardShouldPersistTaps="handled">
        <View style={{ alignItems: "center", gap: theme.spacing.sm }}>
          <Pressable onPress={changePhoto} accessibilityRole="button" accessibilityLabel="Change photo" disabled={photoBusy}>
            <Avatar name={profile?.display_name ?? "?"} uri={profile?.photo_url} size={88} />
          </Pressable>
          <Button title={photoBusy ? "Uploading…" : profile?.photo_url ? "Change photo" : "Add a photo"} kind="text" size="small" onPress={changePhoto} loading={photoBusy} />
        </View>
        <Card style={{ gap: theme.spacing.lg }}>
          <Input label="Display name" value={name} onChangeText={setName} autoCapitalize="words" textContentType="name" />
          <View style={{ gap: theme.spacing.xs }}>
            <Input label="Venmo username" placeholder="your-venmo" value={venmo} onChangeText={setVenmo} autoCapitalize="none" autoCorrect={false} helper="Payments to you open Venmo pre-filled with this." />
            {venmo.trim().length >= 5 && <Button title="Check it on venmo.com ↗" kind="text" size="small" style={{ alignSelf: "flex-start" }} onPress={() => openBrowserAsync(venmoProfileUrl(venmo))} />}
          </View>
          <Text variant="caption1" color={theme.colors.text.onBackground.tertiary}>Phone: +{profile?.phone ?? ""}. Your number is your login and can't be changed here.</Text>
          {error && <Text variant="caption1" color={theme.colors.text.destructive}>{error}</Text>}
          {saved && !error && <Text variant="caption1" color={theme.colors.text.success}>Saved.</Text>}
          <Button title="Save" size="medium" onPress={save} loading={busy} />
        </Card>
        <Card style={{ gap: theme.spacing.lg }}>
          <Text variant="headline">Change password</Text>
          <Input label="New password" placeholder="At least 8 characters" value={pw1} onChangeText={setPw1} secureTextEntry autoCapitalize="none" textContentType="newPassword" />
          <Input label="Confirm new password" value={pw2} onChangeText={setPw2} secureTextEntry autoCapitalize="none" textContentType="newPassword" />
          {pwMsg && <Text variant="caption1" color={pwMsg.ok ? theme.colors.text.success : theme.colors.text.destructive}>{pwMsg.text}</Text>}
          <Button title="Update password" kind="secondary" size="medium" onPress={changePassword} loading={pwBusy} disabled={pw1.length < 8 || pw1 !== pw2} />
        </Card>
        <Button title="Sign out" kind="secondary" size="medium" onPress={signOut} />
        <Button title="Delete account" kind="text" size="small" onPress={deleteAccount} />
        <Text variant="caption1" color={theme.colors.text.onBackground.tertiary} style={{ textAlign: "center" }}>Deleting removes your personal data and anonymises you on shared trips.</Text>
      </ScrollView>
    </Screen>
  );
}
