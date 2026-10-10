import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { env } from "@/server/env";

/**
 * Refreshes the Supabase session cookie on the way through the proxy, so
 * Server Components (which cannot write cookies) always see a live session.
 */
export async function refreshSession(request: NextRequest, response: NextResponse) {
  let out = response;
  const supabase = createServerClient(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: (toSet) => {
          toSet.forEach(({ name, value }) => request.cookies.set(name, value));
          out = NextResponse.next({ request });
          response.headers.forEach((value, key) => out.headers.set(key, value));
          toSet.forEach(({ name, value, options }) => out.cookies.set(name, value, options));
        },
      },
    },
  );
  await supabase.auth.getClaims();
  return out;
}
