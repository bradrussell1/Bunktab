import * as Device from "expo-device";
import * as Notifications from "expo-notifications";
import { Platform } from "react-native";
import { supabase } from "./supabase";

/**
 * Push registration (spec: Push notifications; Stack → Expo push service).
 * The Expo push token is stored in `devices` for the signed-in user; the
 * database decides who to notify and the `push` Edge Function sends. A
 * simulator has no token, so this is a no-op there. Foreground
 * notifications show as banners.
 */
Notifications.setNotificationHandler({
  handleNotification: async () => ({ shouldShowBanner: true, shouldShowList: true, shouldPlaySound: false, shouldSetBadge: false }),
});

let registered: string | null = null;

export async function registerForPush(userId: string): Promise<string | null> {
  if (!Device.isDevice || Platform.OS === "web") return null;
  try {
    let { status } = await Notifications.getPermissionsAsync();
    if (status !== "granted") ({ status } = await Notifications.requestPermissionsAsync());
    if (status !== "granted") return null;
    if (Platform.OS === "android") {
      await Notifications.setNotificationChannelAsync("default", { name: "Trip updates", importance: Notifications.AndroidImportance.DEFAULT });
    }
    const { data: token } = await Notifications.getExpoPushTokenAsync();
    if (!token || token === registered) return token ?? null;
    const { error } = await supabase.from("devices").upsert({ user_id: userId, expo_push_token: token, platform: Platform.OS, updated_at: new Date().toISOString() }, { onConflict: "user_id,expo_push_token" });
    if (!error) registered = token;
    return token;
  } catch {
    return null; // never block sign-in on push
  }
}

/** On sign-out, forget this device so the next user of the phone isn't told about our trips. */
export async function unregisterPush(userId: string): Promise<void> {
  if (!registered) return;
  await supabase.from("devices").delete().eq("user_id", userId).eq("expo_push_token", registered).then(() => undefined, () => undefined);
  registered = null;
}
