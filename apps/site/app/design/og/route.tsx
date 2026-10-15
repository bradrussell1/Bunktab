import { inviteOg } from "@/lib/og";

/** Review-only (under /design, noindex): the invite OG with sample data; ?long=1 for a long trip name. */
export const dynamic = "force-dynamic";
export async function GET(req: Request) {
  const long = new URL(req.url).searchParams.get("long");
  return inviteOg(long ? { inviter: "Alexandria", trip: "Grandma's 80th birthday extravaganza in Lake Tahoe 2026", members: 9, done: 4 } : { inviter: "Jen", trip: "Cabo 2026", members: 6, done: 4 });
}
