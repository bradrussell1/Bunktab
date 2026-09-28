"use client";
import { useRouter } from "next/navigation";
import { PhoneVerify } from "./PhoneVerify";
import { supabaseBrowser } from "@/lib/supabase/browser";

/** Signed-out visitor on a trip URL: verify, pick up any invites for this number, then reload. */
export function TripGate() {
  const router = useRouter();
  return <PhoneVerify title="Sign in to see this trip" body="Verify the phone number the invite was sent to." onDone={async () => { await supabaseBrowser().rpc("accept_invites_for_me", { p_via: "web" }); router.refresh(); }} />;
}
