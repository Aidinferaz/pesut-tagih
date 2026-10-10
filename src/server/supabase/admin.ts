import "server-only";
import { createClient } from "@supabase/supabase-js";
import { env } from "@/server/env";
import type { Database } from "@/server/db/database.types";

/**
 * Supabase with the secret key: bypasses row level security. Only for jobs
 * that act on nobody's behalf (the daily cron, the Telegram webhook). Never
 * use it to answer a request a person made from the browser.
 */
export function supabaseAdmin() {
  return createClient<Database>(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SECRET_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
