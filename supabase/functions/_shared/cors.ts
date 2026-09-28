export const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-checkm8-secret",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
export function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}
/** Internal calls from Postgres (pg_net) carry the shared secret. */
export function internalOk(req: Request): boolean {
  const want = Deno.env.get("CHECKM8_INTERNAL_SECRET");
  const got = req.headers.get("x-checkm8-secret");
  return !!want && !!got && got === want;
}
