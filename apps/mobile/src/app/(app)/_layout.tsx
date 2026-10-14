import { palette } from "@bunktab/theme";
import { Stack } from "expo-router";

export default function AppLayout() {
  return <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: palette.bgMid } }} />;
}
