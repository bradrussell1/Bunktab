import { isValidNamePart, isValidVenmoUsername, joinName } from "@bunktab/core";
import { color, space } from "@bunktab/theme";
import { useRouter } from "expo-router";
import { useState } from "react";
import { View } from "react-native";
import { AuthScreen, FormError } from "@/components/AuthScreen";
import { Button, Input, TextLink, ZText } from "@/ui";
import { friendlyAuthError, isValidEmail, toE164 } from "@/lib/auth";
import { openVenmoProfile } from "@/lib/venmo";
import { supabase } from "@/lib/supabase";

/**
 * Sign up: first name, last name, email, password + confirm, phone, Venmo (optional,
 * with "Check it"), Next, then "Enter the code we just sent you". Order under the
 * hood: the account is created on email + password (email is auto-confirmed: no SMTP
 * yet), the phone is attached, and the texted code confirms it as a phone change.
 * The names and Venmo ride along as user metadata so the users row (first_name,
 * last_name and the composed display_name) is complete even if the follow-up write
 * fails. Feedback round 1, items 18 and 19.
 */
export default function SignupScreen() {
  const router = useRouter();
  const [first, setFirst] = useState("");
  const [last, setLast] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [phone, setPhone] = useState("");
  const [venmo, setVenmo] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const mismatch = confirm.length > 0 && confirm !== password;

  async function next() {
    const e164 = toE164(phone);
    if (!isValidNamePart(first)) return setError("Enter your first name.");
    if (!isValidNamePart(last)) return setError("Enter your last name.");
    if (!isValidEmail(email)) return setError("Enter a valid email address.");
    if (password.length < 8) return setError("Use a password of at least 8 characters.");
    if (password !== confirm) return setError("The two passwords don't match.");
    if (!e164) return setError("Enter a phone number, like (555) 555-0100.");
    if (venmo.trim() && !isValidVenmoUsername(venmo)) return setError("Venmo usernames are 5–30 letters, numbers, hyphens or underscores.");
    setBusy(true); setError(null);
    const venmoClean = venmo.trim().replace(/^@/, "") || null;
    const firstClean = first.trim(), lastClean = last.trim();
    const { data, error: err } = await supabase.auth.signUp({
      email: email.trim().toLowerCase(),
      password,
      options: { data: { first_name: firstClean, last_name: lastClean, display_name: joinName(firstClean, lastClean), venmo_username: venmoClean } },
    });
    if (err) { setBusy(false); setError(friendlyAuthError(err.message)); return; }
    if (!data.session) { setBusy(false); setError("Check your email to confirm the address, then log in."); return; } // only if autoconfirm is ever turned off
    const { error: e2 } = await supabase.auth.updateUser({ phone: e164 });
    setBusy(false);
    if (e2) {
      const m = e2.message.toLowerCase();
      setError(m.includes("already") ? "That phone number is on another account. Log in instead." : friendlyAuthError(e2.message));
      return; // the layout now holds this account on the add-phone step, which offers "Log in"
    }
    router.replace({ pathname: "/(auth)/code", params: { phone: e164, mode: "phone_change" } });
  }

  return (
    <AuthScreen
      onBack={() => router.back()}
      title="Create your account"
      lead="We'll text a code to confirm your number."
      footer={
        <>
          <FormError>{error}</FormError>
          <Button label="Next" onPress={next} loading={busy} />
          <ZText variant="small" color={color.textMuted} style={{ textAlign: "center" }}>By continuing you agree to the Terms and Privacy Policy at zebrasplit.com.</ZText>
        </>
      }
    >
      <View style={{ flexDirection: "row", gap: space[10] }}>
        <Input label="First Name" placeholder="Bradley" value={first} onChangeText={setFirst} autoCapitalize="words" textContentType="givenName" autoComplete="given-name" returnKeyType="next" style={{ flex: 1 }} />
        <Input label="Last Name" placeholder="Russell" value={last} onChangeText={setLast} autoCapitalize="words" textContentType="familyName" autoComplete="family-name" returnKeyType="next" style={{ flex: 1 }} />
      </View>
      <Input label="Email" placeholder="you@example.com" value={email} onChangeText={setEmail} autoCapitalize="none" autoCorrect={false} keyboardType="email-address" textContentType="emailAddress" autoComplete="email" returnKeyType="next" />
      <Input label="Password" placeholder="At least 8 characters" value={password} onChangeText={setPassword} secureTextEntry textContentType="newPassword" autoComplete="new-password" returnKeyType="next" />
      <Input label="Confirm Password" placeholder="Same again" value={confirm} onChangeText={setConfirm} secureTextEntry textContentType="newPassword" autoComplete="new-password" returnKeyType="next" error={mismatch ? "These don't match yet." : null} />
      <Input label="Phone number" placeholder="(555) 555-0100" value={phone} onChangeText={setPhone} keyboardType="phone-pad" textContentType="telephoneNumber" autoComplete="tel" helper="Your login and how friends' invites find you." returnKeyType="done" />
      <View style={{ gap: space[4] }}>
        <Input label="Venmo username (optional)" placeholder="your-venmo" value={venmo} onChangeText={setVenmo} autoCapitalize="none" autoCorrect={false} helper="Needed before close-out so friends can pay you in Venmo." returnKeyType="done" />
        {venmo.trim().length >= 5 ? <TextLink label="Check it" onPress={() => openVenmoProfile(venmo)} /> : null}
      </View>
    </AuthScreen>
  );
}
