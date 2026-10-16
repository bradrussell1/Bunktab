import { CATEGORIES, formatCents, isValidNamePart, isValidVenmoUsername, joinName, splitName } from "@bunktab/core";
import { color, layout, palette, radius, size, space } from "@bunktab/theme";
import { useFocusEffect, useRouter } from "expo-router";
import { useCallback, useMemo, useState } from "react";
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { TripHistoryList } from "@/components/TripHistoryList";
import { ActionSheet, Avatar, Button, Card, Icon, Input, InsetPanel, Press, RowCard, ScreenBackground, SegmentedControl, Skeleton, TextLink, TopBar, ZText, useToast } from "@/ui";
import { useAuth } from "@/lib/auth";
import { pickImage, uploadImage } from "@/lib/storage";
import { supabase } from "@/lib/supabase";
import { loadTripSummaries, type TripSummary } from "@/lib/trips";
import { openVenmoProfile } from "@/lib/venmo";

/**
 * Profile (user: hierarchy). Photo → Add/Replace photo → Name → the login identifier
 * (email, else phone; read-only) → Password (read-only, with a "Change password" link
 * to the reset screen) → Venmo username → Save → Stats | History → FAQ → Sign out →
 * Delete account. Delete confirms in an action sheet (never a system alert) and still
 * calls delete_my_account.
 */
type StatsRow = { id: string; description: string; category: string; base_amount_cents: number; expense_payers: { user_id: string; base_amount_cents: number }[] };

export default function ProfileScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { show } = useToast();
  const { session, profile, refreshProfile, signOut } = useAuth();
  const uid = session!.user.id;
  const prefill = splitName(profile?.display_name);
  const [first, setFirst] = useState(profile?.first_name ?? prefill.first ?? "");
  const [last, setLast] = useState(profile?.last_name ?? prefill.last ?? "");
  const [venmo, setVenmo] = useState(profile?.venmo_username ?? "");
  const [busy, setBusy] = useState(false);
  const [photoBusy, setPhotoBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [tab, setTab] = useState<"stats" | "history">("stats");
  const [trips, setTrips] = useState<TripSummary[]>([]);
  const [rows, setRows] = useState<StatsRow[]>([]);
  const [settledCents, setSettledCents] = useState(0);
  const [loading, setLoading] = useState(true);

  const identifier = profile?.email ?? (profile?.phone ? `+${profile.phone}` : "");
  const identifierLabel = profile?.email ? "Email" : "Phone number";

  useFocusEffect(useCallback(() => {
    let live = true;
    Promise.all([
      loadTripSummaries(uid),
      supabase.from("expenses").select("id, description, category, base_amount_cents, expense_payers(user_id, base_amount_cents)").is("deleted_at", null),
      supabase.from("settlements").select("amount_cents, status, from_user, to_user").neq("status", "pending"),
    ]).then(([t, e, s]) => {
      if (!live) return;
      setTrips(t);
      setRows((e.data ?? []) as unknown as StatsRow[]);
      setSettledCents(((s.data ?? []) as { amount_cents: number; from_user: string; to_user: string }[]).filter((x) => x.from_user === uid || x.to_user === uid).reduce((a, x) => a + x.amount_cents, 0));
      setLoading(false);
    });
    return () => { live = false; };
  }, [uid]));

  const stats = useMemo(() => {
    const mine = rows.map((r) => ({ r, paid: r.expense_payers.filter((p) => p.user_id === uid).reduce((a, p) => a + p.base_amount_cents, 0) })).filter((x) => x.paid > 0);
    const totalPaid = mine.reduce((a, x) => a + x.paid, 0);
    const biggest = mine.reduce<{ r: StatsRow; paid: number } | null>((b, x) => (!b || x.paid > b.paid ? x : b), null);
    const byCat = new Map<string, number>();
    for (const x of mine) byCat.set(x.r.category, (byCat.get(x.r.category) ?? 0) + 1);
    const topKey = [...byCat.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];
    const top = CATEGORIES.find((c) => c.key === topKey)?.label ?? null;
    return { trips: trips.length, settledTrips: trips.filter((t) => t.status !== "open").length, totalPaid, biggest, top, logged: mine.length };
  }, [rows, trips, uid]);

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
    if (!isValidNamePart(first)) { setError("Enter your first name."); return; }
    if (!isValidNamePart(last)) { setError("Enter your last name."); return; }
    if (venmo.trim() && !isValidVenmoUsername(venmo)) { setError("Venmo usernames are 5–30 letters, numbers, hyphens or underscores."); return; }
    setBusy(true); setError(null);
    const f = first.trim(), l = last.trim();
    // first_name / last_name are the source; display_name stays the composed name every reader uses
    const { error: e } = await supabase.from("users").update({ first_name: f, last_name: l, display_name: joinName(f, l), venmo_username: venmo.trim().replace(/^@/, "") || null }).eq("id", uid);
    setBusy(false);
    if (e) { setError(e.message); return; }
    await refreshProfile();
    show({ message: "Saved", tone: "volt", duration: 2000 });
  }

  async function deleteAccount() {
    await supabase.storage.from("avatars").remove([`${uid}/avatar.jpg`]).catch(() => null);
    const { error: e } = await supabase.rpc("delete_my_account");
    if (e) { setError(e.message); return; }
    await signOut();
  }

  return (
    <View style={styles.screen}>
      <ScreenBackground />
      <TopBar onBack={() => router.back()} />
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={styles.flex}>
        <ScrollView contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + space[32] }]} keyboardShouldPersistTaps="handled" keyboardDismissMode="interactive" showsVerticalScrollIndicator={false}>
          <ZText variant="title1" accessibilityRole="header" style={styles.title}>Profile</ZText>

          {/* 1–2: photo */}
          <Press onPress={changePhoto} disabled={photoBusy} scaleTo={0.98} accessibilityRole="button" accessibilityLabel={profile?.photo_url ? "Replace photo" : "Add a photo"} accessibilityState={{ busy: photoBusy }} style={styles.photoRow}>
            <View>
              <Avatar name={profile?.display_name ?? "?"} uri={profile?.photo_url} size={72} />
              <View style={styles.plus} accessibilityElementsHidden><Icon name={profile?.photo_url ? "camera" : "plus"} size={14} stroke={2.4} /></View>
            </View>
            <ZText variant="label" color={color.textSecondary}>{photoBusy ? "Uploading…" : profile?.photo_url ? "Replace photo" : "Add a photo"}</ZText>
          </Press>

          {/* 3–6: fields */}
          <Card style={styles.form}>
            <View style={styles.names}>
              <Input label="First name" value={first} onChangeText={setFirst} autoCapitalize="words" textContentType="givenName" autoComplete="given-name" returnKeyType="next" style={styles.flex} />
              <Input label="Last name" value={last} onChangeText={setLast} autoCapitalize="words" textContentType="familyName" autoComplete="family-name" returnKeyType="done" style={styles.flex} />
            </View>
            <Input label={identifierLabel} value={identifier} editable={false} helper="Used to sign in; can't be changed here." />
            <View style={styles.fieldWithLink}>
              <Input label="Password" value="••••••••" editable={false} secureTextEntry />
              {/* the reset-password route is built alongside the account flows */}
              <TextLink label="Change password" onPress={() => router.push("/(auth)/reset-password?mode=change" as Parameters<typeof router.push>[0])} />
            </View>
            <View style={styles.fieldWithLink}>
              <Input label="Venmo username" placeholder="your-venmo" value={venmo} onChangeText={setVenmo} autoCapitalize="none" autoCorrect={false} error={error} returnKeyType="done" />
              {venmo.trim().length >= 5 ? <TextLink label="View on Venmo" onPress={() => openVenmoProfile(venmo)} /> : null}
            </View>
            <Button kind="ink" label="Save" height={size.buttonHeight} onPress={save} loading={busy} />
          </Card>

          {/* 7: Stats | History */}
          <View style={styles.tabs}>
            <SegmentedControl options={[{ key: "stats", label: "Stats" }, { key: "history", label: "History" }]} value={tab} onChange={setTab} />
            {tab === "stats" ? (
              <Card style={styles.stats}>
                <Stat k="Dazzles" v={`${stats.trips}${stats.settledTrips ? ` · ${stats.settledTrips} settled` : ""}`} loading={loading} />
                <Stat k="You've paid" v={formatCents(stats.totalPaid)} sub={`${stats.logged} ${stats.logged === 1 ? "expense" : "expenses"} logged`} loading={loading} />
                <Stat k="Settled through Zebrasplit" v={formatCents(settledCents)} loading={loading} />
                <Stat k="Biggest expense you paid" v={stats.biggest ? `${stats.biggest.r.description} · ${formatCents(stats.biggest.paid)}` : "—"} loading={loading} />
                <Stat k="Most frequent category" v={stats.top ?? "—"} loading={loading} />
              </Card>
            ) : (
              <TripHistoryList trips={trips} loading={loading} />
            )}
          </View>

          {/* 8: FAQ */}
          <RowCard title="FAQ" caption="How splitting, Done and close-out work" right={<Icon name="chevronRight" size={18} color={color.textMuted} />} onPress={() => router.push("/(app)/faq")} />

          {/* 9–10 */}
          <Button kind="secondary" label="Sign out" height={size.buttonHeight} onPress={signOut} />
          <Press onPress={() => setConfirmDelete(true)} scaleTo={0.98} accessibilityRole="button" accessibilityLabel="Delete account" style={styles.delete}>
            <ZText variant="label" color={color.destructive} style={styles.deleteText}>Delete account</ZText>
          </Press>
          <ZText variant="caption" color={color.textMuted} style={styles.note}>Deleting removes your personal data and anonymises you on shared Dazzles.</ZText>
        </ScrollView>
      </KeyboardAvoidingView>

      <ActionSheet
        open={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        title={"Delete your account? Your name comes off every Dazzle as \"Former member\" so the group's totals still add up. Your phone, photo and Venmo username are removed and you're signed out. This can't be undone."}
        actions={[{ label: "Delete account", destructive: true, onPress: deleteAccount }]}
      />
    </View>
  );
}

function Stat({ k, v, sub, loading }: { k: string; v: string; sub?: string; loading: boolean }) {
  return (
    <InsetPanel style={styles.stat}>
      <ZText variant="small" color={color.textMuted}>{k}</ZText>
      {loading ? <Skeleton width="50%" height={16} style={styles.statSkeleton} /> : <ZText variant="bodyStrong">{v}</ZText>}
      {sub && !loading ? <ZText variant="caption" color={color.textMuted}>{sub}</ZText> : null}
    </InsetPanel>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: palette.bgMid },
  flex: { flex: 1 },
  content: { paddingHorizontal: layout.screenGutter, gap: space[14] },
  title: { paddingHorizontal: space[4] },
  photoRow: { flexDirection: "row", alignItems: "center", gap: space[12], alignSelf: "flex-start", paddingHorizontal: space[4] },
  plus: { position: "absolute", right: -2, bottom: -2, width: 26, height: 26, borderRadius: radius.pill, backgroundColor: color.surfaceTile, borderWidth: 2, borderColor: color.surface, alignItems: "center", justifyContent: "center" },
  form: { gap: space[14] },
  names: { flexDirection: "row", gap: space[10] },
  fieldWithLink: { gap: space[6] },
  tabs: { gap: space[10] },
  stats: { gap: space[8] },
  stat: { gap: 2 },
  statSkeleton: { marginVertical: 2 },
  delete: { alignSelf: "center", minHeight: layout.minTapTarget, justifyContent: "center", paddingHorizontal: space[12] },
  deleteText: { textDecorationLine: "underline" },
  note: { textAlign: "center", paddingHorizontal: layout.textGutter },
});
