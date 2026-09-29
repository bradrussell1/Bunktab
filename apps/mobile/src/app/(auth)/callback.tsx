import { Redirect, useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";
import { ActivityIndicator, View } from "react-native";
import { supabase } from "@/lib/supabase";

/**
 * OAuth landing (`checkm8://callback`). The browser sheet normally hands
 * the tokens straight to oauth.ts, so this only runs if the system opened
 * the app with the URL instead: set the session from whatever arrived,
 * then go home.
 */
export default function CallbackScreen() {
  const params = useLocalSearchParams<{ access_token?: string; refresh_token?: string; code?: string }>();
  const [done, setDone] = useState(false);
  useEffect(() => {
    (async () => {
      try {
        if (params.access_token && params.refresh_token) await supabase.auth.setSession({ access_token: params.access_token, refresh_token: params.refresh_token });
        else if (params.code) await supabase.auth.exchangeCodeForSession(params.code);
      } finally { setDone(true); }
    })();
  }, [params.access_token, params.refresh_token, params.code]);
  if (!done) return <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}><ActivityIndicator /></View>;
  return <Redirect href="/" />;
}
