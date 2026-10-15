import { formatCents } from "@bunktab/core";
import { color, layout, palette, space } from "@bunktab/theme";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { ScrollView, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Avatar, Card, ContextPill, ErrorPanel, RowSkeleton, ScreenBackground, TopBar, ZText } from "@/ui";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/lib/supabase";
import { ACTION_LABEL, diffFields, relativeTime, type HistoryRow } from "@/lib/tripExtras";
import { useTrip } from "@/lib/trips";

/**
 * Edit and delete history (spec: Edit and delete history): every create, edit and
 * delete with who, when, and the old and new values. With ?expense=<id> it's that
 * expense's thread (opened from the Edited tag); without, the whole dazzle's log,
 * including owner overrides and member removals. Deleted expenses are soft-deleted,
 * so they appear here even though the feed hides them.
 */
export default function HistoryScreen() {
  const { id, expense } = useLocalSearchParams<{ id: string; expense?: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { session } = useAuth();
  const me = session!.user.id;
  const { data } = useTrip(id);
  const [rows, setRows] = useState<HistoryRow[] | null>(null);
  const [names, setNames] = useState<Record<string, { name: string; photo: string | null }>>({});
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let live = true;
    setError(null);
    (async () => {
      let q = supabase.from("expense_history").select("id, trip_id, expense_id, actor_id, action, before_json, after_json, at").eq("trip_id", id!).order("at", { ascending: false }).limit(300);
      if (expense) q = q.eq("expense_id", expense);
      const { data: h, error: e } = await q;
      if (!live) return;
      if (e) { setError(e.message); setRows([]); return; }
      const list = (h ?? []) as HistoryRow[];
      setRows(list);
      // actors who aren't (or are no longer) dazzle members
      const ids = [...new Set(list.map((r) => r.actor_id).filter((x): x is string => !!x))];
      const { data: us } = await supabase.from("users").select("id, display_name, photo_url").in("id", ids);
      if (live && us) setNames(Object.fromEntries(us.map((u) => [u.id, { name: u.display_name ?? "Someone", photo: u.photo_url }])));
    })();
    return () => { live = false; };
  }, [id, expense, attempt]);

  const who = (uid: string | null) => {
    if (!uid) return { name: "Zebrasplit", full: "Zebrasplit", photo: null };
    const m = data?.members.find((x) => x.user_id === uid);
    const full = m ? (m.display_name ?? "Member") : (names[uid]?.name ?? "Someone");
    return { name: uid === me ? "You" : full, full, photo: m ? m.photo_url : (names[uid]?.photo ?? null) };
  };
  const base = data?.trip.base_currency ?? "USD";
  const subject = expense ? (data?.expenses.find((e) => e.id === expense)?.description ?? (rows?.[0]?.after_json?.description as string | undefined) ?? (rows?.[0]?.before_json?.description as string | undefined)) : null;

  return (
    <View style={styles.screen}>
      <ScreenBackground />
      <TopBar onBack={() => router.back()} right={subject ? <ContextPill style={styles.context}>{subject}</ContextPill> : null} />
      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + space[32] }]} showsVerticalScrollIndicator={false}>
        <ZText variant="title1" accessibilityRole="header" style={styles.title}>{expense ? "Expense history" : "Dazzle history"}</ZText>
        {rows === null ? [0, 1, 2].map((i) => <RowSkeleton key={i} />) : null}
        {error ? <ErrorPanel message={error} onRetry={() => { setRows(null); setAttempt((a) => a + 1); }} /> : null}
        {rows && rows.length === 0 && !error ? <ZText variant="body" color={color.textSecondary} style={styles.title}>Nothing logged yet.</ZText> : null}
        {rows && rows.length > 0 ? (
          <Card style={styles.log}>
            {rows.map((r, i) => {
              const actor = who(r.actor_id);
              const changes = r.action === "expense.update" ? diffFields(r.before_json, r.after_json, base) : [];
              const desc = (r.after_json?.description ?? r.before_json?.description) as string | undefined;
              const amount = (r.after_json?.base_amount_cents ?? r.before_json?.base_amount_cents) as number | undefined;
              const removed = r.action === "member.remove" ? (r.after_json?.display_name as string | undefined) : undefined;
              return (
                <View key={r.id} style={[styles.row, i > 0 ? styles.rule : null]}>
                  <Avatar name={actor.full} uri={actor.photo} size={32} />
                  <View style={styles.rowText}>
                    <ZText variant="body">
                      <ZText variant="bodyStrong">{actor.name}</ZText> {ACTION_LABEL[r.action] ?? r.action.replace(".", " ")}
                      {!expense && desc ? <ZText variant="body" color={color.textSecondary}>{` · ${desc}${typeof amount === "number" ? ` (${formatCents(amount, base)})` : ""}`}</ZText> : null}
                      {removed ? <ZText variant="body" color={color.textSecondary}>{` · ${removed}`}</ZText> : null}
                    </ZText>
                    {changes.map((c) => (
                      <ZText key={c.field} variant="caption" color={color.textSecondary}>
                        {c.field}: <ZText variant="caption" color={color.textMuted} style={styles.strike}>{c.from}</ZText> → <ZText variant="captionStrong">{c.to}</ZText>
                      </ZText>
                    ))}
                    <ZText variant="small" color={color.textMuted}>{relativeTime(r.at)}</ZText>
                  </View>
                </View>
              );
            })}
          </Card>
        ) : null}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: palette.bgMid },
  content: { paddingHorizontal: layout.screenGutter, gap: layout.listGap },
  title: { paddingHorizontal: space[4] },
  context: { maxWidth: 220 },
  log: { paddingVertical: space[4] },
  row: { flexDirection: "row", gap: space[12], paddingVertical: 12 },
  rule: { borderTopWidth: 1, borderTopColor: color.divider },
  rowText: { flex: 1, gap: 4 },
  strike: { textDecorationLine: "line-through" },
});
