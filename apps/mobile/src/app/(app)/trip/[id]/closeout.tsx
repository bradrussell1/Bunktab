import { formatCents, venmoChargeLink, venmoPayLink } from "@checkm8/core";
import { theme } from "@checkm8/theme";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { ActivityIndicator, Linking, View } from "react-native";
import { Avatar, Button, Card, Divider, ListItem, Screen, Text } from "@/components/ui";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/lib/supabase";
import { memberName, useTrip } from "@/lib/trips";

/**
 * Close out and pay (spec: Screens → Close out and pay). The plan is written
 * by the database (generate_settlements) when the gate is open. Your
 * payments show as "Pay Mike $84.50" buttons that open Venmo pre-filled,
 * falling back to venmo.com when the app isn't installed; each has Mark as
 * paid, and the recipient an optional Got it. Creditors get "Request from
 * everyone". The trip is settled when every payment is marked paid.
 */
export default function CloseoutScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { session } = useAuth();
  const me = session!.user.id;
  const { data, loading, reload } = useTrip(id);
  const [error, setError] = useState<string | null>(null);
  const [generated, setGenerated] = useState(false);

  useEffect(() => {
    if (!data || generated) return;
    setGenerated(true);
    if (data.trip.status === "open") supabase.rpc("generate_settlements", { p_trip: data.trip.id }).then(({ error: e }) => { if (e) setError(e.message); reload(); });
  }, [data, generated, reload]);

  if (loading || !data) return <Screen><View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}><ActivityIndicator /></View></Screen>;
  const { trip, settlements, members } = data;
  const mine = settlements.filter((s) => s.from_user === me);
  const owed = settlements.filter((s) => s.to_user === me);
  const others = settlements.filter((s) => s.from_user !== me && s.to_user !== me);
  const venmoOf = (uid: string) => members.find((m) => m.user_id === uid)?.venmo_username ?? null;

  async function open(link: { app: string; web: string }) {
    const can = await Linking.canOpenURL(link.app).catch(() => false);
    await Linking.openURL(can ? link.app : link.web);
  }
  async function mark(sid: string, action: "mark_paid" | "unmark" | "confirm") {
    const { error: e } = await supabase.rpc("mark_settlement", { p_settlement: sid, p_action: action });
    if (e) setError(e.message); reload();
  }

  return (
    <Screen>
      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingVertical: theme.spacing.sm }}>
        <Button title="‹ Trip" kind="text" size="small" onPress={() => router.back()} />
        <Text variant="title2">{trip.status === "settled" ? "Settled" : "Close out"}</Text>
        <View style={{ width: 60 }} />
      </View>
      <View style={{ gap: theme.spacing.lg }}>
        {error && <Text variant="caption1" color={theme.colors.text.destructive}>{error}</Text>}
        {settlements.length === 0 && <Text variant="body" color={theme.colors.text.onBackground.secondary}>Nothing to settle: everyone is even.</Text>}

        {mine.length > 0 && (
          <View style={{ gap: theme.spacing.sm }}>
            <Text variant="captionCaps2" color={theme.colors.text.onBackground.secondary}>Your payments</Text>
            <Card style={{ padding: 0, overflow: "hidden" }}>
              {mine.map((s, i) => {
                const to = memberName(data, s.to_user, me); const handle = venmoOf(s.to_user); const paid = s.status !== "pending";
                return (
                  <View key={s.id}>
                    {i > 0 && <Divider />}
                    <View style={{ padding: 12, gap: 10 }}>
                      <ListItem title={`Pay ${to} ${formatCents(s.amount_cents, trip.base_currency)}`} subtitle={handle ? `@${handle}` : `${to} hasn't added a Venmo username yet`} left={<Avatar name={to} />} right={paid ? <Text variant="caption1Semibold" color={theme.colors.text.success}>{s.status === "confirmed" ? "Confirmed" : "Marked paid"}</Text> : undefined} />
                      <View style={{ flexDirection: "row", gap: theme.spacing.sm, paddingHorizontal: 8 }}>
                        <Button title={`Pay in Venmo`} size="small" style={{ flex: 1 }} disabled={!handle || paid} onPress={() => open(venmoPayLink(handle!, s.amount_cents, trip.title))} />
                        <Button title={paid ? "Undo" : "Mark as paid"} kind="secondary" size="small" style={{ flex: 1 }} onPress={() => mark(s.id, paid ? "unmark" : "mark_paid")} disabled={s.status === "confirmed"} />
                      </View>
                    </View>
                  </View>
                );
              })}
            </Card>
          </View>
        )}

        {owed.length > 0 && (
          <View style={{ gap: theme.spacing.sm }}>
            <Text variant="captionCaps2" color={theme.colors.text.onBackground.secondary}>Owed to you</Text>
            <Card style={{ padding: 0, overflow: "hidden" }}>
              {owed.map((s, i) => {
                const from = memberName(data, s.from_user, me);
                return (
                  <View key={s.id}>
                    {i > 0 && <Divider />}
                    <ListItem title={`${from} pays you ${formatCents(s.amount_cents, trip.base_currency)}`} subtitle={s.status === "pending" ? "Not marked paid yet" : s.status === "confirmed" ? "You confirmed" : "Marked paid"} left={<Avatar name={from} />}
                      right={s.status === "marked_paid" ? <Button title="Got it" size="small" onPress={() => mark(s.id, "confirm")} /> : undefined} />
                  </View>
                );
              })}
            </Card>
            {owed.some((s) => s.status === "pending") && owed.every((s) => venmoOf(s.from_user)) && (
              <Button title="Request from everyone" kind="secondary" size="medium" onPress={() => open(venmoChargeLink(owed.filter((s) => s.status === "pending").map((s) => venmoOf(s.from_user)!), owed[0]!.amount_cents, trip.title))} />
            )}
          </View>
        )}

        {others.length > 0 && (
          <View style={{ gap: theme.spacing.sm }}>
            <Text variant="captionCaps2" color={theme.colors.text.onBackground.secondary}>Between others</Text>
            <Card style={{ padding: 0, overflow: "hidden" }}>
              {others.map((s, i) => <View key={s.id}>{i > 0 && <Divider />}<ListItem title={`${memberName(data, s.from_user, me)} pays ${memberName(data, s.to_user, me)} ${formatCents(s.amount_cents, trip.base_currency)}`} subtitle={s.status === "pending" ? "Pending" : "Marked paid"} /></View>)}
            </Card>
          </View>
        )}
        <Text variant="caption1" color={theme.colors.text.onBackground.tertiary}>Venmo does the paying. Checkm8 only prepares each payment and can&apos;t see whether it went through, so mark it paid yourself. &quot;Got it&quot; is optional.</Text>
      </View>
    </Screen>
  );
}
