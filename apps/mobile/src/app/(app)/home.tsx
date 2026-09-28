import { formatCents } from "@checkm8/core";
import { theme } from "@checkm8/theme";
import { useCallback, useEffect, useState } from "react";
import { FlatList, RefreshControl, View } from "react-native";
import { Avatar, Button, Card, EmptyState, ListItem, Screen, Segmented, Text } from "@/components/ui";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/lib/supabase";

/**
 * Home (spec: Screens → Home): Current and Past trips, search (next phase),
 * and the always-visible "New Shared Expense" button. Balances per trip
 * arrive with the trip page phase; this shell lists what the user is a
 * member of, live from the store under row-level security.
 */
type TripRow = { id: string; title: string; status: "open" | "settled" | "archived"; start_date: string; end_date: string; last_activity_at: string; member_count: number };

export default function HomeScreen() {
  const { profile, signOut } = useAuth();
  const [tab, setTab] = useState<"current" | "past">("current");
  const [trips, setTrips] = useState<TripRow[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase.from("trips").select("id, title, status, start_date, end_date, last_activity_at, trip_members(count)").order("last_activity_at", { ascending: false });
    setTrips(((data ?? []) as unknown as (TripRow & { trip_members: { count: number }[] })[]).map((t) => ({ ...t, member_count: t.trip_members?.[0]?.count ?? 0 })));
    setLoading(false);
  }, []);
  useEffect(() => { load(); }, [load]);

  const shown = trips.filter((t) => (tab === "current" ? t.status === "open" : t.status !== "open"));

  return (
    <Screen>
      <View style={{ gap: theme.spacing.lg, flex: 1 }}>
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingTop: theme.spacing.sm }}>
          <Text variant="largeTitle">Trips</Text>
          <Avatar name={profile?.display_name ?? "?"} size={36} />
        </View>
        <Segmented options={[{ key: "current", label: "Current" }, { key: "past", label: "Past" }]} value={tab} onChange={setTab} />
        <FlatList
          data={shown}
          keyExtractor={(t) => t.id}
          refreshControl={<RefreshControl refreshing={loading} onRefresh={load} />}
          ItemSeparatorComponent={() => <View style={{ height: theme.spacing.md }} />}
          ListEmptyComponent={loading ? null : <EmptyState title={tab === "current" ? "No trips yet" : "Nothing in the archive"} body={tab === "current" ? "Start a trip and invite the group. Everyone logs what they paid; close-out unlocks when the whole group taps Done." : "Settled trips, and trips quiet for 14 days, land here."} />}
          renderItem={({ item }) => (
            <Card style={{ padding: 0, overflow: "hidden" }}>
              <ListItem title={item.title} subtitle={`${item.start_date} – ${item.end_date} · ${item.member_count} ${item.member_count === 1 ? "member" : "members"}`} right={<Text variant="caption1Semibold" color={theme.colors.text.onBackground.secondary}>{formatCents(0)}</Text>} onPress={() => {}} />
            </Card>
          )}
          contentContainerStyle={{ paddingBottom: 96 }}
        />
      </View>
      <View style={{ position: "absolute", left: theme.screenPadding, right: theme.screenPadding, bottom: theme.spacing.xxl, gap: theme.spacing.sm }}>
        <Button title="New Shared Expense" onPress={() => {}} />
        <Button title="Sign out" kind="text" size="small" onPress={signOut} />
      </View>
    </Screen>
  );
}
