"use client";
import { useState } from "react";
import { supabaseBrowser } from "@/lib/supabase/browser";

/**
 * Phone + one-time code, then a display name if the profile has none
 * (spec: Web guest view → guests verify with their phone number and a text
 * code; Security → web guests verify before seeing any trip data).
 */
export function toE164(raw: string): string | null {
  const digits = raw.replace(/\D/g, "");
  if (raw.trim().startsWith("+") && digits.length >= 8 && digits.length <= 15) return `+${digits}`;
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`;
  return null;
}

export function PhoneVerify({ title, body, onDone }: { title: string; body?: string; onDone: () => void | Promise<void> }) {
  const [step, setStep] = useState<"phone" | "code" | "name">("phone");
  const [phone, setPhone] = useState("");
  const [e164, setE164] = useState("");
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function sendCode(e: React.FormEvent) {
    e.preventDefault();
    const p = toE164(phone);
    if (!p) return setError("Enter a phone number with area code.");
    setBusy(true); setError(null);
    const { error: err } = await supabaseBrowser().auth.signInWithOtp({ phone: p });
    setBusy(false);
    if (err) return setError(err.message);
    setE164(p); setStep("code");
  }
  async function verify(e: React.FormEvent) {
    e.preventDefault();
    if (code.trim().length < 6) return setError("Enter the 6-digit code.");
    setBusy(true); setError(null);
    const sb = supabaseBrowser();
    const { data, error: err } = await sb.auth.verifyOtp({ phone: e164, token: code.trim(), type: "sms" });
    if (err || !data.user) { setBusy(false); return setError(err?.message ?? "That code didn't work."); }
    const { data: profile } = await sb.from("users").select("display_name").eq("id", data.user.id).maybeSingle();
    setBusy(false);
    if (!profile?.display_name) return setStep("name");
    await onDone();
  }
  async function saveName(e: React.FormEvent) {
    e.preventDefault();
    if (name.trim().length < 2) return setError("Enter the name your friends know you by.");
    setBusy(true); setError(null);
    const sb = supabaseBrowser();
    const { data: u } = await sb.auth.getUser();
    const { error: err } = await sb.from("users").update({ display_name: name.trim() }).eq("id", u.user!.id);
    setBusy(false);
    if (err) return setError(err.message);
    await onDone();
  }

  return (
    <div className="stack" style={{ gap: 20, paddingTop: 32 }}>
      <div className="stack" style={{ gap: 8 }}>
        <h1 className="h-large">{title}</h1>
        {body && <p className="t-body t-muted">{body}</p>}
      </div>
      {step === "phone" && (
        <form className="stack" onSubmit={sendCode}>
          <div className="field"><label htmlFor="phone">Phone number</label><input id="phone" className="input" type="tel" inputMode="tel" autoComplete="tel" placeholder="(555) 555-0100" value={phone} onChange={(e) => setPhone(e.target.value)} autoFocus /></div>
          <p className="help">We text a 6-digit code. Standard rates apply. Your number is only used to sign you in and match your invites.</p>
          {error && <p className="err">{error}</p>}
          <button className="btn primary" type="submit" disabled={busy}>{busy ? "Sending…" : "Text me a code"}</button>
        </form>
      )}
      {step === "code" && (
        <form className="stack" onSubmit={verify}>
          <div className="field"><label htmlFor="code">Code sent to {e164}</label><input id="code" className="input" inputMode="numeric" autoComplete="one-time-code" placeholder="123456" maxLength={6} value={code} onChange={(e) => setCode(e.target.value)} autoFocus /></div>
          {error && <p className="err">{error}</p>}
          <button className="btn primary" type="submit" disabled={busy}>{busy ? "Checking…" : "Verify"}</button>
          <button className="btn text" type="button" onClick={() => { setStep("phone"); setCode(""); setError(null); }}>Use a different number</button>
        </form>
      )}
      {step === "name" && (
        <form className="stack" onSubmit={saveName}>
          <div className="field"><label htmlFor="name">Your name</label><input id="name" className="input" autoComplete="name" placeholder="Jordan" value={name} onChange={(e) => setName(e.target.value)} autoFocus /></div>
          <p className="help">How your trip mates will see you.</p>
          {error && <p className="err">{error}</p>}
          <button className="btn primary" type="submit" disabled={busy}>{busy ? "Saving…" : "Continue"}</button>
        </form>
      )}
    </div>
  );
}
