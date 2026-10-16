"use client";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { PhoneVerify } from "./PhoneVerify";
import { ZebraBust } from "./Zebra";
import { supabaseBrowser } from "@/lib/supabase/browser";

/**
 * Invite landing (spec: Invite links and web guests). Trip data is hidden
 * until the phone is verified, so we can't show the title first; after
 * verification accept_invite_token adds the member (it checks the invite
 * was sent to this number) and we land on the dazzle. RPCs unchanged.
 */
export function InviteAccept({ token, signedIn }: { token: string; signedIn: boolean }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(signedIn);

  async function accept() {
    setBusy(true); setError(null);
    const sb = supabaseBrowser();
    const { data, error: err } = await sb.rpc("accept_invite_token", { p_token: token, p_via: "web" });
    if (err) {
      // already a member via a phone-matched invite? try that path before giving up
      await sb.rpc("accept_invites_for_me", { p_via: "web" });
      setBusy(false);
      setError(err.message.includes("different number") ? "This invite was sent to a different phone number. Sign in with the number that got the text, or ask the organizer to invite this one."
        : err.message.includes("expired") || err.message.includes("not found") ? "This invite link has expired or was already used. Ask the organizer for a new one."
        : err.message);
      return;
    }
    router.replace(`/t/${data as string}`); router.refresh();
  }
  useEffect(() => { if (signedIn) accept(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [signedIn]);

  if (signedIn || busy || error) return (
    <div className="stack col-text" style={{ paddingTop: "var(--zs-space-40)" }}>
      <ZebraBust mood={error ? "worried" : "wink"} size={88} label={error ? "Zebra, worried" : "Zebra, winking"} />
      <h1 className="t-title2">{error ? "Couldn't open this invite" : "Opening your invite…"}</h1>
      {error && <div className="error-panel"><span>{error}</span></div>}
      {error && <button className="btn secondary" type="button" onClick={async () => { await supabaseBrowser().auth.signOut(); setError(null); setBusy(false); router.refresh(); }}>Sign in with a different number</button>}
    </div>
  );
  return <PhoneVerify title="You're invited to a Dazzle" body="Verify your phone number to open it. No app needed; you can add expenses and tap Done right here." onDone={accept} />;
}
