import { NextResponse, type NextRequest } from "next/server";
import { defaultLocale } from "@/i18n/config";
import { safeNext } from "@/server/auth";
import { supabaseForUser } from "@/server/supabase/server";

/** Where Google (or a dev magic link) sends people back after signing in. */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const code = searchParams.get("code");
  const next = safeNext(searchParams.get("next"), `/${defaultLocale}/home`);

  if (code) {
    const supabase = await supabaseForUser();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(new URL(next, origin));
  }
  const lang = next.split("/")[1] || defaultLocale;
  return NextResponse.redirect(new URL(`/${lang}?error=signin`, origin));
}
