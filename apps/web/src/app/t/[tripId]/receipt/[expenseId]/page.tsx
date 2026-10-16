import { ReceiptSummary } from "@/components/ReceiptSummary";
import { TripGate } from "@/components/TripGate";
import { supabaseServer } from "@/lib/supabase/server";

export const metadata = { title: "Receipt" };
export const dynamic = "force-dynamic";

export default async function ReceiptPage({ params }: { params: Promise<{ tripId: string; expenseId: string }> }) {
  const { tripId, expenseId } = await params;
  const sb = await supabaseServer();
  const { data } = await sb.auth.getUser();
  if (!data.user) return <TripGate />;
  return <ReceiptSummary tripId={tripId} expenseId={expenseId} me={data.user.id} />;
}
