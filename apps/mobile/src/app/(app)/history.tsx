import { layout, palette, space } from "@bunktab/theme";
import { useFocusEffect, useRouter } from "expo-router";
import { useCallback, useState } from "react";
import { ScrollView, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { TripHistoryList } from "@/components/TripHistoryList";
import { ScreenBackground, TopBar, ZText } from "@/ui";
import { useAuth } from "@/lib/auth";
import { loadTripSummaries, type TripSummary } from "@/lib/trips";

/** Dazzle history (user: its own CTA inside the Profile): every dazzle, tap → read-only dazzle page. */
export default function HistoryScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { session } = useAuth();
  const me = session!.user.id;
  const [trips, setTrips] = useState<TripSummary[]>([]);
  const [loading, setLoading] = useState(true);
  useFocusEffect(useCallback(() => { let live = true; loadTripSummaries(me).then((t) => { if (live) { setTrips(t); setLoading(false); } }); return () => { live = false; }; }, [me]));
  return (
    <View style={styles.screen}>
      <ScreenBackground />
      <TopBar onBack={() => router.back()} />
      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + space[32] }]} showsVerticalScrollIndicator={false}>
        <ZText variant="title1" accessibilityRole="header" style={styles.title}>Dazzle history</ZText>
        <TripHistoryList trips={trips} loading={loading} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: palette.bgMid },
  content: { paddingHorizontal: layout.screenGutter, gap: space[12] },
  title: { paddingHorizontal: space[4] },
});
