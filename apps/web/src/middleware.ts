import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

/** Keeps the cookie session fresh on every request (spec: Login → refresh tokens that expire). */
export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request });
  const supabase = createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (all) => {
        for (const c of all) request.cookies.set(c.name, c.value);
        response = NextResponse.next({ request });
        for (const c of all) response.cookies.set(c.name, c.value, c.options);
      },
    },
  });
  await supabase.auth.getUser();
  return response;
}

export const config = { matcher: ["/t/:path*", "/i/:path*"] };
