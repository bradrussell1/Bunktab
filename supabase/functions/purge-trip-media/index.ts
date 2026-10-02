// purge-trip-media: when a trip is deleted, remove its cover and receipts
// from the private buckets (spec: Files and receipts → "deleted with the
// trip"). Called by Postgres (trips delete trigger → pg_net) with the shared
// secret. Body: { trip_id }
import { createClient } from "npm:@supabase/supabase-js@2";
import { internalOk, json } from "../_shared/cors.ts";

Deno.serve(async (req) => {
  if (req.method !== "POST") return json({ error: "method" }, 405);
  if (!internalOk(req)) return json({ error: "unauthorized" }, 401);
  const { trip_id } = await req.json().catch(() => ({}));
  if (!trip_id || !/^[0-9a-f-]{36}$/i.test(trip_id)) return json({ error: "bad request" }, 400);

  const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });
  const removed: Record<string, number> = {};
  for (const bucket of ["covers", "receipts"]) {
    let total = 0;
    // list is paged; loop until empty
    for (;;) {
      const { data: objs, error } = await admin.storage.from(bucket).list(trip_id, { limit: 100 });
      if (error) return json({ error: `${bucket}: ${error.message}` }, 500);
      if (!objs?.length) break;
      const paths = objs.filter((o) => o.name).map((o) => `${trip_id}/${o.name}`);
      const { error: e2 } = await admin.storage.from(bucket).remove(paths);
      if (e2) return json({ error: `${bucket}: ${e2.message}` }, 500);
      total += paths.length;
      if (objs.length < 100) break;
    }
    removed[bucket] = total;
  }
  return json({ ok: true, trip_id, removed });
});
