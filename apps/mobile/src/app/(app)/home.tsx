import { formatCents, formatDateRange } from "@checkm8/core";
import { theme } from "@checkm8/theme";
import { useFocusEffect, useRouter } from "expo-router";
import { useCallback, useMemo, useState } from "react";
import { FlatList, Image, Pressable, RefreshControl, View } from "react-native";
import { Avatar, Button, Card, EmptyState, Input, Screen, Segmented, Text } from "@/components/ui";
import { useAuth } from "@/lib/auth";
import { useSignedUrl } from "@/lib/media";
import { supabase } from "@/lib/supabase";

/**
 * Home (spec: Screens → Home): Current and Past trips as cards with title,
 * cover photo, member avatars and your balance ("You're owed $142" / "You
 * owe $58"), search across trips by title or member name, and the
 * always-visible "New Shared Expense" button. Balances are computed here
 * from the same rows the trip page uses (base cents, paid minus share),
 * so the two screens can never disagree. Reloads whenever the screen
 * regains focus, so a trip created or edited elsewhere shows at once.
 */
type MemberRow = { user_id: string; display_name: string | null; photo_url: string | null };
type TripRow = { id: string; title: string; status: "open" | "settled" | "archived"; start_date: string; end_date: string; cover_photo_url: string | null; last_activity_at: string; members: MemberRow[]; net_cents: number };

export default function HomeScreen() {
  const router = useRouter();
  const { session, profile, signOut } = useAuth();
  const me = session!.user.id;
  const [tab, setTab] = useState<"current" | "past">("current");
  const [query, setQuery] = useState("");
  const [trips, setTrips] = useState<TripRow[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const [t, m, e] = await Promise.all([
      supabase.from("trips").select("id, title, status, start_date, end_date, cover_photo_url, last_activity_at").order("last_activity_at", { ascending: false }),
      supabase.from("trip_members").select("trip_id, user_id, users(display_name, photo_url)").is("removed_at", null),
      supabase.from("expenses").select("trip_id, expense_payers(user_id, base_amount_cents), expense_shares(user_id, base_share_cents)").is("deleted_at", null),
    ]);
    type M = { trip_id: string; user_id: string; users: { display_name: string | null; photo_url: string | null } | null };
    type E = { trip_id: string; expense_payers: { user_id: string; base_amount_cents: number }[]; expense_shares: { user_id: string; base_share_cents: number }[] };
    const membersBy = new Map<string, MemberRow[]>();
    for (const r of (m.data ?? []) as unknown as M[]) membersBy.set(r.trip_id, [...(membersBy.get(r.trip_id) ?? []), { user_id: r.user_id, display_name: r.users?.display_name ?? null, photo_url: r.users?.photo_url ?? null }]);
    const netBy = new Map<string, number>();
    for (const x of (e.data ?? []) as unknown as E[]) {
      const paid = x.expense_payers.filter((p) => p.user_id === me).reduce((s, p) => s + p.base_amount_cents, 0);
      const share = x.expense_shares.filter((p) => p.user_id === me).reduce((s, p) => s + p.base_share_cents, 0);
      netBy.set(x.trip_id, (netBy.get(x.trip_id) ?? 0) + paid - share);
    }
    setTrips(((t.data ?? []) as Omit<TripRow, "members" | "net_cents">[]).map((r) => ({ ...r, members: membersBy.get(r.id) ?? [], net_cents: netBy.get(r.id) ?? 0 })));
    setLoading(false);
  }, [me]);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return trips
      .filter((t) => (tab === "current" ? t.status === "open" : t.status !== "open"))
      .filter((t) => !q || t.title.toLowerCase().includes(q) || t.members.some((mm) => (mm.display_name ?? "").toLowerCase().includes(q)));
  }, [trips, tab, query]);

  return (
    <Screen>
      <View style={{ gap: theme.spacing.md, flex: 1 }}>
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingTop: theme.spacing.sm }}>
          <Text variant="largeTitle">Trips</Text>
          <Pressable onPress={() => router.push("/(app)/settings")} accessibilityRole="button" accessibilityLabel="Your profile"><Avatar name={profile?.display_name ?? "?"} uri={profile?.photo_url} size={36} /></Pressable>
        </View>
        <Segmented options={[{ key: "current", label: "Current" }, { key: "past", label: "Past" }]} value={tab} onChange={setTab} />
        {trips.length > 0 && <Input placeholder="Search trips or people" value={query} onChangeText={setQuery} autoCapitalize="none" autoCorrect={false} clearButtonMode="while-editing" />}
        <FlatList
          data={shown}
          keyExtractor={(t) => t.id}
          refreshControl={<RefreshControl refreshing={loading && trips.length > 0} onRefresh={load} />}
          ItemSeparatorComponent={() => <View style={{ height: theme.spacing.md }} />}
          ListEmptyComponent={loading ? null : query ? <EmptyState title="No matches" body="Try a trip title or a member's name." /> : <EmptyState title={tab === "current" ? "No trips yet" : "Nothing in the archive"} body={tab === "current" ? "Start a trip and invite the group. Everyone logs what they paid; close-out unlocks when the whole group taps Done." : "Settled trips, and trips quiet for 14 days, land here."} />}
          renderItem={({ item }) => <TripCard trip={item} me={me} onPress={() => router.push(`/(app)/trip/${item.id}`)} />}
          contentContainerStyle={{ paddingBottom: 140 }}
          keyboardShouldPersistTaps="handled"
        />
      </View>
      <View style={{ position: "absolute", left: theme.screenPadding, right: theme.screenPadding, bottom: theme.spacing.xxl, gap: theme.spacing.sm }}>
        <Button title="New Shared Expense" onPress={() => router.push("/(app)/trip/new")} />
        <Button title="Sign out" kind="text" size="small" onPress={signOut} />
      </View>
    </Screen>
  );
}

function TripCard({ trip, me, onPress }: { trip: TripRow; me: string; onPress: () => void }) {
  const others = trip.members.filter((m) => m.user_id !== me);
  const cover = useSignedUrl("covers", trip.cover_photo_url); // object path in the private bucket
  const balance = trip.status !== "open" ? { label: trip.status === "settled" ? "Settled" : "Archived", color: theme.colors.text.onBackground.secondary }
    : trip.net_cents > 0 ? { label: `You're owed ${formatCents(trip.net_cents)}`, color: theme.colors.text.success }
    : trip.net_cents < 0 ? { label: `You owe ${formatCents(-trip.net_cents)}`, color: theme.colors.text.destructive }
    : { label: "You're even", color: theme.colors.text.onBackground.secondary };
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={`${trip.title}, ${balance.label}`}>
      <Card style={{ padding: 0, overflow: "hidden" }}>
        {cover && <Image source={{ uri: cover }} style={{ width: "100%", height: 120 }} resizeMode="cover" accessibilityIgnoresInvertColors />}
        <View style={{ padding: theme.spacing.lg, gap: theme.spacing.sm }}>
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", gap: theme.spacing.md }}>
            <View style={{ flex: 1, gap: 2 }}>
              <Text variant="headline">{trip.title}</Text>
              <Text variant="caption1" color={theme.colors.text.onBackground.secondary}>{formatDateRange(trip.start_date, trip.end_date)}</Text>
            </View>
            <Text variant="caption1Semibold" color={balance.color}>{balance.label}</Text>
          </View>
          <View style={{ flexDirection: "row", alignItems: "center" }}>
            {others.slice(0, 5).map((m, i) => <View key={m.user_id} style={{ marginLeft: i === 0 ? 0 : -8, borderWidth: 2, borderColor: theme.colors.background.surface, borderRadius: 16 }}><Avatar name={m.display_name ?? "?"} uri={m.photo_url} size={28} /></View>)}
            <Text variant="caption1" color={theme.colors.text.onBackground.secondary} style={{ marginLeft: others.length ? theme.spacing.sm : 0 }}>
              {others.length === 0 ? "Just you so far" : others.length <= 2 ? others.map((m) => m.display_name ?? "Someone").join(" & ") : `${others[0]!.display_name ?? "Someone"} and ${others.length - 1} others`}
            </Text>
          </View>
        </View>
      </Card>
    </Pressable>
  );
}
