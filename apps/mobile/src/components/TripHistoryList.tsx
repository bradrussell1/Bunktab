import { formatCents, formatDateRange } from "@checkm8/core";
import { theme } from "@checkm8/theme";
import { useRouter } from "expo-router";
import { View } from "react-native";
import { Card, Divider, EmptyState, ListItem, Text } from "@/components/ui";
import type { TripSummary } from "@/lib/trips";

/**
 * Trip history rows (spec: Home → Past trips; user: history lives in the
 * Profile). Every trip you've been part of, newest activity first; a row
 * opens the trip page read-only. Mint = you were owed, dusk = you owed.
 */
export function TripHistoryList({ trips, loading }: { trips: TripSummary[]; loading: boolean }) {
  const router = useRouter();
  if (!loading && trips.length === 0) return <EmptyState title="No trips yet" body="Trips you join or start show up here, open or settled." />;
  return (
    <Card style={{ padding: 0, overflow: "hidden" }}>
      {trips.map((t, i) => {
        const net = t.net_cents;
        const status = t.status === "open" ? null : t.status === "settled" ? "Settled" : "Archived";
        return (
          <View key={t.id}>
            {i > 0 && <Divider />}
            <ListItem
              title={t.title}
              subtitle={`${formatDateRange(t.start_date, t.end_date)} · ${t.expense_count} ${t.expense_count === 1 ? "expense" : "expenses"}${status ? ` · ${status}` : ""}`}
              right={<Text variant="caption1Semibold" color={net > 0 ? theme.colors.text.success : net < 0 ? theme.colors.text.destructive : theme.colors.text.onBackground.secondary}>{net === 0 ? (t.expense_count ? "Even" : "—") : net > 0 ? `+${formatCents(net, t.base_currency)}` : `−${formatCents(-net, t.base_currency)}`}</Text>}
              onPress={() => router.push(`/(app)/trip/${t.id}?readonly=1`)}
            />
          </View>
        );
      })}
    </Card>
  );
}
