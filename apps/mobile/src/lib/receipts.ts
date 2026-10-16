import type { Claims, ItemKind, Share, SplitReceipt, TipChoice } from "@bunktab/core";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Crypto from "expo-crypto";
import { ImageManipulator, SaveFormat } from "expo-image-manipulator";
import * as ImagePicker from "expo-image-picker";
import * as Network from "expo-network";
import { useCallback, useEffect, useState, useSyncExternalStore } from "react";
import { AppState } from "react-native";
import { track } from "./analytics";
import { readFileBytes } from "./files";
import { isNetworkError, supabase } from "./supabase";

/**
 * Receipt photos and the itemized split flow (RECEIPT_SPLIT_PROMPT, Parts 3–5).
 *
 * Capture: the picker's crop/deskew editor stands in for a document scanner (no native
 * scanner module in Expo Go), the photo is resized to ~2000 px on the long edge and
 * re-encoded as JPEG 0.8 (which also strips EXIF/GPS), hashed (SHA-256), uploaded to the
 * private `receipts` bucket as <trip_id>/<receipt_id>.jpg and a `receipts` row is
 * inserted with status 'queued'. The database hands the row to receipt-parse; the app
 * subscribes to the row over Realtime and never blocks on the read. Offline: the photo
 * waits in AsyncStorage and uploads when the app comes back with a connection.
 *
 * The split itself is computed by @bunktab/core on the device for display and
 * recomputed by the receipt-save function before anything is written.
 */

export type ReceiptStatus = "queued" | "processing" | "ready" | "needs_review" | "failed";
export type ReceiptRow = {
  id: string; trip_id: string; expense_id: string | null; storage_path: string; status: ReceiptStatus;
  merchant: string | null; receipt_date: string | null; currency: string | null;
  subtotal_cents: number | null; tax_cents: number | null; fees_cents: number | null; discounts_cents: number | null; printed_total_cents: number | null; tip_printed_cents: number | null;
  tax_included: boolean; reconciled: boolean | null; error: string | null; created_by: string; created_at: string;
};
export type ReceiptItemRow = { id: string; receipt_id: string; position: number; name: string; raw_text: string | null; quantity: number; line_total_cents: number; kind: ItemKind | null; confidence: "high" | "medium" | "low" | null; edited_by_user: boolean };
export type ReceiptChargeRow = { id: string; receipt_id: string; kind: "tax" | "service_charge" | "auto_gratuity" | "other_fee" | "discount"; label: string | null; amount_cents: number; applies_to: "all" | "food" | "alcohol" | "unknown"; item_id: string | null; position: number };
export type ReceiptBundle = { receipt: ReceiptRow; items: ReceiptItemRow[]; charges: ReceiptChargeRow[]; claims: Claims };

/* ───────────────────────── capture + upload ───────────────────────── */

const QUEUE_KEY = "zs.receiptQueue.v1";
type Queued = { tripId: string; localUri: string; receiptId: string; sha: string; at: number };

export async function pickReceipt(source: "camera" | "library"): Promise<string | null> {
  const perm = source === "camera" ? await ImagePicker.requestCameraPermissionsAsync() : await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!perm.granted) return null;
  // allowsEditing gives the system crop/straighten sheet: the closest thing to a scanner mode without a native module
  const opts: ImagePicker.ImagePickerOptions = { mediaTypes: ["images"], quality: 1, allowsEditing: true, exif: false };
  const res = source === "camera" ? await ImagePicker.launchCameraAsync(opts) : await ImagePicker.launchImageLibraryAsync(opts);
  if (res.canceled || !res.assets[0]) return null;
  return res.assets[0].uri;
}

/** Long edge ≈ 2000 px, JPEG 0.8, no EXIF; returns the processed file and its SHA-256. */
export async function prepareReceiptImage(localUri: string, width?: number, height?: number): Promise<{ uri: string; bytes: Uint8Array; sha: string }> {
  const ctx = ImageManipulator.manipulate(localUri);
  const long = Math.max(width ?? 0, height ?? 0);
  if (!long || long > 2000) ctx.resize(width && height && width < height ? { height: 2000 } : { width: 2000 });
  const rendered = await ctx.renderAsync();
  const saved = await rendered.saveAsync({ compress: 0.8, format: SaveFormat.JPEG });
  const bytes = await readFileBytes(saved.uri);
  const digest = await Crypto.digest(Crypto.CryptoDigestAlgorithm.SHA256, bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer);
  const sha = Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, "0")).join("");
  return { uri: saved.uri, bytes, sha };
}

export type CaptureResult = { receiptId: string; queued: boolean; existing: boolean; /** AI reading is switched off: the photo is saved, the caller opens manual entry with it attached. */ aiDisabled?: boolean; storagePath?: string };

/** Server settings for the receipt flow (kill switch, daily limit). Defaults to enabled when the call fails. */
export async function receiptSettings(): Promise<{ aiEnabled: boolean; dailyLimit: number }> {
  try {
    const { data } = await supabase.rpc("receipt_settings");
    return { aiEnabled: data?.ai_enabled !== false, dailyLimit: Number(data?.daily_limit ?? 30) };
  } catch { return { aiEnabled: true, dailyLimit: 30 }; }
}

/** Upload + insert the receipts row (or reuse the trip's existing row for the same photo). */
export async function uploadAndQueue(tripId: string, uri: string, bytes: Uint8Array, sha: string, receiptId = Crypto.randomUUID()): Promise<CaptureResult> {
  const { data: me } = await supabase.auth.getUser();
  const uid = me.user?.id; if (!uid) throw new Error("Not signed in.");
  const { data: dup } = await supabase.from("receipts").select("id, status").eq("trip_id", tripId).eq("image_sha256", sha).maybeSingle();
  if (dup) {
    if (dup.status === "failed" || dup.status === "needs_review") await supabase.rpc("requeue_receipt", { p_receipt: dup.id });
    return { receiptId: dup.id, queued: false, existing: true };
  }
  const path = `${tripId}/${receiptId}.jpg`;
  const { error: upErr } = await supabase.storage.from("receipts").upload(path, bytes, { contentType: "image/jpeg", upsert: true });
  if (upErr) throw upErr;
  const { error } = await supabase.from("receipts").insert({ id: receiptId, trip_id: tripId, storage_path: path, image_sha256: sha, created_by: uid });
  if (error) {
    if (error.code === "23505") {
      const { data: again } = await supabase.from("receipts").select("id").eq("trip_id", tripId).eq("image_sha256", sha).maybeSingle();
      if (again) return { receiptId: again.id, queued: false, existing: true };
    }
    throw error;
  }
  track("receipt_scan_started", {});
  return { receiptId, queued: false, existing: false };
}

/** The whole capture: pick → prepare → upload (or queue when offline). null when the user cancelled. */
export async function captureReceipt(tripId: string, source: "camera" | "library"): Promise<CaptureResult | null> {
  const uri = await pickReceipt(source);
  if (!uri) return null;
  const prepared = await prepareReceiptImage(uri);
  const receiptId = Crypto.randomUUID();
  // Kill switch (RECEIPT_PIPELINE_PROMPT Step 9): with the AI off, keep the photo and skip straight to manual entry.
  const settings = await receiptSettings();
  if (!settings.aiEnabled) {
    const path = `${tripId}/${receiptId}.jpg`;
    const { error: upErr } = await supabase.storage.from("receipts").upload(path, prepared.bytes, { contentType: "image/jpeg", upsert: true });
    if (upErr) throw upErr;
    return { receiptId, queued: false, existing: false, aiDisabled: true, storagePath: path };
  }
  try {
    return await uploadAndQueue(tripId, prepared.uri, prepared.bytes, prepared.sha, receiptId);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (!isNetworkError(msg)) throw e;
    await enqueue({ tripId, localUri: prepared.uri, receiptId, sha: prepared.sha, at: Date.now() });
    return { receiptId, queued: true, existing: false };
  }
}

async function readQueue(): Promise<Queued[]> { try { return JSON.parse((await AsyncStorage.getItem(QUEUE_KEY)) ?? "[]"); } catch { return []; } }
async function enqueue(q: Queued) { const all = await readQueue(); all.push(q); await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(all)); }

/** Uploads anything captured offline. Called on foreground and when the network comes back. */
export async function flushReceiptQueue(): Promise<number> {
  const all = await readQueue();
  if (!all.length) return 0;
  const state = await Network.getNetworkStateAsync().catch(() => null);
  if (state && state.isInternetReachable === false) return 0;
  const rest: Queued[] = [];
  let sent = 0;
  for (const q of all) {
    try { const bytes = await readFileBytes(q.localUri); await uploadAndQueue(q.tripId, q.localUri, bytes, q.sha, q.receiptId); sent++; }
    catch (e) { if (isNetworkError(e instanceof Error ? e.message : String(e))) rest.push(q); /* anything else: drop it, the photo is still in the library */ }
  }
  await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(rest));
  return sent;
}

let flushing = false;
export function startReceiptQueueWatcher(): () => void {
  const run = () => { if (flushing) return; flushing = true; flushReceiptQueue().finally(() => { flushing = false; }); };
  run();
  const app = AppState.addEventListener("change", (s) => { if (s === "active") run(); });
  const net = Network.addNetworkStateListener((s) => { if (s.isInternetReachable) run(); });
  return () => { app.remove(); net.remove(); };
}

export async function requeueReceipt(receiptId: string): Promise<void> {
  const { error } = await supabase.rpc("requeue_receipt", { p_receipt: receiptId });
  if (error) throw error;
}

export async function signReceipt(path: string, seconds = 600): Promise<string | null> {
  const { data } = await supabase.storage.from("receipts").createSignedUrl(path, seconds);
  return data?.signedUrl ?? null;
}

/* ───────────────────────── reading the receipt ───────────────────────── */

export async function fetchReceipt(receiptId: string): Promise<ReceiptBundle | null> {
  const { data: receipt } = await supabase.from("receipts").select("*").eq("id", receiptId).maybeSingle();
  if (!receipt) return null;
  const [{ data: items }, { data: charges }] = await Promise.all([
    supabase.from("receipt_items").select("*").eq("receipt_id", receiptId).order("position"),
    supabase.from("receipt_charges").select("*").eq("receipt_id", receiptId).order("position"),
  ]);
  const ids = (items ?? []).map((i) => i.id);
  const { data: claimRows } = ids.length ? await supabase.from("receipt_item_claims").select("item_id, user_id, units").in("item_id", ids) : { data: [] as { item_id: string; user_id: string; units: number | string }[] };
  const claims: Claims = {};
  for (const c of claimRows ?? []) { (claims[c.item_id] ??= {})[c.user_id] = Number(c.units); }
  return { receipt: receipt as ReceiptRow, items: (items ?? []) as ReceiptItemRow[], charges: (charges ?? []) as ReceiptChargeRow[], claims };
}

/** Live receipt: refetches when the row changes (queued → processing → ready). */
export function useReceipt(receiptId: string | undefined) {
  const [data, setData] = useState<ReceiptBundle | null>(null);
  const [error, setError] = useState<string | null>(null);
  const reload = useCallback(async () => {
    if (!receiptId) return;
    if (receiptId === DEMO_ID) { setData(demoBundle()); return; }
    try { setData(await fetchReceipt(receiptId)); setError(null); } catch (e) { setError(e instanceof Error ? e.message : "Couldn't load the receipt."); }
  }, [receiptId]);
  useEffect(() => { reload(); }, [reload]);
  useEffect(() => {
    if (!receiptId || receiptId === DEMO_ID) return;
    const ch = supabase.channel(`receipt:${receiptId}:${Math.random().toString(36).slice(2, 8)}`)
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "receipts", filter: `id=eq.${receiptId}` }, () => reload())
      .subscribe();
    // belt and braces while the read is in flight: Realtime can lag a cold start
    const poll = setInterval(() => { if (!data || data.receipt.status === "queued" || data.receipt.status === "processing") reload(); }, 4000);
    return () => { supabase.removeChannel(ch); clearInterval(poll); };
  }, [receiptId, reload]); // eslint-disable-line react-hooks/exhaustive-deps
  return { data, error, reload };
}

/** The engine's view of a receipt bundle. */
export function toSplitReceipt(b: ReceiptBundle): SplitReceipt {
  return {
    items: b.items.map((i) => ({ id: i.id, name: i.name, quantity: i.quantity, lineTotalCents: i.line_total_cents, kind: i.kind })),
    charges: b.charges.map((c) => ({ id: c.id, kind: c.kind, label: c.label, amountCents: c.amount_cents, appliesTo: c.applies_to, itemId: c.item_id })),
    subtotalCents: b.receipt.subtotal_cents, taxIncluded: b.receipt.tax_included,
  };
}

/* ───────────────────────── editing lines ───────────────────────── */

async function refreshReceiptTotals(receiptId: string): Promise<void> {
  const b = await fetchReceipt(receiptId); if (!b) return;
  const itemDisc = b.charges.filter((c) => c.kind === "discount" && c.item_id).reduce((s, c) => s - Math.abs(c.amount_cents), 0);
  const subtotal = b.items.reduce((s, i) => s + i.line_total_cents, 0) + itemDisc;
  const other = b.charges.filter((c) => c.kind === "discount" && !c.item_id).reduce((s, c) => s - Math.abs(c.amount_cents), 0);
  const computed = subtotal + (b.receipt.tax_included ? 0 : b.receipt.tax_cents ?? 0) + (b.receipt.fees_cents ?? 0) + other;
  const printed = b.receipt.printed_total_cents;
  const reconciled = printed == null || Math.abs(computed - printed) <= 1;
  await supabase.from("receipts").update({ subtotal_cents: subtotal, reconciled, status: reconciled && b.receipt.status === "needs_review" ? "ready" : b.receipt.status, error: reconciled ? null : b.receipt.error }).eq("id", receiptId);
}

export async function updateReceiptItem(item: ReceiptItemRow, patch: { name?: string; quantity?: number; line_total_cents?: number }): Promise<void> {
  if (item.receipt_id === DEMO_ID) return;
  const { error } = await supabase.from("receipt_items").update({ ...patch, edited_by_user: true }).eq("id", item.id);
  if (error) throw error;
  track("receipt_line_edited", { field: Object.keys(patch).join(",") });
  await refreshReceiptTotals(item.receipt_id);
}

export async function addReceiptItem(receiptId: string, position: number, name: string, quantity: number, lineTotalCents: number): Promise<void> {
  if (receiptId === DEMO_ID) return;
  const { error } = await supabase.from("receipt_items").insert({ receipt_id: receiptId, position, name, quantity, line_total_cents: lineTotalCents, kind: "other", confidence: "high", edited_by_user: true });
  if (error) throw error;
  track("receipt_line_edited", { field: "added" });
  await refreshReceiptTotals(receiptId);
}

export async function deleteReceiptItem(item: ReceiptItemRow): Promise<void> {
  if (item.receipt_id === DEMO_ID) return;
  const { error } = await supabase.from("receipt_items").delete().eq("id", item.id);
  if (error) throw error;
  track("receipt_line_edited", { field: "deleted" });
  await refreshReceiptTotals(item.receipt_id);
}

/* ───────────────────────── the split draft (shared by the three method screens) ───────────────────────── */

export type Method = "equal" | "exact" | "itemized";
export type SplitDraft = {
  tip: TipChoice;
  method: Method | null;
  participants: string[];
  claims: Claims;
  amounts: Record<string, number>;
  active: string;          // picker: "all" or a user id
  expenseId: string | null;
  description: string | null;
  seeded: boolean;
};
const EMPTY: SplitDraft = { tip: { mode: "percent", percent: 20 }, method: null, participants: [], claims: {}, amounts: {}, active: "", expenseId: null, description: null, seeded: false };
const drafts = new Map<string, SplitDraft>();
const listeners = new Map<string, Set<() => void>>();
function emit(id: string) { listeners.get(id)?.forEach((l) => l()); }
export function getDraft(id: string): SplitDraft { return drafts.get(id) ?? EMPTY; }
export function setDraft(id: string, patch: Partial<SplitDraft> | ((d: SplitDraft) => Partial<SplitDraft>)): void {
  const cur = getDraft(id);
  const next = { ...cur, ...(typeof patch === "function" ? patch(cur) : patch) };
  drafts.set(id, next); emit(id);
}
export function resetDraft(id: string): void { drafts.delete(id); emit(id); }
export function useSplitDraft(id: string): [SplitDraft, (p: Partial<SplitDraft> | ((d: SplitDraft) => Partial<SplitDraft>)) => void] {
  const subscribe = useCallback((l: () => void) => { const set = listeners.get(id) ?? new Set(); set.add(l); listeners.set(id, set); return () => { set.delete(l); }; }, [id]);
  const draft = useSyncExternalStore(subscribe, () => getDraft(id), () => getDraft(id));
  const update = useCallback((p: Partial<SplitDraft> | ((d: SplitDraft) => Partial<SplitDraft>)) => setDraft(id, p), [id]);
  return [draft, update];
}

/* ───────────────────────── saving ───────────────────────── */

export type SavePayload = {
  trip_id: string; receipt_id: string; expense_id?: string | null; method: Method; tip: TipChoice; participants: string[];
  claims?: Claims; amounts?: Record<string, number>; shares: Record<string, number>; description?: string | null; currency?: string | null;
};
export async function saveReceiptExpense(p: SavePayload): Promise<{ expense_id: string; grand_cents: number }> {
  if (p.receipt_id === DEMO_ID) return { expense_id: "demo", grand_cents: Object.values(p.shares).reduce((a, b) => a + b, 0) };
  const { data, error } = await supabase.functions.invoke<{ expense_id: string; grand_cents: number; error?: string }>("receipt-save", { body: p });
  if (error) {
    // the function body carries the reason (split mismatch, unclaimed food, settled trip)
    let detail = error.message;
    try { const ctx = (error as { context?: Response }).context; if (ctx && typeof ctx.json === "function") detail = (await ctx.json())?.error ?? detail; } catch { /* keep message */ }
    throw new Error(detail);
  }
  if (!data || data.error) throw new Error(data?.error ?? "Couldn't save the expense.");
  track("receipt_expense_saved", { method: p.method, people: p.participants.length, items: Object.keys(p.claims ?? {}).length });
  return data;
}

export function sharesByPerson(shares: Share[]): Record<string, number> {
  return Object.fromEntries(shares.map((s) => [s.personId, s.totalCents]));
}

/* ───────────────────────── demo (DEV screenshots: ?receipt=demo) ───────────────────────── */

export const DEMO_ID = "demo";
export const DEMO_TRIP_ID = "demo-trip";
export const DEMO_PEOPLE = [
  { user_id: "you", display_name: "You", first: "You" },
  { user_id: "pp", display_name: "Priya Patel", first: "Priya" },
  { user_id: "mc", display_name: "Mike Chen", first: "Mike" },
  { user_id: "jt", display_name: "Jordan Tran", first: "Jordan" },
  { user_id: "ja", display_name: "Jess Alvarez", first: "Jess" },
  { user_id: "br", display_name: "Bradley Ross", first: "Bradley" },
];
export let demoStatus: ReceiptStatus = "ready";
export function setDemoStatus(s: ReceiptStatus) { demoStatus = s; }
export function demoBundle(): ReceiptBundle {
  const items: ReceiptItemRow[] = [
    ["guac", "Guacamole & chips", 1, 1400, "food"], ["cev", "Ceviche tostadas", 1, 1800, "food"], ["fish", "Fish tacos", 1, 1600, "food"], ["carne", "Carne asada plate", 1, 2400, "food"],
    ["shrimp", "Shrimp enchiladas", 1, 2100, "food"], ["marg", "Margarita", 2, 2400, "alcohol"], ["pac", "Pacifico", 3, 1800, "alcohol"], ["churro", "Churros", 1, 900, "food"],
  ].map(([id, name, quantity, cents, kind], i) => ({ id: id as string, receipt_id: DEMO_ID, position: i, name: name as string, raw_text: (name as string).toUpperCase(), quantity: quantity as number, line_total_cents: cents as number, kind: kind as ItemKind, confidence: "high", edited_by_user: false }));
  const needsReview = demoStatus === "needs_review";
  return {
    receipt: {
      id: DEMO_ID, trip_id: DEMO_TRIP_ID, expense_id: null, storage_path: "demo/demo.jpg", status: demoStatus, merchant: "El Faro Cantina", receipt_date: "2026-10-11", currency: "USD",
      subtotal_cents: 14400, tax_cents: 1188, fees_cents: 0, discounts_cents: 0, printed_total_cents: 15588, tip_printed_cents: null, tax_included: false,
      reconciled: !needsReview, error: needsReview ? "items add to 14200, subtotal printed 14400" : demoStatus === "failed" ? "unreadable" : null, created_by: "you", created_at: "2026-10-11T20:00:00Z",
    },
    items: needsReview ? items.map((it) => (it.id === "fish" ? { ...it, line_total_cents: 1400, confidence: "low" } : it)) : items,
    charges: [{ id: "tax1", receipt_id: DEMO_ID, kind: "tax", label: "TAX 8.25%", amount_cents: 1188, applies_to: "all", item_id: null, position: 0 }],
    claims: {},
  };
}
