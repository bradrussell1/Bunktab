import { isValidVenmoUsername, venmoProfileUrl, zebraLabel, zebraMoodFor } from "@bunktab/core";
import { color, radius, space } from "@bunktab/theme";
import { openBrowserAsync } from "expo-web-browser";
import { useState } from "react";
import { StyleSheet, View } from "react-native";
import { AuthScreen, FormError } from "@/components/AuthScreen";
import { Avatar, Button, Icon, Input, Press, TextLink, Zebra, ZText } from "@/ui";
import { useAuth } from "@/lib/auth";
import { pickImage, uploadImage } from "@/lib/storage";
import { supabase } from "@/lib/supabase";

/**
 * Profile step (first login): name, optional photo (Avatar with a sand "+" tile),
 * Venmo username with a "Check it" link. The zebra is hi until the profile saves,
 * then happy (login rule in zebraMoodFor).
 */
export default function ProfileScreen() {
  const { session, profile, refreshProfile } = useAuth();
  const uid = session!.user.id;
  const [name, setName] = useState(profile?.display_name ?? "");
  const [venmo, setVenmo] = useState(profile?.venmo_username ?? "");
  const [photo, setPhoto] = useState<string | null>(profile?.photo_url ?? null);
  const [busy, setBusy] = useState(false);
  const [photoBusy, setPhotoBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const mood = zebraMoodFor({ place: "login", profileSaved: saved }) ?? "hi";

  async function changePhoto() {
    setError(null);
    const uri = await pickImage([1, 1]);
    if (!uri) return;
    setPhotoBusy(true);
    try {
      const url = await uploadImage("avatars", `${uid}/avatar.jpg`, uri);
      const { error: e } = await supabase.from("users").update({ photo_url: url }).eq("id", uid);
      if (e) throw e;
      setPhoto(url);
    } catch (e) { setError(e instanceof Error ? e.message : "Couldn't upload the photo."); }
    setPhotoBusy(false);
  }

  async function save() {
    if (name.trim().length < 2) { setError("Enter the name your friends know you by."); return; }
    if (venmo.trim() && !isValidVenmoUsername(venmo)) { setError("Venmo usernames are 5–30 letters, numbers, hyphens or underscores."); return; }
    setBusy(true); setError(null);
    const { error: e } = await supabase.from("users").update({ display_name: name.trim(), venmo_username: venmo.trim().replace(/^@/, "") || null }).eq("id", uid);
    setBusy(false);
    if (e) { setError(e.message); return; }
    setSaved(true);
    // let the happy zebra land before the root layout moves on
    setTimeout(() => { refreshProfile(); }, 600);
  }

  return (
    <AuthScreen
      hero={<Zebra variant="full" mood={mood} size={176} animate={{ blink: true, bob: true }} accessibilityLabel={zebraLabel(mood)} />}
      title="Almost there"
      lead="How should your dazzle see you, and where should they send money?"
      footer={
        <>
          <FormError>{error}</FormError>
          <Button label="Save and continue" onPress={save} loading={busy} />
        </>
      }
    >
      <Press onPress={changePhoto} disabled={photoBusy} scaleTo={0.98} accessibilityRole="button" accessibilityLabel={photo ? "Replace photo" : "Add a photo"} accessibilityState={{ busy: photoBusy }} style={styles.photoRow}>
        <View>
          <Avatar name={name || "?"} uri={photo} size={72} />
          <View style={styles.plus} accessibilityElementsHidden><Icon name="plus" size={14} stroke={2.4} /></View>
        </View>
        <ZText variant="label" color={color.textSecondary}>{photoBusy ? "Uploading…" : photo ? "Replace photo" : "Add a photo (optional)"}</ZText>
      </Press>
      <Input label="Display name" placeholder="Bradley" value={name} onChangeText={setName} autoCapitalize="words" textContentType="name" />
      <View style={{ gap: space[4] }}>
        <Input label="Venmo username" placeholder="your-venmo" value={venmo} onChangeText={setVenmo} autoCapitalize="none" autoCorrect={false} helper="Optional now; needed before close-out so friends can pay you in Venmo." />
        {venmo.trim().length >= 5 ? <TextLink label="Check it" onPress={() => openBrowserAsync(venmoProfileUrl(venmo))} /> : null}
      </View>
    </AuthScreen>
  );
}

const styles = StyleSheet.create({
  photoRow: { flexDirection: "row", alignItems: "center", gap: space[12], alignSelf: "flex-start" },
  plus: { position: "absolute", right: -2, bottom: -2, width: 26, height: 26, borderRadius: radius.pill, backgroundColor: color.surfaceTile, borderWidth: 2, borderColor: color.surface, alignItems: "center", justifyContent: "center" },
});
