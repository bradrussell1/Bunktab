import { palette } from "@bunktab/theme";
import { Stack } from "expo-router";

export default function AppLayout() {
  return (
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: palette.bgMid } }}>
      {/* the add/edit expense sheet slides up over the dazzle page (RESKIN_PROMPT B5) */}
      <Stack.Screen name="trip/[id]/expense" options={{ presentation: "transparentModal", animation: "slide_from_bottom", contentStyle: { backgroundColor: "transparent" } }} />
    </Stack>
  );
}
