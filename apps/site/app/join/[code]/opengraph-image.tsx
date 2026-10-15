import { defaultOg, inviteOg, OG_SIZE } from "@/lib/og";
import { getInvitePreview } from "@/lib/invite";

export const alt = "You're invited to a dazzle on Zebrasplit";
export const size = OG_SIZE;
export const contentType = "image/png";

export default async function Image({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const inv = await getInvitePreview(code);
  if (inv.state === "invalid" || !inv.trip) return defaultOg();
  return inviteOg({ inviter: inv.inviter ?? "A friend", trip: inv.trip.name, members: inv.memberCount, done: inv.doneCount });
}
