import { formatCents } from "@bunktab/core";
import { color, layout, palette, space } from "@bunktab/theme";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useState, type ReactNode } from "react";
import { ScrollView, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ActionSheet, AmountPill, Avatar, Card, Press, ScreenBackground, ScreenSkeleton, StatusPill, TextLink, TopBar, ZText, useToast } from "@/ui";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/lib/supabase";
import { hasNoExpenses } from "@/lib/tripExtras";
import { openVenmoProfile } from "@/lib/venmo";
import { nets, paidBy, shareOf, useTrip } from "@/lib/trips";

/**
 * Member details (spec: Trip page → tapping a member shows their details; Members →
 * the owner can remove a member only if that member has no expenses, as payer or as
 * someone included). Removal calls remove_member, which the database re-checks
 * (guard_member_removal) so a stale screen can't remove someone who has since been
 * added to an expense. Confirmation is an action sheet, never a system alert.
 */
export default function MemberScreen() {
  const { id, user } = useLocalSearchParams<{ id: string; user: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { show } = useToast();
  const { session } = useAuth();
  const me = session!.user.id;
  const { data, loading, reload } = useTrip(id);
  const [busy, setBusy] = useState(false);
  const [confirm, setConfirm] = useState(false);

  if (loading || !data) return <View style={styles.screen}><ScreenBackground /><TopBar onBack={() => router.back()} /><ScreenSkeleton rows={2} /></View>;
  const m = data.members.find((x) => x.user_id === user);
  if (!m) return <View style={styles.screen}><ScreenBackground /><TopBar onBack={() => router.back()} /><ZText variant="body" style={styles.missing}>Member not found.</ZText></View>;
  const { trip } = data;
  const isMe = m.user_id === me;
  const viewerIsOwner = data.members.find((x) => x.user_id === me)?.role === "owner";
  const removable = viewerIsOwner && !isMe && m.role !== "owner" && !m.removed_at && trip.status === "open" && hasNoExpenses(data, m.user_id);
  const name = isMe ? "You" : (m.display_name ?? m.phone ?? "Member");
  const paid = paidBy(data, m.user_id), share = shareOf(data, m.user_id), net = nets(data)[m.user_id] ?? 0;
  const cur = trip.base_currency;

  async function remove() {
    setBusy(true);
    const { error } = await supabase.rpc("remove_member", { p_trip: trip.id, p_user: m!.user_id });
    setBusy(false);
    if (error) { show({ message: `Couldn't remove: ${error.message}` }); reload(); return; }
    router.back();
  }

  return (
    <View style={styles.screen}>
      <ScreenBackground />
      <TopBar onBack={() => router.back()} />
      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + space[32] }]} showsVerticalScrollIndicator={false}>
        <View style={styles.head}>
          <Avatar name={m.display_name ?? "?"} uri={m.photo_url} size={88} done={!!m.done_at} />
          <ZText variant="title1" accessibilityRole="header">{name}</ZText>
          <View style={styles.headMeta}>
            <ZText variant="caption" color={color.textSecondary}>{m.role === "owner" ? "Dazzle owner" : "Member"}{m.removed_at ? " · removed" : ""}</ZText>
            {m.done_at ? <StatusPill label="Done" complete /> : null}
          </View>
        </View>

        <Card style={styles.list}>
          <Row label="Phone" value={m.phone ? `+${m.phone}` : "Not shared"} />
          <Row label="Venmo" value={m.venmo_username ? `@${m.venmo_username}` : "Not added yet"} rule right={m.venmo_username ? <TextLink label="Open" onPress={() => openVenmoProfile(m.venmo_username!)} /> : null} />
        </Card>

        <Card style={styles.list}>
          <ZText variant="overline" color={color.textMuted} style={styles.cardLabel}>On this Dazzle</ZText>
          <Row label="Paid" value={formatCents(paid, cur)} />
          <Row label="Share" value={formatCents(share, cur)} rule />
          <Row label="Net" value={net === 0 ? "Even" : net > 0 ? `Owed ${formatCents(net, cur)}` : `Owes ${formatCents(-net, cur)}`} rule right={net !== 0 ? <AmountPill cents={net} /> : null} hideValue={net !== 0} />
          <Row label="Done adding expenses" value={m.done_at ? "Yes" : "Not yet"} rule />
        </Card>

        {removable ? (
          <Press onPress={() => setConfirm(true)} disabled={busy} scaleTo={0.98} accessibilityRole="button" accessibilityLabel="Remove from Dazzle" style={styles.remove}>
            <ZText variant="label" color={color.destructive} style={styles.removeText}>{busy ? "Removing…" : "Remove from Dazzle"}</ZText>
          </Press>
        ) : viewerIsOwner && !isMe && m.role !== "owner" && !m.removed_at ? (
          <ZText variant="caption" color={color.textMuted} style={styles.note}>
            {trip.status !== "open" ? "Members can't be removed after close-out." : `${m.display_name ?? "This member"} is on at least one expense, so they can't be removed in this version. That keeps every balance intact.`}
          </ZText>
        ) : null}
      </ScrollView>

      <ActionSheet
        open={confirm}
        onClose={() => setConfirm(false)}
        title={`Remove ${m.display_name ?? "this member"}? They lose access right away and are notified. Balances don't change because they're on no expenses.`}
        actions={[{ label: "Remove", destructive: true, onPress: remove }]}
      />
    </View>
  );
}

function Row({ label, value, right, rule, hideValue }: { label: string; value: string; right?: ReactNode; rule?: boolean; hideValue?: boolean }) {
  return (
    <View style={[styles.row, rule ? styles.rule : null]} accessibilityLabel={`${label}: ${value}`}>
      <ZText variant="body" style={styles.flex}>{label}</ZText>
      {!hideValue ? <ZText variant="bodyStrong" tabular>{value}</ZText> : null}
      {right}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: palette.bgMid },
  flex: { flex: 1 },
  content: { paddingHorizontal: layout.screenGutter, gap: layout.listGap },
  missing: { padding: layout.textGutter },
  head: { alignItems: "center", gap: space[8], paddingVertical: space[8] },
  headMeta: { flexDirection: "row", alignItems: "center", gap: space[8] },
  list: { paddingVertical: space[4] },
  cardLabel: { paddingTop: space[8], paddingBottom: space[2] },
  row: { flexDirection: "row", alignItems: "center", gap: space[12], paddingVertical: 12 },
  rule: { borderTopWidth: 1, borderTopColor: color.divider },
  remove: { alignSelf: "center", minHeight: layout.minTapTarget, justifyContent: "center", paddingHorizontal: space[12] },
  removeText: { textDecorationLine: "underline" },
  note: { textAlign: "center", paddingHorizontal: layout.textGutter },
});
