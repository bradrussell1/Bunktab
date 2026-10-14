import { useRouter } from "expo-router";
import { useState } from "react";
import { AuthScreen, FormError } from "@/components/AuthScreen";
import { Button, Input } from "@/ui";
import { friendlyAuthError, toE164 } from "@/lib/auth";
import { supabase, supabaseConfigured } from "@/lib/supabase";

/**
 * "Text me a code instead": the password-free login for accounts created
 * before passwords existed. Phone number as a white pill Input; "Send code"
 * as the volt action.
 */
export default function PhoneScreen() {
  const router = useRouter();
  const [raw, setRaw] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function send() {
    if (raw.includes("@")) { setError("Enter your phone number here. To use your email, go back and pick email or phone."); return; }
    const phone = toE164(raw);
    if (!phone) { setError("Enter a phone number, like (555) 555-0100."); return; }
    setBusy(true); setError(null);
    const { error: e } = await supabase.auth.signInWithOtp({ phone });
    setBusy(false);
    if (e) { setError(friendlyAuthError(e.message)); return; }
    router.push({ pathname: "/(auth)/code", params: { phone, mode: "otp" } });
  }

  return (
    <AuthScreen
      onBack={() => router.back()}
      title="Text me a code"
      lead="No password needed. We'll text a 6-digit code to your number."
      footer={<Button label="Send code" onPress={send} loading={busy} />}
    >
      <Input label="Phone number" keyboardType="phone-pad" textContentType="telephoneNumber" autoComplete="tel" placeholder="(555) 555-0100" value={raw} onChangeText={setRaw} error={error} helper="Standard message rates apply." onSubmitEditing={send} returnKeyType="done" autoFocus />
      {!supabaseConfigured ? <FormError>Supabase isn't configured: add EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY to apps/mobile/.env.</FormError> : null}
    </AuthScreen>
  );
}
