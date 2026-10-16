import { palette } from "@bunktab/theme";
import { Stack } from "expo-router";
import { useEffect } from "react";
import { startReceiptQueueWatcher } from "@/lib/receipts";

/**
 * The signed-in group. `home` is declared first and named as the initial route: when a
 * sign-in flips the root guards, expo-router opens the group's first screen, and before
 * this it was the only one declared here - the expense sheet, with no dazzle id and no
 * way out (feedback round 1, item 1).
 */
export const unstable_settings = { initialRouteName: "home" };

export default function AppLayout() {
  // photos snapped offline upload when the app is back with a connection
  useEffect(() => startReceiptQueueWatcher(), []);
  return (
    <Stack initialRouteName="home" screenOptions={{ headerShown: false, contentStyle: { backgroundColor: palette.bgMid } }}>
      <Stack.Screen name="home" />
      {/* the add/edit expense sheet slides up over the Dazzle page (RESKIN_PROMPT B5) */}
      <Stack.Screen name="trip/[id]/expense" options={{ presentation: "transparentModal", animation: "slide_from_bottom", contentStyle: { backgroundColor: "transparent" } }} />
      {/* the receipt flow: read → split → summary, each a full screen */}
      <Stack.Screen name="trip/[id]/receipt/[receiptId]/index" />
      <Stack.Screen name="trip/[id]/receipt/[receiptId]/split" />
      <Stack.Screen name="trip/[id]/receipt/[receiptId]/summary" />
    </Stack>
  );
}
