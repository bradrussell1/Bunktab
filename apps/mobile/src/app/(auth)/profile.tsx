import { isValidNamePart, isValidVenmoUsername, joinName, splitName, zebraLabel, zebraMoodFor } from "@bunktab/core";
import { color, radius, space } from "@bunktab/theme";
import { useState } from "react";
import { StyleSheet, View } from "react-native";
import { AuthScreen, FormError } from "@/components/AuthScreen";
import { Avatar, Button, Icon, Input, Press, TextLink, Zebra, ZText } from "@/ui";
import { useAuth } from "@/lib/auth";
import { pickImage, uploadImage } from "@/lib/storage";
import { supabase } from "@/lib/supabase";
import { openVenmoProfile } from "@/lib/venmo";

/**
 * Profile step: first name, last name, optional photo (Avatar with a sand "+" tile),
 * Venmo username with a "Check it" link. Shown on a first login with no name, and once
 * to an existing account that has no last name yet (feedback round 1, item 18): the
 * fields are prefilled from the display name. The zebra is hi until the profile saves,
 * then happy (login rule in zebraMoodFor).
 */
export default function ProfileScreen() {
  const { session, profile, refreshProfile } = useAuth();
  const uid = session!.user.id;
  const prefill = splitName(profile?.display_name);
  const [first, setFirst] = useState(profile?.first_name ?? prefill.first ?? "");
  const [last, setLast] = useState(profile?.last_name ?? prefill.last ?? "");
  const [venmo, setVenmo] = useState(profile?.venmo_username ?? "");
  const [photo, setPhoto] = useState<string | null>(profile?.photo_url ?? null);
  const [busy, setBusy] = useState(false);
  const [photoBusy, setPhotoBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const mood = zebraMoodFor({ place: "login", profileSaved: saved }) ?? "hi";
  const completing = !!profile?.display_name; // an existing account asked for its last name

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
    if (!isValidNamePart(first)) { setError("Enter your first name."); return; }
    if (!isValidNamePart(last)) { setError("Enter your last name."); return; }
    if (venmo.trim() && !isValidVenmoUsername(venmo)) { setError("Venmo usernames are 5–30 letters, numbers, hyphens or underscores."); return; }
    setBusy(true); setError(null);
    const f = first.trim(), l = last.trim();
    const { error: e } = await supabase.from("users").update({ first_name: f, last_name: l, display_name: joinName(f, l), venmo_username: venmo.trim().replace(/^@/, "") || null }).eq("id", uid);
    setBusy(false);
    if (e) { setError(e.message); return; }
    setSaved(true);
    // let the happy zebra land before the root layout moves on
    setTimeout(() => { refreshProfile(); }, 600);
  }

  return (
    <AuthScreen
      hero={<Zebra variant="full" mood={mood} size={176} animate={{ blink: true, bob: true }} accessibilityLabel={zebraLabel(mood)} />}
      title={completing ? "One more thing" : "Almost there"}
      lead={completing ? "Zebrasplit now shows first names and last initials on a dazzle. Add your last name so your crew knows which Sam you are." : "How should your dazzle see you, and where should they send money?"}
      footer={
        <>
          <FormError>{error}</FormError>
          <Button label="Save and continue" onPress={save} loading={busy} />
        </>
      }
    >
      <Press onPress={changePhoto} disabled={photoBusy} scaleTo={0.98} accessibilityRole="button" accessibilityLabel={photo ? "Replace photo" : "Add a photo"} accessibilityState={{ busy: photoBusy }} style={styles.photoRow}>
        <View>
          <Avatar name={joinName(first, last) || "?"} uri={photo} size={72} />
          <View style={styles.plus} accessibilityElementsHidden><Icon name="plus" size={14} stroke={2.4} /></View>
        </View>
        <ZText variant="label" color={color.textSecondary}>{photoBusy ? "Uploading…" : photo ? "Replace photo" : "Add a photo (optional)"}</ZText>
      </Press>
      <View style={styles.names}>
        <Input label="First name" placeholder="Bradley" value={first} onChangeText={setFirst} autoCapitalize="words" textContentType="givenName" autoComplete="given-name" returnKeyType="next" style={styles.flex} />
        <Input label="Last name" placeholder="Russell" value={last} onChangeText={setLast} autoCapitalize="words" textContentType="familyName" autoComplete="family-name" returnKeyType="done" style={styles.flex} />
      </View>
      <View style={{ gap: space[4] }}>
        <Input label="Venmo username" placeholder="your-venmo" value={venmo} onChangeText={setVenmo} autoCapitalize="none" autoCorrect={false} helper="Optional now; needed before close-out so friends can pay you in Venmo." returnKeyType="done" />
        {venmo.trim().length >= 5 ? <TextLink label="Check it" onPress={() => openVenmoProfile(venmo)} /> : null}
      </View>
    </AuthScreen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  names: { flexDirection: "row", gap: space[10] },
  photoRow: { flexDirection: "row", alignItems: "center", gap: space[12], alignSelf: "flex-start" },
  plus: { position: "absolute", right: -2, bottom: -2, width: 26, height: 26, borderRadius: radius.pill, backgroundColor: color.surfaceTile, borderWidth: 2, borderColor: color.surface, alignItems: "center", justifyContent: "center" },
});
