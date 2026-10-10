import { Plus, Settings2 } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { lang as rootLang } from "next/root-params";
import { Suspense } from "react";
import { z } from "zod";
import { PesutRiver } from "@/components/home/PesutRiver";
import { BalancePanel } from "@/components/ledger/BalancePanel";
import { GroupLedger } from "@/components/ledger/GroupLedger";
import { PendingPanel } from "@/components/ledger/PendingPanel";
import { RecurringPanel } from "@/components/ledger/RecurringPanel";
import { RoutesPanel } from "@/components/ledger/RoutesPanel";
import { buttonClass } from "@/components/ui/Button";
import { HullSwatch } from "@/components/ui/HullSwatch";
import { Panel, PanelTitle } from "@/components/ui/Panel";
import { isLocale, type Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/dictionaries/id";
import { format } from "@/i18n/format";
import { getDictionary } from "@/i18n/get-dictionary";
import { rupiah } from "@/lib/format";
import { requireUser } from "@/server/auth";
import { requestNow } from "@/server/clock";
import { debtAgeDays } from "@/domain/ledger";
import { getGroupBook, listRecurringBills, signedUrls, viewForMember } from "@/server/db/ledger";
import { env } from "@/server/env";

type Params = PageProps<"/[lang]/groups/[groupId]">;

export async function generateMetadata(): Promise<Metadata> {
  const lang = await rootLang();
  if (!isLocale(lang)) return {};
  return { title: (await getDictionary(lang)).nav.groups };
}

export default async function GroupPage({ params, searchParams }: Params) {
  const lang = await rootLang();
  if (!isLocale(lang)) notFound();
  const t = await getDictionary(lang);
  return (
    <main className="mx-auto grid max-w-[90rem] grid-cols-1 gap-5 px-4 py-6 sm:px-8 lg:gap-7 lg:px-10 lg:py-8">
      <Suspense
        fallback={<div className="bg-surface-sunk h-96 animate-pulse rounded-[10px]" aria-hidden />}
      >
        <GroupContent lang={lang} t={t} params={params} searchParams={searchParams} />
      </Suspense>
    </main>
  );
}

async function GroupContent({
  lang,
  t,
  params,
  searchParams,
}: {
  lang: Locale;
  t: Dictionary;
  params: Params["params"];
  searchParams: Params["searchParams"];
}) {
  const { groupId } = await params;
  if (!z.uuid().safeParse(groupId).success) notFound();
  const user = await requireUser(lang);
  const [book, bills, query] = await Promise.all([
    getGroupBook(groupId),
    listRecurringBills(groupId),
    searchParams,
  ]);
  if (!book) notFound();

  const { group, balances, transfers, settlements, expenses } = book;
  const me = user.id;
  const {
    names,
    pending,
    outgoing,
    incoming,
    proofUrls,
    accounts,
    balance: mine,
  } = await viewForMember(book, me);
  const isAdmin = group.members.some((m) => m.id === me && m.role === "admin");
  const scale = Math.max(1, ...[...balances.values()].map(Math.abs));
  const receiptUrls = await signedUrls(
    "receipts",
    expenses.flatMap((e) => (e.receiptPath ? [e.receiptPath] : [])),
  );

  const days = debtAgeDays(me, expenses, settlements, await requestNow());
  const biggest = outgoing.toSorted((a, b) => b.amount - a.amount)[0];
  const opening = biggest
    ? format(days > 0 ? t.pesut.idleOwe : t.pesut.idleOweToday, {
        amount: rupiah(biggest.amount, lang),
        name: names[biggest.to],
        days,
      })
    : incoming.length > 0
      ? format(t.pesut.idleOwed, {
          count: incoming.length,
          amount: rupiah(
            incoming.reduce((s, r) => s + r.amount, 0),
            lang,
          ),
        })
      : expenses.length === 0
        ? t.onboarding.pesut
        : t.pesut.idleEven;
  const mood =
    mine < 0 && days > 7 ? "worried" : mine === 0 && expenses.length > 0 ? "happy" : "idle";

  return (
    <>
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex items-center gap-4">
          <HullSwatch hull={group.hull} className="h-7 w-14" />
          <div>
            <h1 className="display text-[2.5rem] uppercase sm:text-[3rem]">{group.name}</h1>
            <p className="text-ink-soft font-semibold">
              {format(t.groups.members, { count: group.members.length })}
            </p>
          </div>
        </div>
        <Link href={`/${lang}/groups/${group.id}/expenses/new`} className={buttonClass("primary")}>
          <Plus className="size-[18px]" strokeWidth={2.75} aria-hidden />
          {t.actions.addExpense}
        </Link>
      </header>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[1.15fr_1fr] lg:gap-7">
        {/* Two columns on desktop; on phones the wrappers dissolve and `order` sets the stack. */}
        <div className="contents lg:flex lg:flex-col lg:gap-7">
          <div className="order-1 lg:order-none">
            <BalancePanel
              title={t.groups.yourBalance}
              balance={mine}
              scale={scale}
              oweCount={outgoing.length}
              owedCount={incoming.length}
              t={t}
              locale={lang}
            />
          </div>
          <div className="order-5 lg:order-none">
            <GroupLedger
              groupId={group.id}
              expenses={expenses}
              settlements={settlements}
              balances={balances}
              names={names}
              me={me}
              isAdmin={isAdmin}
              receiptUrls={receiptUrls}
              t={t}
              locale={lang}
            />
          </div>
          <div className="order-6 lg:order-none">
            <RecurringPanel
              groupId={group.id}
              bills={bills}
              members={group.members.map((m) => ({ id: m.id, name: m.name }))}
              me={me}
            />
          </div>
        </div>

        <div className="contents lg:flex lg:flex-col lg:gap-7">
          <div className="order-2 empty:hidden lg:order-none">
            <PendingPanel
              groupId={group.id}
              pending={pending}
              me={me}
              names={names}
              proofUrls={proofUrls}
              autoConfirmDays={group.autoConfirmDays}
              t={t}
              locale={lang}
            />
          </div>
          <div className="order-4 lg:order-none">
            <RoutesPanel
              groupId={group.id}
              groupName={group.name}
              me={me}
              names={names}
              routes={transfers}
              siteUrl={env.NEXT_PUBLIC_SITE_URL}
              accounts={accounts}
            />
          </div>
          <div className="order-3 lg:order-none">
            <PesutRiver
              mood={mood}
              opening={query.logged ? t.pesut.loggedLine : opening}
              greet={query.logged ? "jump" : undefined}
            />
          </div>
          <div className="order-7 grid min-w-0 grid-cols-1 gap-5 lg:order-none lg:gap-7">
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
                    <span
                      className={`tabular-nums ${(balances.get(m.id) ?? 0) < 0 ? "text-debt" : "text-ink-soft"}`}
                    >
                      {rupiah(balances.get(m.id) ?? 0, lang, { signed: true })}
                    </span>
                    {m.role === "admin" && (
                      <span className="text-muted text-sm font-bold">{t.groups.admin}</span>
                    )}
                  </li>
                ))}
              </ul>
              <Link
                href={`/${lang}/groups/${group.id}/settings`}
                className={buttonClass("outline", "mt-4")}
              >
                <Settings2 className="size-4" aria-hidden />
                {t.groups.settingsTitle}
              </Link>
            </Panel>
          </div>
        </div>
      </div>
    </>
  );
}
