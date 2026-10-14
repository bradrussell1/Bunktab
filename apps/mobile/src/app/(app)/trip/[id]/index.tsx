import { CATEGORIES, categoryLabel, closeoutUnlocked, formatCents, formatDateRange, nightsBetween, zebraMoodFor } from "@bunktab/core";
import { color, layout, palette, radius, shadow, size, space } from "@bunktab/theme";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, Image, ScrollView, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ActionSheet, AmountPill, Avatar, AvatarRow, Button, Card, CountUp, Icon, IconButton, InsetPanel, HeroCard, LiveDot, Money, Press, Rise, RowCard, ScreenBackground, SegmentedControl, Toggle, TopBar, Zebra, ZText, useToast, type SheetAction } from "@/ui";
import { useAuth } from "@/lib/auth";
import { uploadPrivateImage, useSignedUrl } from "@/lib/media";
import { pickImage } from "@/lib/storage";
import { supabase } from "@/lib/supabase";
import { biggestExpense, CATEGORY_GLYPH, frontedMost, topCategory } from "@/lib/tripExtras";
import { activeMembers, memberName, membersWithNoExpenses, myDelta, nets, paidBy, previewPayments, shareOf, tripTotal, useTrip, type Expense, type TripData } from "@/lib/trips";

/**
 * The dazzle page (RESKIN_PROMPT B4, board `Trip`): TopBar with back and the ⋯ menu;
 * title + "Oct 9 – 14, 2026 · 5 nights · 6 in the dazzle"; the member avatar row
 * (done = ink with a volt stripe; tap opens member details); the balance HeroCard
 * with the full zebra (progress rule; tap → Earn your stripes) and the stripes
 * InsetPanel with Nudge; "Jordan hasn't added anything yet" with a live dot; the
 * "See who pays who" settlement preview; Expenses · People · Summary; and the white
 * sheet footer with the Done toggle, Add expense and Close out (locked until
 * everyone's done). `?readonly=1` (from Profile → History) shows the page with
 * nothing tappable and no footer. Every read, RPC and navigation target is the
 * same as before the reskin.
 */
type Tab = "expenses" | "people" | "summary";

export default function TripScreen() {
  const { id, tab: tabParam, readonly: roParam, scrollTo } = useLocalSearchParams<{ id: string; tab?: string; readonly?: string; scrollTo?: string }>();
  const readonly = roParam === "1";
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { show } = useToast();
  const { session } = useAuth();
  const me = session!.user.id;
  const { data, loading, error, reload } = useTrip(id);
  // DEV-only `?tab=people|summary` opens a tab directly (screenshots)
  const asTab = (v?: string): Tab | null => (v === "people" || v === "summary" ? v : v === "expenses" || v === "mine" || v === "all" ? "expenses" : null);
  const [tab, setTab] = useState<Tab>((__DEV__ && asTab(tabParam)) || "expenses");
  useEffect(() => { const t = __DEV__ ? asTab(tabParam) : null; if (t) setTab(t); }, [tabParam]);
  const [showPlan, setShowPlan] = useState(false);
  const [menu, setMenu] = useState(false);
  const [confirm, setConfirm] = useState<{ title: string; label: string; run: () => void } | null>(null);
  const [busy, setBusy] = useState(false);
  const [coverBusy, setCoverBusy] = useState(false);
  const [footerH, setFooterH] = useState(160);
  // DEV-only `?scrollTo=tabs` scrolls the tab strip to the top (screenshots)
  const scrollRef = useRef<ScrollView>(null);
  const tabsY = useRef(0);
  useEffect(() => { if (__DEV__ && scrollTo === "tabs" && data) setTimeout(() => scrollRef.current?.scrollTo({ y: Math.max(0, tabsY.current - space[8]), animated: false }), 400); }, [scrollTo, data, tab]);
  const coverUrl = useSignedUrl("covers", data?.trip.cover_photo_url);

  const figures = useMemo(() => {
    if (!data) return null;
    const n = nets(data);
    return { nets: n, mine: n[me] ?? 0, plan: previewPayments(data), total: tripTotal(data), members: activeMembers(data), quiet: membersWithNoExpenses(data) };
  }, [data, me]);

  // a late expense clears everyone's Done on the server (spec rule): say why when it was yours
  const meMember = data?.members.find((m) => m.user_id === me);
  const myDone = !!meMember?.done_at;
  const prevDone = useRef<boolean | null>(null);
  const toggling = useRef(false);
  useEffect(() => {
    if (!data) return;
    if (prevDone.current === true && !myDone && !toggling.current) show({ message: "A new expense came in, so your stripe is back to ghost. Tap Done again when you're set.", duration: 4500 });
    prevDone.current = myDone;
  }, [myDone, data, show]);

  if (loading || !data || !figures) {
    return (
      <View style={styles.screen}>
        <ScreenBackground />
        <TopBar onBack={() => router.back()} />
        <View style={styles.center}>{error ? <ZText color={color.error}>{error}</ZText> : <ActivityIndicator color={color.text} />}</View>
      </View>
    );
  }

  const { trip, members } = data;
  const isOwner = meMember?.role === "owner";
  const settledUp = !!meMember?.settled_up_at;
  const doneCount = figures.members.filter((m) => m.done_at).length;
  const toGo = figures.members.length - doneCount;
  const unlocked = closeoutUnlocked(figures.members.map((m) => ({ doneAt: m.done_at, removedAt: m.removed_at }))) || !!trip.closeout_override_at;
  const closed = trip.status !== "open";
  const cur = trip.base_currency;
  const nights = nightsBetween(trip.start_date, trip.end_date);
  const mood = zebraMoodFor({ place: "dazzle-hero", members: figures.members.length, done: doneCount }) ?? "hi";
  const stillAdding = figures.members.filter((m) => !m.done_at).map((m) => (m.user_id === me ? "you" : (m.display_name ?? "someone").split(/\s+/)[0]!));

  async function toggleDone(v: boolean) {
    setBusy(true); toggling.current = true;
    await supabase.rpc("set_done", { p_trip: trip.id, p_done: v });
    await reload();
    toggling.current = false; setBusy(false);
  }
  function closeOutAnyway() {
    setConfirm({
      title: "Close out anyway? Not everyone has tapped Done. Everyone will be notified, the override is logged, and expenses already logged still count.",
      label: "Close out",
      run: async () => { await supabase.rpc("owner_closeout", { p_trip: trip.id }); reload(); router.push(`/(app)/trip/${trip.id}/closeout`); },
    });
  }
  function deleteTrip() {
    setConfirm({
      title: "Delete this dazzle? It has no expenses. Members lose access and this can't be undone.",
      label: "Delete",
      run: async () => { const { error: e } = await supabase.from("trips").delete().eq("id", trip.id); if (e) show({ message: `Couldn't delete: ${e.message}` }); else router.replace("/(app)/home"); },
    });
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
    } catch (e) { show({ message: `Couldn't save the cover photo: ${e instanceof Error ? e.message : String(e)}` }); }
    setCoverBusy(false);
  }
  const menuActions: SheetAction[] = [
    { label: coverUrl ? "Change the cover photo" : "Add a cover photo", onPress: changeCover },
    { label: "Members", onPress: () => router.push(`/(app)/trip/${trip.id}/members`) },
    { label: "Dazzle history", onPress: () => router.push(`/(app)/trip/${trip.id}/history`) },
    { label: "Profile", onPress: () => router.push("/(app)/settings") },
  ];
  if (closed) menuActions.push({ label: "View recap", onPress: () => router.push(`/(app)/trip/${trip.id}/recap`) });
  if (isOwner && !unlocked && !closed) menuActions.push({ label: "Close out anyway", destructive: true, onPress: closeOutAnyway });
  if (isOwner && !closed && data.expenses.length === 0) menuActions.push({ label: "Delete dazzle", destructive: true, onPress: deleteTrip });

  const openStripes = readonly ? undefined : () => router.push(`/(app)/trip/${trip.id}/closeout`);
  const balanceState = settledUp ? "settled" : data.expenses.length === 0 ? "none" : figures.mine === 0 ? "square" : "amount";

  return (
    <View style={styles.screen}>
      <ScreenBackground />
      <TopBar
        onBack={() => (readonly ? router.back() : router.replace("/(app)/home"))}
        right={!readonly ? <IconButton name="more" label="Dazzle menu" onPress={() => setMenu(true)} /> : null}
      />
      <ScrollView ref={scrollRef} contentContainerStyle={[styles.content, { paddingBottom: footerH + space[16] }]} showsVerticalScrollIndicator={false}>
        <View style={styles.head}>
          <View style={styles.titleRow}>
            {coverUrl ? (
              <Press onPress={changeCover} disabled={coverBusy || readonly} scaleTo={0.97} accessibilityRole="button" accessibilityLabel="Change the cover photo" style={styles.coverWrap}>
                <Image source={{ uri: coverUrl }} style={styles.cover} accessibilityIgnoresInvertColors />
              </Press>
            ) : null}
            <ZText variant="title1" accessibilityRole="header" style={styles.flex}>{trip.title}</ZText>
          </View>
          <ZText variant="caption" color={color.textMuted}>
            {formatDateRange(trip.start_date, trip.end_date)} · {nights} {nights === 1 ? "night" : "nights"} · {figures.members.length} in the dazzle{closed ? ` · ${trip.status}` : ""}
          </ZText>
        </View>

        {/* member avatar row: done = ink with a volt stripe; tap opens member details */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.avatars} accessibilityLabel={`${doneCount} of ${figures.members.length} members done`}>
          <AvatarRow>
            {figures.members.map((m) => (
              <Press key={m.user_id} disabled={readonly} onPress={() => router.push(`/(app)/trip/${trip.id}/members?user=${m.user_id}`)} scaleTo={0.97} accessibilityRole="button" accessibilityLabel={`${memberName(data, m.user_id, me)}${m.done_at ? ", done" : ", still adding"}`}>
                <Avatar name={m.display_name ?? "?"} uri={m.photo_url} done={!!m.done_at} notDone={!m.done_at} onHero />
              </Press>
            ))}
          </AvatarRow>
        </ScrollView>

        {/* balance card */}
        <HeroCard>
          <View style={styles.heroRow}>
            <View style={[styles.flex, styles.heroText]}>
              <ZText variant="caption" color={color.textMuted}>Your balance</ZText>
              {balanceState === "amount" ? <CountUp cents={Math.abs(figures.mine)} variant="amountL" /> : <ZText variant="amountL">{balanceState === "settled" ? "Settled up" : balanceState === "none" ? "Nothing yet" : "All square"}</ZText>}
              {balanceState === "amount" ? <LabelPill tone={figures.mine > 0 ? "volt" : "blush"} label={figures.mine > 0 ? "owed to you" : "you owe"} /> : null}
            </View>
            <Press onPress={openStripes} disabled={!openStripes} scaleTo={0.97} accessibilityRole="button" accessibilityLabel={`Zebra with ${doneCount} of ${figures.members.length} stripes, ${mood}. Opens Earn your stripes`}>
              <Zebra variant="full" mood={mood} members={figures.members.length} done={doneCount} size={128} animate={{ blink: true, swish: true }} decorative />
            </Press>
          </View>
          <InsetPanel style={styles.stripesPanel}>
            <View style={styles.stripesRow}>
              <ZText variant="caption" style={styles.flex}>
                <ZText variant="captionStrong">{doneCount === figures.members.length ? `All ${figures.members.length} stripes.` : `${doneCount} of ${figures.members.length} stripes.`}</ZText>
                {" "}{toGo === 0 ? "Everyone's done." : `${listNames(stillAdding)} still adding.`}
              </ZText>
              {toGo > 0 && !readonly && !closed ? <Button kind="nudge" label="Nudge" onPress={openStripes} /> : null}
            </View>
          </InsetPanel>
        </HeroCard>

        {figures.quiet.length > 0 ? (
          <View style={styles.quiet}>
            <LiveDot />
            <ZText variant="caption" color={color.textMuted} style={styles.flex}>
              {figures.quiet.map((m) => (m.user_id === me ? "You haven't" : `${m.display_name ?? "A member"} hasn't`)).join(", ")} added anything yet.
            </ZText>
          </View>
        ) : null}

        {/* settlement preview */}
        {data.expenses.length > 0 && !settledUp ? (
          <InsetPanel style={styles.plan}>
            <Press onPress={() => setShowPlan((v) => !v)} scaleTo={0.98} accessibilityRole="button" accessibilityState={{ expanded: showPlan }} accessibilityLabel="See who pays who" style={styles.planRow}>
              <ZText variant="bodyStrong" style={styles.flex}>See who pays who</ZText>
              <Icon name={showPlan ? "chevronUp" : "chevronDown"} size={18} color={color.textMuted} />
            </Press>
            {showPlan ? (
              <Rise style={styles.planLines}>
                {figures.plan.length === 0 ? <ZText variant="caption" color={color.textMuted}>Nothing to settle yet.</ZText> : null}
                {figures.plan.map((p, i) => (
                  <View key={i} style={styles.planLine}>
                    <ZText variant="body" style={styles.flex}>{p.from === me ? `Pay ${memberName(data, p.to)}` : p.to === me ? `${memberName(data, p.from)} pays you` : `${memberName(data, p.from)} pays ${memberName(data, p.to)}`}</ZText>
                    <Money cents={p.cents} currency={cur === "USD" ? undefined : `${cur} `} color={p.to === me ? color.text : p.from === me ? color.youOweText : color.textMuted} />
                  </View>
                ))}
              </Rise>
            ) : null}
          </InsetPanel>
        ) : null}

        <View onLayout={(e) => { tabsY.current = e.nativeEvent.layout.y; }}>
          <SegmentedControl options={[{ key: "expenses", label: "Expenses" }, { key: "people", label: "People" }, { key: "summary", label: "Summary" }]} value={tab} onChange={setTab} />
        </View>

        {tab === "expenses" ? (
          <View style={styles.rows}>
            {data.expenses.length === 0 ? <ZText variant="body" color={color.textMuted} style={styles.note}>No expenses yet. Add the first one.</ZText> : null}
            {data.expenses.map((e) => (
              <View key={e.id} style={settledUp ? styles.faded : null}>
                <ExpenseRow e={e} me={me} data={data} settled={settledUp} onOpen={readonly ? undefined : () => router.push(`/(app)/trip/${trip.id}/expense?expense=${e.id}`)} onHistory={readonly ? undefined : () => router.push(`/(app)/trip/${trip.id}/history?expense=${e.id}`)} />
              </View>
            ))}
          </View>
        ) : null}

        {tab === "people" ? (
          <View style={styles.rows}>
            {[...figures.members].sort((a, b) => (a.user_id === me ? -1 : b.user_id === me ? 1 : 0)).map((m) => {
              const net = figures.nets[m.user_id] ?? 0;
              const name = m.user_id === me ? "You" : (m.display_name ?? m.phone ?? "Invited");
              return (
                <RowCard
                  key={m.user_id}
                  tile={<Avatar name={m.display_name ?? "?"} uri={m.photo_url} size={size.iconTile} done={!!m.done_at} notDone={!m.done_at} />}
                  title={name}
                  caption={`Paid ${formatCents(paidBy(data, m.user_id), cur)} · share ${formatCents(shareOf(data, m.user_id), cur)}`}
                  right={settledUp || net === 0 ? <ZText variant="small" color={color.textMuted}>{settledUp ? "Settled" : "even"}</ZText> : <AmountPill cents={net} />}
                  onPress={readonly ? undefined : () => router.push(`/(app)/trip/${trip.id}/members?user=${m.user_id}`)}
                  accessibilityLabel={`${name}, paid ${formatCents(paidBy(data, m.user_id), cur)}, share ${formatCents(shareOf(data, m.user_id), cur)}, ${net > 0 ? `owed ${formatCents(net, cur)}` : net < 0 ? `owes ${formatCents(-net, cur)}` : "even"}${m.done_at ? ", done" : ""}`}
                />
              );
            })}
          </View>
        ) : null}

        {tab === "summary" ? (
          <Card style={styles.summary}>
            <View style={styles.summaryHead}>
              <ZText variant="caption" color={color.textMuted}>Dazzle total</ZText>
              <Money cents={figures.total} variant="amountL" currency={cur === "USD" ? undefined : `${cur} `} />
              <ZText variant="caption" color={color.textMuted}>
                {data.expenses.length} {data.expenses.length === 1 ? "expense" : "expenses"} · {figures.members.length} people{figures.members.length > 0 ? ` · ${formatCents(Math.round(figures.total / figures.members.length), cur)} each` : ""}
              </ZText>
            </View>
            {figures.total > 0 ? (
              <View style={styles.bars}>
                {CATEGORIES.map((c) => ({ c, cents: data.expenses.filter((e) => e.category === c.key).reduce((s, e) => s + e.base_amount_cents, 0) })).filter((x) => x.cents > 0).sort((a, b) => b.cents - a.cents).map(({ c, cents }) => {
                  const pct = cents / figures.total;
                  return (
                    <View key={c.key} style={styles.bar} accessibilityLabel={`${c.label}, ${formatCents(cents, cur)}, ${Math.round(pct * 100)} percent`}>
                      <View style={styles.barLabel}>
                        <ZText variant="captionStrong">{c.label}</ZText>
                        <ZText variant="caption" color={color.textMuted} tabular>{formatCents(cents, cur)} · {Math.round(pct * 100)}%</ZText>
                      </View>
                      <View style={styles.track}><View style={[styles.fill, { width: `${Math.max(2, Math.round(pct * 100))}%` }]} /></View>
                    </View>
                  );
                })}
              </View>
            ) : null}
            {figures.total > 0 ? <FunFacts data={data} me={me} /> : null}
            {closed && !readonly ? <Button kind="secondary" onWhite height={size.pillButton} label="View recap" onPress={() => router.push(`/(app)/trip/${trip.id}/recap`)} /> : null}
          </Card>
        ) : null}
      </ScrollView>

      {/* sheet footer (none in read-only) */}
      {!readonly && !closed ? (
        <View onLayout={(e) => setFooterH(e.nativeEvent.layout.height)} style={[styles.footer, { paddingBottom: insets.bottom + space[16] }]}>
          <View style={styles.doneRow}>
            <ZText variant="bodyStrong" style={styles.flex}>I'm done adding expenses</ZText>
            <Toggle value={myDone} onChange={toggleDone} disabled={busy} label="I'm done adding expenses" />
          </View>
          <View style={styles.footerButtons}>
            <Button label="Add expense" height={size.buttonHeight} style={styles.footerButton} onPress={() => router.push(`/(app)/trip/${trip.id}/expense`)} />
            {unlocked
              ? <Button kind="ink" label="Close out" height={size.buttonHeight} style={styles.footerButton} onPress={() => router.push(`/(app)/trip/${trip.id}/closeout`)} />
              : <Button kind="locked" label={`Close out · ${toGo} to go`} height={size.buttonHeight} style={[styles.footerButton, styles.footerWide]} accessibilityLabel={`Close out, locked, ${toGo} still adding`} />}
          </View>
        </View>
      ) : null}
      {!readonly && closed ? (
        <View onLayout={(e) => setFooterH(e.nativeEvent.layout.height)} style={[styles.footer, { paddingBottom: insets.bottom + space[16] }]}>
          <View style={styles.footerButtons}>
            <Button kind="ink" label="View recap" height={size.buttonHeight} style={styles.flex} onPress={() => router.push(`/(app)/trip/${trip.id}/recap`)} />
            <Button kind="secondary" onWhite label="Payments" height={size.buttonHeight} style={styles.flex} onPress={() => router.push(`/(app)/trip/${trip.id}/closeout`)} />
          </View>
        </View>
      ) : null}

      <ActionSheet open={menu} onClose={() => setMenu(false)} title={trip.title} actions={menuActions} />
      <ActionSheet open={!!confirm} onClose={() => setConfirm(null)} title={confirm?.title} actions={confirm ? [{ label: confirm.label, destructive: true, onPress: confirm.run }] : []} />
    </View>
  );
}

/** "Jess, Jordan and Bradley" */
function listNames(names: string[]): string {
  if (names.length <= 1) return names[0] ?? "";
  if (names.length === 2) return `${names[0]} and ${names[1]}`;
  if (names.length > 4) return `${names.slice(0, 3).join(", ")} and ${names.length - 3} more`;
  return `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`;
}

/** "owed to you" / "you owe" under the balance: volt or blush, 13/700. */
function LabelPill({ tone, label }: { tone: "volt" | "blush"; label: string }) {
  return (
    <View style={[styles.labelPill, { backgroundColor: tone === "volt" ? color.owedToYou : color.youOwe }]}>
      <ZText variant="captionStrong" color={tone === "volt" ? color.textOnVolt : color.youOweText}>{label}</ZText>
    </View>
  );
}

/** Expense RowCard: category tile (receipt thumbnail when there is one), description, "You paid · split by nights stayed", amount, your share as an AmountPill. */
function ExpenseRow({ e, me, data, settled, onOpen, onHistory }: { e: Expense; me: string; data: TripData; settled: boolean; onOpen?: () => void; onHistory?: () => void }) {
  const thumb = useSignedUrl("receipts", e.receipt_url);
  const edited = e.updated_at !== e.created_at;
  const cur = data.trip.base_currency;
  const delta = myDelta(e, me);
  const payer = memberName(data, e.expense_payers[0]?.user_id ?? e.created_by, me);
  const split = e.split_type === "nights" ? "split by nights stayed" : `${e.expense_shares.length} ${e.expense_shares.length === 1 ? "person" : "people"}`;
  const caption = `${payer} paid${e.expense_payers.length > 1 ? ` +${e.expense_payers.length - 1}` : ""} · ${split}`;
  const tile = thumb
    ? <Image source={{ uri: thumb }} style={styles.thumb} accessibilityLabel="Receipt" accessibilityIgnoresInvertColors />
    : e.split_type === "nights" ? <Icon name="moon" size={20} /> : <ZText variant="micro" color={color.textMuted}>{CATEGORY_GLYPH[e.category] ?? "OT"}</ZText>;
  return (
    <RowCard
      tile={tile}
      title={e.description}
      caption={caption}
      onPress={onOpen}
      accessibilityLabel={`${e.description}, ${caption}, ${formatCents(e.base_amount_cents, cur)}${delta > 0 ? `, ${formatCents(delta, cur)} owed to you` : delta < 0 ? `, you owe ${formatCents(-delta, cur)}` : ""}, ${categoryLabel(e.category, e.subcategory)}`}
      right={
        <>
          <Money cents={e.base_amount_cents} currency={cur === "USD" ? undefined : `${cur} `} />
          {!settled && delta !== 0 ? <AmountPill cents={delta} /> : null}
          {e.currency !== cur ? <ZText variant="small" color={color.textMuted}>{formatCents(e.amount_cents + e.tip_cents, e.currency)}</ZText> : null}
          {edited ? (
            <Press onPress={onHistory} disabled={!onHistory} hitSlop={8} scaleTo={0.97} accessibilityRole="button" accessibilityLabel="Edited, view history" style={styles.edited}>
              <ZText variant="micro" color={color.textMuted}>Edited</ZText>
            </Press>
          ) : null}
        </>
      }
    />
  );
}

/** Summary stats: biggest expense, top category, who fronted the most, who logged the most. */
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
    <View style={styles.facts}>
      {facts.map((f) => (
        <InsetPanel key={f.k}>
          <ZText variant="small" color={color.textMuted}>{f.k}</ZText>
          <ZText variant="bodyStrong">{f.v}</ZText>
        </InsetPanel>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  flex: { flex: 1 },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  content: { paddingHorizontal: layout.screenGutter, gap: space[16] },
  head: { gap: space[6], paddingHorizontal: layout.textGutter - layout.screenGutter },
  titleRow: { flexDirection: "row", alignItems: "center", gap: space[12] },
  coverWrap: { borderRadius: radius.tile, overflow: "hidden" },
  cover: { width: 40, height: 40, borderRadius: radius.tile, backgroundColor: color.surfaceTile },
  avatars: { paddingHorizontal: layout.textGutter - layout.screenGutter, paddingVertical: space[2] },
  heroRow: { flexDirection: "row", alignItems: "center", gap: space[12] },
  heroText: { gap: space[8], alignItems: "flex-start" },
  labelPill: { borderRadius: radius.pill, paddingVertical: 5, paddingHorizontal: 11 },
  stripesPanel: { marginTop: space[12] },
  stripesRow: { flexDirection: "row", alignItems: "center", gap: space[10] },
  quiet: { flexDirection: "row", alignItems: "center", gap: space[8], paddingHorizontal: layout.textGutter - layout.screenGutter },
  plan: { paddingVertical: space[4] },
  planRow: { flexDirection: "row", alignItems: "center", gap: space[8], minHeight: layout.minTapTarget },
  planLines: { gap: space[8], paddingBottom: space[8] },
  planLine: { flexDirection: "row", alignItems: "center", gap: space[8] },
  rows: { gap: space[8] },
  note: { paddingHorizontal: space[4], paddingVertical: space[8] },
  faded: { opacity: 0.45 },
  thumb: { width: size.iconTile, height: size.iconTile },
  edited: { marginTop: 2, minHeight: 20, justifyContent: "center" },
  summary: { gap: space[16] },
  summaryHead: { gap: space[4] },
  bars: { gap: space[12] },
  bar: { gap: space[6] },
  barLabel: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: space[8] },
  track: { height: 8, borderRadius: radius.stripe, backgroundColor: color.stripeOff, overflow: "hidden" },
  fill: { height: 8, borderRadius: radius.stripe, backgroundColor: color.stripeOn },
  facts: { gap: space[8] },
  footer: { position: "absolute", left: 0, right: 0, bottom: 0, backgroundColor: palette.white, borderTopLeftRadius: radius.hero, borderTopRightRadius: radius.hero, paddingHorizontal: layout.screenGutter, paddingTop: space[16], gap: space[14], ...shadow.sheet },
  doneRow: { flexDirection: "row", alignItems: "center", gap: space[12], minHeight: layout.minTapTarget },
  footerButtons: { flexDirection: "row", gap: space[10] },
  footerButton: { flex: 1, paddingHorizontal: space[12] },
  footerWide: { flex: 1.2 },
});

