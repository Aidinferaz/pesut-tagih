"use client";

import Link from "next/link";
import { PesutSprite } from "@/components/pesut/PesutSprite";
import { buttonClass } from "@/components/ui/Button";
import { useI18n } from "@/i18n/provider";

export default function NotFound() {
  const { t, locale } = useI18n();
  return (
    <main className="mx-auto grid min-h-dvh max-w-xl place-content-center gap-5 px-4 py-16 text-center">
      <PesutSprite className="mx-auto w-48" />
      <h1 className="display text-[3rem] uppercase">{t.pages.notFoundTitle}</h1>
      <p className="text-ink-soft">{t.pages.notFoundBody}</p>
      <Link href={`/${locale}/home`} className={buttonClass("primary", "mx-auto")}>
        {t.pages.home}
      </Link>
    </main>
  );
}
