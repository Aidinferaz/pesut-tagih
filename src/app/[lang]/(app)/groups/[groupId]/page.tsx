import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { lang as rootLang } from "next/root-params";
import { Suspense } from "react";
import { z } from "zod";
import { InvitePanel } from "@/components/groups/InvitePanel";
import { LeaveGroupButton } from "@/components/groups/LeaveGroupButton";
import { HullSwatch } from "@/components/ui/HullSwatch";
import { Panel, PanelTitle } from "@/components/ui/Panel";
import { isLocale, type Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/dictionaries/id";
import { format } from "@/i18n/format";
import { getDictionary } from "@/i18n/get-dictionary";
import { requireUser } from "@/server/auth";
import { getGroup } from "@/server/db/groups";

export async function generateMetadata({
  params,
}: PageProps<"/[lang]/groups/[groupId]">): Promise<Metadata> {
  const { lang } = await params;
  if (!isLocale(lang)) return {};
  return { title: (await getDictionary(lang)).nav.groups };
}

export default async function GroupPage({ params }: PageProps<"/[lang]/groups/[groupId]">) {
  const lang = await rootLang();
  if (!isLocale(lang)) notFound();
  const t = await getDictionary(lang);
  return (
    <main className="mx-auto grid max-w-[90rem] grid-cols-1 gap-5 px-4 py-6 sm:px-8 lg:gap-7 lg:px-10 lg:py-8">
      <Suspense
        fallback={<div className="bg-surface-sunk h-96 animate-pulse rounded-[10px]" aria-hidden />}
      >
        <GroupContent lang={lang} t={t} params={params} />
      </Suspense>
    </main>
  );
}

async function GroupContent({
  lang,
  t,
  params,
}: {
  lang: Locale;
  t: Dictionary;
  params: PageProps<"/[lang]/groups/[groupId]">["params"];
}) {
  const { groupId } = await params;
  if (!z.uuid().safeParse(groupId).success) notFound();
  const user = await requireUser(lang);
  const group = await getGroup(groupId);
  if (!group) notFound();
  const me = group.members.find((m) => m.id === user.id);

  return (
    <>
      <header className="flex items-center gap-4">
        <HullSwatch hull={group.hull} className="h-7 w-14" />
        <div>
          <h1 className="display text-[2.5rem] uppercase sm:text-[3rem]">{group.name}</h1>
          <p className="text-ink-soft font-semibold">
            {format(t.groups.members, { count: group.members.length })}
          </p>
        </div>
      </header>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[1.15fr_1fr] lg:gap-7">
        <Panel>
          <p className="text-ink-soft">{t.groups.ledgerSoon}</p>
        </Panel>
        <div className="grid content-start gap-5 lg:gap-7">
          <Panel aria-labelledby="members-title">
            <PanelTitle id="members-title">{t.groups.membersTitle}</PanelTitle>
            <ul className="mt-3">
              {group.members.map((m) => (
                <li
                  key={m.id}
                  className="border-line flex items-center gap-3 border-b py-2.5 last:border-0"
                >
                  <span
                    aria-hidden
                    className="bg-plate text-plate-ink grid size-9 place-items-center rounded-md font-bold"
                  >
                    {m.name.slice(0, 1).toUpperCase()}
                  </span>
                  <span className="flex-1 font-semibold">{m.name}</span>
                  {m.role === "admin" && (
                    <span className="text-muted text-sm font-bold">{t.groups.admin}</span>
                  )}
                </li>
              ))}
            </ul>
          </Panel>
          {me?.role === "admin" && <InvitePanel groupId={group.id} groupName={group.name} />}
          <LeaveGroupButton groupId={group.id} />
        </div>
      </div>
    </>
  );
}
