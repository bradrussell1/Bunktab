import { theme } from "@checkm8/theme";
import { Stack } from "expo-router";

export default function AppLayout() {
  return <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: theme.colors.background.main } }} />;
}
