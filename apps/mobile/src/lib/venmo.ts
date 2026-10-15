import { venmoProfileUrl } from "@bunktab/core";
import { openBrowserAsync } from "expo-web-browser";
import { Linking } from "react-native";

/**
 * "View on Venmo" / "Check it" (feedback round 1, item 21): when the Venmo app is
 * installed (venmo:// answers canOpenURL; the scheme is in LSApplicationQueriesSchemes)
 * open the profile's universal link through the system, which hands it to the app;
 * otherwise show the same page in the in-app browser. Link building in @bunktab/core
 * is untouched.
 */
export async function openVenmoProfile(username: string): Promise<void> {
  const url = venmoProfileUrl(username);
  const installed = await Linking.canOpenURL("venmo://").catch(() => false);
  if (installed) {
    const opened = await Linking.openURL(url).then(() => true, () => false);
    if (opened) return;
  }
  await openBrowserAsync(url);
}
