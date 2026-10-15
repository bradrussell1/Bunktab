import { palette } from "@bunktab/theme";
import { Stack } from "expo-router";
import { Inter_300Light, Inter_400Regular, Inter_500Medium, Inter_600SemiBold, Inter_700Bold, Inter_800ExtraBold, useFonts } from "@expo-google-fonts/inter";
import { Figtree_400Regular, Figtree_600SemiBold, Figtree_700Bold, Figtree_800ExtraBold } from "@expo-google-fonts/figtree";
import { IBMPlexMono_400Regular, IBMPlexMono_700Bold } from "@expo-google-fonts/ibm-plex-mono";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import { useEffect, useState } from "react";
import { AuthProvider, useAuth } from "@/lib/auth";
import { OfflineBanner, ToastProvider } from "@/ui";

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
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: palette.bgMid } }}>
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
      <Stack.Protected guard={needsProfile}>
        <Stack.Screen name="(auth)/profile" />
      </Stack.Protected>
      <Stack.Protected guard={signedIn && !needsPhone && !needsPassword && !needsProfile}>
        <Stack.Screen name="(app)" />
      </Stack.Protected>
      {/* declared after (app): when a sign-in flips the guards, expo-router falls back to the first
          allowed screen, which must be the app, not the reset-password form (reachable by explicit navigation) */}
      <Stack.Protected guard={signedIn}>
        <Stack.Screen name="(auth)/reset-password" />
      </Stack.Protected>
      <Stack.Screen name="(auth)/callback" />
      {__DEV__ && <Stack.Screen name="dev-login" />}
      {__DEV__ && <Stack.Screen name="design" />}
    </Stack>
  );
}

export default function RootLayout() {
  // Zebrasplit design system (2026-10-14): Figtree for everything, IBM Plex Mono for the
  // receipt read-out. Inter stays loaded only until Part B has moved every screen off the
  // legacy wrappers; it is removed with them.
  const [fontsReady, fontError] = useFonts({
    Figtree_400Regular, Figtree_600SemiBold, Figtree_700Bold, Figtree_800ExtraBold,
    IBMPlexMono_400Regular, IBMPlexMono_700Bold,
    Inter_300Light, Inter_400Regular, Inter_500Medium, Inter_600SemiBold, Inter_700Bold, Inter_800ExtraBold,
  });
  const [waited, setWaited] = useState(false);
  useEffect(() => { const t = setTimeout(() => setWaited(true), 3000); return () => clearTimeout(t); }, []);
  if (fontError) console.warn("Fonts failed to load; falling back to the system font", fontError);
  if (!fontsReady && !fontError && !waited) return null; // hold the splash for the fonts; never block the app on them
  return (
    <AuthProvider>
      <ToastProvider>
        <StatusBar style="dark" />
        <Routes />
        <OfflineBanner />
      </ToastProvider>
    </AuthProvider>
  );
}
