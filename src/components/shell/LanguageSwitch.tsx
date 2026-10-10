"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LOCALE_COOKIE, locales, type Locale } from "@/i18n/config";
import { useI18n } from "@/i18n/provider";

/** Remembered for a year so the proxy sends this person to their language next time. */
function rememberLocale(next: Locale) {
  document.cookie = `${LOCALE_COOKIE}=${next}; path=/; max-age=31536000; samesite=lax`;
}

export function LanguageSwitch({ tone = "rail" }: { tone?: "rail" | "surface" }) {
  const { locale, t } = useI18n();
  const pathname = usePathname();
  const rest = pathname.split("/").slice(2).join("/");

  const idle =
    tone === "rail" ? "text-rail-ink-soft hover:text-rail-ink" : "text-muted hover:text-ink";
  const on = tone === "rail" ? "bg-rail-deep text-rail-ink" : "bg-surface-sunk text-ink";

  return (
    <nav aria-label={t.language.label} className="inline-flex gap-1">
      {locales.map((code) => (
        <Link
          key={code}
          href={`/${code}${rest ? `/${rest}` : ""}`}
          hrefLang={code}
          lang={code}
          aria-current={code === locale ? "true" : undefined}
          aria-label={t.language[code]}
          onClick={() => rememberLocale(code)}
          className={`grid h-9 min-w-9 place-items-center rounded-md px-2 text-sm font-bold uppercase transition-colors ${code === locale ? on : idle}`}
        >
          {code}
        </Link>
      ))}
    </nav>
  );
}
