"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { isLocale, defaultLocale } from "@/i18n/config";
import { safeNext } from "@/server/auth";
import { env } from "@/server/env";
import { supabaseForUser } from "@/server/supabase/server";

function callbackUrl(next: string) {
  return `${env.NEXT_PUBLIC_SITE_URL}/auth/callback?next=${encodeURIComponent(next)}`;
}

function readTarget(formData: FormData) {
  const raw = String(formData.get("lang") ?? "");
  const lang = isLocale(raw) ? raw : defaultLocale;
  return { lang, next: safeNext(String(formData.get("next") ?? ""), `/${lang}/home`) };
}

export async function signInWithGoogle(formData: FormData) {
  const { lang, next } = readTarget(formData);
  const supabase = await supabaseForUser();
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: { redirectTo: callbackUrl(next) },
  });
  if (error || !data.url) redirect(`/${lang}?error=signin`);
  redirect(data.url);
}

export type EmailSignInState = { status: "idle" | "sent" | "error" };

/** Development only: magic link to Mailpit, so the app can be tried without Google credentials. */
export async function signInWithEmail(
  _prev: EmailSignInState,
  formData: FormData,
): Promise<EmailSignInState> {
  if (!env.DEV_EMAIL_LOGIN) return { status: "error" };
  const email = z.email().safeParse(formData.get("email"));
  if (!email.success) return { status: "error" };
  const { next } = readTarget(formData);
  const supabase = await supabaseForUser();
  const { error } = await supabase.auth.signInWithOtp({
    email: email.data,
    options: { emailRedirectTo: callbackUrl(next) },
  });
  return { status: error ? "error" : "sent" };
}

export async function signOut(formData: FormData) {
  const { lang } = readTarget(formData);
  const supabase = await supabaseForUser();
  await supabase.auth.signOut();
  redirect(`/${lang}`);
}
