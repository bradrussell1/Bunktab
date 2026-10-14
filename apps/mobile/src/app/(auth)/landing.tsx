import { zebraLabel, zebraMoodFor } from "@bunktab/core";
import { color, space } from "@bunktab/theme";
import { useRouter } from "expo-router";
import { View } from "react-native";
import { AuthScreen } from "@/components/AuthScreen";
import { Button, Zebra, ZText } from "@/ui";

/**
 * First screen (RESKIN_PROMPT B1): the full zebra (hi, blinking, a gentle bob) above
 * the lowercase wordmark at display scale and "Split the trip. Keep it black and
 * white.", then the one volt action (Log in) and a secondary "Create an account".
 */
export default function LandingScreen() {
  const router = useRouter();
  const mood = zebraMoodFor({ place: "login", profileSaved: false }) ?? "hi";
  return (
    <AuthScreen
      centered
      hero={<Zebra variant="full" mood={mood} size={236} animate={{ blink: true, bob: true }} accessibilityLabel={zebraLabel(mood)} />}
      footer={
        <>
          <Button label="Log in" onPress={() => router.push("/(auth)/login")} />
          <Button label="Create an account" kind="secondary" onPress={() => router.push("/(auth)/signup")} />
        </>
      }
    >
      <View style={{ alignItems: "center", gap: space[8] }}>
        <ZText variant="display" accessibilityRole="header">zebrasplit</ZText>
        <ZText variant="body" color={color.textSecondary} style={{ textAlign: "center" }}>Split the trip. Keep it black and white.</ZText>
      </View>
    </AuthScreen>
  );
}
