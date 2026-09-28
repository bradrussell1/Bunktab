import { ExpenseForm } from "@/components/ExpenseForm";
import { TripGate } from "@/components/TripGate";
import { supabaseServer } from "@/lib/supabase/server";

export const metadata = { title: "Expense" };
export const dynamic = "force-dynamic";

export default async function ExpensePage({ params }: { params: Promise<{ tripId: string; id?: string[] }> }) {
  const { tripId, id } = await params;
  const sb = await supabaseServer();
  const { data } = await sb.auth.getUser();
  if (!data.user) return <TripGate />;
  return <ExpenseForm tripId={tripId} expenseId={id?.[0]} me={data.user.id} />;
}
