import { ChevronRight, MessageCircle, Plus } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { Greeting } from "@/components/home/Greeting";
import { PesutRiver } from "@/components/home/PesutRiver";
import { BalancePanel } from "@/components/ledger/BalancePanel";
import { buttonClass } from "@/components/ui/Button";
import { HullSwatch } from "@/components/ui/HullSwatch";
import { Panel, PanelTitle } from "@/components/ui/Panel";
import { isLocale, type Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/dictionaries/id";
import { format } from "@/i18n/format";
import { getDictionary } from "@/i18n/get-dictionary";
import { requireUser } from "@/server/auth";
import { listMyBooks, viewForMember } from "@/server/db/ledger";
import { env } from "@/server/env";
import { RoutesPanel } from "@/components/ledger/RoutesPanel";
import { getProfile } from "@/server/db/profile";
import { rupiah } from "@/lib/format";

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
  const [profile, books] = await Promise.all([getProfile(user.id), listMyBooks(user.id)]);
  const rows = books.map((book) => {
    const outgoing = book.transfers.filter((r) => r.from === user.id);
    const incoming = book.transfers.filter((r) => r.to === user.id);
    const waiting = book.settlements.filter(
      (s) => s.status === "pending" && s.to === user.id,
    ).length;
    return { book, balance: book.balances.get(user.id) ?? 0, outgoing, incoming, waiting };
  });
  const views = await Promise.all(
    rows
      .filter((r) => r.outgoing.length + r.incoming.length > 0)
      .map(async (r) => ({ book: r.book, view: await viewForMember(r.book, user.id) })),
  );
  const total = rows.reduce((sum, r) => sum + r.balance, 0);
  const scale = Math.max(
    1,
    Math.abs(total),
    ...rows.flatMap((r) => [...r.book.balances.values()].map(Math.abs)),
  );
  const outgoing = rows.flatMap((r) =>
    r.outgoing.map((route) => ({ ...route, names: r.book.group.members })),
  );
  const incoming = rows.flatMap((r) => r.incoming);
  const waiting = rows.reduce((sum, r) => sum + r.waiting, 0);
  const biggest = outgoing.toSorted((a, b) => b.amount - a.amount)[0];

  const opening =
    books.length === 0
      ? t.onboarding.pesut
      : biggest
        ? format(t.pesut.homeOwe, {
            amount: rupiah(biggest.amount, lang),
            name: biggest.names.find((m) => m.id === biggest.to)?.name ?? "",
          })
        : incoming.length > 0
          ? format(t.pesut.idleOwed, {
              count: incoming.length,
              amount: rupiah(
                incoming.reduce((s, r) => s + r.amount, 0),
                lang,
              ),
            })
          : t.pesut.idleEven;

  return (
    <>
      <header className="flex flex-wrap items-end justify-between gap-4">
        <Greeting name={profile?.name ?? ""} />
        <div className="hidden gap-3 sm:flex">
          <Link href={`/${lang}/chat`} className={buttonClass("outline")}>
            <MessageCircle className="size-[18px]" strokeWidth={2.25} aria-hidden />
            {t.actions.askPesut}
          </Link>
          <Link
            href={`/${lang}/${books.length ? "expenses" : "groups"}/new`}
            className={buttonClass("primary")}
          >
            <Plus className="size-[18px]" strokeWidth={2.75} aria-hidden />
            {books.length ? t.actions.addExpense : t.groups.create}
          </Link>
        </div>
      </header>

      {waiting > 0 && (
        <Link
          href={`/${lang}/transfers`}
          className="border-line-strong bg-plate text-plate-ink flex items-center justify-between gap-3 rounded-[10px] border-2 px-5 py-4 font-bold"
        >
          {format(t.home.waiting, { count: waiting })}
          <ChevronRight className="size-5" aria-hidden />
        </Link>
      )}

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[1.15fr_1fr] lg:gap-7">
        {/* Two columns on desktop; on phones the wrappers dissolve and `order` sets the stack. */}
        <div className="contents lg:flex lg:min-w-0 lg:flex-col lg:gap-7">
          <div className="order-1 empty:hidden lg:order-none">
            {books.length > 0 && (
              <BalancePanel
                title={t.groups.totalBalance}
                balance={total}
                scale={scale}
                oweCount={outgoing.length}
                owedCount={incoming.length}
                t={t}
                locale={lang}
              />
            )}
          </div>
          <div className="order-4 lg:order-none">
            {books.length === 0 ? (
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
                {/* The rail's "new group" link is desktop-only, so phones get it here. */}
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <PanelTitle id="groups-title">{t.groups.yours}</PanelTitle>
                  <Link href={`/${lang}/groups/new`} className={buttonClass("outline", "text-sm")}>
                    <Plus className="size-4" strokeWidth={2.75} aria-hidden />
                    {t.nav.newGroup}
                  </Link>
                </div>
                <ul className="mt-3">
                  {rows.map(({ book, balance }) => (
                    <li key={book.group.id} className="border-line border-b-2 last:border-0">
                      <Link
                        href={`/${lang}/groups/${book.group.id}`}
                        className="hover:bg-surface-sunk flex items-center gap-4 rounded-md py-3.5"
                      >
                        <HullSwatch hull={book.group.hull} className="h-5 w-10" />
                        <span className="min-w-0 flex-1">
                          <span className="line-clamp-2 block font-bold break-words">
                            {book.group.name}
                          </span>
                          <span className="text-ink-soft text-sm">
                            {format(t.groups.members, { count: book.group.members.length })}
                          </span>
                        </span>
                        <span
                          className={`figure text-xl ${balance < 0 ? "text-debt" : balance > 0 ? "text-credit" : "text-ink-soft"}`}
                        >
                          {rupiah(balance, lang, { signed: true })}
                        </span>
                        <ChevronRight className="text-muted size-5" aria-hidden />
                      </Link>
                    </li>
                  ))}
                </ul>
              </Panel>
            )}
          </div>
        </div>
        <div className="contents lg:flex lg:min-w-0 lg:flex-col lg:gap-7">
          {views.map(({ book, view }) => (
            <div key={book.group.id} className="order-3 lg:order-none">
              <RoutesPanel
                onlyMine
                title={book.group.name}
                groupId={book.group.id}
                groupName={book.group.name}
                me={user.id}
                names={view.names}
                routes={book.transfers}
                accounts={view.accounts}
                siteUrl={env.NEXT_PUBLIC_SITE_URL}
              />
            </div>
          ))}
          <div className="order-2 lg:order-none">
            <PesutRiver
              mood={total < 0 ? "worried" : total === 0 && books.length > 0 ? "happy" : "idle"}
              opening={opening}
            />
          </div>
        </div>
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
