import { isValidVenmoUsername, venmoProfileUrl } from "@checkm8/core";
import { theme } from "@checkm8/theme";
import { useRouter } from "expo-router";
import { openBrowserAsync } from "expo-web-browser";
import { useState } from "react";
import { ScrollView, View } from "react-native";
import { Button, Input, Screen, Text } from "@/components/ui";
import { friendlyAuthError, isValidEmail, toE164 } from "@/lib/auth";
import { supabase } from "@/lib/supabase";

/**
 * Sign up (user brief #24): name, email, password, phone, Venmo (optional),
 * Next, then "Enter the code we just sent you". Order under the hood:
 * the account is created on email + password (email is auto-confirmed:
 * no SMTP yet), the phone is attached, and the texted code confirms it as
 * a phone change. Supabase can't add an email to a phone-created account
 * without a mailer, which is why it isn't the other way round. Name and
 * Venmo ride along as user metadata so the users row is complete even if
 * the follow-up write fails. The root layout keeps an account without a
 * confirmed phone on the code step.
 */
export default function SignupScreen() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [phone, setPhone] = useState("");
  const [venmo, setVenmo] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function next() {
    const e164 = toE164(phone);
    if (name.trim().length < 2) return setError("Enter the name your friends know you by.");
    if (!isValidEmail(email)) return setError("Enter a valid email address.");
    if (password.length < 8) return setError("Use a password of at least 8 characters.");
    if (!e164) return setError("Enter a phone number, like (555) 555-0100.");
    if (venmo.trim() && !isValidVenmoUsername(venmo)) return setError("Venmo usernames are 5–30 letters, numbers, hyphens or underscores.");
    setBusy(true); setError(null);
    const venmoClean = venmo.trim().replace(/^@/, "") || null;
    const { data, error: err } = await supabase.auth.signUp({
      email: email.trim().toLowerCase(),
      password,
      options: { data: { display_name: name.trim(), venmo_username: venmoClean } },
    });
    if (err) { setBusy(false); setError(friendlyAuthError(err.message)); return; }
    if (!data.session) { setBusy(false); setError("Check your email to confirm the address, then log in."); return; } // only if autoconfirm is ever turned off
    const { error: e2 } = await supabase.auth.updateUser({ phone: e164 });
    setBusy(false);
    if (e2) {
      const m = e2.message.toLowerCase();
      setError(m.includes("already") ? "That phone number is on another account. Log in instead." : friendlyAuthError(e2.message));
      return; // the layout now holds this account on the add-phone step
    }
    router.replace({ pathname: "/(auth)/code", params: { phone: e164, mode: "phone_change" } });
  }

  return (
    <Screen>
        <View style={{ flexDirection: "row", alignItems: "center", paddingVertical: theme.spacing.sm }}>
          <Button title="‹ Back" kind="text" size="small" onPress={() => router.back()} />
        </View>
        <ScrollView contentContainerStyle={{ gap: theme.spacing.lg, paddingBottom: 48 }} keyboardShouldPersistTaps="handled" automaticallyAdjustKeyboardInsets contentInsetAdjustmentBehavior="automatic">
          <View style={{ gap: theme.spacing.xs }}>
            <Text variant="largeTitle">Create your account</Text>
            <Text variant="body" color={theme.colors.text.onBackground.secondary}>We'll text a code to confirm your number.</Text>
          </View>
          <Input label="Name" placeholder="Bradley" value={name} onChangeText={setName} autoCapitalize="words" textContentType="name" autoComplete="name" />
          <Input label="Email" placeholder="you@example.com" value={email} onChangeText={setEmail} autoCapitalize="none" autoCorrect={false} keyboardType="email-address" textContentType="emailAddress" autoComplete="email" />
          <Input label="Password" placeholder="At least 8 characters" value={password} onChangeText={setPassword} secureTextEntry textContentType="newPassword" autoComplete="new-password" />
          <Input label="Phone number" placeholder="(555) 555-0100" value={phone} onChangeText={setPhone} keyboardType="phone-pad" textContentType="telephoneNumber" autoComplete="tel" helper="Your login and how friends' invites find you." />
          <View style={{ gap: theme.spacing.xs }}>
            <Input label="Venmo username (optional)" placeholder="your-venmo" value={venmo} onChangeText={setVenmo} autoCapitalize="none" autoCorrect={false} helper="Needed before close-out. Payments to you open Venmo pre-filled with this." />
            {venmo.trim().length >= 5 && <Button title="Check it on venmo.com ↗" kind="text" size="small" style={{ alignSelf: "flex-start" }} onPress={() => openBrowserAsync(venmoProfileUrl(venmo))} />}
          </View>
          {error && <Text variant="caption1" color={theme.colors.text.destructive}>{error}</Text>}
          <Button title="Next" onPress={next} loading={busy} />
          <Text variant="caption1" color={theme.colors.text.onBackground.tertiary} style={{ textAlign: "center" }}>By continuing you agree to the Terms and Privacy Policy at check-m8.io.</Text>
        </ScrollView>
    </Screen>
  );
}
