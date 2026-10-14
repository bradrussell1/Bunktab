import { formatCents } from "@bunktab/core";
import { color, layout, palette, radius, shadow, space } from "@bunktab/theme";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { FlatList, KeyboardAvoidingView, Platform, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Avatar, IconButton, Input, ScreenBackground, TopBar, ZText } from "@/ui";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/lib/supabase";
import { memberName, useTrip } from "@/lib/trips";

/**
 * Comments on one expense (RESKIN_PROMPT B5; spec: Comments). A text-only thread,
 * newest at the bottom: speech-bubble rows (white for others, cream for you) and an
 * Input pill with a send IconButton. Refreshes on focus, after sending, and on
 * realtime inserts when the table is in the publication.
 */
type Comment = { id: string; expense_id: string; user_id: string; body: string; created_at: string };

export default function CommentsScreen() {
  const { id, expense } = useLocalSearchParams<{ id: string; expense: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
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
  const canSend = body.trim().length > 0 && !busy;

  return (
    <View style={styles.screen}>
      <ScreenBackground />
      <TopBar onBack={() => router.back()} />
      <View style={styles.head}>
        <ZText variant="title2" numberOfLines={2} accessibilityRole="header">{exp?.description ?? "Comments"}</ZText>
        {exp && data ? <ZText variant="caption" color={color.textMuted} numberOfLines={1}>{formatCents(exp.base_amount_cents, data.trip.base_currency)} · paid by {memberName(data, exp.expense_payers[0]?.user_id ?? exp.created_by, me)}</ZText> : null}
      </View>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={styles.flex}>
        <FlatList
          ref={list}
          data={items}
          keyExtractor={(c) => c.id}
          contentContainerStyle={styles.list}
          onContentSizeChange={() => list.current?.scrollToEnd({ animated: false })}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="interactive"
          ListEmptyComponent={<ZText variant="body" color={color.textMuted} style={styles.empty}>No comments yet. Ask a question or add a note about this expense.</ZText>}
          renderItem={({ item }) => {
            const mine = item.user_id === me;
            const member = data?.members.find((m) => m.user_id === item.user_id);
            const who = data ? memberName(data, item.user_id, me) : "Someone";
            return (
              <View style={[styles.row, mine ? styles.rowMine : null]} accessibilityLabel={`${who}, ${when(item.created_at)}: ${item.body}`}>
                {!mine ? <Avatar name={member?.display_name ?? "?"} uri={member?.photo_url} size={26} /> : null}
                <View style={styles.bubbleWrap}>
                  <View style={[styles.bubble, mine ? styles.bubbleMine : styles.bubbleOther]}>
                    <ZText variant="body">{item.body}</ZText>
                  </View>
                  <ZText variant="small" color={color.textMuted} style={mine ? styles.metaMine : null}>{who} · {when(item.created_at)}</ZText>
                </View>
              </View>
            );
          }}
        />
        {error ? <ZText variant="small" color={color.error} style={styles.error}>{error}</ZText> : null}
        <View style={[styles.composer, { paddingBottom: insets.bottom + space[12] }]}>
          <Input
            placeholder="Add a comment"
            value={body}
            onChangeText={(v) => setBody(v.slice(0, 1000))}
            onSubmitEditing={send}
            returnKeyType="send"
            blurOnSubmit={false}
            style={styles.flex}
            accessibilityLabel="Add a comment"
          />
          <IconButton name="send" label="Send" onPress={send} disabled={!canSend} style={canSend ? styles.sendOn : styles.sendOff} />
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  flex: { flex: 1 },
  head: { paddingHorizontal: layout.textGutter, gap: space[4], paddingBottom: space[8] },
  list: { paddingHorizontal: layout.screenGutter, paddingVertical: space[12], gap: space[12], flexGrow: 1 },
  empty: { textAlign: "center", paddingTop: space[40], paddingHorizontal: layout.textGutter },
  row: { flexDirection: "row", alignItems: "flex-end", gap: space[8] },
  rowMine: { justifyContent: "flex-end" },
  bubbleWrap: { maxWidth: "80%", gap: space[2] },
  bubble: { paddingHorizontal: 14, paddingVertical: 10 },
  bubbleOther: { backgroundColor: palette.white, borderTopLeftRadius: radius.bubble.tl, borderTopRightRadius: radius.bubble.tr, borderBottomRightRadius: radius.bubble.br, borderBottomLeftRadius: radius.bubble.bl, ...shadow.hairline },
  bubbleMine: { backgroundColor: color.surfaceInset, borderTopLeftRadius: radius.bubble.tl, borderTopRightRadius: radius.bubble.tr, borderBottomRightRadius: radius.bubble.bl, borderBottomLeftRadius: radius.bubble.br },
  metaMine: { textAlign: "right" },
  error: { paddingHorizontal: layout.textGutter, paddingBottom: space[4] },
  composer: { flexDirection: "row", alignItems: "center", gap: space[8], paddingHorizontal: layout.screenGutter, paddingTop: space[8] },
  sendOn: { backgroundColor: palette.ink },
  sendOff: { opacity: 0.5 },
});
