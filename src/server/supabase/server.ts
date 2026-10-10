import "server-only";
import { createServerClient } from "@supabase/ssr";
import { connection } from "next/server";
import { cookies } from "next/headers";
import { env } from "@/server/env";
import type { Database } from "@/server/db/database.types";

/**
 * Supabase acting as the signed-in person: every query runs under their
 * session, so row level security decides what they can see and change.
 */
export async function supabaseForUser() {
  // Auth checks token expiry against the clock: always a request-time render.
  await connection();
  const store = await cookies();
  return createServerClient<Database>(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    {
      cookies: {
        getAll: () => store.getAll(),
        setAll: (toSet) => {
          try {
            toSet.forEach(({ name, value, options }) => store.set(name, value, options));
          } catch {
            // Server Components cannot set cookies; the proxy refreshes the session instead.
          }
        },
      },
    },
  );
}
