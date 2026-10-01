import { formatCents, venmoChargeLink, venmoPayLink } from "@checkm8/core";
import { theme } from "@checkm8/theme";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { ActivityIndicator, Linking, Pressable, ScrollView, Switch, View } from "react-native";
import { NotchedHero, notchInset } from "@/components/NotchedHero";
import { Avatar, Button, Card, Divider, Hero, HeroAction, HeroText, ListItem, Screen, Text } from "@/components/ui";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/lib/supabase";
import { memberName, useTrip } from "@/lib/trips";

/**
 * Close out and pay (spec: Screens → Close out and pay). The plan is written
 * by the database (generate_settlements) when the gate is open. Your
 * payments show as "Pay Mike $84.50" buttons that open Venmo pre-filled,
 * falling back to venmo.com when the app isn't installed; each has Mark as
 * paid, and the recipient an optional Got it. Creditors get "Request from
 * everyone". The trip is settled when every payment is marked paid. The
 * hero is your payments (or what's owed to you when you have none).
 */
export default function CloseoutScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { session } = useAuth();
  const me = session!.user.id;
  const { data, loading, reload } = useTrip(id);
  const [error, setError] = useState<string | null>(null);
  const [generated, setGenerated] = useState(false);
  const [settling, setSettling] = useState(false);

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
  const meMember = members.find((m) => m.user_id === me);
  const settledUp = !!meMember?.settled_up_at;

  async function open(link: { app: string; web: string }) {
    const can = await Linking.canOpenURL(link.app).catch(() => false);
    await Linking.openURL(can ? link.app : link.web);
  }
  async function toggleSettledUp(v: boolean) {
    setSettling(true);
    const { error: e } = await supabase.rpc("set_settled_up", { p_trip: trip.id, p_on: v });
    if (e) setError(e.message);
    await reload(); setSettling(false);
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
      <ScrollView contentContainerStyle={{ gap: theme.spacing.lg, paddingBottom: 40 }}>
        {error && <Text variant="caption1" color={theme.colors.text.destructive}>{error}</Text>}
        <Card style={{ gap: theme.spacing.sm }}>
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: theme.spacing.md }}>
            <Text variant="text">Settled up</Text>
            <Switch value={settledUp} onValueChange={toggleSettledUp} disabled={settling} trackColor={{ true: theme.colors.fill.primary, false: theme.palette.grayDeep }} />
          </View>
          <Text variant="caption1" color={theme.colors.text.onBackground.secondary}>Turn this on once you&apos;ve paid and/or been paid for this trip. It marks your payments paid and greys out the expenses.</Text>
        </Card>
        {settlements.length === 0 && (
          <Hero>
            <HeroText variant="captionCaps2" tone="mid">Nothing to settle</HeroText>
            <HeroText variant="title2" style={{ marginTop: 4 }}>Everyone is even.</HeroText>
          </Hero>
        )}

        {mine.length > 0 && (
          <Hero style={{ gap: theme.spacing.md }}>
            <View style={{ gap: 2 }}>
              <HeroText variant="captionCaps2" tone="mid">Your payments</HeroText>
              <HeroText variant="largeTitle" tone="dusk" numberOfLines={1} adjustsFontSizeToFit>{formatCents(mine.reduce((a, s) => a + s.amount_cents, 0), trip.base_currency)}</HeroText>
              <HeroText variant="caption1Semibold" tone="mid">{mine.filter((s) => s.status !== "pending").length} of {mine.length} marked paid</HeroText>
            </View>
            {mine.map((s) => {
              const to = memberName(data, s.to_user, me); const handle = venmoOf(s.to_user); const paid = s.status !== "pending";
              return (
                <View key={s.id} style={{ gap: 10, paddingTop: theme.spacing.md, borderTopWidth: 1, borderTopColor: theme.colors.hero.divider }}>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: theme.spacing.md }}>
                    <Avatar name={to} onHero />
                    <View style={{ flex: 1, gap: 2 }}>
                      <HeroText variant="headline">Pay {to} {formatCents(s.amount_cents, trip.base_currency)}</HeroText>
                      <HeroText variant="caption1" tone="mid">{handle ? `@${handle}` : `${to} hasn't added a Venmo username yet`}</HeroText>
                    </View>
                    {paid && <HeroText variant="caption1Semibold" tone="mint">{s.status === "confirmed" ? "Confirmed" : "Marked paid"}</HeroText>}
                  </View>
                  <View style={{ flexDirection: "row", gap: theme.spacing.sm }}>
                    <Button title="Pay in Venmo" size="small" style={{ flex: 1 }} disabled={!handle || paid} onPress={() => open(venmoPayLink(handle!, s.amount_cents, trip.title))} />
                    <Pressable onPress={() => mark(s.id, paid ? "unmark" : "mark_paid")} disabled={s.status === "confirmed"} accessibilityRole="button"
                      style={({ pressed }) => ({ flex: 1, height: 36, borderRadius: theme.radius.control, borderWidth: 1, borderColor: theme.colors.hero.ink, alignItems: "center", justifyContent: "center", opacity: pressed ? 0.7 : s.status === "confirmed" ? 0.5 : 1 })}>
                      <HeroText variant="caption1Semibold">{paid ? "Undo" : "Mark as paid"}</HeroText>
                    </Pressable>
                  </View>
                </View>
              );
            })}
          </Hero>
        )}

        {owed.length > 0 && mine.length === 0 && (() => {
          const canRequest = owed.some((s) => s.status === "pending") && owed.every((s) => venmoOf(s.from_user));
          const header = (
            <View style={{ gap: 2, paddingRight: canRequest ? notchInset(52, 52).width - theme.spacing.xl : 0 }}>
              <HeroText variant="captionCaps2" tone="mid">Owed to you</HeroText>
              <HeroText variant="largeTitle" tone="mint" numberOfLines={1} adjustsFontSizeToFit>{formatCents(owed.reduce((a, s) => a + s.amount_cents, 0), trip.base_currency)}</HeroText>
              <HeroText variant="caption1Semibold" tone="mid">{owed.filter((s) => s.status !== "pending").length} of {owed.length} marked paid</HeroText>
            </View>
          );
          const rows = (
            <>
            {owed.map((s) => {
              const from = memberName(data, s.from_user, me);
              return (
                <View key={s.id} style={{ flexDirection: "row", alignItems: "center", gap: theme.spacing.md, paddingTop: theme.spacing.md, borderTopWidth: 1, borderTopColor: theme.colors.hero.divider }}>
                  <Avatar name={from} onHero />
                  <View style={{ flex: 1, gap: 2 }}>
                    <HeroText variant="headline">{from} pays you {formatCents(s.amount_cents, trip.base_currency)}</HeroText>
                    <HeroText variant="caption1" tone={s.status === "pending" ? "mid" : "mint"}>{s.status === "pending" ? "Not marked paid yet" : s.status === "confirmed" ? "You confirmed" : "Marked paid"}</HeroText>
                  </View>
                  {s.status === "marked_paid" && <Button title="Got it" size="small" onPress={() => mark(s.id, "confirm")} />}
                </View>
              );
            })}
            {canRequest && <HeroText variant="caption1" tone="mid">The arrow opens one Venmo request to everyone who still owes you.</HeroText>}
            </>
          );
          // the Request arrow sits in a top-right notch when there is something to request
          return canRequest ? (
            <NotchedHero corner="tr" slotWidth={52} slotHeight={52} contentStyle={{ gap: theme.spacing.md }}
              renderSlot={() => <HeroAction label="Request from everyone in Venmo" onPress={() => open(venmoChargeLink(owed.filter((s) => s.status === "pending").map((s) => venmoOf(s.from_user)!), owed[0]!.amount_cents, trip.title))} />}>
              {header}{rows}
            </NotchedHero>
          ) : (
            <Hero style={{ gap: theme.spacing.md }}>{header}{rows}</Hero>
          );
        })()}

        {owed.length > 0 && mine.length > 0 && (
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
      </ScrollView>
    </Screen>
  );
}
