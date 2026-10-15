import AsyncStorage from "@react-native-async-storage/async-storage";
import { supabase } from "./supabase";

/**
 * In-app surface for notifications (feedback round 1, items 7 and 13). The database
 * writes one notification_log row per push (notify()); a member can read their own rows
 * (notif_select). On the next open, Home shows the newest unseen nudge or invite as a
 * toast, then remembers the high-water mark on the device, so a nudge is never only a
 * push that was swiped away.
 */
const KEY = "zs.notifications.lastSeenId";
const SURFACED = ["nudge.manual", "nudge.inactive", "trip.invited", "closeout.forced"];

export type InAppNotification = { id: number; kind: string; trip_id: string | null; title: string; body: string; sent_at: string };

export async function fetchUnseenNotifications(): Promise<InAppNotification[]> {
  const lastSeen = Number((await AsyncStorage.getItem(KEY).catch(() => null)) ?? 0);
  const { data } = await supabase
    .from("notification_log")
    .select("id, kind, trip_id, payload, sent_at")
    .in("kind", SURFACED)
    .gt("id", lastSeen)
    .order("id", { ascending: false })
    .limit(5);
  type Row = { id: number; kind: string; trip_id: string | null; payload: { title?: string; body?: string } | null; sent_at: string };
  const rows = ((data ?? []) as Row[]).filter((r) => r.payload?.body);
  if (lastSeen === 0 && rows.length) {
    // first run on this device: don't replay history, just set the mark
    await AsyncStorage.setItem(KEY, String(rows[0]!.id)).catch(() => undefined);
    return [];
  }
  return rows.map((r) => ({ id: r.id, kind: r.kind, trip_id: r.trip_id, title: r.payload?.title ?? "Zebrasplit", body: r.payload!.body!, sent_at: r.sent_at }));
}

export async function markNotificationsSeen(upToId: number): Promise<void> {
  await AsyncStorage.setItem(KEY, String(upToId)).catch(() => undefined);
}
