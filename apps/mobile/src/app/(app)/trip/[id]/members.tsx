import { formatCents, venmoProfileUrl } from "@checkm8/core";
import { theme } from "@checkm8/theme";
import { useLocalSearchParams, useRouter } from "expo-router";
import { openBrowserAsync } from "expo-web-browser";
import { useState } from "react";
import { ActivityIndicator, Alert, View } from "react-native";
import { Avatar, Button, Card, Divider, DoneBadge, ListItem, Screen, Text } from "@/components/ui";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/lib/supabase";
import { hasNoExpenses } from "@/lib/tripExtras";
import { nets, paidBy, shareOf, useTrip } from "@/lib/trips";

/**
 * Member details (spec: Trip page → tapping a member shows their details;
 * Members → the owner can remove a member only if that member has no
 * expenses, as payer or as someone included). Removal calls remove_member,
 * which the database re-checks (guard_member_removal) so a stale screen
 * can't remove someone who has since been added to an expense.
 */
export default function MemberScreen() {
  const { id, user } = useLocalSearchParams<{ id: string; user: string }>();
  const router = useRouter();
  const { session } = useAuth();
  const me = session!.user.id;
  const { data, loading, reload } = useTrip(id);
  const [busy, setBusy] = useState(false);

  if (loading || !data) return <Screen><View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}><ActivityIndicator /></View></Screen>;
  const m = data.members.find((x) => x.user_id === user);
  if (!m) return <Screen><Text>Member not found.</Text></Screen>;
  const { trip } = data;
  const isMe = m.user_id === me;
  const viewerIsOwner = data.members.find((x) => x.user_id === me)?.role === "owner";
  const removable = viewerIsOwner && !isMe && m.role !== "owner" && !m.removed_at && trip.status === "open" && hasNoExpenses(data, m.user_id);
  const name = isMe ? "You" : (m.display_name ?? m.phone ?? "Member");
  const paid = paidBy(data, m.user_id), share = shareOf(data, m.user_id), net = nets(data)[m.user_id] ?? 0;

  function remove() {
    Alert.alert(`Remove ${m!.display_name ?? "this member"}?`, "They lose access right away and are notified. Balances don't change because they're on no expenses.", [
      { text: "Cancel", style: "cancel" },
      { text: "Remove", style: "destructive", onPress: async () => {
        setBusy(true);
        const { error } = await supabase.rpc("remove_member", { p_trip: trip.id, p_user: m!.user_id });
        setBusy(false);
        if (error) { Alert.alert("Couldn't remove", error.message); reload(); return; }
        router.back();
      } },
    ]);
  }

  return (
    <Screen>
      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingVertical: theme.spacing.sm }}>
        <Button title="‹ Trip" kind="text" size="small" onPress={() => router.back()} />
        <Text variant="title2">Member</Text>
        <View style={{ width: 60 }} />
      </View>
      <View style={{ gap: theme.spacing.xl }}>
        <View style={{ alignItems: "center", gap: theme.spacing.sm }}>
          <Avatar name={m.display_name ?? "?"} uri={m.photo_url} size={88} />
          <Text variant="largeTitle">{name}</Text>
          <View style={{ flexDirection: "row", alignItems: "center", gap: theme.spacing.sm }}>
            <Text variant="caption1" color={theme.colors.text.onBackground.secondary}>{m.role === "owner" ? "Trip owner" : "Member"}{m.removed_at ? " · removed" : ""}</Text>
            {m.done_at && <DoneBadge />}
          </View>
        </View>

        <Card style={{ padding: 0, overflow: "hidden" }}>
          <ListItem title="Phone" subtitle={m.phone ? `+${m.phone}` : "Not shared"} />
          <Divider />
          <ListItem title="Venmo" subtitle={m.venmo_username ? `@${m.venmo_username}` : "Not added yet"} right={m.venmo_username ? <Button title="Open ↗" kind="text" size="small" onPress={() => openBrowserAsync(venmoProfileUrl(m.venmo_username!))} /> : undefined} />
        </Card>

        <Card style={{ padding: 0, overflow: "hidden" }}>
          <Text variant="captionCaps2" color={theme.colors.text.onBackground.secondary} style={{ padding: 12, paddingBottom: 4 }}>On this trip</Text>
          <ListItem title="Paid" right={<Text variant="text">{formatCents(paid, trip.base_currency)}</Text>} />
          <Divider />
          <ListItem title="Share" right={<Text variant="text">{formatCents(share, trip.base_currency)}</Text>} />
          <Divider />
          <ListItem title="Net" right={<Text variant="text" color={net < 0 ? theme.colors.text.destructive : net > 0 ? theme.colors.text.success : theme.colors.text.onBackground.secondary}>{net === 0 ? "Even" : net > 0 ? `Owed ${formatCents(net, trip.base_currency)}` : `Owes ${formatCents(-net, trip.base_currency)}`}</Text>} />
          <Divider />
          <ListItem title="Done adding expenses" right={<Text variant="caption1Semibold" color={m.done_at ? theme.colors.text.success : theme.colors.text.onBackground.secondary}>{m.done_at ? "Yes" : "Not yet"}</Text>} />
        </Card>

        {removable ? (
          <Button title="Remove from trip" kind="destructive" size="medium" onPress={remove} loading={busy} />
        ) : viewerIsOwner && !isMe && m.role !== "owner" && !m.removed_at ? (
          <Text variant="caption1" color={theme.colors.text.onBackground.tertiary} style={{ textAlign: "center" }}>
            {trip.status !== "open" ? "Members can't be removed after close-out." : `${m.display_name ?? "This member"} is on at least one expense, so they can't be removed in this version. That keeps every balance intact.`}
          </Text>
        ) : null}
      </View>
    </Screen>
  );
}
