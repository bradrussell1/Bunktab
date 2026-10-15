import { formatCents, formatDateRange } from "@bunktab/core";
import { color, layout, palette, radius, shadow, space } from "@bunktab/theme";
import { useLocalSearchParams, useRouter } from "expo-router";
import * as Sharing from "expo-sharing";
import React, { useEffect, useRef, useState } from "react";
import { ActivityIndicator, Image, ScrollView, Share, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import ViewShot from "react-native-view-shot";
import { Button, InsetPanel, Money, ScreenBackground, StatusPill, TopBar, Wordmark, Zebra, ZText, useToast } from "@/ui";
import { useAuth } from "@/lib/auth";
import { useSignedUrl } from "@/lib/media";
import { biggestExpense, frontedMost, topCategory } from "@/lib/tripExtras";
import { activeMembers, memberName, tripTotal, useTrip } from "@/lib/trips";

/**
 * Dazzle recap (RESKIN_PROMPT B8; spec: Screens → Trip recap): shown once a dazzle is
 * settled and kept on the archived one. Black and white only (settled = no colour)
 * except the share button. One white card: wordmark + Settled pill, cover photo
 * (rounded 24), title, dates · people, the total with cost per person, the starry
 * zebra (sparkles, tail up, dances once on open) and three stat panels. "Share the
 * recap" exports that card as an image (view-shot → the system share sheet) and
 * confirms with a wink-bust toast.
 */
export default function RecapScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { session } = useAuth();
  const { show } = useToast();
  const me = session!.user.id;
  const { data, loading } = useTrip(id);
  const coverUrl = useSignedUrl("covers", data?.trip.cover_photo_url);
  const shot = useRef<React.ElementRef<typeof ViewShot>>(null);
  const [sharing, setSharing] = useState(false);

  const openTrip = !!data && data.trip.status === "open";
  useEffect(() => { if (openTrip && data) router.replace(`/(app)/trip/${data.trip.id}`); }, [openTrip, data, router]);
  if (loading || !data || openTrip) {
    return <View style={styles.screen}><ScreenBackground /><View style={styles.center}><ActivityIndicator /></View></View>;
  }
  const { trip } = data;
  const cur = trip.base_currency;
  const members = activeMembers(data);
  const total = tripTotal(data);
  const perPerson = members.length ? Math.round(total / members.length) : 0;
  const big = biggestExpense(data), top = topCategory(data), fronted = frontedMost(data);
  // the card is shared, so it names you rather than saying "You"
  const nameOf = (uid: string) => { const n = memberName(data, uid, me); return n === "You" ? (data.members.find((m) => m.user_id === me)?.display_name ?? "You") : n; };

  async function share() {
    setSharing(true);
    try {
      const uri = await shot.current?.capture?.();
      if (uri && (await Sharing.isAvailableAsync())) await Sharing.shareAsync(uri, { mimeType: "image/png", dialogTitle: `${trip.title} recap` });
      else await Share.share({ message: `${trip.title} (${formatDateRange(trip.start_date, trip.end_date)}): ${formatCents(total, cur)} total across ${members.length} people. Settled with Zebrasplit.` });
      show({ message: "Recap shared", bust: <Zebra variant="bust" mood="wink" size={28} decorative /> });
    } catch { /* user dismissed the sheet */ }
    setSharing(false);
  }

  return (
    <View style={styles.screen}>
      <ScreenBackground />
      <TopBar onBack={() => router.back()} />
      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 110 }]} showsVerticalScrollIndicator={false}>
        <ViewShot ref={shot} options={{ format: "png", quality: 1 }} style={styles.card}>
          <View style={styles.cardHead}>
            <Wordmark />
            <StatusPill label={trip.status === "settled" ? "Settled" : "Archived"} />
          </View>
          {coverUrl ? <Image source={{ uri: coverUrl }} style={styles.cover} resizeMode="cover" accessibilityIgnoresInvertColors accessibilityLabel="Cover photo" /> : null}
          <View style={styles.titleBlock}>
            <ZText variant="title1" accessibilityRole="header">{trip.title}</ZText>
            <ZText variant="caption" color={color.textSecondary}>{formatDateRange(trip.start_date, trip.end_date)} · {members.length} {members.length === 1 ? "person" : "people"}</ZText>
          </View>
          <View style={styles.totalRow}>
            <View style={styles.flex}>
              <ZText variant="small" color={color.textSecondary}>Dazzle total</ZText>
              <Money variant="amountL" cents={total} />
              <ZText variant="caption" color={color.textSecondary}>{formatCents(perPerson, cur)} a person</ZText>
            </View>
            <Zebra variant="full" mood="starry" members={members.length} done={members.length} size={132} tailUp animate={{ blink: true, swish: true, sparkles: true, dance: true }} accessibilityLabel="Zebra, starry, every stripe earned" />
          </View>
          <View style={styles.stats}>
            <Stat label="Biggest expense" value={big ? big.description : "—"} amount={big ? formatCents(big.base_amount_cents, cur) : undefined} />
            <Stat label="Top category" value={top ? top.label : "—"} amount={top ? formatCents(top.cents, cur) : undefined} />
            <Stat label="Fronted the most" value={fronted ? nameOf(fronted.user_id) : "—"} amount={fronted ? formatCents(fronted.cents, cur) : undefined} />
          </View>
          <ZText variant="small" color={color.textMuted} style={styles.foot}>We earned our stripes · split with Zebrasplit</ZText>
        </ViewShot>
      </ScrollView>
      <View style={[styles.footer, { paddingBottom: insets.bottom + layout.bottomCtaPadding }]}>
        <Button label="Share the recap" icon="share" onPress={share} loading={sharing} />
      </View>
    </View>
  );
}

function Stat({ label, value, amount }: { label: string; value: string; amount?: string }) {
  return (
    <InsetPanel style={styles.stat}>
      <View style={styles.flex}>
        <ZText variant="small" color={color.textMuted}>{label}</ZText>
        <ZText variant="bodyStrong" numberOfLines={1}>{value}</ZText>
      </View>
      {amount ? <ZText variant="amountRow" tabular>{amount}</ZText> : null}
    </InsetPanel>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: palette.bgMid },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  flex: { flex: 1 },
  content: { paddingHorizontal: layout.screenGutter, paddingTop: space[4] },
  card: { backgroundColor: palette.white, borderRadius: radius.hero, padding: layout.heroPadding, gap: space[14], ...shadow.hero },
  cardHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  cover: { width: "100%", aspectRatio: 16 / 9, borderRadius: radius.card, backgroundColor: color.surfaceTile },
  titleBlock: { gap: space[2] },
  totalRow: { flexDirection: "row", alignItems: "center", gap: space[8] },
  stats: { gap: space[8] },
  stat: { flexDirection: "row", alignItems: "center", gap: space[12], paddingVertical: 10, paddingHorizontal: 14 },
  foot: { textAlign: "center" },
  footer: { position: "absolute", left: 0, right: 0, bottom: 0, paddingHorizontal: layout.screenGutter, paddingTop: space[10] },
});
