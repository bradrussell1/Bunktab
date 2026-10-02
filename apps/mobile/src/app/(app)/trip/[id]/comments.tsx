import { formatCents } from "@checkm8/core";
import { theme } from "@checkm8/theme";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { FlatList, KeyboardAvoidingView, Platform, View } from "react-native";
import { Avatar, Button, Input, Screen, Text } from "@/components/ui";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/lib/supabase";
import { memberName, useTrip } from "@/lib/trips";

/**
 * Comments on one expense (spec: Comments). A text-only thread, newest at
 * the bottom, with a composer. Refreshes on focus, after sending, and on
 * realtime inserts when the table is in the publication.
 */
type Comment = { id: string; expense_id: string; user_id: string; body: string; created_at: string };

export default function CommentsScreen() {
  const { id, expense } = useLocalSearchParams<{ id: string; expense: string }>();
  const router = useRouter();
  const { session } = useAuth();
  const me = session!.user.id;
  const { data } = useTrip(id);
  const [items, setItems] = useState<Comment[]>([]);
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const list = useRef<FlatList<Comment>>(null);

  const load = useCallback(async () => {
    if (!expense) return;
    const { data: rows, error: e } = await supabase.from("comments").select("id, expense_id, user_id, body, created_at").eq("expense_id", expense).order("created_at");
    if (e) setError(e.message); else setItems((rows ?? []) as Comment[]);
  }, [expense]);
  useFocusEffect(useCallback(() => { load(); }, [load]));
  useEffect(() => {
    if (!expense) return;
    const ch = supabase.channel(`comments:${expense}:${Math.random().toString(36).slice(2, 8)}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "comments", filter: `expense_id=eq.${expense}` }, () => load())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [expense, load]);

  async function send() {
    const text = body.trim();
    if (!text || !expense) return;
    setBusy(true); setError(null);
    const { error: e } = await supabase.from("comments").insert({ expense_id: expense, user_id: me, body: text.slice(0, 1000) });
    setBusy(false);
    if (e) { setError(e.message); return; }
    setBody(""); await load();
    setTimeout(() => list.current?.scrollToEnd({ animated: true }), 50);
  }

  const exp = data?.expenses.find((x) => x.id === expense);
  const when = (iso: string) => { const d = new Date(iso); return `${d.toLocaleDateString([], { month: "short", day: "numeric" })} · ${d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}`; };

  return (
    <Screen>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1 }} keyboardVerticalOffset={8}>
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingVertical: theme.spacing.sm }}>
          <Button title="‹ Back" kind="text" size="small" onPress={() => router.back()} />
          <View style={{ flex: 1, alignItems: "center", gap: 1 }}>
            <Text variant="title2" numberOfLines={1}>{exp?.description ?? "Comments"}</Text>
            {exp && data && <Text variant="caption1" color={theme.colors.text.onBackground.secondary} numberOfLines={1}>{formatCents(exp.base_amount_cents, data.trip.base_currency)} · paid by {memberName(data, exp.expense_payers[0]?.user_id ?? exp.created_by, me)}</Text>}
          </View>
          <View style={{ width: 60 }} />
        </View>
        <FlatList
          ref={list}
          data={items}
          keyExtractor={(c) => c.id}
          contentContainerStyle={{ gap: theme.spacing.md, paddingVertical: theme.spacing.md, flexGrow: 1 }}
          onContentSizeChange={() => list.current?.scrollToEnd({ animated: false })}
          ListEmptyComponent={<Text variant="caption1" color={theme.colors.text.onBackground.secondary} style={{ textAlign: "center", paddingTop: 40 }}>No comments yet. Ask a question or add a note about this expense.</Text>}
          renderItem={({ item }) => {
            const mine = item.user_id === me;
            const who = data ? memberName(data, item.user_id, me) : "Someone";
            return (
              <View style={{ flexDirection: "row", gap: theme.spacing.sm, alignItems: "flex-end", justifyContent: mine ? "flex-end" : "flex-start" }}>
                {!mine && <Avatar name={data?.members.find((m) => m.user_id === item.user_id)?.display_name ?? "?"} uri={data?.members.find((m) => m.user_id === item.user_id)?.photo_url} size={28} />}
                <View style={{ maxWidth: "78%", gap: 2 }}>
                  <View style={{ backgroundColor: mine ? theme.colors.fill.secondary : theme.colors.background.surface, borderWidth: mine ? 0 : 1, borderColor: theme.colors.border.neutral, borderRadius: theme.radius.sheet, paddingHorizontal: 12, paddingVertical: 8 }}>
                    <Text variant="body">{item.body}</Text>
                  </View>
                  <Text variant="caption3" color={theme.colors.text.onBackground.tertiary} style={{ textAlign: mine ? "right" : "left" }}>{who} · {when(item.created_at)}</Text>
                </View>
              </View>
            );
          }}
        />
        {error && <Text variant="caption1" color={theme.colors.text.destructive}>{error}</Text>}
        <View style={{ flexDirection: "row", gap: theme.spacing.sm, alignItems: "flex-end", paddingBottom: theme.spacing.lg }}>
          <View style={{ flex: 1 }}><Input placeholder="Add a comment" value={body} onChangeText={(v) => setBody(v.slice(0, 1000))} multiline style={{ maxHeight: 120, paddingTop: 12 }} /></View>
          <Button title="Send" size="medium" kind={body.trim() ? "primary" : "secondary"} onPress={send} loading={busy} disabled={!body.trim()} />
        </View>
      </KeyboardAvoidingView>
    </Screen>
  );
}
