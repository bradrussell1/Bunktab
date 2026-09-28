import { InviteAccept } from "@/components/InviteAccept";
import { supabaseServer } from "@/lib/supabase/server";

export const metadata = { title: "You're invited" };
export const dynamic = "force-dynamic";

export default async function InvitePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const sb = await supabaseServer();
  const { data } = await sb.auth.getUser();
  return <main className="col"><InviteAccept token={token} signedIn={!!data.user} /></main>;
}
