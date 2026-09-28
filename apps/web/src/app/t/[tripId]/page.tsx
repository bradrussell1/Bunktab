import { TripGate } from "@/components/TripGate";
import { TripView } from "@/components/TripView";
import { supabaseServer } from "@/lib/supabase/server";

export const metadata = { title: "Trip" };
export const dynamic = "force-dynamic";

export default async function TripPage({ params }: { params: Promise<{ tripId: string }> }) {
  const { tripId } = await params;
  const sb = await supabaseServer();
  const { data } = await sb.auth.getUser();
  if (!data.user) return <TripGate />;
  return <TripView tripId={tripId} me={data.user.id} />;
}
