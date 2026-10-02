import { theme } from "@bunktab/theme";
import { useFocusEffect, useRouter } from "expo-router";
import { useCallback, useState } from "react";
import { ActivityIndicator, ScrollView, View } from "react-native";
import { TripHistoryList } from "@/components/TripHistoryList";
import { Button, Screen, Text } from "@/components/ui";
import { useAuth } from "@/lib/auth";
import { loadTripSummaries, type TripSummary } from "@/lib/trips";

/** Trip history (user: its own CTA inside the Profile): all trips, tap → read-only trip page. */
export default function HistoryScreen() {
  const router = useRouter();
  const { session } = useAuth();
  const me = session!.user.id;
  const [trips, setTrips] = useState<TripSummary[]>([]);
  const [loading, setLoading] = useState(true);
  useFocusEffect(useCallback(() => { let live = true; loadTripSummaries(me).then((t) => { if (live) { setTrips(t); setLoading(false); } }); return () => { live = false; }; }, [me]));
  return (
    <Screen>
      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingVertical: theme.spacing.sm }}>
        <Button title="‹ Profile" kind="text" size="small" onPress={() => router.back()} />
        <Text variant="title2">Trip history</Text>
        <View style={{ width: 70 }} />
      </View>
      <ScrollView contentContainerStyle={{ gap: theme.spacing.lg, paddingBottom: 40 }}>
        {loading ? <ActivityIndicator style={{ marginTop: 40 }} /> : <TripHistoryList trips={trips} loading={loading} />}
      </ScrollView>
    </Screen>
  );
}
