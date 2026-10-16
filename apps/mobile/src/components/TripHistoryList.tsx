import { formatCents, formatDateRange } from "@bunktab/core";
import { color, layout, space } from "@bunktab/theme";
import { useRouter } from "expo-router";
import { StyleSheet, View } from "react-native";
import { AmountPill, Icon, RowCard, RowSkeleton, Zebra, ZText } from "@/ui";
import type { TripSummary } from "@/lib/trips";

/**
 * Dazzle history rows (spec: Home → Past trips; user: history lives in the Profile).
 * Every dazzle you've been part of, newest activity first; a row opens it read-only.
 * Volt = you were owed, blush = you owed, settled or even = no colour.
 */
export function TripHistoryList({ trips, loading }: { trips: TripSummary[]; loading: boolean }) {
  const router = useRouter();
  if (loading) return <View style={styles.list}>{[0, 1, 2].map((i) => <RowSkeleton key={i} />)}</View>;
  if (trips.length === 0) {
    return (
      <View style={styles.empty} accessibilityRole="summary">
        <Zebra variant="bust" mood="sleepy" size={96} animate={{ blink: true }} accessibilityLabel="Zebra, sleepy" />
        <ZText variant="headline">No Dazzles yet</ZText>
        <ZText variant="body" color={color.textMuted} style={styles.center}>Dazzles you join or start show up here, open or settled.</ZText>
      </View>
    );
  }
  return (
    <View style={styles.list}>
      {trips.map((t) => {
        const net = t.net_cents;
        const status = t.status === "open" ? null : t.status === "settled" ? "Settled" : "Archived";
        const caption = `${formatDateRange(t.start_date, t.end_date)} · ${t.expense_count} ${t.expense_count === 1 ? "expense" : "expenses"}${status ? ` · ${status}` : ""}`;
        const money = net === 0 ? (t.expense_count ? "Even" : "—") : net > 0 ? `owed ${formatCents(net, t.base_currency)}` : `you owed ${formatCents(-net, t.base_currency)}`;
        return (
          <RowCard
            key={t.id}
            title={t.title}
            caption={caption}
            right={
              <View style={styles.right}>
                {net !== 0 && t.status === "open" ? <AmountPill cents={net} /> : <ZText variant="captionStrong" color={net === 0 ? color.textMuted : color.text} tabular>{net === 0 ? money : (net > 0 ? "+" : "−") + formatCents(Math.abs(net), t.base_currency)}</ZText>}
                <Icon name="chevronRight" size={16} color={color.textMuted} />
              </View>
            }
            onPress={() => router.push(`/(app)/trip/${t.id}?readonly=1`)}
            accessibilityLabel={`${t.title}, ${caption}, ${money}`}
          />
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  list: { gap: layout.listGap },
  right: { flexDirection: "row", alignItems: "center", gap: space[6] },
  empty: { alignItems: "center", gap: space[8], paddingVertical: space[24], paddingHorizontal: layout.textGutter },
  center: { textAlign: "center" },
});
