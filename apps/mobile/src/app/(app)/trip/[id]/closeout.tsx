import { closeoutUnlocked, countDone, formatCents, venmoChargeLink, venmoPayLink, zebraLabel, zebraMoodFor } from "@bunktab/core";
import { color, layout, palette, radius, shadow, size, space } from "@bunktab/theme";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { Linking, ScrollView, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ActionSheet, Banner, Button, Card, Confetti, Dance, HeroCard, Icon, InsetPanel, PersonPill, Press, Rise, ScreenBackground, StatusPill, TextLink, Toggle, TopBar, VenmoZipButton, Zebra, ZText, haptic, ScreenSkeleton, useToast } from "@/ui";
import { useAuth } from "@/lib/auth";
import { isNetworkError, supabase } from "@/lib/supabase";
import { activeMembers, memberName, useTrip } from "@/lib/trips";

/**
 * Earn your stripes / close out (RESKIN_PROMPT B7, board "Earn your stripes"; spec:
 * Screens → Close out and pay). One screen, two states:
 *
 * Not everyone done: "Earn your stripes", the zebra stage (one stripe per member
 * who's Done, mood by the progress rule), a person pill per member (yours toggles
 * set_done), a locked "Close out at N stripes · K to go" button and, for the creator,
 * a "Close out remaining zebras" toggle (force_close_out: every remaining member is
 * marked Done and told; confirmed in an action sheet). `?nudge=1` (the creator's Nudge
 * button on the dazzle page) adds a small Nudge CTA beside each person still adding:
 * send_nudge writes one notification + push per person per day, never a text.
 * Feedback round 1, items 13 and 14.
 *
 * Everyone done: "Stripes are even. Time to settle." The zebra dances and confetti
 * fires the moment the last stripe lands; the payment plan (written by the database
 * through generate_settlements) rises in: your payments as "Pay Mike $84.50" Venmo
 * zip buttons with Mark as paid / Undo, what's owed to you with Got it, payments
 * between others, then "We earned our stripes. Share the recap?" and one volt
 * "Request … in Venmo" for creditors. Settled up stays a toggle (set_settled_up).
 * Venmo link building, RPC names and the gate are unchanged.
 */
function friendly(m: string): string {
  const s = m.toLowerCase();
  if (s.includes("still locked")) return "Close out is locked until everyone has tapped Done.";
  if (s.includes("not a member")) return "You're not on this Dazzle any more.";
  if (isNetworkError(m) || s.includes("network")) return "Connection lost. Check your signal and try again.";
  if (s.includes("42501") || s.includes("only the")) return "Only the Dazzle creator can do that.";
  return m;
}

export default function CloseoutScreen() {
  const { id, nudge: nudgeParam } = useLocalSearchParams<{ id: string; nudge?: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { show } = useToast();
  const { session } = useAuth();
  const me = session!.user.id;
  const { data, loading, reload } = useTrip(id);
  const [error, setError] = useState<string | null>(null);
  const [generated, setGenerated] = useState(false);
  const [settling, setSettling] = useState(false);
  const [busyDone, setBusyDone] = useState(false);
  const [confirmSkip, setConfirmSkip] = useState(false);
  const [closingOut, setClosingOut] = useState(false);
  const [nudging, setNudging] = useState<string | null>(null);
  const [nudged, setNudged] = useState<Record<string, boolean>>({}); // user_id → sent this session
  const [play, setPlay] = useState({ dance: 0, confetti: 0 });
  const wasUnlocked = useRef<boolean | null>(null);

  // the plan is only asked for once the gate is open; a locked trip shows the stripes instead
  const gateOpen = data ? (closeoutUnlocked(activeMembers(data).map((m) => ({ doneAt: m.done_at, removedAt: m.removed_at }))) || !!data.trip.closeout_override_at) : false;
  useEffect(() => {
    if (!data || generated || !gateOpen) return;
    setGenerated(true);
    if (data.trip.status === "open") supabase.rpc("generate_settlements", { p_trip: data.trip.id }).then(({ error: e }) => { if (e) setError(friendly(e.message)); reload(); });
  }, [data, generated, gateOpen, reload]);
  // the last stripe landing (while you watch) → dance + confetti; already even on open → one dance
  useEffect(() => {
    if (!data) return;
    if (wasUnlocked.current === null) { wasUnlocked.current = gateOpen; if (gateOpen) setPlay((p) => ({ ...p, dance: p.dance + 1 })); return; }
    if (!wasUnlocked.current && gateOpen) { wasUnlocked.current = true; setPlay((p) => ({ dance: p.dance + 1, confetti: p.confetti + 1 })); haptic.success(); }
    if (!gateOpen) wasUnlocked.current = false;
  }, [data, gateOpen]);

  if (loading || !data) {
    return <View style={styles.screen}><ScreenBackground /><TopBar onBack={() => router.back()} /><ScreenSkeleton rows={3} /></View>;
  }
  const { trip, settlements } = data;
  const members = activeMembers(data);
  const doneCount = countDone(members).done;
  const toGo = members.length - doneCount;
  const closed = trip.status !== "open";
  const cur = trip.base_currency;
  const isOwner = members.find((m) => m.user_id === me)?.role === "owner";
  const myDone = !!members.find((m) => m.user_id === me)?.done_at;
  const mood = zebraMoodFor({ place: "stripes", members: members.length, done: doneCount }) ?? "hi";
  const nudgeMode = nudgeParam === "1" && isOwner && !closed;

  const mine = settlements.filter((s) => s.from_user === me);
  const owed = settlements.filter((s) => s.to_user === me);
  const others = settlements.filter((s) => s.from_user !== me && s.to_user !== me);
  const venmoOf = (uid: string) => data.members.find((m) => m.user_id === uid)?.venmo_username ?? null;
  const settledUp = !!data.members.find((m) => m.user_id === me)?.settled_up_at;
  const pendingOwed = owed.filter((s) => s.status === "pending");
  const canRequest = pendingOwed.length > 0 && owed.every((s) => venmoOf(s.from_user));
  const allMinePaid = mine.length > 0 && mine.every((s) => s.status !== "pending");
  const who = (uid: string) => memberName(data, uid, me);

  async function open(link: { app: string; web: string }) {
    const can = await Linking.canOpenURL(link.app).catch(() => false);
    await Linking.openURL(can ? link.app : link.web);
  }
  async function toggleDone(v: boolean) {
    setBusyDone(true);
    const { error: e } = await supabase.rpc("set_done", { p_trip: trip.id, p_done: v });
    if (e) setError(friendly(e.message));
    await reload(); setBusyDone(false);
  }
  // the creator closes out for everyone: every remaining member is marked Done and told
  async function closeOutRemaining() {
    setClosingOut(true);
    const { error: e } = await supabase.rpc("force_close_out", { p_trip: trip.id });
    if (e) setError(friendly(e.message));
    await reload();
    setClosingOut(false);
  }
  // one nudge per person per day: the database dedupes (notification_log) and says so
  async function nudgeMember(uid: string, name: string) {
    setNudging(uid);
    const { data: sent, error: e } = await supabase.rpc("send_nudge", { p_trip: trip.id, p_user: uid });
    setNudging(null);
    if (e) { show({ message: friendly(e.message) }); return; }
    setNudged((n) => ({ ...n, [uid]: true }));
    show({ message: sent ? `Nudged ${name}. They'll get a push and see it next time they open the app.` : `${name} was already nudged today. One a day keeps it friendly.`, duration: 3500, bust: <Zebra variant="bust" mood="wink" size={28} decorative /> });
  }
  async function toggleSettledUp(v: boolean) {
    setSettling(true);
    const { error: e } = await supabase.rpc("set_settled_up", { p_trip: trip.id, p_on: v });
    if (e) setError(friendly(e.message));
    await reload(); setSettling(false);
  }
  async function mark(sid: string, action: "mark_paid" | "unmark" | "confirm") {
    const { error: e } = await supabase.rpc("mark_settlement", { p_settlement: sid, p_action: action });
    if (e) setError(friendly(e.message)); reload();
  }
  const requestLabel = pendingOwed.length === 1 ? `Request ${formatCents(pendingOwed[0]!.amount_cents, cur)} in Venmo` : "Request from everyone in Venmo";
  const request = () => open(venmoChargeLink(pendingOwed.map((s) => venmoOf(s.from_user)!), owed[0]!.amount_cents, trip.title));

  return (
    <View style={styles.screen}>
      <ScreenBackground />
      <TopBar onBack={() => router.back()} right={<StatusPill label={gateOpen ? `All ${members.length} stripes` : `${doneCount} of ${members.length} stripes`} complete={gateOpen} />} />
      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 120 }]} showsVerticalScrollIndicator={false}>
        {gateOpen ? (
          <Rise key="even" style={styles.titleBlock}>
            <ZText variant="title1" accessibilityRole="header">Stripes are even.{"\n"}Time to settle.</ZText>
          </Rise>
        ) : (
          <View style={styles.titleBlock}>
            <ZText variant="title1" accessibilityRole="header">Earn your stripes</ZText>
            <ZText variant="body" color={color.textSecondary}>Each stripe is someone who&apos;s done adding expenses.</ZText>
          </View>
        )}

        {error ? <Banner dot="pink" style={styles.gutter}>{error}</Banner> : null}

        {/* the zebra stage: one stripe per member who's Done */}
        <HeroCard style={styles.stage}>
          <Dance play={play.dance}>
            <Zebra variant="full" members={members.length} done={doneCount} mood={mood} size={244} animate={{ blink: true, swish: true }} accessibilityLabel={zebraLabel(mood, members.length, doneCount)} />
          </Dance>
          <Confetti play={play.confetti} style={StyleSheet.absoluteFill} />
        </HeroCard>

        {!gateOpen ? (
          <View style={styles.pills}>
            {members.map((m, i) => {
              const done = !!m.done_at;
              const isMe = m.user_id === me;
              return (
                <PersonPill
                  key={m.user_id}
                  name={isMe ? "You" : (m.display_name ?? "Member")}
                  done={done}
                  stripeIndex={done ? members.slice(0, i + 1).filter((x) => x.done_at).length : undefined}
                  bust={done ? <Zebra variant="bust" mood="happy" size={44} decorative /> : undefined}
                  onPress={isMe && !closed && !busyDone ? () => toggleDone(!myDone) : undefined}
                  action={nudgeMode && !done && !isMe ? (
                    <Button kind="nudge" label={nudged[m.user_id] ? "Nudged" : "Nudge"} loading={nudging === m.user_id} disabled={!!nudged[m.user_id] || !!nudging} onPress={() => nudgeMember(m.user_id, (m.display_name ?? "them").split(/\s+/)[0]!)} accessibilityLabel={`Nudge ${m.display_name ?? "this member"} to add their receipts`} />
                  ) : undefined}
                />
              );
            })}
          </View>
        ) : (
          <>
            {settlements.length === 0 ? (
              <Rise delay={250} style={styles.gutter}>
                <Card><ZText variant="headline">Everyone is even.</ZText><ZText variant="caption" color={color.textSecondary}>Nothing to settle on this Dazzle.</ZText></Card>
              </Rise>
            ) : null}

            {mine.length > 0 ? (
              <Rise delay={250} style={styles.gutter}>
                <Card style={styles.payCard}>
                  <View style={styles.payHeader}>
                    <View style={styles.flex}>
                      <ZText variant="small" color={color.textSecondary}>Your payments</ZText>
                      <ZText variant="headline">{mine.filter((s) => s.status !== "pending").length} of {mine.length} marked paid</ZText>
                    </View>
                    <Zebra variant="bust" size={84} mood={zebraMoodFor({ place: "payment", paid: allMinePaid }) ?? "hi"} animate={{ blink: true }} accessibilityLabel={allMinePaid ? "Zebra, love: all paid" : "Zebra, hi"} />
                  </View>
                  {mine.map((s) => {
                    const to = who(s.to_user); const handle = venmoOf(s.to_user); const paid = s.status !== "pending"; const amt = formatCents(s.amount_cents, cur);
                    return (
                      <View key={s.id} style={styles.payRow}>
                        {handle ? (
                          <VenmoZipButton label={`Pay ${to} ${amt}`} paid={paid} onPress={() => open(venmoPayLink(handle, s.amount_cents, trip.title))} />
                        ) : (
                          <Button kind="locked" label={`Pay ${to} ${amt}`} accessibilityLabel={`Pay ${to} ${amt}, unavailable: ${to} hasn't added a Venmo handle yet`} />
                        )}
                        <View style={styles.payMeta}>
                          <ZText variant="caption" color={color.textMuted} style={styles.flex} numberOfLines={1}>{handle ? `@${handle}` : `${to} hasn't added a Venmo handle yet`}</ZText>
                          {s.status === "confirmed"
                            ? <ZText variant="captionStrong">{to} confirmed</ZText>
                            : <TextLink label={paid ? "Undo" : "Mark as paid"} muted={paid} onPress={() => mark(s.id, paid ? "unmark" : "mark_paid")} />}
                        </View>
                      </View>
                    );
                  })}
                </Card>
              </Rise>
            ) : null}

            {owed.length > 0 || others.length > 0 ? (
              <Rise delay={mine.length ? 350 : 250} style={styles.gutter}>
                <Card style={styles.listCard}>
                  {owed.map((s, i) => {
                    const from = who(s.from_user);
                    const status = s.status === "pending" ? "Not marked paid yet" : s.status === "confirmed" ? "You confirmed" : "Marked paid";
                    return (
                      <View key={s.id} style={[styles.listRow, i > 0 ? styles.listRule : null]} accessibilityLabel={`${from} pays you ${formatCents(s.amount_cents, cur)}, ${status}`}>
                        <View style={styles.flex}>
                          <ZText variant="body">{from} pays you</ZText>
                          <ZText variant="small" color={s.status === "pending" ? color.textMuted : color.text}>{status}</ZText>
                        </View>
                        <ZText variant="amountRow" tabular>{formatCents(s.amount_cents, cur)}</ZText>
                        {s.status === "marked_paid" ? <Button kind="secondary" onWhite height={size.pillSmall} label="Got it" onPress={() => mark(s.id, "confirm")} /> : null}
                      </View>
                    );
                  })}
                  {others.map((s, i) => (
                    <View key={s.id} style={[styles.listRow, owed.length + i > 0 ? styles.listRule : null]}>
                      <ZText variant="body" color={color.textSecondary} style={styles.flex}>{who(s.from_user)} pays {who(s.to_user)}</ZText>
                      <ZText variant="amountRow" tabular color={color.textSecondary}>{formatCents(s.amount_cents, cur)}</ZText>
                    </View>
                  ))}
                </Card>
              </Rise>
            ) : null}

            <Rise delay={350} style={styles.gutter}>
              <Press onPress={() => router.push(`/(app)/trip/${trip.id}/recap`)} scaleTo={0.98} accessibilityRole="button" accessibilityLabel="We earned our stripes. Share the recap?">
                <InsetPanel tone="blush" style={styles.recapNudge}>
                  <ZText variant="label" color={color.youOweText}>We earned our stripes. Share the recap?</ZText>
                  <Icon name="chevronRight" size={16} color={color.youOweText} />
                </InsetPanel>
              </Press>
            </Rise>

            <Rise delay={450} style={styles.gutter}>
              <Card style={styles.settledCard}>
                <View style={styles.settledRow}>
                  <ZText variant="bodyStrong" style={styles.flex}>Settled up</ZText>
                  <Toggle value={settledUp} onChange={toggleSettledUp} disabled={settling} label="Settled up" />
                </View>
                <ZText variant="caption" color={color.textSecondary}>Turn this on once you&apos;ve paid and been paid for this Dazzle. It marks your payments paid and quiets the expenses.</ZText>
                <ZText variant="caption" color={color.textMuted}>Venmo does the paying. Zebrasplit only prepares each payment and can&apos;t see whether it went through, so mark each one paid yourself. Recipients can tap Got it to confirm, but they don&apos;t have to.</ZText>
              </Card>
            </Rise>
          </>
        )}
      </ScrollView>

      {/* footer */}
      {!gateOpen ? (
        <View style={[styles.footer, { paddingBottom: insets.bottom + layout.bottomCtaPadding }]}>
          {isOwner && !closed ? (
            // creator only: force every remaining member Done (confirmed below)
            <View style={styles.forceRow}>
              <View style={styles.flex}>
                <ZText variant="bodyStrong">Close out remaining zebras</ZText>
                <ZText variant="small" color={color.textMuted}>Marks the {toGo} still adding as Done and tells them.</ZText>
              </View>
              <Toggle value={false} onChange={() => setConfirmSkip(true)} disabled={closingOut} label="Close out remaining zebras" />
            </View>
          ) : null}
          <Button kind="locked" label={`Close out at ${members.length} stripes · ${toGo} to go`} accessibilityLabel={`Close out, locked, ${toGo} still adding expenses`} />
        </View>
      ) : canRequest ? (
        <Rise delay={450} style={[styles.footer, { paddingBottom: insets.bottom + layout.bottomCtaPadding }]}>
          <Button label={requestLabel} right={<Icon name="arrowUpRight" size={18} />} onPress={request} />
        </Rise>
      ) : null}

      <ActionSheet
        open={confirmSkip}
        onClose={() => setConfirmSkip(false)}
        title={`Close out the remaining ${toGo === 1 ? "zebra" : "zebras"}? Everyone still adding is marked Done and notified, the override is logged, and expenses already logged still count.`}
        actions={[{ label: "Close out for everyone", destructive: true, onPress: closeOutRemaining }]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: palette.bgMid },
  flex: { flex: 1 },
  content: { gap: space[12] },
  gutter: { marginHorizontal: layout.screenGutter },
  titleBlock: { paddingHorizontal: layout.textGutter, paddingTop: space[2], gap: space[4] },
  stage: { marginHorizontal: layout.screenGutter, backgroundColor: color.surfaceTranslucentStrong, alignItems: "center", paddingVertical: space[6], paddingHorizontal: space[10], overflow: "hidden" },
  pills: { paddingHorizontal: layout.screenGutter, gap: space[8] },
  payCard: { gap: space[14] },
  payHeader: { flexDirection: "row", alignItems: "flex-end", gap: space[12] },
  payRow: { gap: space[8], paddingTop: space[12], borderTopWidth: 1, borderTopColor: color.divider },
  payMeta: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: space[12], paddingHorizontal: space[4] },
  listCard: { paddingVertical: space[2] },
  listRow: { flexDirection: "row", alignItems: "center", gap: space[12], paddingVertical: 12 },
  listRule: { borderTopWidth: 1, borderTopColor: color.divider },
  recapNudge: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: space[8], borderRadius: radius.inset + 4, paddingVertical: 12, paddingHorizontal: 16 },
  settledCard: { gap: space[8] },
  settledRow: { flexDirection: "row", alignItems: "center", gap: space[12] },
  footer: { position: "absolute", left: 0, right: 0, bottom: 0, paddingHorizontal: layout.screenGutter, paddingTop: space[10], gap: space[4], backgroundColor: color.surfaceTranslucentStrong, borderTopLeftRadius: radius.hero, borderTopRightRadius: radius.hero, ...shadow.sheet },
  forceRow: { flexDirection: "row", alignItems: "center", gap: space[12], paddingHorizontal: space[4], paddingBottom: space[6], minHeight: layout.minTapTarget },
});
