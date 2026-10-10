"use client";

import Link from "next/link";
import { PesutSprite } from "@/components/pesut/PesutSprite";
import { Button, buttonClass } from "@/components/ui/Button";
import { useI18n } from "@/i18n/provider";

export default function ErrorPage({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const { t, locale } = useI18n();
  return (
    <main className="mx-auto grid max-w-xl place-content-center gap-5 px-4 py-16 text-center">
      <PesutSprite className="mx-auto w-48" />
      <h1 className="display text-[3rem] uppercase">{t.pages.errorTitle}</h1>
      <p className="text-ink-soft">{t.pages.errorBody}</p>
      <div className="flex justify-center gap-3">
        <Button onClick={reset}>{t.pages.retry}</Button>
        <Link href={`/${locale}/home`} className={buttonClass("outline")}>
          {t.pages.home}
        </Link>
      </div>
    </main>
  );
}
