import "server-only";
import { env } from "@/server/env";
import { supabaseForUser } from "@/server/supabase/server";

/** Counts one use against today's allowance (Asia/Makassar day); false when it's used up. */
export async function consumeQuota(kind: "chat" | "scan"): Promise<boolean> {
  const supabase = await supabaseForUser();
  const { data, error } = await supabase.rpc("consume_ai_quota", {
    kind,
    daily_limit: kind === "chat" ? env.AI_DAILY_CHATS : env.AI_DAILY_SCANS,
  });
  return !error && data === true;
}
