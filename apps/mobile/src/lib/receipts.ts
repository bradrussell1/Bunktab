import * as Crypto from "expo-crypto";
import * as ImagePicker from "expo-image-picker";
import { supabase } from "./supabase";

/**
 * Receipt photos (spec: Receipt reading, Files and receipts). Photos go to
 * the PRIVATE `receipts` bucket under <trip_id>/<receipt_id>.jpg, which the
 * storage policy scopes to trip members, and are shown through short-lived
 * signed links. `receipt_url` on the expense holds the object path, not a
 * URL. Reading the total runs through the `read-receipt` Edge Function
 * (Anthropic vision, server-side key); it returns the total only.
 */
export type ReceiptRead = { total_cents: number | null; currency: string | null; confidence: "high" | "low" | null };

export async function pickReceipt(source: "camera" | "library"): Promise<string | null> {
  const perm = source === "camera" ? await ImagePicker.requestCameraPermissionsAsync() : await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!perm.granted) return null;
  const opts: ImagePicker.ImagePickerOptions = { mediaTypes: ["images"], quality: 0.7, allowsEditing: false };
  const res = source === "camera" ? await ImagePicker.launchCameraAsync(opts) : await ImagePicker.launchImageLibraryAsync(opts);
  if (res.canceled || !res.assets[0]) return null;
  return res.assets[0].uri;
}

/** Uploads and returns the object path to store in expenses.receipt_url. */
export async function uploadReceipt(tripId: string, localUri: string): Promise<string> {
  const path = `${tripId}/${Crypto.randomUUID()}.jpg`;
  const bytes = await (await fetch(localUri)).arrayBuffer();
  const { error } = await supabase.storage.from("receipts").upload(path, bytes, { contentType: "image/jpeg", upsert: false });
  if (error) throw error;
  return path;
}

export async function signReceipt(path: string, seconds = 3600): Promise<string | null> {
  const { data } = await supabase.storage.from("receipts").createSignedUrl(path, seconds);
  return data?.signedUrl ?? null;
}

/** Contract: POST /functions/v1/read-receipt { bucket, path } → ReceiptRead. Never throws; null on any failure. */
export async function readReceipt(path: string): Promise<ReceiptRead | null> {
  try {
    const { data, error } = await supabase.functions.invoke<ReceiptRead>("read-receipt", { body: { bucket: "receipts", path } });
    if (error || !data) return null;
    return { total_cents: typeof data.total_cents === "number" ? Math.round(data.total_cents) : null, currency: data.currency ?? null, confidence: data.confidence ?? null };
  } catch { return null; }
}
