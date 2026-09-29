import { CATEGORIES, categoryLabel, closeoutUnlocked, formatCents, formatDateRange } from "@checkm8/core";
import { theme } from "@checkm8/theme";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import { ActionSheetIOS, ActivityIndicator, Alert, Image, Platform, Pressable, ScrollView, Switch, View } from "react-native";
import { RotaryCarousel } from "@/components/RotaryCarousel";
import { NotchedHero, notchInset } from "@/components/NotchedHero";
import { Avatar, Button, DoneBadge, Divider, Hero, HeroLink, HeroText, Screen, Segmented, Text } from "@/components/ui";
import { useAuth } from "@/lib/auth";
import { uploadPrivateImage, useSignedUrl } from "@/lib/media";
import { pickImage } from "@/lib/storage";
import { supabase } from "@/lib/supabase";
import { biggestExpense, CATEGORY_GLYPH, frontedMost, topCategory } from "@/lib/tripExtras";
import { activeMembers, memberName, membersWithNoExpenses, myDelta, myExpenses, nets, paidBy, previewPayments, shareOf, tripTotal, useTrip, type Expense, type Member, type TripData } from "@/lib/trips";

/**
 * The trip page (spec: Screens → Trip page): header with cover photo (tap to
 * add or change), member chips in a rotary carousel with Done badges; the
 * "Your Check" hero with the settlement preview behind a HeroLink; who
 * hasn't logged yet; Expenses (yours) · All Expenses · Summary on a second
 * pastel card (mint = owed to you, dusk = you owe); the sticky footer with
 * Add expense, the Done toggle and Close out. "Settled up" (close-out
 * switch) greys the expenses and relabels the check. The ⋯ menu holds
 * Profile, Trip history and, for the owner, Close out anyway / Delete.
 */
type Tab = "mine" | "all" | "summary";

export default function TripScreen() {
  const { id, tab: tabParam } = useLocalSearchParams<{ id: string; tab?: string }>();
  const router = useRouter();
  const { session } = useAuth();
  const me = session!.user.id;
  const { data, loading, error, reload } = useTrip(id);
  // DEV-only `?tab=all|summary` opens a tab directly (screenshots)
  const [tab, setTab] = useState<Tab>(__DEV__ && (tabParam === "all" || tabParam === "summary") ? tabParam : "mine");
  useEffect(() => { if (__DEV__ && (tabParam === "all" || tabParam === "summary" || tabParam === "mine")) setTab(tabParam); }, [tabParam]);
  const [showPlan, setShowPlan] = useState(false);
  const [busy, setBusy] = useState(false);
  const [coverBusy, setCoverBusy] = useState(false);
  const coverUrl = useSignedUrl("covers", data?.trip.cover_photo_url);

  const figures = useMemo(() => {
    if (!data) return null;
    const n = nets(data);
    return { nets: n, mine: n[me] ?? 0, plan: previewPayments(data), total: tripTotal(data), members: activeMembers(data), quiet: membersWithNoExpenses(data), myExpenses: myExpenses(data, me) };
  }, [data, me]);

  if (loading || !data || !figures) return <Screen><View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>{error ? <Text>{error}</Text> : <ActivityIndicator />}</View></Screen>;

  const { trip, members } = data;
  const meMember = members.find((m) => m.user_id === me);
  const isOwner = meMember?.role === "owner";
  const settledUp = !!meMember?.settled_up_at;
  const unlocked = closeoutUnlocked(figures.members.map((m) => ({ doneAt: m.done_at, removedAt: m.removed_at }))) || !!trip.closeout_override_at;
  const closed = trip.status !== "open";
  const cur = trip.base_currency;
  const checkLine = settledUp ? "Settled up" : data.expenses.length === 0 ? "No expenses yet" : figures.mine === 0 ? "All square" : figures.mine > 0 ? `You're owed ${formatCents(figures.mine, cur)}` : `You owe ${formatCents(-figures.mine, cur)}`;
  const checkTone = settledUp || data.expenses.length === 0 || figures.mine === 0 ? "ink" : figures.mine > 0 ? "mint" : "dusk";

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
    const items: { label: string; destructive?: boolean; run: () => void }[] = [
      { label: "Profile", run: () => router.push("/(app)/settings") },
      { label: "Trip history", run: () => router.push(`/(app)/trip/${trip.id}/history`) },
    ];
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

  const compactChips = figures.members.length > 6;
  const shownExpenses = tab === "mine" ? figures.myExpenses : data.expenses;

  return (
    <Screen padded={false}>
      <ScrollView contentContainerStyle={{ paddingBottom: 200, gap: theme.spacing.lg }}>
        {/* header */}
        <View style={{ paddingTop: theme.spacing.sm, gap: theme.spacing.sm, paddingHorizontal: theme.screenPadding }}>
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
          <Text variant="caption1" color={theme.colors.text.onBackground.secondary}>{formatDateRange(trip.start_date, trip.end_date)} · {cur}{closed ? ` · ${trip.status}` : ""}</Text>
        </View>

        {/* members: rotary carousel, 2–20 people */}
        <RotaryCarousel items={figures.members} keyOf={(m) => m.user_id} style={{ paddingHorizontal: theme.screenPadding }}
          renderItem={(m) => <MemberChip m={m} me={me} compact={compactChips} onPress={() => router.push(`/(app)/trip/${trip.id}/members?user=${m.user_id}`)} />} />

        <View style={{ paddingHorizontal: theme.screenPadding, gap: theme.spacing.lg }}>
          {/* Your Check + settlement preview */}
          {data.expenses.length > 0 && !settledUp ? (
            // the Settlement preview pill sits in a bottom-left notch; the plan expands above it
            <NotchedHero corner="bl" slotWidth={156} slotHeight={34} contentStyle={{ paddingBottom: notchInset(156, 34).height + 4 }}
              renderSlot={() => <HeroLink title="Settlement preview" expanded={showPlan} onPress={() => setShowPlan((v) => !v)} />}>
              <View style={{ gap: 4 }}>
                <HeroText variant="captionCaps2" tone="mid">Your Check</HeroText>
                <HeroText variant="largeTitle" tone={checkTone} numberOfLines={1} adjustsFontSizeToFit>{checkLine}</HeroText>
              </View>
              {showPlan && (
                <View style={{ gap: 6, marginTop: theme.spacing.md, paddingTop: theme.spacing.sm, borderTopWidth: 1, borderTopColor: theme.colors.hero.divider }}>
                  {figures.plan.length === 0 && <HeroText variant="caption1" tone="mid">Nothing to settle yet.</HeroText>}
                  {figures.plan.map((p, i) => (
                    <HeroText key={i} variant="body">{memberName(data, p.from, me)} {p.from === me ? "pay" : "pays"} {memberName(data, p.to, me).toLowerCase() === "you" ? "you" : memberName(data, p.to, me)} <HeroText variant="text" tone={p.to === me ? "mint" : p.from === me ? "dusk" : "ink"}>{formatCents(p.cents, cur)}</HeroText></HeroText>
                  ))}
                </View>
              )}
            </NotchedHero>
          ) : (
            <Hero>
              <View style={{ gap: 4 }}>
                <HeroText variant="captionCaps2" tone="mid">Your Check</HeroText>
                <HeroText variant="largeTitle" tone={checkTone} numberOfLines={1} adjustsFontSizeToFit>{checkLine}</HeroText>
              </View>
            </Hero>
          )}
          {figures.quiet.length > 0 && (
            <Text variant="caption1" color={theme.colors.text.onBackground.secondary}>
              {figures.quiet.map((m) => (m.user_id === me ? "You haven't" : `${m.display_name ?? "A member"} hasn't`)).join(", ")} added anything yet.
            </Text>
          )}

          <Segmented options={[{ key: "mine", label: "Expenses" }, { key: "all", label: "All Expenses" }, { key: "summary", label: "Summary" }]} value={tab} onChange={setTab} />

          {tab !== "summary" && (
            <Hero style={{ padding: 0 }}>
              {shownExpenses.length === 0 && (
                <HeroText variant="caption1" tone="mid" style={{ padding: 16 }}>{tab === "mine" ? "You haven't added an expense yet. Tap Add expense to log what you paid." : "No expenses yet. Add the first one."}</HeroText>
              )}
              {shownExpenses.map((e, i) => (
                <View key={e.id} style={settledUp ? { opacity: 0.45 } : undefined}>
                  {i > 0 && <Divider onHero />}
                  <ExpenseRow e={e} me={me} data={data} onOpen={() => router.push(`/(app)/trip/${trip.id}/expense?expense=${e.id}`)} onHistory={() => router.push(`/(app)/trip/${trip.id}/history?expense=${e.id}`)} />
                </View>
              ))}
            </Hero>
          )}

          {tab === "summary" && (
            <Hero style={{ gap: theme.spacing.lg }}>
              <View style={{ gap: 2 }}>
                <HeroText variant="captionCaps2" tone="mid">Trip total</HeroText>
                <HeroText variant="largeTitle">{formatCents(figures.total, cur)}</HeroText>
                <HeroText variant="caption1" tone="mid">{data.expenses.length} {data.expenses.length === 1 ? "expense" : "expenses"} · {figures.members.length} people</HeroText>
              </View>
              {figures.total > 0 && (
                <View style={{ gap: theme.spacing.sm, paddingTop: theme.spacing.md, borderTopWidth: 1, borderTopColor: theme.colors.hero.divider }}>
                  {CATEGORIES.map((c) => {
                    const cents = data.expenses.filter((e) => e.category === c.key).reduce((s, e) => s + e.base_amount_cents, 0);
                    if (!cents) return null;
                    const pct = cents / figures.total;
                    return (
                      <View key={c.key} style={{ gap: 4 }}>
                        <View style={{ flexDirection: "row", justifyContent: "space-between" }}><HeroText variant="caption1Semibold">{c.label}</HeroText><HeroText variant="caption1Semibold" tone="mid">{formatCents(cents, cur)} · {Math.round(pct * 100)}%</HeroText></View>
                        <View style={{ height: 8, borderRadius: 4, backgroundColor: theme.colors.hero.divider }}><View style={{ width: `${Math.max(2, Math.round(pct * 100))}%`, height: 8, borderRadius: 4, backgroundColor: theme.colors.hero.dusk }} /></View>
                      </View>
                    );
                  })}
                </View>
              )}
              {figures.total > 0 && <FunFacts data={data} me={me} />}
              <View style={{ gap: theme.spacing.sm, paddingTop: theme.spacing.md, borderTopWidth: 1, borderTopColor: theme.colors.hero.divider }}>
                <HeroText variant="captionCaps2" tone="mid">Paid so far</HeroText>
                <HeroText variant="caption1" tone="mid">What each person has fronted before settlement, and their share of the total.</HeroText>
                {[...figures.members].map((m) => ({ m, paid: paidBy(data, m.user_id), share: shareOf(data, m.user_id), net: figures.nets[m.user_id] ?? 0 })).sort((a, b) => b.paid - a.paid).map(({ m, paid, share, net }) => (
                  <Pressable key={m.user_id} onPress={() => router.push(`/(app)/trip/${trip.id}/members?user=${m.user_id}`)} accessibilityRole="button" style={{ flexDirection: "row", alignItems: "center", gap: theme.spacing.md, paddingVertical: 6 }}>
                    <Avatar name={m.display_name ?? "?"} uri={m.photo_url} onHero />
                    <View style={{ flex: 1, gap: 2 }}>
                      <HeroText variant="headline">{m.user_id === me ? "You" : (m.display_name ?? "Member")}</HeroText>
                      <HeroText variant="caption1" tone="mid">Paid {formatCents(paid, cur)} · share {formatCents(share, cur)}</HeroText>
                    </View>
                    <HeroText variant="text" tone={net > 0 ? "mint" : net < 0 ? "dusk" : "mid"}>{net === 0 ? "even" : net > 0 ? `+${formatCents(net, cur)}` : `−${formatCents(-net, cur)}`}</HeroText>
                  </Pressable>
                ))}
              </View>
              {closed && <Button title="View recap" kind="secondary" size="medium" onPress={() => router.push(`/(app)/trip/${trip.id}/recap`)} />}
            </Hero>
          )}
        </View>
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

/** Member chip for the rotary: avatar, name (first name when compact), Done badge. */
function MemberChip({ m, me, compact, onPress }: { m: Member; me: string; compact: boolean; onPress: () => void }) {
  const full = m.user_id === me ? "You" : (m.display_name ?? m.phone ?? "Invited");
  const label = compact ? full.split(/\s+/)[0]! : full;
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={`${full} details${m.done_at ? ", done" : ""}`}
      style={{ flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: theme.colors.background.surface, borderWidth: 1, borderColor: theme.colors.border.neutral, borderRadius: theme.radius.pill, paddingRight: 10, paddingLeft: 3, paddingVertical: 3 }}>
      <Avatar name={m.display_name ?? "?"} uri={m.photo_url} size={26} />
      <Text variant="caption1Semibold" numberOfLines={1}>{label}</Text>
      {m.done_at && <DoneBadge />}
    </Pressable>
  );
}

/** Feed row on the pastel card: receipt thumb or glyph, description, payer/people/category, amount, my delta (mint owed to me / dusk I owe), Edited tag → history. */
function ExpenseRow({ e, me, data, onOpen, onHistory }: { e: Expense; me: string; data: TripData; onOpen: () => void; onHistory: () => void }) {
  const thumb = useSignedUrl("receipts", e.receipt_url);
  const edited = e.updated_at !== e.created_at;
  const cur = data.trip.base_currency;
  const delta = myDelta(e, me);
  return (
    <Pressable onPress={onOpen} accessibilityRole="button" style={({ pressed }) => ({ flexDirection: "row", alignItems: "center", gap: 12, padding: 12, opacity: pressed ? 0.7 : 1 })}>
      {thumb
        ? <Image source={{ uri: thumb }} style={{ width: 40, height: 40, borderRadius: theme.radius.control }} accessibilityLabel="Receipt" accessibilityIgnoresInvertColors />
        : <View style={{ width: 40, height: 40, borderRadius: theme.radius.control, backgroundColor: theme.colors.hero.divider, alignItems: "center", justifyContent: "center" }}><HeroText variant="caption3" tone="mid">{CATEGORY_GLYPH[e.category] ?? "OT"}</HeroText></View>}
      <View style={{ flex: 1, gap: 2 }}>
        <HeroText variant="headline" numberOfLines={1}>{e.description}</HeroText>
        <HeroText variant="caption1" tone="mid" numberOfLines={2}>
          {memberName(data, e.expense_payers[0]?.user_id ?? e.created_by, me)} paid{e.expense_payers.length > 1 ? ` +${e.expense_payers.length - 1}` : ""} · {e.expense_shares.length} {e.expense_shares.length === 1 ? "person" : "people"} · {categoryLabel(e.category, e.subcategory)}
        </HeroText>
      </View>
      <View style={{ alignItems: "flex-end", gap: 2 }}>
        <HeroText variant="text">{formatCents(e.base_amount_cents, cur)}</HeroText>
        {delta !== 0 && <HeroText variant="caption1Semibold" tone={delta > 0 ? "mint" : "dusk"}>{delta > 0 ? `+${formatCents(delta, cur)} owed to you` : `you owe ${formatCents(-delta, cur)}`}</HeroText>}
        {e.currency !== cur && <HeroText variant="caption1" tone="mid">{formatCents(e.amount_cents + e.tip_cents, e.currency)}</HeroText>}
        {edited && (
          <Pressable onPress={onHistory} hitSlop={8} accessibilityRole="button" accessibilityLabel="Edited, view history" style={{ paddingHorizontal: 6, paddingVertical: 1, borderRadius: theme.radius.tag, borderWidth: 1, borderColor: theme.colors.hero.divider }}>
            <HeroText variant="caption3" tone="mid">Edited</HeroText>
          </Pressable>
        )}
      </View>
    </Pressable>
  );
}

/** Summary fun facts: biggest expense, top category, who fronted the most, who logged the most. */
function FunFacts({ data, me }: { data: TripData; me: string }) {
  const cur = data.trip.base_currency;
  const big = biggestExpense(data), top = topCategory(data), front = frontedMost(data);
  const counts = new Map<string, number>();
  for (const e of data.expenses) counts.set(e.created_by, (counts.get(e.created_by) ?? 0) + 1);
  const logger = [...counts.entries()].sort((a, b) => b[1] - a[1])[0];
  const facts: { k: string; v: string }[] = [];
  if (big) facts.push({ k: "Biggest expense", v: `${big.description} · ${formatCents(big.base_amount_cents, cur)}` });
  if (top) facts.push({ k: "Top category", v: `${top.label} · ${formatCents(top.cents, cur)}` });
  if (front) facts.push({ k: "Fronted the most", v: `${memberName(data, front.user_id, me)} · ${formatCents(front.cents, cur)}` });
  if (logger) facts.push({ k: "Most receipts logged", v: `${memberName(data, logger[0], me)} · ${logger[1]}` });
  if (!facts.length) return null;
  return (
    <View style={{ gap: theme.spacing.sm, paddingTop: theme.spacing.md, borderTopWidth: 1, borderTopColor: theme.colors.hero.divider }}>
      {facts.map((f) => (
        <View key={f.k} style={{ gap: 1 }}>
          <HeroText variant="captionCaps2" tone="mid">{f.k}</HeroText>
          <HeroText variant="body">{f.v}</HeroText>
        </View>
      ))}
    </View>
  );
}
