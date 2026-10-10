import { ChevronRight } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Suspense } from "react";
import { HullSwatch } from "@/components/ui/HullSwatch";
import { Panel } from "@/components/ui/Panel";
import { isLocale, type Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/dictionaries/id";
import { getDictionary } from "@/i18n/get-dictionary";
import { requireUser } from "@/server/auth";
import { listMyGroups } from "@/server/db/groups";

export async function generateMetadata({
  params,
}: PageProps<"/[lang]/expenses/new">): Promise<Metadata> {
  const { lang } = await params;
  if (!isLocale(lang)) return {};
  return { title: (await getDictionary(lang)).expenseForm.title };
}

/** The bottom bar's "+" lands here: straight into the form when there's only one group. */
export default async function PickGroupPage({ params }: PageProps<"/[lang]/expenses/new">) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();
  const t = await getDictionary(lang);
  return (
    <main className="mx-auto max-w-3xl px-4 py-6 sm:px-8 lg:py-10">
      <h1 className="display mb-6 text-[2.5rem] uppercase sm:text-[3rem]">{t.expenseForm.title}</h1>
      <Suspense
        fallback={<div className="bg-surface-sunk h-48 animate-pulse rounded-[10px]" aria-hidden />}
      >
        <Picker lang={lang} t={t} />
      </Suspense>
    </main>
  );
}

async function Picker({ lang, t }: { lang: Locale; t: Dictionary }) {
  const user = await requireUser(lang);
  const groups = await listMyGroups(user.id);
  if (groups.length === 0) redirect(`/${lang}/groups/new`);
  if (groups.length === 1) redirect(`/${lang}/groups/${groups[0].id}/expenses/new`);
  return (
    <Panel>
      <h2 className="text-sm font-bold">{t.expenseForm.pickGroup}</h2>
      <ul className="mt-2">
        {groups.map((g) => (
          <li key={g.id} className="border-line border-b-2 last:border-0">
            <Link
              href={`/${lang}/groups/${g.id}/expenses/new`}
              className="hover:bg-surface-sunk flex items-center gap-4 rounded-md py-3.5"
            >
              <HullSwatch hull={g.hull} className="h-5 w-10" />
              <span className="flex-1 font-bold">{g.name}</span>
              <ChevronRight className="text-muted size-5" aria-hidden />
            </Link>
          </li>
        ))}
      </ul>
    </Panel>
  );
}
