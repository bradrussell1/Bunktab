import { CATEGORIES, categoryLabel, closeoutUnlocked, formatCents, formatDateRange } from "@checkm8/core";
import { theme } from "@checkm8/theme";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useMemo, useState } from "react";
import { ActivityIndicator, Alert, Pressable, ScrollView, Switch, View } from "react-native";
import { Avatar, Button, Card, DoneBadge, Divider, ListItem, Screen, Segmented, Text } from "@/components/ui";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/lib/supabase";
import { activeMembers, memberName, membersWithNoExpenses, nets, paidBy, previewPayments, shareOf, tripTotal, useTrip } from "@/lib/trips";

/**
 * The trip page (spec: Screens → Trip page): header with member avatars and
 * Done badges; the balance card with the live settlement preview beneath;
 * who hasn't logged yet; Expenses · Per person · Summary; the sticky footer
 * with Add expense, the Done toggle and Close out (locked until everyone
 * has the badge; the owner gets Close out anyway).
 */
type Tab = "expenses" | "people" | "summary";

export default function TripScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { session } = useAuth();
  const me = session!.user.id;
  const { data, loading, error, reload } = useTrip(id);
  const [tab, setTab] = useState<Tab>("expenses");
  const [showPlan, setShowPlan] = useState(false);
  const [busy, setBusy] = useState(false);

  const figures = useMemo(() => {
    if (!data) return null;
    const n = nets(data);
    return { nets: n, mine: n[me] ?? 0, plan: previewPayments(data), total: tripTotal(data), members: activeMembers(data), quiet: membersWithNoExpenses(data) };
  }, [data, me]);

  if (loading || !data || !figures) return <Screen><View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>{error ? <Text>{error}</Text> : <ActivityIndicator />}</View></Screen>;

  const { trip, members } = data;
  const meMember = members.find((m) => m.user_id === me);
  const isOwner = meMember?.role === "owner";
  const unlocked = closeoutUnlocked(figures.members.map((m) => ({ doneAt: m.done_at, removedAt: m.removed_at }))) || !!trip.closeout_override_at;
  const perPerson = figures.members.length ? Math.round(figures.total / figures.members.length) : 0;

  async function toggleDone(v: boolean) {
    setBusy(true);
    await supabase.rpc("set_done", { p_trip: trip.id, p_done: v });
    setBusy(false); reload();
  }
  function closeOutAnyway() {
    Alert.alert("Close out anyway?", "Not everyone has tapped Done. Everyone will be notified, the override is logged, and expenses already logged still count.", [
      { text: "Cancel", style: "cancel" },
      { text: "Close out", style: "destructive", onPress: async () => { await supabase.rpc("owner_closeout", { p_trip: trip.id }); reload(); router.push(`/(app)/trip/${trip.id}/closeout`); } },
    ]);
  }

  return (
    <Screen padded={false}>
      <ScrollView contentContainerStyle={{ paddingHorizontal: theme.screenPadding, paddingBottom: 200, gap: theme.spacing.lg }}>
        {/* header */}
        <View style={{ paddingTop: theme.spacing.sm, gap: theme.spacing.sm }}>
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
            <Button title="‹ Trips" kind="text" size="small" onPress={() => router.replace("/(app)/home")} />
            {isOwner && !unlocked && trip.status === "open" && <Button title="Close out anyway" kind="text" size="small" onPress={closeOutAnyway} />}
          </View>
          <Text variant="largeTitle">{trip.title}</Text>
          <Text variant="caption1" color={theme.colors.text.onBackground.secondary}>{formatDateRange(trip.start_date, trip.end_date)} · {trip.base_currency}{trip.status !== "open" ? ` · ${trip.status}` : ""}</Text>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: theme.spacing.sm }}>
            {figures.members.map((m) => (
              <View key={m.user_id} style={{ flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: theme.colors.background.surface, borderWidth: 1, borderColor: theme.colors.border.neutral, borderRadius: theme.radius.pill, paddingRight: 10, paddingLeft: 3, paddingVertical: 3 }}>
                <Avatar name={m.display_name ?? "?"} uri={m.photo_url} size={26} />
                <Text variant="caption1Semibold">{m.user_id === me ? "You" : (m.display_name ?? m.phone ?? "Invited")}</Text>
                {m.done_at && <DoneBadge />}
              </View>
            ))}
          </View>
        </View>

        {/* balance card + settlement preview */}
        <Card style={{ gap: theme.spacing.sm }}>
          <Text variant="captionCaps2" color={theme.colors.text.onBackground.secondary}>Your balance</Text>
          <Text variant="largeTitle" color={figures.mine < 0 ? theme.colors.text.destructive : figures.mine > 0 ? theme.colors.text.success : theme.colors.text.onBackground.primary}>
            {figures.mine === 0 ? "Settled up" : figures.mine > 0 ? `You're owed ${formatCents(figures.mine, trip.base_currency)}` : `You owe ${formatCents(-figures.mine, trip.base_currency)}`}
          </Text>
          <Pressable onPress={() => setShowPlan((v) => !v)} accessibilityRole="button" accessibilityState={{ expanded: showPlan }} style={{ flexDirection: "row", justifyContent: "space-between", paddingTop: 4 }}>
            <Text variant="caption1Semibold" color={theme.colors.text.onBackground.accent}>Settlement preview</Text>
            <Text variant="caption1Semibold" color={theme.colors.text.onBackground.accent}>{showPlan ? "Hide" : `${figures.plan.length} ${figures.plan.length === 1 ? "payment" : "payments"}`}</Text>
          </Pressable>
          {showPlan && (
            <View style={{ gap: 6, paddingTop: 4 }}>
              {figures.plan.length === 0 && <Text variant="caption1" color={theme.colors.text.onBackground.secondary}>Nothing to settle yet.</Text>}
              {figures.plan.map((p, i) => (
                <Text key={i} variant="body">{memberName(data, p.from, me)} {p.from === me ? "pay" : "pays"} {memberName(data, p.to, me).toLowerCase() === "you" ? "you" : memberName(data, p.to, me)} <Text variant="text">{formatCents(p.cents, trip.base_currency)}</Text></Text>
              ))}
            </View>
          )}
        </Card>
        {figures.quiet.length > 0 && (
          <Text variant="caption1" color={theme.colors.text.onBackground.secondary}>
            {figures.quiet.map((m) => (m.user_id === me ? "You haven't" : `${m.display_name ?? "A member"} hasn't`)).join(", ")} added anything yet.
          </Text>
        )}

        <Segmented options={[{ key: "expenses", label: "Expenses" }, { key: "people", label: "Per person" }, { key: "summary", label: "Summary" }]} value={tab} onChange={setTab} />

        {tab === "expenses" && (
          <Card style={{ padding: 0, overflow: "hidden" }}>
            {data.expenses.length === 0 && <Text variant="caption1" color={theme.colors.text.onBackground.secondary} style={{ padding: 16 }}>No expenses yet. Add the first one.</Text>}
            {data.expenses.map((e, i) => (
              <View key={e.id}>
                {i > 0 && <Divider />}
                <ListItem
                  title={e.description}
                  subtitle={`${memberName(data, e.expense_payers[0]?.user_id ?? e.created_by, me)} paid${e.expense_payers.length > 1 ? ` +${e.expense_payers.length - 1}` : ""} · ${e.expense_shares.length} ${e.expense_shares.length === 1 ? "person" : "people"} · ${categoryLabel(e.category, e.subcategory)}${e.updated_at !== e.created_at ? " · Edited" : ""}`}
                  right={<View style={{ alignItems: "flex-end" }}><Text variant="text">{formatCents(e.base_amount_cents, trip.base_currency)}</Text>{e.currency !== trip.base_currency && <Text variant="caption1" color={theme.colors.text.onBackground.tertiary}>{formatCents(e.amount_cents + e.tip_cents, e.currency)}</Text>}</View>}
                  onPress={() => router.push(`/(app)/trip/${trip.id}/expense?expense=${e.id}`)}
                />
              </View>
            ))}
          </Card>
        )}

        {tab === "people" && (
          <Card style={{ padding: 0, overflow: "hidden" }}>
            {[...figures.members].sort((a, b) => (a.user_id === me ? -1 : b.user_id === me ? 1 : 0)).map((m, i) => {
              const paid = paidBy(data, m.user_id), share = shareOf(data, m.user_id), net = figures.nets[m.user_id] ?? 0;
              return (
                <View key={m.user_id}>
                  {i > 0 && <Divider />}
                  <ListItem title={m.user_id === me ? "You" : (m.display_name ?? "Member")} subtitle={`Paid ${formatCents(paid, trip.base_currency)} · share ${formatCents(share, trip.base_currency)}`} left={<Avatar name={m.display_name ?? "?"} />}
                    right={<Text variant="text" color={net < 0 ? theme.colors.text.destructive : net > 0 ? theme.colors.text.success : theme.colors.text.onBackground.secondary}>{net === 0 ? "even" : net > 0 ? `+${formatCents(net, trip.base_currency)}` : `−${formatCents(-net, trip.base_currency)}`}</Text>} />
                </View>
              );
            })}
          </Card>
        )}

        {tab === "summary" && (
          <Card style={{ gap: theme.spacing.md }}>
            <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
              <View><Text variant="captionCaps2" color={theme.colors.text.onBackground.secondary}>Trip total</Text><Text variant="largeTitle">{formatCents(figures.total, trip.base_currency)}</Text></View>
              <View style={{ alignItems: "flex-end" }}><Text variant="captionCaps2" color={theme.colors.text.onBackground.secondary}>Per person</Text><Text variant="largeTitle">{formatCents(perPerson, trip.base_currency)}</Text></View>
            </View>
            <Divider />
            {CATEGORIES.map((c) => {
              const cents = data.expenses.filter((e) => e.category === c.key).reduce((s, e) => s + e.base_amount_cents, 0);
              if (!cents) return null;
              const pct = figures.total ? cents / figures.total : 0;
              return (
                <View key={c.key} style={{ gap: 4 }}>
                  <View style={{ flexDirection: "row", justifyContent: "space-between" }}><Text variant="caption1Semibold">{c.label}</Text><Text variant="caption1Semibold">{formatCents(cents, trip.base_currency)}</Text></View>
                  <View style={{ height: 8, borderRadius: 4, backgroundColor: theme.colors.fill.secondary }}><View style={{ width: `${Math.round(pct * 100)}%`, height: 8, borderRadius: 4, backgroundColor: theme.palette.quarry }} /></View>
                </View>
              );
            })}
          </Card>
        )}
      </ScrollView>

      {/* sticky footer */}
      {trip.status === "open" && (
        <View style={{ position: "absolute", left: 0, right: 0, bottom: 0, padding: theme.screenPadding, paddingBottom: 28, gap: theme.spacing.sm, backgroundColor: theme.colors.background.surface, borderTopWidth: 1, borderTopColor: theme.colors.divider.default }}>
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
            <Text variant="text">Done adding expenses</Text>
            <Switch value={!!meMember?.done_at} onValueChange={toggleDone} disabled={busy} trackColor={{ true: theme.colors.fill.success, false: theme.colors.divider.default }} />
          </View>
          <View style={{ flexDirection: "row", gap: theme.spacing.sm }}>
            <Button title="Add expense" kind="secondary" size="medium" style={{ flex: 1 }} onPress={() => router.push(`/(app)/trip/${trip.id}/expense`)} />
            <Button title="Close out" size="medium" style={{ flex: 1 }} disabled={!unlocked} onPress={() => router.push(`/(app)/trip/${trip.id}/closeout`)} />
          </View>
          {!unlocked && <Text variant="caption1" color={theme.colors.text.onBackground.tertiary} style={{ textAlign: "center" }}>Close out unlocks when everyone has tapped Done.</Text>}
        </View>
      )}
      {trip.status === "settled" && (
        <View style={{ position: "absolute", left: 0, right: 0, bottom: 0, padding: theme.screenPadding, paddingBottom: 28, backgroundColor: theme.colors.background.surface, borderTopWidth: 1, borderTopColor: theme.colors.divider.default }}>
          <Button title="View payments" kind="secondary" size="medium" onPress={() => router.push(`/(app)/trip/${trip.id}/closeout`)} />
        </View>
      )}
    </Screen>
  );
}
