import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { lang as rootLang } from "next/root-params";
import { Suspense } from "react";
import { z } from "zod";
import { GroupSettingsPanel } from "@/components/groups/GroupSettingsPanel";
import { InvitePanel } from "@/components/groups/InvitePanel";
import { LeaveGroupButton } from "@/components/groups/LeaveGroupButton";
import { Panel, PanelTitle } from "@/components/ui/Panel";
import { isLocale, type Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/dictionaries/id";
import { getDictionary } from "@/i18n/get-dictionary";
import { requireUser } from "@/server/auth";
import { getGroup } from "@/server/db/groups";
import { env } from "@/server/env";

type Params = PageProps<"/[lang]/groups/[groupId]/settings">;

export async function generateMetadata(): Promise<Metadata> {
  const lang = await rootLang();
  if (!isLocale(lang)) return {};
  return { title: (await getDictionary(lang)).groups.settingsTitle };
}

/** Everything about a group that isn't money: who's in it, inviting, settings, leaving. */
export default async function GroupSettingsPage({ params }: Params) {
  const lang = await rootLang();
  if (!isLocale(lang)) notFound();
  const t = await getDictionary(lang);
  return (
    <main className="mx-auto grid max-w-3xl gap-5 px-4 py-6 sm:px-8 lg:gap-7 lg:py-10">
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
  const isAdmin = group.members.some((m) => m.id === user.id && m.role === "admin");

  return (
    <>
      <div>
        <Link
          href={`/${lang}/groups/${group.id}`}
          className="text-ink-soft font-semibold underline"
        >
          {group.name}
        </Link>
        <h1 className="display mt-1 text-[2.5rem] uppercase sm:text-[3rem]">
          {t.groups.settingsTitle}
        </h1>
      </div>

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
              <span className="min-w-0 flex-1 truncate font-semibold">{m.name}</span>
              {m.role === "admin" && (
                <span className="text-muted text-sm font-bold">{t.groups.admin}</span>
              )}
            </li>
          ))}
        </ul>
      </Panel>

      {isAdmin && <InvitePanel groupId={group.id} groupName={group.name} />}
      {isAdmin && (
        <GroupSettingsPanel
          groupId={group.id}
          simplify={group.simplifyDebts}
          autoConfirmDays={group.autoConfirmDays}
          recapAmounts={group.recapAmounts}
          telegramLinked={group.telegramLinked}
          bot={env.TELEGRAM_BOT_TOKEN ? (env.TELEGRAM_BOT_USERNAME ?? null) : null}
        />
      )}
      <LeaveGroupButton groupId={group.id} />
    </>
  );
}
