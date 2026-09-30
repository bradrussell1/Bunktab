import { supabase } from "./supabase";

/**
 * A person you can invite: a phone contact or a Checkm8 friend. Friends are
 * people you have shared a trip with who have an account (users visible
 * under row-level security through shared trips); random numbers you once
 * invited don't count.
 */
export type Person = {
  id: string;            // user id for friends, E.164 for contacts
  name: string;
  phone: string | null;  // E.164 with "+", null when unknown
  subtitle?: string;
  photo?: string | null;
  kind: "friend" | "contact";
};

export async function fetchFriends(me: string): Promise<Person[]> {
  const { data, error } = await supabase
    .from("trip_members")
    .select("user_id, removed_at, users(display_name, phone, photo_url, venmo_username, deleted_at)")
    .is("removed_at", null);
  if (error) throw error;
  type Row = { user_id: string; users: { display_name: string | null; phone: string | null; photo_url: string | null; venmo_username: string | null; deleted_at: string | null } | null };
  const seen = new Map<string, Person>();
  for (const r of (data ?? []) as unknown as Row[]) {
    if (r.user_id === me || !r.users?.display_name || r.users.deleted_at || seen.has(r.user_id)) continue;
    seen.set(r.user_id, {
      id: r.user_id,
      name: r.users.display_name,
      phone: r.users.phone ? `+${r.users.phone.replace(/^\+/, "")}` : null,
      subtitle: r.users.venmo_username ? `On Checkm8 · @${r.users.venmo_username}` : "On Checkm8",
      photo: r.users.photo_url,
      kind: "friend",
    });
  }
  return [...seen.values()].sort((a, b) => a.name.localeCompare(b.name));
}
