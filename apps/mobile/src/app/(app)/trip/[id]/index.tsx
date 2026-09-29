import { CATEGORIES, categoryLabel, closeoutUnlocked, formatCents, formatDateRange } from "@checkm8/core";
import { theme } from "@checkm8/theme";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useMemo, useState } from "react";
import { ActionSheetIOS, ActivityIndicator, Alert, Image, Platform, Pressable, ScrollView, Switch, View } from "react-native";
import { Avatar, Button, Card, DoneBadge, Divider, Hero, HeroText, ListItem, Screen, Segmented, Text } from "@/components/ui";
import { useAuth } from "@/lib/auth";
import { uploadPrivateImage, useSignedUrl } from "@/lib/media";
import { pickImage } from "@/lib/storage";
import { supabase } from "@/lib/supabase";
import { CATEGORY_GLYPH } from "@/lib/tripExtras";
import { activeMembers, memberName, membersWithNoExpenses, nets, paidBy, previewPayments, shareOf, tripTotal, useTrip, type Expense, type TripData } from "@/lib/trips";

/**
 * The trip page (spec: Screens → Trip page): header with cover photo (tap to
 * add or change), member avatars (tap for details) and Done badges; the
 * balance card with the live settlement preview beneath; who hasn't logged
 * yet; Expenses · Per person · Summary; the sticky footer with Add expense,
 * the Done toggle and Close out (locked until everyone has the badge). The
 * ⋯ menu holds Trip history and, for the owner, Close out anyway / Delete.
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
  const [coverBusy, setCoverBusy] = useState(false);
  const coverUrl = useSignedUrl("covers", data?.trip.cover_photo_url);

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
  const closed = trip.status !== "open";

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
  function deleteTrip() {
    Alert.alert("Delete this trip?", "It has no expenses. Members lose access and this can't be undone.", [
      { text: "Cancel", style: "cancel" },
      { text: "Delete", style: "destructive", onPress: async () => { const { error: e } = await supabase.from("trips").delete().eq("id", trip.id); if (e) Alert.alert("Couldn't delete", e.message); else router.replace("/(app)/home"); } },
    ]);
  }
  async function changeCover() {
    const uri = await pickImage([16, 9]);
    if (!uri) return;
    setCoverBusy(true);
    try {
      const path = await uploadPrivateImage("covers", `${trip.id}/cover.jpg`, uri);
      const { error: e } = await supabase.from("trips").update({ cover_photo_url: path }).eq("id", trip.id);
      if (e) throw e;
      await reload();
    } catch (e) { Alert.alert("Couldn't save the cover photo", e instanceof Error ? e.message : String(e)); }
    setCoverBusy(false);
  }
  function openMenu() {
    const items: { label: string; destructive?: boolean; run: () => void }[] = [{ label: "Trip history", run: () => router.push(`/(app)/trip/${trip.id}/history`) }];
    if (closed) items.push({ label: "View recap", run: () => router.push(`/(app)/trip/${trip.id}/recap`) });
    if (isOwner && !unlocked && !closed) items.push({ label: "Close out anyway", destructive: true, run: closeOutAnyway });
    if (isOwner && !closed && data!.expenses.length === 0) items.push({ label: "Delete trip", destructive: true, run: deleteTrip });
    if (Platform.OS === "ios") {
      ActionSheetIOS.showActionSheetWithOptions(
        { options: [...items.map((i) => i.label), "Cancel"], cancelButtonIndex: items.length, destructiveButtonIndex: items.map((i, k) => (i.destructive ? k : -1)).filter((k) => k >= 0) },
        (k) => { items[k]?.run(); },
      );
    } else {
      Alert.alert(trip.title, undefined, [...items.map((i) => ({ text: i.label, style: i.destructive ? ("destructive" as const) : ("default" as const), onPress: i.run })), { text: "Cancel", style: "cancel" as const }]);
    }
  }

  return (
    <Screen padded={false}>
      <ScrollView contentContainerStyle={{ paddingHorizontal: theme.screenPadding, paddingBottom: 200, gap: theme.spacing.lg }}>
        {/* header */}
        <View style={{ paddingTop: theme.spacing.sm, gap: theme.spacing.sm }}>
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
            <Button title="‹ Trips" kind="text" size="small" onPress={() => router.replace("/(app)/home")} />
            <Button title="⋯" kind="text" size="small" onPress={openMenu} accessibilityLabel="Trip menu" />
          </View>
          <Pressable onPress={changeCover} disabled={coverBusy} accessibilityRole="button" accessibilityLabel={coverUrl ? "Change cover photo" : "Add cover photo"}
            style={{ height: coverUrl ? 160 : 44, borderRadius: theme.radius.card, overflow: "hidden", backgroundColor: theme.colors.background.elevated, borderWidth: 1, borderColor: theme.colors.border.soft, alignItems: "center", justifyContent: "center" }}>
            {coverUrl
              ? <Image source={{ uri: coverUrl }} style={{ width: "100%", height: "100%" }} resizeMode="cover" accessibilityIgnoresInvertColors />
              : <Text variant="caption1Semibold" color={theme.colors.text.onBackground.accent}>{coverBusy ? "Uploading…" : "+ Add a cover photo"}</Text>}
            {coverUrl && coverBusy && <View style={{ position: "absolute", top: 0, right: 0, bottom: 0, left: 0, backgroundColor: theme.colors.system.dimming40, alignItems: "center", justifyContent: "center" }}><ActivityIndicator color={theme.colors.text.onBackground.primary} /></View>}
          </Pressable>
          <Text variant="largeTitle">{trip.title}</Text>
          <Text variant="caption1" color={theme.colors.text.onBackground.secondary}>{formatDateRange(trip.start_date, trip.end_date)} · {trip.base_currency}{closed ? ` · ${trip.status}` : ""}</Text>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: theme.spacing.sm }}>
            {figures.members.map((m) => (
              <Pressable key={m.user_id} onPress={() => router.push(`/(app)/trip/${trip.id}/members?user=${m.user_id}`)} accessibilityRole="button" accessibilityLabel={`${m.display_name ?? "Member"} details`}
                style={{ flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: theme.colors.background.surface, borderWidth: 1, borderColor: theme.colors.border.neutral, borderRadius: theme.radius.pill, paddingRight: 10, paddingLeft: 3, paddingVertical: 3 }}>
                <Avatar name={m.display_name ?? "?"} uri={m.photo_url} size={26} />
                <Text variant="caption1Semibold">{m.user_id === me ? "You" : (m.display_name ?? m.phone ?? "Invited")}</Text>
                {m.done_at && <DoneBadge />}
              </Pressable>
            ))}
          </View>
        </View>

        {/* balance card + settlement preview */}
        <Hero style={{ gap: theme.spacing.sm }}>
          <HeroText variant="captionCaps2" tone="mid">Your balance</HeroText>
          <HeroText variant="largeTitle" tone={figures.mine < 0 ? "dusk" : figures.mine > 0 ? "mint" : "ink"} numberOfLines={1} adjustsFontSizeToFit>
            {figures.mine === 0 ? "Settled up" : figures.mine > 0 ? `You're owed ${formatCents(figures.mine, trip.base_currency)}` : `You owe ${formatCents(-figures.mine, trip.base_currency)}`}
          </HeroText>
          <Pressable onPress={() => setShowPlan((v) => !v)} accessibilityRole="button" accessibilityState={{ expanded: showPlan }} style={{ flexDirection: "row", justifyContent: "space-between", paddingTop: 4 }}>
            <HeroText variant="caption1Semibold" tone="dusk">Settlement preview</HeroText>
            <HeroText variant="caption1Semibold" tone="mid">{showPlan ? "Hide ▴" : `${figures.plan.length} ${figures.plan.length === 1 ? "payment" : "payments"} ▾`}</HeroText>
          </Pressable>
          {showPlan && (
            <View style={{ gap: 6, paddingTop: theme.spacing.sm, borderTopWidth: 1, borderTopColor: theme.colors.hero.divider }}>
              {figures.plan.length === 0 && <HeroText variant="caption1" tone="mid">Nothing to settle yet.</HeroText>}
              {figures.plan.map((p, i) => (
                <HeroText key={i} variant="body">{memberName(data, p.from, me)} {p.from === me ? "pay" : "pays"} {memberName(data, p.to, me).toLowerCase() === "you" ? "you" : memberName(data, p.to, me)} <HeroText variant="text">{formatCents(p.cents, trip.base_currency)}</HeroText></HeroText>
              ))}
            </View>
          )}
        </Hero>
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
                <ExpenseRow e={e} me={me} data={data} onOpen={() => router.push(`/(app)/trip/${trip.id}/expense?expense=${e.id}`)} onHistory={() => router.push(`/(app)/trip/${trip.id}/history?expense=${e.id}`)} />
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
                  <ListItem title={m.user_id === me ? "You" : (m.display_name ?? "Member")} subtitle={`Paid ${formatCents(paid, trip.base_currency)} · share ${formatCents(share, trip.base_currency)}`} left={<Avatar name={m.display_name ?? "?"} uri={m.photo_url} />}
                    onPress={() => router.push(`/(app)/trip/${trip.id}/members?user=${m.user_id}`)}
                    right={<Text variant="text" color={net < 0 ? theme.colors.text.onBackground.accent : net > 0 ? theme.colors.text.success : theme.colors.text.onBackground.secondary}>{net === 0 ? "even" : net > 0 ? `+${formatCents(net, trip.base_currency)}` : `−${formatCents(-net, trip.base_currency)}`}</Text>} />
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
                  <View style={{ height: 8, borderRadius: 4, backgroundColor: theme.colors.fill.secondary }}><View style={{ width: `${Math.round(pct * 100)}%`, height: 8, borderRadius: 4, backgroundColor: theme.colors.text.onBackground.accent }} /></View>
                </View>
              );
            })}
            {closed && <Button title="View recap" kind="secondary" size="medium" onPress={() => router.push(`/(app)/trip/${trip.id}/recap`)} />}
          </Card>
        )}
      </ScrollView>

      {/* sticky footer */}
      {trip.status === "open" && (
        <View style={{ position: "absolute", left: 0, right: 0, bottom: 0, padding: theme.screenPadding, paddingBottom: 28, gap: theme.spacing.sm, backgroundColor: theme.colors.background.surface, borderTopWidth: 1, borderTopColor: theme.colors.divider.default }}>
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
            <Text variant="text">Done adding expenses</Text>
            <Switch value={!!meMember?.done_at} onValueChange={toggleDone} disabled={busy} trackColor={{ true: theme.colors.fill.primary, false: theme.palette.line }} />
          </View>
          <View style={{ flexDirection: "row", gap: theme.spacing.sm }}>
            <Button title="Add expense" kind="secondary" size="medium" style={{ flex: 1 }} onPress={() => router.push(`/(app)/trip/${trip.id}/expense`)} />
            <Button title="Close out" size="medium" style={{ flex: 1 }} disabled={!unlocked} onPress={() => router.push(`/(app)/trip/${trip.id}/closeout`)} />
          </View>
          {!unlocked && <Text variant="caption1" color={theme.colors.text.onBackground.tertiary} style={{ textAlign: "center" }}>Close out unlocks when everyone has tapped Done.</Text>}
        </View>
      )}
      {closed && (
        <View style={{ position: "absolute", left: 0, right: 0, bottom: 0, padding: theme.screenPadding, paddingBottom: 28, flexDirection: "row", gap: theme.spacing.sm, backgroundColor: theme.colors.background.surface, borderTopWidth: 1, borderTopColor: theme.colors.divider.default }}>
          <Button title="View recap" size="medium" style={{ flex: 1 }} onPress={() => router.push(`/(app)/trip/${trip.id}/recap`)} />
          <Button title="Payments" kind="secondary" size="medium" style={{ flex: 1 }} onPress={() => router.push(`/(app)/trip/${trip.id}/closeout`)} />
        </View>
      )}
    </Screen>
  );
}

/** Feed row: receipt thumbnail or category glyph, description, payer/people/category, amount, Edited tag → history. */
function ExpenseRow({ e, me, data, onOpen, onHistory }: { e: Expense; me: string; data: TripData; onOpen: () => void; onHistory: () => void }) {
  const thumb = useSignedUrl("receipts", e.receipt_url);
  const edited = e.updated_at !== e.created_at;
  const cur = data.trip.base_currency;
  return (
    <Pressable onPress={onOpen} accessibilityRole="button" style={({ pressed }) => ({ flexDirection: "row", alignItems: "center", gap: 12, padding: 12, opacity: pressed ? 0.7 : 1 })}>
      {thumb
        ? <Image source={{ uri: thumb }} style={{ width: 40, height: 40, borderRadius: theme.radius.control, backgroundColor: theme.colors.fill.secondary }} accessibilityLabel="Receipt" accessibilityIgnoresInvertColors />
        : <View style={{ width: 40, height: 40, borderRadius: theme.radius.control, backgroundColor: theme.colors.background.elevated, alignItems: "center", justifyContent: "center" }}><Text variant="caption3" color={theme.colors.text.onBackground.secondary}>{CATEGORY_GLYPH[e.category] ?? "OT"}</Text></View>}
      <View style={{ flex: 1, gap: 2 }}>
        <Text variant="headline" numberOfLines={1}>{e.description}</Text>
        <Text variant="caption1" color={theme.colors.text.onBackground.secondary} numberOfLines={2}>
          {memberName(data, e.expense_payers[0]?.user_id ?? e.created_by, me)} paid{e.expense_payers.length > 1 ? ` +${e.expense_payers.length - 1}` : ""} · {e.expense_shares.length} {e.expense_shares.length === 1 ? "person" : "people"} · {categoryLabel(e.category, e.subcategory)}
        </Text>
      </View>
      <View style={{ alignItems: "flex-end", gap: 4 }}>
        <Text variant="text">{formatCents(e.base_amount_cents, cur)}</Text>
        {e.currency !== cur && <Text variant="caption1" color={theme.colors.text.onBackground.tertiary}>{formatCents(e.amount_cents + e.tip_cents, e.currency)}</Text>}
        {edited && (
          <Pressable onPress={onHistory} hitSlop={8} accessibilityRole="button" accessibilityLabel="Edited, view history" style={{ paddingHorizontal: 6, paddingVertical: 1, borderRadius: theme.radius.tag, borderWidth: 1, borderColor: theme.colors.border.neutral }}>
            <Text variant="caption3" color={theme.colors.text.onBackground.secondary}>Edited</Text>
          </Pressable>
        )}
      </View>
    </Pressable>
  );
}
