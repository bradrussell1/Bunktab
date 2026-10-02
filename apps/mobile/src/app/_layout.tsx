import { theme } from "@bunktab/theme";
import { Stack } from "expo-router";
import { Inter_300Light, Inter_400Regular, Inter_500Medium, Inter_600SemiBold, Inter_700Bold, Inter_800ExtraBold, useFonts } from "@expo-google-fonts/inter";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import { useEffect, useState } from "react";
import { AuthProvider, useAuth } from "@/lib/auth";

SplashScreen.preventAutoHideAsync();

/**
 * Root: session provider + protected route groups.
 *  signed out                 → landing, login (hub), password, forgot, signup, phone
 *  signed out OR no phone yet → code, add-phone (sign-up finishes here;
 *                               Google/Apple accounts add a number here)
 *  forgot-password code       → reset-password (held until saved/skipped)
 *  no display name yet        → the profile step (text-code accounts only)
 *  otherwise                  → (app)
 * `reset-password` is also reachable while signed in (Profile → Change
 * Password, mode=change); `callback` (OAuth) and the DEV login are always
 * reachable.
 */
function Routes() {
  const { session, profile, loading, pendingPasswordReset } = useAuth();
  useEffect(() => { if (!loading) SplashScreen.hideAsync(); }, [loading]);
  if (loading) return null;
  const signedIn = !!session;
  const needsPhone = signedIn && !session.user.phone;
  const needsPassword = signedIn && !needsPhone && pendingPasswordReset;
  const needsProfile = signedIn && !needsPhone && !needsPassword && !profile?.display_name;
  return (
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: theme.colors.background.main } }}>
      <Stack.Protected guard={!signedIn}>
        <Stack.Screen name="(auth)/landing" />
        <Stack.Screen name="(auth)/login" />
        <Stack.Screen name="(auth)/password" />
        <Stack.Screen name="(auth)/forgot" />
        <Stack.Screen name="(auth)/signup" />
        <Stack.Screen name="(auth)/phone" />
      </Stack.Protected>
      <Stack.Protected guard={!signedIn || needsPhone}>
        <Stack.Screen name="(auth)/add-phone" />
        <Stack.Screen name="(auth)/code" />
      </Stack.Protected>
      <Stack.Protected guard={signedIn}>
        <Stack.Screen name="(auth)/reset-password" />
      </Stack.Protected>
      <Stack.Protected guard={needsProfile}>
        <Stack.Screen name="(auth)/profile" />
      </Stack.Protected>
      <Stack.Protected guard={signedIn && !needsPhone && !needsPassword && !needsProfile}>
        <Stack.Screen name="(app)" />
      </Stack.Protected>
      <Stack.Screen name="(auth)/callback" />
      {__DEV__ && <Stack.Screen name="dev-login" />}
    </Stack>
  );
}

export default function RootLayout() {
  const [fontsReady, fontError] = useFonts({ Inter_300Light, Inter_400Regular, Inter_500Medium, Inter_600SemiBold, Inter_700Bold, Inter_800ExtraBold });
  const [waited, setWaited] = useState(false);
  useEffect(() => { const t = setTimeout(() => setWaited(true), 3000); return () => clearTimeout(t); }, []);
  if (fontError) console.warn("Inter failed to load; falling back to the system font", fontError);
  if (!fontsReady && !fontError && !waited) return null; // hold the splash briefly for Inter; never block the app on it
  return (
    <AuthProvider>
      <StatusBar style="dark" />
      <Routes />
    </AuthProvider>
  );
}
