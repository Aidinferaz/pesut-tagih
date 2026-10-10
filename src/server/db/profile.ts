import "server-only";
import type { ProviderCode } from "@/domain/providers";
import { supabaseForUser } from "@/server/supabase/server";

export type Profile = { id: string; name: string; avatarUrl: string | null; locale: "id" | "en" };

export type PaymentMethod = {
  id: string;
  userId: string;
  provider: ProviderCode;
  accountNumber: string;
  accountName: string;
  qrisPath: string | null;
  priority: number;
};

export async function getProfile(userId: string): Promise<Profile | null> {
  const supabase = await supabaseForUser();
  const { data, error } = await supabase
    .from("profiles")
    .select("id, display_name, avatar_url, locale")
    .eq("id", userId)
    .maybeSingle();
  if (error) throw error;
  return data
    ? {
        id: data.id,
        name: data.display_name,
        avatarUrl: data.avatar_url,
        locale: data.locale as Profile["locale"],
      }
    : null;
}

/** Receiving accounts for the given people, each person's list in priority order. */
export async function listPaymentMethods(userIds: string[]): Promise<PaymentMethod[]> {
  if (userIds.length === 0) return [];
  const supabase = await supabaseForUser();
  const { data, error } = await supabase
    .from("payment_methods")
    .select("id, user_id, provider, account_number, account_name, qris_path, priority")
    .in("user_id", userIds)
    .order("priority")
    .order("created_at");
  if (error) throw error;
  return data.map((m) => ({
    id: m.id,
    userId: m.user_id,
    provider: m.provider as ProviderCode,
    accountNumber: m.account_number,
    accountName: m.account_name,
    qrisPath: m.qris_path,
    priority: m.priority,
  }));
}
