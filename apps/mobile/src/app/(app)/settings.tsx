import { CATEGORIES, formatCents, isValidVenmoUsername, venmoProfileUrl } from "@checkm8/core";
import { theme } from "@checkm8/theme";
import { useFocusEffect, useRouter } from "expo-router";
import { openBrowserAsync } from "expo-web-browser";
import { useCallback, useMemo, useState } from "react";
import { Alert, Pressable, ScrollView, View } from "react-native";
import { TripHistoryList } from "@/components/TripHistoryList";
import { Avatar, Button, Card, Input, ListItem, Screen, Segmented, Text } from "@/components/ui";
import { useAuth } from "@/lib/auth";
import { pickImage, uploadImage } from "@/lib/storage";
import { supabase } from "@/lib/supabase";
import { loadTripSummaries, type TripSummary } from "@/lib/trips";

/**
 * Profile (user: hierarchy). Photo → Add/Replace photo → Name → the login
 * identifier (email, else phone; read-only) → Password (read-only, with a
 * "Change Password" link to the reset screen) → Venmo Handle → Save →
 * Stats | History tabs → FAQ → Sign out → Delete account.
 */
type StatsRow = { id: string; description: string; category: string; base_amount_cents: number; expense_payers: { user_id: string; base_amount_cents: number }[] };

export default function ProfileScreen() {
  const router = useRouter();
  const { session, profile, refreshProfile, signOut } = useAuth();
  const uid = session!.user.id;
  const [name, setName] = useState(profile?.display_name ?? "");
  const [venmo, setVenmo] = useState(profile?.venmo_username ?? "");
  const [busy, setBusy] = useState(false);
  const [photoBusy, setPhotoBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
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
    if (name.trim().length < 2) { setError("Enter the name your friends know you by."); return; }
    if (venmo.trim() && !isValidVenmoUsername(venmo)) { setError("Venmo handles are 5–30 letters, numbers, hyphens or underscores."); return; }
    setBusy(true); setError(null); setSaved(false);
    const { error: e } = await supabase.from("users").update({ display_name: name.trim(), venmo_username: venmo.trim().replace(/^@/, "") || null }).eq("id", uid);
    setBusy(false);
    if (e) { setError(e.message); return; }
    await refreshProfile(); setSaved(true);
  }

  function deleteAccount() {
    Alert.alert("Delete your account?", "Your name comes off every trip as \"Former member\" so the group's totals still add up. Your phone, photo and Venmo handle are removed and you're signed out. This can't be undone.", [
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
        {/* 1–2: photo */}
        <View style={{ alignItems: "center", gap: theme.spacing.sm }}>
          <Pressable onPress={changePhoto} accessibilityRole="button" accessibilityLabel={profile?.photo_url ? "Replace photo" : "Add a photo"} disabled={photoBusy}>
            <Avatar name={profile?.display_name ?? "?"} uri={profile?.photo_url} size={88} />
          </Pressable>
          <Button title={photoBusy ? "Uploading…" : profile?.photo_url ? "Replace photo" : "Add a photo"} kind="text" size="small" onPress={changePhoto} loading={photoBusy} />
        </View>

        {/* 3–6: fields */}
        <Card style={{ gap: theme.spacing.lg }}>
          <Input label="Name" value={name} onChangeText={setName} autoCapitalize="words" textContentType="name" />
          <View style={{ opacity: 0.55 }}>
            <Input label={identifierLabel} value={identifier} editable={false} helper="Used to sign in; can't be changed here." />
          </View>
          <View style={{ gap: theme.spacing.xs }}>
            <View style={{ opacity: 0.55 }}>
              <Input label="Password" value="••••••••" editable={false} secureTextEntry />
            </View>
            {/* the reset-password route is built alongside the account flows */}
            <Button title="Change Password" kind="text" size="small" style={{ alignSelf: "flex-start" }} onPress={() => router.push("/(auth)/reset-password?mode=change" as Parameters<typeof router.push>[0])} />
          </View>
          <View style={{ gap: theme.spacing.xs }}>
            <Input label="Venmo Handle" placeholder="your-venmo" value={venmo} onChangeText={setVenmo} autoCapitalize="none" autoCorrect={false} />
            {venmo.trim().length >= 5 && <Button title="View on Venmo" kind="text" size="small" style={{ alignSelf: "flex-start" }} onPress={() => openBrowserAsync(venmoProfileUrl(venmo))} />}
          </View>
          {error && <Text variant="caption1" color={theme.colors.text.destructive}>{error}</Text>}
          {saved && !error && <Text variant="caption1" color={theme.colors.text.success}>Saved.</Text>}
          <Button title="Save" size="medium" onPress={save} loading={busy} />
        </Card>

        {/* 7: Stats | History */}
        <View style={{ gap: theme.spacing.md }}>
          <Segmented options={[{ key: "stats", label: "Stats" }, { key: "history", label: "History" }]} value={tab} onChange={setTab} />
          {tab === "stats" ? (
            <Card style={{ gap: theme.spacing.md }}>
              <StatRow k="Trips" v={loading ? "…" : `${stats.trips}${stats.settledTrips ? ` · ${stats.settledTrips} settled` : ""}`} />
              <StatRow k="You've paid" v={loading ? "…" : formatCents(stats.totalPaid)} sub={loading ? undefined : `${stats.logged} ${stats.logged === 1 ? "expense" : "expenses"} logged`} />
              <StatRow k="Settled through Checkm8" v={loading ? "…" : formatCents(settledCents)} />
              <StatRow k="Biggest expense you paid" v={loading ? "…" : stats.biggest ? `${stats.biggest.r.description} · ${formatCents(stats.biggest.paid)}` : "—"} />
              <StatRow k="Most frequent category" v={loading ? "…" : stats.top ?? "—"} />
            </Card>
          ) : (
            <TripHistoryList trips={trips} loading={loading} />
          )}
        </View>

        {/* 8: FAQ */}
        <Card style={{ padding: 0, overflow: "hidden" }}>
          <ListItem title="FAQ" subtitle="How splitting, Done and close-out work" onPress={() => router.push("/(app)/faq")} right={<Text variant="title2" color={theme.colors.text.onBackground.accent}>›</Text>} />
        </Card>

        {/* 9–10 */}
        <Button title="Sign out" kind="secondary" size="medium" onPress={signOut} />
        <Button title="Delete account" kind="text" size="small" onPress={deleteAccount} />
        <Text variant="caption1" color={theme.colors.text.onBackground.tertiary} style={{ textAlign: "center" }}>Deleting removes your personal data and anonymises you on shared trips.</Text>
      </ScrollView>
    </Screen>
  );
}

function StatRow({ k, v, sub }: { k: string; v: string; sub?: string }) {
  return (
    <View style={{ gap: 2 }}>
      <Text variant="captionCaps2" color={theme.colors.text.onBackground.secondary}>{k}</Text>
      <Text variant="headline">{v}</Text>
      {sub ? <Text variant="caption1" color={theme.colors.text.onBackground.tertiary}>{sub}</Text> : null}
    </View>
  );
}
