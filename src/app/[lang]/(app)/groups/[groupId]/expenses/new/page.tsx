import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { lang as rootLang } from "next/root-params";
import { Suspense } from "react";
import { z } from "zod";
import { ExpenseForm } from "@/components/expenses/ExpenseForm";
import { Panel } from "@/components/ui/Panel";
import { isLocale, type Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/dictionaries/id";
import { getDictionary } from "@/i18n/get-dictionary";
import { requireUser } from "@/server/auth";
import { getGroup } from "@/server/db/groups";
import { aiEnabled } from "@/server/ai/model";

type Params = PageProps<"/[lang]/groups/[groupId]/expenses/new">;

export async function generateMetadata(): Promise<Metadata> {
  const lang = await rootLang();
  if (!isLocale(lang)) return {};
  return { title: (await getDictionary(lang)).expenseForm.title };
}

export default async function NewExpensePage({ params }: Params) {
  const lang = await rootLang();
  if (!isLocale(lang)) notFound();
  const t = await getDictionary(lang);
  return (
    <main className="mx-auto max-w-3xl px-4 py-6 sm:px-8 lg:py-10">
      <Suspense
        fallback={<div className="bg-surface-sunk h-96 animate-pulse rounded-[10px]" aria-hidden />}
      >
        <Content lang={lang} t={t} params={params} />
      </Suspense>
    </main>
  );
}

async function Content({
  lang,
  t,
  params,
}: {
  lang: Locale;
  t: Dictionary;
  params: Params["params"];
}) {
  const { groupId } = await params;
  if (!z.uuid().safeParse(groupId).success) notFound();
  const user = await requireUser(lang);
  const group = await getGroup(groupId);
  if (!group) notFound();
  return (
    <>
      <Link href={`/${lang}/groups/${group.id}`} className="text-ink-soft font-semibold underline">
        {group.name}
      </Link>
      <h1 className="display mt-1 mb-6 text-[2.5rem] uppercase sm:text-[3rem]">
        {t.expenseForm.title}
      </h1>
      <Panel>
        <ExpenseForm
          aiEnabled={aiEnabled()}
          groupId={group.id}
          me={user.id}
          members={group.members.map((m) => ({ id: m.id, name: m.name }))}
        />
      </Panel>
    </>
  );
}
