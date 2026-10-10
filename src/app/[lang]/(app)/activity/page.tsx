import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { Plate } from "@/components/ui/Plate";
import { Panel } from "@/components/ui/Panel";
import { intlLocale, isLocale, type Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/dictionaries/id";
import { format } from "@/i18n/format";
import { getDictionary } from "@/i18n/get-dictionary";
import { plateNumber, rupiah } from "@/lib/format";
import { requireUser } from "@/server/auth";
import { listActivity, type ActivityEntry } from "@/server/db/activity";

export async function generateMetadata({
  params,
}: PageProps<"/[lang]/activity">): Promise<Metadata> {
  const { lang } = await params;
  if (!isLocale(lang)) return {};
  return { title: (await getDictionary(lang)).activity.title };
}

export default async function ActivityPage({ params }: PageProps<"/[lang]/activity">) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();
  const t = await getDictionary(lang);
  return (
    <main className="mx-auto grid max-w-4xl gap-5 px-4 py-6 sm:px-8 lg:py-10">
      <div>
        <h1 className="display text-[2.5rem] uppercase sm:text-[3rem]">{t.activity.title}</h1>
        <p className="text-ink-soft mt-2 max-w-prose">{t.activity.body}</p>
      </div>
      <Suspense
        fallback={<div className="bg-surface-sunk h-96 animate-pulse rounded-[10px]" aria-hidden />}
      >
        <Feed lang={lang} t={t} />
      </Suspense>
    </main>
  );
}

function describe(
  entry: ActivityEntry,
  names: Record<string, string>,
  t: Dictionary,
  locale: Locale,
) {
  const d = entry.details;
  const who = (id: unknown) => (typeof id === "string" && names[id]) || t.activity.someone;
  let key = entry.action;
  if (key === "settlement.confirmed" && d.auto) key = "settlement.confirmedAuto";
  const template = t.activity.actions[key as keyof Dictionary["activity"]["actions"]];
  if (!template) return entry.action;
  return format(template, {
    actor: who(entry.actor),
    title: String(d.title ?? ""),
    amount: rupiah(Number(d.total ?? d.amount ?? 0), locale),
    from: who(d.from),
    to: who(d.to),
  });
}

async function Feed({ lang, t }: { lang: Locale; t: Dictionary }) {
  await requireUser(lang);
  const { entries, names } = await listActivity();
  if (entries.length === 0) {
    return (
      <Panel>
        <p className="text-ink-soft">{t.activity.empty}</p>
      </Panel>
    );
  }
  const when = new Intl.DateTimeFormat(intlLocale[lang], {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Makassar",
  });
  return (
    <Panel>
      <ol>
        {entries.map((entry) => (
          <li
            key={entry.id}
            className="border-line grid gap-1 border-b py-3 last:border-0 sm:grid-cols-[minmax(0,1fr)_auto] sm:gap-4"
          >
            <p>
              {typeof entry.details.number === "number" && (
                <span className="mr-2">
                  <Plate size="sm">{plateNumber("PT", entry.details.number)}</Plate>
                </span>
              )}
              <span className="font-semibold">{describe(entry, names, t, lang)}</span>
            </p>
            <p className="text-ink-soft text-sm sm:text-right">
              <Link href={`/${lang}/groups/${entry.groupId}`} className="font-semibold underline">
                {entry.groupName}
              </Link>
              {" · "}
              <time dateTime={entry.createdAt}>{when.format(new Date(entry.createdAt))}</time>
            </p>
          </li>
        ))}
      </ol>
    </Panel>
  );
}
