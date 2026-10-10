import { NextResponse, type NextRequest } from "next/server";
import { defaultLocale, isLocale, LOCALE_COOKIE, type Locale } from "@/i18n/config";

/** Cookie first (an explicit choice), then the browser's languages, then Indonesian. */
function preferredLocale(request: NextRequest): Locale {
  const saved = request.cookies.get(LOCALE_COOKIE)?.value;
  if (saved && isLocale(saved)) return saved;

  const accepted = request.headers.get("accept-language") ?? "";
  for (const part of accepted.split(",")) {
    const tag = part.split(";")[0].trim().toLowerCase().slice(0, 2);
    if (isLocale(tag)) return tag;
  }
  return defaultLocale;
}

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const first = pathname.split("/")[1] ?? "";
  if (isLocale(first)) return NextResponse.next();

  const url = request.nextUrl.clone();
  url.pathname = `/${preferredLocale(request)}${pathname === "/" ? "" : pathname}`;
  return NextResponse.redirect(url);
}

export const config = {
  // Everything except Next internals, API routes and files with an extension.
  matcher: ["/((?!api|_next|.*\\..*).*)"],
};
