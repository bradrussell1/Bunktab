import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

/** Server client for server components and route handlers (anon key + the viewer's cookie session). */
export async function supabaseServer() {
  const store = await cookies();
  return createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    cookies: {
      getAll: () => store.getAll(),
      setAll: (all) => { try { for (const c of all) store.set(c.name, c.value, c.options); } catch { /* read-only in server components; middleware refreshes */ } },
    },
  });
}
