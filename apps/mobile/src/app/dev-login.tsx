import { Redirect, useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";
import { ActivityIndicator, View } from "react-native";
import { supabase } from "@/lib/supabase";

/**
 * DEV ONLY: checkm8://dev-login?phone=15555550100 signs a test number in
 * with the fixed test code, so the app can be driven from the command line
 * (xcrun simctl openurl). Compiled out of release builds by the __DEV__
 * guard; the test numbers only exist in the project's auth config anyway.
 */
export default function DevLogin() {
  const { phone } = useLocalSearchParams<{ phone?: string }>();
  const [done, setDone] = useState(false);
  useEffect(() => {
    if (!__DEV__ || !phone) { setDone(true); return; }
    (async () => {
      const p = phone.startsWith("+") ? phone : `+${phone}`;
      await supabase.auth.signOut();
      await supabase.auth.signInWithOtp({ phone: p });
      await supabase.auth.verifyOtp({ phone: p, token: "123456", type: "sms" });
      setDone(true);
    })();
  }, [phone]);
  if (!done) return <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}><ActivityIndicator /></View>;
  return <Redirect href="/" />;
}
