import { theme } from "@checkm8/theme";
import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import { useEffect } from "react";
import { AuthProvider, useAuth } from "@/lib/auth";

SplashScreen.preventAutoHideAsync();

/**
 * Root: session provider + protected route groups. Signed out → (auth);
 * signed in without a display name → the profile step; otherwise → (app).
 * Light mode only (spec: Theme).
 */
function Routes() {
  const { session, profile, loading } = useAuth();
  useEffect(() => { if (!loading) SplashScreen.hideAsync(); }, [loading]);
  if (loading) return null;
  const signedIn = !!session;
  const needsProfile = signedIn && !profile?.display_name;
  return (
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: theme.colors.background.main } }}>
      <Stack.Protected guard={!signedIn}>
        <Stack.Screen name="(auth)/phone" />
        <Stack.Screen name="(auth)/verify" />
      </Stack.Protected>
      <Stack.Protected guard={needsProfile}>
        <Stack.Screen name="(auth)/profile" />
      </Stack.Protected>
      <Stack.Protected guard={signedIn && !needsProfile}>
        <Stack.Screen name="(app)" />
      </Stack.Protected>
    </Stack>
  );
}

export default function RootLayout() {
  return (
    <AuthProvider>
      <StatusBar style="dark" />
      <Routes />
    </AuthProvider>
  );
}
