import { formatCents } from "@bunktab/core";
import { theme } from "@bunktab/theme";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { ActivityIndicator, ScrollView, View } from "react-native";
import { Avatar, Button, Card, Divider, Screen, Text } from "@/components/ui";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/lib/supabase";
import { ACTION_LABEL, diffFields, relativeTime, type HistoryRow } from "@/lib/tripExtras";
import { useTrip } from "@/lib/trips";

/**
 * Edit and delete history (spec: Edit and delete history): every create,
 * edit and delete with who, when, and the old and new values. With
 * ?expense=<id> it's that expense's thread (opened from the Edited tag);
 * without, the whole trip's log, including owner overrides and member
 * removals. Deleted expenses are soft-deleted, so they appear here even
 * though the feed hides them.
 */
export default function HistoryScreen() {
  const { id, expense } = useLocalSearchParams<{ id: string; expense?: string }>();
  const router = useRouter();
  const { session } = useAuth();
  const me = session!.user.id;
  const { data } = useTrip(id);
  const [rows, setRows] = useState<HistoryRow[] | null>(null);
  const [names, setNames] = useState<Record<string, { name: string; photo: string | null }>>({});
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let live = true;
    (async () => {
      let q = supabase.from("expense_history").select("id, trip_id, expense_id, actor_id, action, before_json, after_json, at").eq("trip_id", id!).order("at", { ascending: false }).limit(300);
      if (expense) q = q.eq("expense_id", expense);
      const { data: h, error: e } = await q;
      if (!live) return;
      if (e) { setError(e.message); setRows([]); return; }
      const list = (h ?? []) as HistoryRow[];
      setRows(list);
      // actors who aren't (or are no longer) trip members
      const ids = [...new Set(list.map((r) => r.actor_id).filter((x): x is string => !!x))];
      const { data: us } = await supabase.from("users").select("id, display_name, photo_url").in("id", ids);
      if (live && us) setNames(Object.fromEntries(us.map((u) => [u.id, { name: u.display_name ?? "Someone", photo: u.photo_url }])));
    })();
    return () => { live = false; };
  }, [id, expense]);

  const who = (uid: string | null) => {
    if (!uid) return { name: "Bunktab", full: "Bunktab", photo: null };
    const m = data?.members.find((x) => x.user_id === uid);
    const full = m ? (m.display_name ?? "Member") : (names[uid]?.name ?? "Someone");
    return { name: uid === me ? "You" : full, full, photo: m ? m.photo_url : (names[uid]?.photo ?? null) };
  };
  const base = data?.trip.base_currency ?? "USD";
  const subject = expense ? (data?.expenses.find((e) => e.id === expense)?.description ?? (rows?.[0]?.after_json?.description as string | undefined) ?? (rows?.[0]?.before_json?.description as string | undefined)) : null;

  return (
    <Screen>
      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingVertical: theme.spacing.sm }}>
        <Button title="‹ Back" kind="text" size="small" onPress={() => router.back()} />
        <Text variant="title2">History</Text>
        <View style={{ width: 60 }} />
      </View>
      {subject && <Text variant="caption1" color={theme.colors.text.onBackground.secondary} style={{ marginBottom: theme.spacing.md }}>{subject}</Text>}
      {rows === null ? <ActivityIndicator /> : (
        <ScrollView contentContainerStyle={{ paddingBottom: 40 }}>
          {error && <Text variant="caption1" color={theme.colors.text.destructive}>{error}</Text>}
          {rows.length === 0 && !error && <Text variant="body" color={theme.colors.text.onBackground.secondary}>Nothing logged yet.</Text>}
          {rows.length > 0 && (
            <Card style={{ padding: 0, overflow: "hidden" }}>
              {rows.map((r, i) => {
                const actor = who(r.actor_id);
                const changes = r.action === "expense.update" ? diffFields(r.before_json, r.after_json, base) : [];
                const desc = (r.after_json?.description ?? r.before_json?.description) as string | undefined;
                const amount = (r.after_json?.base_amount_cents ?? r.before_json?.base_amount_cents) as number | undefined;
                const removed = r.action === "member.remove" ? (r.after_json?.display_name as string | undefined) : undefined;
                return (
                  <View key={r.id}>
                    {i > 0 && <Divider />}
                    <View style={{ flexDirection: "row", gap: 12, padding: 12 }}>
                      <Avatar name={actor.full} uri={actor.photo} size={32} />
                      <View style={{ flex: 1, gap: 4 }}>
                        <Text variant="body">
                          <Text variant="text">{actor.name}</Text> {ACTION_LABEL[r.action] ?? r.action.replace(".", " ")}
                          {!expense && desc ? <Text variant="body" color={theme.colors.text.onBackground.secondary}>{` · ${desc}${typeof amount === "number" ? ` (${formatCents(amount, base)})` : ""}`}</Text> : null}
                          {removed ? <Text variant="body" color={theme.colors.text.onBackground.secondary}>{` · ${removed}`}</Text> : null}
                        </Text>
                        {changes.map((c) => (
                          <Text key={c.field} variant="caption1" color={theme.colors.text.onBackground.secondary}>
                            {c.field}: <Text variant="caption1" style={{ textDecorationLine: "line-through" }} color={theme.colors.text.onBackground.tertiary}>{c.from}</Text> → <Text variant="caption1Semibold">{c.to}</Text>
                          </Text>
                        ))}
                        <Text variant="caption3" color={theme.colors.text.onBackground.tertiary}>{relativeTime(r.at)}</Text>
                      </View>
                    </View>
                  </View>
                );
              })}
            </Card>
          )}
        </ScrollView>
      )}
    </Screen>
  );
}
