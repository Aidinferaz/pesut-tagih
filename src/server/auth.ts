import "server-only";
import { redirect } from "next/navigation";
import type { Locale } from "@/i18n/config";
import { supabaseForUser } from "@/server/supabase/server";

export type CurrentUser = { id: string; email: string | null };

/** The signed-in person, verified against Supabase, or null. */
export async function getCurrentUser(): Promise<CurrentUser | null> {
  const supabase = await supabaseForUser();
  const { data, error } = await supabase.auth.getClaims();
  if (error || !data?.claims?.sub) return null;
  return { id: data.claims.sub, email: (data.claims.email as string | undefined) ?? null };
}

/** For pages behind sign-in: sends anyone else to the landing page. */
export async function requireUser(locale: Locale): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) redirect(`/${locale}`);
  return user;
}

/** Only relative, same-site paths may be used as a post-login destination. */
export function safeNext(next: string | null | undefined, fallback: string): string {
  if (!next || !next.startsWith("/") || next.startsWith("//") || next.includes("\\"))
    return fallback;
  return next;
}
