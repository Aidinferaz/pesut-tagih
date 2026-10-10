import { ChevronRight, MessageCircle, Plus } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { Greeting } from "@/components/home/Greeting";
import { PesutRiver } from "@/components/home/PesutRiver";
import { buttonClass } from "@/components/ui/Button";
import { HullSwatch } from "@/components/ui/HullSwatch";
import { Panel, PanelTitle } from "@/components/ui/Panel";
import { isLocale, type Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/dictionaries/id";
import { format } from "@/i18n/format";
import { getDictionary } from "@/i18n/get-dictionary";
import { requireUser } from "@/server/auth";
import { listMyGroups } from "@/server/db/groups";
import { getProfile } from "@/server/db/profile";

export async function generateMetadata({ params }: PageProps<"/[lang]/home">): Promise<Metadata> {
  const { lang } = await params;
  if (!isLocale(lang)) return {};
  return { title: (await getDictionary(lang)).nav.home };
}

export default async function HomePage({ params }: PageProps<"/[lang]/home">) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();
  const t = await getDictionary(lang);

  return (
    <main className="mx-auto grid max-w-[90rem] grid-cols-1 gap-5 px-4 py-6 sm:px-8 lg:gap-7 lg:px-10 lg:py-8">
      <Suspense fallback={<HomeSkeleton />}>
        <HomeContent lang={lang} t={t} />
      </Suspense>
    </main>
  );
}

async function HomeContent({ lang, t }: { lang: Locale; t: Dictionary }) {
  const user = await requireUser(lang);
  const [profile, groups] = await Promise.all([getProfile(user.id), listMyGroups(user.id)]);

  return (
    <>
      <header className="flex flex-wrap items-end justify-between gap-4">
        <Greeting name={profile?.name ?? ""} />
        <div className="hidden gap-3 sm:flex">
          <Link href={`/${lang}/chat`} className={buttonClass("outline")}>
            <MessageCircle className="size-[18px]" strokeWidth={2.25} aria-hidden />
            {t.actions.askPesut}
          </Link>
          <Link href={`/${lang}/groups/new`} className={buttonClass("primary")}>
            <Plus className="size-[18px]" strokeWidth={2.75} aria-hidden />
            {t.groups.create}
          </Link>
        </div>
      </header>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[1.15fr_1fr] lg:gap-7">
        {groups.length === 0 ? (
          <Panel aria-labelledby="onboarding-title">
            <PanelTitle id="onboarding-title">{t.onboarding.title}</PanelTitle>
            <p className="text-ink-soft mt-3 max-w-prose">{t.onboarding.body}</p>
            <Link href={`/${lang}/groups/new`} className={buttonClass("primary", "mt-5")}>
              <Plus className="size-[18px]" strokeWidth={2.75} aria-hidden />
              {t.onboarding.create}
            </Link>
          </Panel>
        ) : (
          <Panel aria-labelledby="groups-title">
            <PanelTitle id="groups-title">{t.groups.yours}</PanelTitle>
            <ul className="mt-3">
              {groups.map((group) => (
                <li key={group.id} className="border-line border-b-2 last:border-0">
                  <Link
                    href={`/${lang}/groups/${group.id}`}
                    className="hover:bg-surface-sunk flex items-center gap-4 rounded-md py-3.5"
                  >
                    <HullSwatch hull={group.hull} className="h-5 w-10" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-bold">{group.name}</span>
                      <span className="text-ink-soft text-sm">
                        {format(t.groups.members, { count: group.memberCount })}
                        {group.role === "admin" && ` · ${t.groups.admin}`}
                      </span>
                    </span>
                    <ChevronRight className="text-muted size-5" aria-hidden />
                  </Link>
                </li>
              ))}
            </ul>
          </Panel>
        )}
        <PesutRiver
          mood="idle"
          opening={groups.length === 0 ? t.onboarding.pesut : t.pesut.idleEven}
        />
      </div>
    </>
  );
}

function HomeSkeleton() {
  return (
    <div aria-hidden className="grid gap-5">
      <div className="bg-surface-sunk h-12 w-2/3 max-w-md animate-pulse rounded-md" />
      <div className="grid gap-5 lg:grid-cols-[1.15fr_1fr]">
        <div className="bg-surface-sunk h-64 animate-pulse rounded-[10px]" />
        <div className="bg-surface-sunk h-64 animate-pulse rounded-[10px]" />
      </div>
    </div>
  );
}
