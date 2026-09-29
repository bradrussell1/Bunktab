import { theme } from "@checkm8/theme";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import { Pressable, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Button, HeroText, Text } from "@/components/ui";

/**
 * First screen (user brief #22): black canvas, the wordmark up top, a
 * pastel mesh panel from about halfway down that ends just past a single
 * Login button with big rounded bottom corners, and a dusk "Sign-Up" link
 * on the black below it.
 */
export default function LandingScreen() {
  const router = useRouter();
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.background.main }} edges={["top", "bottom"]}>
      <View style={{ flex: 1 }}>
        <View style={{ flex: 1, paddingHorizontal: theme.screenPadding, paddingTop: theme.spacing.xxl * 2, gap: theme.spacing.sm }}>
          <Text variant="captionCaps2" color={theme.colors.text.onBackground.accent}>Checkm8</Text>
          <Text variant="largeTitle" style={{ fontSize: 40, lineHeight: 46 }}>Split the trip.{"\n"}Settle in Venmo.</Text>
          <Text variant="body" color={theme.colors.text.onBackground.secondary}>Everyone logs what they paid. Close out with the fewest payments.</Text>
        </View>

        <LinearGradient
          colors={[...theme.colors.hero.gradient]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={{ paddingHorizontal: theme.screenPadding, paddingTop: 36, paddingBottom: 36, borderBottomLeftRadius: 40, borderBottomRightRadius: 40, gap: theme.spacing.xl, ...theme.elevation.sm }}
        >
          <View style={{ gap: theme.spacing.xs }}>
            <HeroText variant="title2">Welcome back</HeroText>
            <HeroText variant="body" tone="mid">Log in with your email or phone number.</HeroText>
          </View>
          <Button title="Login" onPress={() => router.push("/(auth)/login")} accessibilityLabel="Log in" />
        </LinearGradient>

        <View style={{ alignItems: "center", paddingVertical: theme.spacing.xxl, gap: theme.spacing.sm }}>
          <Text variant="caption1" color={theme.colors.text.onBackground.tertiary}>New here?</Text>
          <Pressable onPress={() => router.push("/(auth)/signup")} accessibilityRole="button" accessibilityLabel="Sign up" hitSlop={12}>
            <Text variant="title2" color={theme.colors.text.onBackground.accent}>Sign-Up</Text>
          </Pressable>
        </View>
      </View>
    </SafeAreaView>
  );
}
