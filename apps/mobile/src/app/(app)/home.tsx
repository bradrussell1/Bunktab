import { formatCents, formatDateRange, zebraMoodFor, type ZebraMood } from "@bunktab/core";
import { color, layout, radius, size, space } from "@bunktab/theme";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { FlatList, Image, RefreshControl, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { AmountPill, Button, Card, CountUp, Icon, IconButton, Input, InsetPanel, HeroCard, Money, ScreenBackground, SegmentedControl, StripeMeter, TopBar, Zebra, ZText, useToast } from "@/ui";
import { useAuth } from "@/lib/auth";
import { useSignedUrl } from "@/lib/media";
import { supabase } from "@/lib/supabase";
import { sortMembers } from "@/lib/trips";

/**
 * Home: Your dazzles (RESKIN_PROMPT B2, board `Main`). Wordmark top bar with search
 * and profile; the balance HeroCard (net across open dazzles, zebra bust in the
 * corner); "Your dazzles" with Open / Past; one Card per dazzle with its stripe
 * meter; "Start a dazzle" pinned at the bottom beside "Join with a link".
 * Balances are computed here from the same rows the dazzle page uses (base cents,
 * paid minus share), so the two screens can never disagree. Reloads whenever the
 * screen regains focus, so a dazzle created or edited elsewhere shows at once.
 */
type MemberRow = { user_id: string; role: "owner" | "member"; joined_at: string | null; done_at: string | null; display_name: string | null; photo_url: string | null };
type TripRow = { id: string; title: string; status: "open" | "settled" | "archived"; start_date: string; end_date: string; base_currency: string; cover_photo_url: string | null; last_activity_at: string; members: MemberRow[]; net_cents: number };

export default function HomeScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { show } = useToast();
  const { session } = useAuth();
  const me = session!.user.id;
  const params = useLocalSearchParams<{ tab?: "open" | "past" }>();
  const [tab, setTab] = useState<"open" | "past">(params.tab === "past" ? "past" : "open");
  useEffect(() => { if (params.tab === "open" || params.tab === "past") setTab(params.tab); }, [params.tab]); // a link can open either tab
  const [searching, setSearching] = useState(false);
  const [query, setQuery] = useState("");
  const [trips, setTrips] = useState<TripRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [footerH, setFooterH] = useState(size.ctaHeight + layout.bottomCtaPadding);

  const load = useCallback(async () => {
    const [t, m, e] = await Promise.all([
      supabase.from("trips").select("id, title, status, start_date, end_date, base_currency, cover_photo_url, last_activity_at").order("last_activity_at", { ascending: false }),
      // done_at is read here only for the stripe meter ("3 of 6 stripes"); nothing on Home writes it
      supabase.from("trip_members").select("trip_id, user_id, role, joined_at, done_at, users(display_name, photo_url)").is("removed_at", null),
      supabase.from("expenses").select("trip_id, expense_payers(user_id, base_amount_cents), expense_shares(user_id, base_share_cents)").is("deleted_at", null),
    ]);
    type M = { trip_id: string; user_id: string; role: "owner" | "member"; joined_at: string | null; done_at: string | null; users: { display_name: string | null; photo_url: string | null } | null };
    type E = { trip_id: string; expense_payers: { user_id: string; base_amount_cents: number }[]; expense_shares: { user_id: string; base_share_cents: number }[] };
    const membersBy = new Map<string, MemberRow[]>();
    for (const r of (m.data ?? []) as unknown as M[]) membersBy.set(r.trip_id, [...(membersBy.get(r.trip_id) ?? []), { user_id: r.user_id, role: r.role, joined_at: r.joined_at, done_at: r.done_at, display_name: r.users?.display_name ?? null, photo_url: r.users?.photo_url ?? null }]);
    const netBy = new Map<string, number>();
    for (const x of (e.data ?? []) as unknown as E[]) {
      const paid = x.expense_payers.filter((p) => p.user_id === me).reduce((s, p) => s + p.base_amount_cents, 0);
      const share = x.expense_shares.filter((p) => p.user_id === me).reduce((s, p) => s + p.base_share_cents, 0);
      netBy.set(x.trip_id, (netBy.get(x.trip_id) ?? 0) + paid - share);
    }
    setTrips(((t.data ?? []) as Omit<TripRow, "members" | "net_cents">[]).map((r) => ({ ...r, members: sortMembers(membersBy.get(r.id) ?? []), net_cents: netBy.get(r.id) ?? 0 })));
    setLoading(false);
  }, [me]);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  const open = useMemo(() => trips.filter((t) => t.status === "open"), [trips]);
  // one figure per currency: the hero shows the currency with the most open dazzles (ties → USD), the rest as captions
  const position = useMemo(() => {
    const by = new Map<string, { net: number; n: number }>();
    for (const t of open) { const c = by.get(t.base_currency) ?? { net: 0, n: 0 }; by.set(t.base_currency, { net: c.net + t.net_cents, n: c.n + 1 }); }
    const rows = [...by.entries()].map(([currency, v]) => ({ currency, ...v })).sort((a, b) => b.n - a.n || (a.currency === "USD" ? -1 : b.currency === "USD" ? 1 : a.currency.localeCompare(b.currency)));
    return { main: rows[0] ?? null, others: rows.slice(1) };
  }, [open]);
  const overall = position.main?.net ?? 0;
  const heroMood = zebraMoodFor({ place: "home-hero", netCents: overall, openDazzles: open.length }) ?? "hi";

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return trips
      .filter((t) => (tab === "open" ? t.status === "open" : t.status !== "open"))
      .filter((t) => !q || t.title.toLowerCase().includes(q) || t.members.some((mm) => (mm.display_name ?? "").toLowerCase().includes(q)));
  }, [trips, tab, query]);

  function toggleSearch() {
    if (searching) setQuery("");
    setSearching((s) => !s);
  }
  function joinWithLink() {
    // There is no in-app join screen: invites arrive as links that open the dazzle directly.
    show({ message: "Open the invite link you were sent and you'll land in the dazzle.", bust: <Zebra variant="bust" mood="wink" size={28} decorative /> });
  }

  const header = loading ? null : (
    <View style={styles.header}>
      <HeroCard style={styles.hero}>
        <View style={styles.heroText}>
          <ZText variant="caption" color={color.textMuted}>
            {open.length === 0 ? "Nothing open right now" : `Across ${open.length} ${open.length === 1 ? "dazzle" : "dazzles"}`}
          </ZText>
          {position.main && position.main.currency !== "USD"
            ? <Money variant="display" cents={Math.abs(overall)} currency={`${position.main.currency} `} />
            : <CountUp cents={Math.abs(overall)} />}
          {overall !== 0 ? <LabelPill tone={overall > 0 ? "volt" : "blush"} label={overall > 0 ? "owed to you" : "you owe"} /> : null}
          {position.others.map((o) => (
            <ZText key={o.currency} variant="caption" color={color.textMuted}>
              {o.net === 0 ? `Even across ${o.n} ${o.n === 1 ? "dazzle" : "dazzles"} in ${o.currency}` : `${formatCents(Math.abs(o.net), o.currency)} ${o.net > 0 ? "owed to you" : "you owe"} across ${o.n} ${o.n === 1 ? "dazzle" : "dazzles"} in ${o.currency}`}
            </ZText>
          ))}
        </View>
        <View style={styles.heroZebra}>
          <Zebra variant="bust" mood={heroMood} size={112} animate={{ bob: true }} accessibilityLabel={`Zebra, ${heroMood}`} />
        </View>
      </HeroCard>
      <View style={styles.titleRow}>
        <ZText variant="title2" accessibilityRole="header">Your dazzles</ZText>
        <SegmentedControl options={[{ key: "open", label: "Open" }, { key: "past", label: "Past" }]} value={tab} onChange={setTab} style={styles.segment} />
      </View>
    </View>
  );

  const empty = loading ? null : query.trim() ? (
    <Empty mood="worried" size={64} title="No dazzles match" body="Try a dazzle title or someone's name." />
  ) : tab === "open" ? (
    <Empty mood={zebraMoodFor({ place: "empty", kind: "no-dazzles" }) ?? "hi"} title="Start your first dazzle" body="Invite the crew, log what you paid, and earn your stripes together." />
  ) : (
    <Empty mood={zebraMoodFor({ place: "empty", kind: "no-past" }) ?? "sleepy"} title="Nothing filed away yet" body="Settled dazzles, and ones that go quiet, land here." />
  );

  return (
    <View style={styles.screen}>
      <ScreenBackground />
      <TopBar
        wordmark
        right={
          <>
            <IconButton name={searching ? "close" : "search"} label={searching ? "Close search" : "Search dazzles"} onPress={toggleSearch} accessibilityState={{ expanded: searching }} />
            <IconButton name="person" label="Profile" onPress={() => router.push("/(app)/settings")} />
          </>
        }
      />
      {searching ? (
        <View style={styles.search}>
          <Input
            left={<Icon name="search" size={18} color={color.textMuted} />}
            placeholder="Search dazzles or people"
            value={query}
            onChangeText={setQuery}
            autoFocus
            autoCapitalize="none"
            autoCorrect={false}
            clearButtonMode="while-editing"
            returnKeyType="search"
            accessibilityLabel="Search dazzles by title or member name"
          />
        </View>
      ) : null}
      <FlatList
        data={shown}
        keyExtractor={(t) => t.id}
        refreshControl={<RefreshControl refreshing={loading && trips.length > 0} onRefresh={load} />}
        ListHeaderComponent={header}
        ItemSeparatorComponent={() => <View style={{ height: layout.listGap }} />}
        ListEmptyComponent={empty}
        renderItem={({ item }) => <DazzleCard trip={item} me={me} onPress={() => router.push(`/(app)/trip/${item.id}`)} />}
        contentContainerStyle={[styles.list, { paddingBottom: footerH + space[16] }]}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
      />
      <View onLayout={(e) => setFooterH(e.nativeEvent.layout.height + layout.bottomCtaPadding + insets.bottom)} style={[styles.footer, { bottom: layout.bottomCtaPadding + insets.bottom }]}>
        <Button label="Start a dazzle" icon="plus" style={styles.start} onPress={() => router.push("/(app)/trip/new")} />
        <IconButton name="link" label="Join with a link" size={size.ctaHeight} onPress={joinWithLink} />
      </View>
    </View>
  );
}

/** "owed to you" / "you owe" under the hero amount: volt or blush, 13/700. */
function LabelPill({ tone, label }: { tone: "volt" | "blush"; label: string }) {
  return (
    <View style={[styles.labelPill, { backgroundColor: tone === "volt" ? color.owedToYou : color.youOwe }]}>
      <ZText variant="captionStrong" color={tone === "volt" ? color.textOnVolt : color.youOweText}>{label}</ZText>
    </View>
  );
}

/** Drop the year from "Oct 9 – 14, 2026" when it's this year (the board's card caption). */
function shortRange(start: string, end: string) {
  return formatDateRange(start, end).replace(new RegExp(`, ${new Date().getFullYear()}$`), "");
}

function DazzleCard({ trip, me, onPress }: { trip: TripRow; me: string; onPress: () => void }) {
  const cover = useSignedUrl("covers", trip.cover_photo_url); // object path in the private bucket
  const settled = trip.status === "settled";
  const youOwe = !settled && trip.net_cents < 0;
  const done = trip.members.filter((m) => m.done_at).length;
  const notDone = trip.members.length - done;
  const cardMood = zebraMoodFor({ place: "home-card", youOwe });
  const caption = `${shortRange(trip.start_date, trip.end_date)} · ${trip.members.length} in the dazzle`;
  const status = settled ? "settled" : trip.net_cents > 0 ? `owed ${formatCents(trip.net_cents, trip.base_currency)}` : trip.net_cents < 0 ? `you owe ${formatCents(-trip.net_cents, trip.base_currency)}` : "even";
  const stillAdding = settled ? "Settled" : trip.status === "archived" ? "Archived" : notDone === 0 ? "Everyone's done" : cardMood ? "still adding" : `${notDone} still adding`;
  return (
    <Card onPress={onPress} accessibilityLabel={`${trip.title}, ${caption}, ${status}, ${done} of ${trip.members.length} done`}>
      <View style={styles.cardTop}>
        {cover ? <Image source={{ uri: cover }} style={styles.cover} accessibilityIgnoresInvertColors /> : null}
        <View style={styles.cardText}>
          <ZText variant="headline" numberOfLines={2}>{trip.title}</ZText>
          <ZText variant="caption" color={color.textMuted}>{caption}</ZText>
        </View>
        {!settled ? <AmountPill cents={trip.net_cents} hideZero /> : null}
      </View>
      <InsetPanel style={styles.inset}>
        <View style={styles.meterRow}>
          <StripeMeter members={trip.members.length} done={done} allInk={settled} />
          <View style={styles.adding}>
            <ZText variant="small" color={settled ? color.text : color.textMuted}>{stillAdding}</ZText>
            {cardMood ? <Zebra variant="bust" mood={cardMood} size={30} animate={{ blink: true }} decorative /> : null}
          </View>
        </View>
      </InsetPanel>
    </Card>
  );
}

function Empty({ mood, title, body, size: s = 120 }: { mood: ZebraMood; title: string; body: string; size?: number }) {
  return (
    <View style={styles.empty} accessibilityRole="summary">
      <Zebra variant="bust" mood={mood} size={s} animate={{ blink: true }} accessibilityLabel={`Zebra, ${mood}`} />
      <ZText variant="title2" style={styles.center}>{title}</ZText>
      <ZText variant="body" color={color.textMuted} style={styles.center}>{body}</ZText>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  search: { paddingHorizontal: layout.screenGutter, paddingBottom: space[12] },
  list: { paddingHorizontal: layout.screenGutter, flexGrow: 1 },
  header: { gap: space[16], paddingTop: space[4], paddingBottom: space[12] },
  hero: { minHeight: 172, justifyContent: "center" },
  heroText: { gap: space[8], alignItems: "flex-start", paddingRight: 112 },
  heroZebra: { position: "absolute", right: -2, bottom: -12 },
  labelPill: { borderRadius: radius.pill, paddingVertical: 5, paddingHorizontal: 11 },
  titleRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: layout.textGutter - layout.screenGutter, gap: space[12] },
  segment: { width: 150 },
  cardTop: { flexDirection: "row", alignItems: "center", gap: space[12] },
  cover: { width: 40, height: 40, borderRadius: radius.tile, backgroundColor: color.surfaceTile },
  cardText: { flex: 1, gap: 2 },
  inset: { marginTop: space[10] },
  meterRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: space[8] },
  adding: { flexDirection: "row", alignItems: "center", gap: space[6] },
  empty: { alignItems: "center", gap: space[8], paddingVertical: space[32], paddingHorizontal: layout.textGutter },
  center: { textAlign: "center" },
  footer: { position: "absolute", left: layout.screenGutter, right: layout.screenGutter, flexDirection: "row", alignItems: "center", gap: space[10] },
  start: { flex: 1 },
});
