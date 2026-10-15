"use client";
import { useRef, useState } from "react";
import { supabaseBrowser } from "@/lib/supabase/browser";
import { ZebraBust } from "./Zebra";

/**
 * Phone + one-time code, then a display name if the profile has none
 * (spec: Web guest view → guests verify with their phone number and a text
 * code; Security → web guests verify before seeing any trip data). Surfaces per
 * ticket B1/B9: pill input, six 48 px code cells with auto-advance, worried bust
 * beside an error. Auth calls are unchanged.
 */
export function toE164(raw: string): string | null {
  const digits = raw.replace(/\D/g, "");
  if (raw.trim().startsWith("+") && digits.length >= 8 && digits.length <= 15) return `+${digits}`;
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`;
  return null;
}

function ErrorLine({ text }: { text: string }) {
  return (
    <div className="row" style={{ gap: "var(--zs-space-8)" }} role="alert">
      <ZebraBust mood="worried" size={30} decorative />
      <p className="err">{text}</p>
    </div>
  );
}

export function PhoneVerify({ title, body, onDone }: { title: string; body?: string; onDone: () => void | Promise<void> }) {
  const [step, setStep] = useState<"phone" | "code" | "name">("phone");
  const [phone, setPhone] = useState("");
  const [e164, setE164] = useState("");
  const [cells, setCells] = useState<string[]>(["", "", "", "", "", ""]);
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const refs = useRef<(HTMLInputElement | null)[]>([]);
  const code = cells.join("");

  async function sendCode(e: React.FormEvent) {
    e.preventDefault();
    const p = toE164(phone);
    if (!p) return setError("Enter a phone number with area code.");
    setBusy(true); setError(null);
    const { error: err } = await supabaseBrowser().auth.signInWithOtp({ phone: p });
    setBusy(false);
    if (err) return setError(err.message);
    setE164(p); setStep("code");
    setTimeout(() => refs.current[0]?.focus(), 50);
  }
  async function verify(e?: React.FormEvent, token = code) {
    e?.preventDefault();
    if (token.trim().length < 6) return setError("Enter the 6-digit code.");
    setBusy(true); setError(null);
    const sb = supabaseBrowser();
    const { data, error: err } = await sb.auth.verifyOtp({ phone: e164, token: token.trim(), type: "sms" });
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
  function onCell(i: number, v: string) {
    const digits = v.replace(/\D/g, "");
    if (digits.length > 1) {
      // a pasted code fills every cell
      const next = Array.from({ length: 6 }, (_, k) => digits[k] ?? "");
      setCells(next);
      if (digits.length >= 6) void verify(undefined, next.join(""));
      else refs.current[Math.min(digits.length, 5)]?.focus();
      return;
    }
    const next = [...cells]; next[i] = digits;
    setCells(next);
    if (digits && i < 5) refs.current[i + 1]?.focus();
    if (next.every((c) => c)) void verify(undefined, next.join(""));
  }
  function onKey(i: number, e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Backspace" && !cells[i] && i > 0) refs.current[i - 1]?.focus();
  }

  return (
    <div className="stack-loose" style={{ paddingTop: "var(--zs-space-32)" }}>
      <div className="stack-tight col-text">
        <ZebraBust mood={step === "name" ? "happy" : "hi"} size={88} label="Zebra" />
        <h1 className="t-title1">{title}</h1>
        {body && <p className="t-body t-soft">{body}</p>}
      </div>
      {step === "phone" && (
        <form className="stack" onSubmit={sendCode}>
          <div className="field"><label htmlFor="phone">Phone number</label><input id="phone" className="input" type="tel" inputMode="tel" autoComplete="tel" placeholder="(555) 555-0100" value={phone} onChange={(e) => setPhone(e.target.value)} autoFocus /></div>
          <p className="help">We text a 6-digit code. Standard rates apply. Your number is only used to sign you in and match your invites.</p>
          {error && <ErrorLine text={error} />}
          <button className="btn primary" type="submit" disabled={busy}>{busy ? "Sending…" : "Send code"}</button>
        </form>
      )}
      {step === "code" && (
        <form className="stack" onSubmit={verify}>
          <div className="field">
            <label htmlFor="code-0">Code sent to {e164}</label>
            <div className="code-cells">
              {cells.map((c, i) => (
                <input key={i} id={`code-${i}`} ref={(el) => { refs.current[i] = el; }} inputMode="numeric" autoComplete={i === 0 ? "one-time-code" : "off"} maxLength={6} value={c} aria-label={`Digit ${i + 1}`} onChange={(e) => onCell(i, e.target.value)} onKeyDown={(e) => onKey(i, e)} />
              ))}
            </div>
          </div>
          {error && <ErrorLine text={error} />}
          <button className="btn primary" type="submit" disabled={busy}>{busy ? "Checking…" : "Verify"}</button>
          <button className="btn text" type="button" onClick={() => { setStep("phone"); setCells(["", "", "", "", "", ""]); setError(null); }}>Use a different number</button>
        </form>
      )}
      {step === "name" && (
        <form className="stack" onSubmit={saveName}>
          <div className="field"><label htmlFor="name">Your name</label><input id="name" className="input" autoComplete="name" placeholder="Jordan" value={name} onChange={(e) => setName(e.target.value)} autoFocus /></div>
          <p className="help">How your dazzle will see you.</p>
          {error && <ErrorLine text={error} />}
          <button className="btn primary" type="submit" disabled={busy}>{busy ? "Saving…" : "Continue"}</button>
        </form>
      )}
    </div>
  );
}
