import { useEffect, useState } from "react";
import { readFileBytes } from "./files";
import { supabase } from "./supabase";

/**
 * Private media (spec: Security → Files and receipts): covers and receipts
 * live in private buckets and are served through short-lived signed links.
 * The database stores the OBJECT PATH inside the bucket (e.g. covers:
 * `<trip_id>/cover.jpg`, receipts: `<trip_id>/<expense_id>.jpg`), never a
 * URL. `useSignedUrl` signs on demand and caches per bucket+path for 50 min
 * (links are issued for 60). Avatars are a public bucket and keep full URLs.
 */
export type PrivateBucket = "covers" | "receipts";

const TTL_SECONDS = 60 * 60;
const REFRESH_AFTER_MS = 50 * 60 * 1000;
const cache = new Map<string, { url: string; at: number; v: string }>();

export async function signedUrl(bucket: PrivateBucket, path: string | null | undefined): Promise<string | null> {
  if (!path) return null;
  // a `?v=` suffix (cache-bust after re-upload) is part of the key but not the object name
  const [object, v = ""] = path.split("?v=");
  const key = `${bucket}/${path}`;
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < REFRESH_AFTER_MS) return hit.url;
  const { data, error } = await supabase.storage.from(bucket).createSignedUrl(object!, TTL_SECONDS);
  if (error || !data) return null;
  cache.set(key, { url: data.signedUrl, at: Date.now(), v });
  return data.signedUrl;
}

export function useSignedUrl(bucket: PrivateBucket, path: string | null | undefined): string | null {
  const key = path ? `${bucket}/${path}` : null;
  const [url, setUrl] = useState<string | null>(() => (key && cache.get(key)?.url) || null);
  useEffect(() => {
    let live = true;
    if (!path) { setUrl(null); return; }
    signedUrl(bucket, path).then((u) => { if (live) setUrl(u); });
    return () => { live = false; };
  }, [bucket, path]);
  return url;
}

/** Upload a local image to a private bucket; returns the stored path with a cache-bust suffix. */
export async function uploadPrivateImage(bucket: PrivateBucket, object: string, localUri: string): Promise<string> {
  const bytes = await readFileBytes(localUri);
  const { error } = await supabase.storage.from(bucket).upload(object, bytes, { contentType: "image/jpeg", upsert: true });
  if (error) throw error;
  const path = `${object}?v=${Date.now()}`;
  cache.delete(`${bucket}/${path}`);
  return path;
}
