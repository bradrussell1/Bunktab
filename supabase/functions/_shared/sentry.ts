/**
 * Minimal Sentry reporter for Edge Functions: posts an envelope to Sentry's store endpoint when the
 * SENTRY_DSN secret is set, otherwise does nothing. No SDK, no content: only the error class and
 * message (scrubbed of digits runs), the function name and the tags the caller passes (ids, status).
 */
const DSN = Deno.env.get("SENTRY_DSN") ?? "";
const parsed = (() => {
  try {
    if (!DSN) return null;
    const u = new URL(DSN);
    const projectId = u.pathname.replace(/^\//, "");
    return { key: u.username, host: u.host, projectId, endpoint: `${u.protocol}//${u.host}/api/${projectId}/envelope/` };
  } catch { return null; }
})();
export const sentryEnabled = !!parsed;

const scrub = (s: string) => s.replace(/\d[\d\s().-]{6,}\d/g, "[number]").slice(0, 500);

export async function reportError(fn: string, err: unknown, tags: Record<string, string | number | boolean | null | undefined> = {}): Promise<void> {
  if (!parsed) return;
  const e = err instanceof Error ? err : new Error(String(err));
  const eventId = crypto.randomUUID().replace(/-/g, "");
  const now = new Date().toISOString();
  const cleanTags: Record<string, string> = { function: fn };
  for (const [k, v] of Object.entries(tags)) if (v !== undefined && v !== null) cleanTags[k] = String(v).slice(0, 100);
  const event = {
    event_id: eventId, timestamp: now, platform: "javascript", level: "error", logger: "edge",
    release: `zebrasplit-functions@${Deno.env.get("FUNCTIONS_RELEASE") ?? "live"}`, environment: Deno.env.get("SENTRY_ENV") ?? "production",
    tags: cleanTags,
    exception: { values: [{ type: e.name || "Error", value: scrub(e.message || "error"), stacktrace: e.stack ? { frames: e.stack.split("\n").slice(1, 12).map((l) => ({ function: scrub(l.trim()) })) } : undefined }] },
  };
  const envelope = `${JSON.stringify({ event_id: eventId, sent_at: now, dsn: DSN })}\n${JSON.stringify({ type: "event" })}\n${JSON.stringify(event)}\n`;
  try {
    await fetch(parsed.endpoint, { method: "POST", headers: { "Content-Type": "application/x-sentry-envelope", "X-Sentry-Auth": `Sentry sentry_version=7, sentry_key=${parsed.key}, sentry_client=zebrasplit-edge/1.0` }, body: envelope, signal: AbortSignal.timeout(3000) });
  } catch { /* reporting must never break the request */ }
}

/** Wrap a Deno.serve handler: uncaught errors are reported (when enabled) and answered with a plain 500. */
export function withSentry(fn: string, handler: (req: Request) => Promise<Response>): (req: Request) => Promise<Response> {
  return async (req) => {
    try {
      return await handler(req);
    } catch (err) {
      console.error(`[${fn}] unhandled`, err instanceof Error ? err.message : String(err));
      await reportError(fn, err, { method: req.method });
      return new Response(JSON.stringify({ error: "internal" }), { status: 500, headers: { "Content-Type": "application/json" } });
    }
  };
}
