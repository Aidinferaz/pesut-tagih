"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Suspense } from "react";
import { LOCALE_COOKIE, locales, type Locale } from "@/i18n/config";
import { useI18n } from "@/i18n/provider";

/** Remembered for a year so the proxy sends this person to their language next time. */
function rememberLocale(next: Locale) {
  document.cookie = `${LOCALE_COOKIE}=${next}; path=/; max-age=31536000; samesite=lax`;
}

type Tone = { tone?: "rail" | "surface" };

/** The switch keeps you on the same page; until the path is known it links to each language's home. */
export function LanguageSwitch({ tone = "rail" }: Tone) {
  return (
    <Suspense fallback={<Switch tone={tone} rest="" />}>
      <CurrentPageSwitch tone={tone} />
    </Suspense>
  );
}

function CurrentPageSwitch({ tone }: Tone) {
  const pathname = usePathname();
  return <Switch tone={tone} rest={pathname.split("/").slice(2).join("/")} />;
}

function Switch({ tone = "rail", rest }: Tone & { rest: string }) {
  const { locale, t } = useI18n();

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
