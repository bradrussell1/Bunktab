/**
 * Manual nudges (feedback round 1): the dazzle creator taps Nudge next to a member who
 * hasn't tapped Done. The database writes one notification_log row per person per UTC
 * day under this dedupe key (send_nudge RPC) and pushes to their devices. These helpers
 * mirror the SQL so the app can tell "sent" from "already nudged today" without a round
 * trip, and so the key format is tested in one place.
 */

/** YYYY-MM-DD in UTC, the same day the database uses. */
export function utcDay(at: Date): string {
  return at.toISOString().slice(0, 10);
}

/** `nudge:<trip>:<user>:<YYYY-MM-DD>` — unique per person per day. */
export function nudgeDedupeKey(tripId: string, userId: string, at: Date = new Date()): string {
  return `nudge:${tripId}:${userId}:${utcDay(at)}`;
}

/** Given the keys already written today (from notification_log), who can still be nudged? */
export function nudgeable<T extends { user_id: string; done_at: string | null; removed_at?: string | null }>(members: T[], tripId: string, sentKeys: Iterable<string>, me: string, at: Date = new Date()): { member: T; sentToday: boolean }[] {
  const sent = new Set(sentKeys);
  return members
    .filter((m) => !m.done_at && !m.removed_at && m.user_id !== me)
    .map((m) => ({ member: m, sentToday: sent.has(nudgeDedupeKey(tripId, m.user_id, at)) }));
}

/** The push / toast copy: "psst, add your receipts to Tahoe weekend". */
export function nudgeBody(tripTitle: string): string {
  return `psst, add your receipts to ${tripTitle}`;
}
