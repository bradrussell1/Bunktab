import { File } from "expo-file-system";

/**
 * Read a local file (picker/camera URI) as bytes for a storage upload.
 * `fetch(file://…)` is unreliable in React Native (the "fetch error" on
 * cover/receipt uploads), so go through expo-file-system instead.
 */
export async function readFileBytes(localUri: string): Promise<Uint8Array> {
  const f = new File(localUri);
  return await f.bytes();
}
