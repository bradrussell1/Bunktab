import Constants from "expo-constants";
import { Platform } from "react-native";
import { supabase } from "./supabase";

/**
 * Receipt-flow analytics (RECEIPT_SPLIT_PROMPT, Part 7). Event names are the server's
 * allow-list (log_event); props are numbers and enums only, never names, phones, trip
 * ids or typed amounts. Fire-and-forget: a failed insert is never surfaced.
 */
export type EventName =
  | "receipt_scan_started" | "receipt_read_ready" | "receipt_read_failed" | "receipt_line_edited"
  | "tip_selected" | "split_method_chosen" | "split_rest_used" | "receipt_expense_saved";

const version = Constants.expoConfig?.version ?? null;

export function track(name: EventName, props: Record<string, string | number | boolean | null> = {}): void {
  if (__DEV__) console.log("[track]", name, props);
  supabase.rpc("log_event", { p_name: name, p_props: props, p_platform: Platform.OS, p_app_version: version }).then(({ error }) => {
    if (error && __DEV__) console.warn("track", name, error.message);
  });
}
