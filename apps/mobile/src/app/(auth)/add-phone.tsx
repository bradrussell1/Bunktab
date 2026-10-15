import { space } from "@bunktab/theme";
import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { View } from "react-native";
import { AuthScreen } from "@/components/AuthScreen";
import { Button, Input, TextLink } from "@/ui";
import { friendlyAuthError, toE164, useAuth } from "@/lib/auth";
import { supabase } from "@/lib/supabase";

/**
 * A signed-in account with no verified phone lands here (the root layout
 * holds it): a sign-up that stopped before the code, or a Google/Apple
 * login. Sign-up itself normally skips this screen: signup.tsx already
 * asked for the phone, so when a pending number exists we go straight to
 * the code. Phone is the identity invites are matched on, so it isn't
 * optional.
 *
 * Ways out (feedback round 1, item 2): the back button and "Sign out" both
 * sign the half-made account out and return to the landing screen (the
 * previous step was signed-out, so "back" can only mean that); the
 * "already an account with that number" error offers a tappable "Log in"
 * that does the same and opens the login hub.
 */
export default function AddPhoneScreen() {
  const router = useRouter();
  const { signOut } = useAuth();
  const [raw, setRaw] = useState("");
  const [busy, setBusy] = useState(false);
  const [checking, setChecking] = useState(true);
  const [leaving, setLeaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const numberTaken = !!error && /log in instead/i.test(error);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.auth.getUser().catch(() => ({ data: { user: null } }));
      const pending = (data.user as { new_phone?: string } | null)?.new_phone;
      if (pending) router.replace({ pathname: "/(auth)/code", params: { phone: `+${pending.replace(/^\+/, "")}`, mode: "phone_change" } });
      else setChecking(false);
    })();
  }, [router]);

  async function send() {
    const phone = toE164(raw);
    if (!phone) { setError("Enter a phone number, like (555) 555-0100."); return; }
    setBusy(true); setError(null);
    const { error: e } = await supabase.auth.updateUser({ phone });
    setBusy(false);
    if (e) { setError(friendlyAuthError(e.message)); return; }
    router.push({ pathname: "/(auth)/code", params: { phone, mode: "phone_change" } });
  }

  // sign out, then go: the root guards drop this screen once the session is gone, and the
  // explicit replace makes sure we land where the user asked rather than wherever the router falls
  async function leave(to: "/(auth)/landing" | "/(auth)/login") {
    if (leaving) return;
    setLeaving(true);
    try { await signOut(); } finally { setLeaving(false); }
    router.replace(to);
  }

  if (checking) return <AuthScreen />;
  return (
    <AuthScreen
      onBack={() => leave("/(auth)/landing")}
      title="Add your phone number"
      lead="Friends invite you by number, so we need to confirm one. We'll text you a code."
      footer={
        <>
          <Button label="Send code" onPress={send} loading={busy} />
          <TextLink label="Sign out" muted style={{ alignSelf: "center" }} onPress={() => leave("/(auth)/landing")} />
        </>
      }
    >
      <Input label="Phone number" keyboardType="phone-pad" textContentType="telephoneNumber" autoComplete="tel" placeholder="(555) 555-0100" value={raw} onChangeText={setRaw} error={error} onSubmitEditing={send} returnKeyType="done" autoFocus />
      {numberTaken ? (
        <View style={{ paddingHorizontal: space[4] }}>
          <TextLink label="Log in" onPress={() => leave("/(auth)/login")} />
        </View>
      ) : null}
    </AuthScreen>
  );
}
