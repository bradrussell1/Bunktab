import { formatCents, formatDateRange } from "@bunktab/core";
import { theme } from "@bunktab/theme";
import { useLocalSearchParams, useRouter } from "expo-router";
import * as Sharing from "expo-sharing";
import React, { useEffect, useRef, useState } from "react";
import { ActivityIndicator, Image, Share, View } from "react-native";
import ViewShot from "react-native-view-shot";
import { Button, Divider, Hero, HeroText, Screen, Text } from "@/components/ui";
import { useAuth } from "@/lib/auth";
import { useSignedUrl } from "@/lib/media";
import { biggestExpense, frontedMost, topCategory } from "@/lib/tripExtras";
import { activeMembers, memberName, tripTotal, useTrip } from "@/lib/trips";

/**
 * Trip recap (spec: Screens → Trip recap): shown once a trip is settled and
 * kept on the archived trip. Cover photo, dates, total, cost per person,
 * biggest expense, top category, who fronted the most, and Share, which
 * exports the card as an image (view-shot → the system share sheet).
 */
export default function RecapScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { session } = useAuth();
  const me = session!.user.id;
  const { data, loading } = useTrip(id);
  const coverUrl = useSignedUrl("covers", data?.trip.cover_photo_url);
  const shot = useRef<React.ElementRef<typeof ViewShot>>(null);
  const [sharing, setSharing] = useState(false);

  const openTrip = !!data && data.trip.status === "open";
  useEffect(() => { if (openTrip && data) router.replace(`/(app)/trip/${data.trip.id}`); }, [openTrip, data, router]);
  if (loading || !data || openTrip) return <Screen><View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}><ActivityIndicator /></View></Screen>;
  const { trip } = data;
  const cur = trip.base_currency;
  const members = activeMembers(data);
  const total = tripTotal(data);
  const big = biggestExpense(data), top = topCategory(data), fronted = frontedMost(data);
  const nameOf = (uid: string) => { const n = memberName(data, uid, me); return n === "You" ? (data.members.find((m) => m.user_id === me)?.display_name ?? "You") : n; };

  async function share() {
    setSharing(true);
    try {
      const uri = await shot.current?.capture?.();
      if (uri && (await Sharing.isAvailableAsync())) await Sharing.shareAsync(uri, { mimeType: "image/png", dialogTitle: `${trip.title} recap` });
      else await Share.share({ message: `${trip.title} (${formatDateRange(trip.start_date, trip.end_date)}): ${formatCents(total, cur)} total across ${members.length} people. Settled with Bunktab.` });
    } catch { /* user dismissed the sheet */ }
    setSharing(false);
  }

  return (
    <Screen>
      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingVertical: theme.spacing.sm }}>
        <Button title="‹ Trip" kind="text" size="small" onPress={() => router.back()} />
        <Text variant="title2">Recap</Text>
        <View style={{ width: 60 }} />
      </View>
      <View style={{ gap: theme.spacing.lg }}>
        <ViewShot ref={shot} options={{ format: "png", quality: 1 }} style={{ backgroundColor: theme.colors.background.main, borderRadius: theme.radius.hero }}>
          <Hero style={{ padding: 0 }}>
            {coverUrl
              ? <Image source={{ uri: coverUrl }} style={{ width: "100%", height: 180 }} resizeMode="cover" accessibilityIgnoresInvertColors />
              : <View style={{ paddingHorizontal: theme.spacing.xl, paddingTop: theme.spacing.xl }}><HeroText variant="captionCaps2" tone="mint">Bunktab</HeroText></View>}
            <View style={{ padding: theme.spacing.xl, gap: theme.spacing.md }}>
              <View style={{ gap: 2 }}>
                <HeroText variant="largeTitle">{trip.title}</HeroText>
                <HeroText variant="caption1" tone="mid">{formatDateRange(trip.start_date, trip.end_date)} · {members.length} {members.length === 1 ? "person" : "people"}</HeroText>
              </View>
              <View><HeroText variant="captionCaps2" tone="mid">Trip total</HeroText><HeroText variant="largeTitle">{formatCents(total, cur)}</HeroText></View>
              <Divider onHero />
              <Stat label="Biggest expense" value={big ? `${big.description} · ${formatCents(big.base_amount_cents, cur)}` : "—"} />
              <Stat label="Top category" value={top ? `${top.label} · ${formatCents(top.cents, cur)}` : "—"} />
              <Stat label="Fronted the most" value={fronted ? `${nameOf(fronted.user_id)} · ${formatCents(fronted.cents, cur)}` : "—"} dusk />
              <HeroText variant="caption3" tone="mid">{trip.status === "settled" ? "Settled · " : trip.status === "archived" ? "Archived · " : ""}split with Bunktab</HeroText>
            </View>
          </Hero>
        </ViewShot>
        <Button title="Share recap" onPress={share} loading={sharing} />
      </View>
    </Screen>
  );
}

function Stat({ label, value, dusk }: { label: string; value: string; dusk?: boolean }) {
  return (
    <View style={{ gap: 2 }}>
      <HeroText variant="captionCaps2" tone="mid">{label}</HeroText>
      <HeroText variant={dusk ? "text" : "headline"} tone={dusk ? "mint" : "ink"}>{value}</HeroText>
    </View>
  );
}
