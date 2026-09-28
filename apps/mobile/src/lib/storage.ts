import * as ImagePicker from "expo-image-picker";
import { supabase } from "./supabase";

/**
 * Image upload for avatars and trip covers. The picker returns a local
 * file URI; we read it as bytes and upload under a path the storage
 * policies allow (avatars/<uid>/…, covers/<trip_id>/…). Both buckets are
 * public-read (URLs are unguessable UUID paths); receipts stay private.
 */
export async function pickImage(aspect: [number, number] = [1, 1]): Promise<string | null> {
  const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!perm.granted) return null;
  const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], allowsEditing: true, aspect, quality: 0.8 });
  if (res.canceled || !res.assets[0]) return null;
  return res.assets[0].uri;
}

export async function uploadImage(bucket: "avatars" | "covers", path: string, localUri: string): Promise<string> {
  const bytes = await (await fetch(localUri)).arrayBuffer();
  const { error } = await supabase.storage.from(bucket).upload(path, bytes, { contentType: "image/jpeg", upsert: true });
  if (error) throw error;
  const { data } = supabase.storage.from(bucket).getPublicUrl(path);
  return `${data.publicUrl}?v=${Date.now()}`; // cache-bust: the path is stable across re-uploads
}
