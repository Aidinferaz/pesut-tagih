import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { BalanceHull } from "@/components/home/BalanceHull";
import { Greeting } from "@/components/home/Greeting";
import { LedgerCard } from "@/components/home/LedgerCard";
import { PesutRiver } from "@/components/home/PesutRiver";
import { TransferPlates } from "@/components/home/TransferPlates";
import { buttonClass } from "@/components/ui/Button";
import { Panel, PanelTitle } from "@/components/ui/Panel";
import { balances, expenses, groups, ME, members, nameOf, transfers } from "@/demo/circle";
import { isLocale } from "@/i18n/config";
import { format } from "@/i18n/format";
import { getDictionary } from "@/i18n/get-dictionary";
import { rupiah } from "@/lib/format";
import { MessageCircle, Plus } from "lucide-react";
import Link from "next/link";

export async function generateMetadata({
  params,
}: PageProps<"/[lang]/preview">): Promise<Metadata> {
  const { lang } = await params;
  if (!isLocale(lang)) return {};
  return { title: (await getDictionary(lang)).demo.preview };
}

/**
 * Design preview on synthetic data, kept for development: it shows every
 * dashboard component in a busy state. Not served in production.
 */
export default async function PreviewPage({ params }: PageProps<"/[lang]/preview">) {
  const { lang } = await params;
  if (!isLocale(lang) || process.env.NODE_ENV === "production") notFound();
  const t = await getDictionary(lang);

  const mine = balances.get(ME) ?? 0;
  const scale = Math.max(...[...balances.values()].map(Math.abs));
  const iOwe = transfers.filter((r) => r.from === ME);
  const oweMe = transfers.filter((r) => r.to === ME);
  const biggest = [...iOwe].sort((a, b) => b.amount - a.amount)[0];
  const oldestDays = Math.max(...expenses.map((e) => e.daysAgo));

  const state = mine < 0 ? t.balance.sinking : mine > 0 ? t.balance.floating : t.balance.level;
  const side = (sign: 1 | -1) =>
    [...balances]
      .filter(([, v]) => v * sign > 0)
      .sort((a, b) => Math.abs(b[1]) - Math.abs(a[1]))
      .map(([id, v]) => ({ name: nameOf(id), amount: Math.abs(v) }));

  return (
    <main className="mx-auto grid max-w-[90rem] grid-cols-1 gap-5 px-4 py-6 sm:px-8 lg:grid-cols-[1.15fr_1fr] lg:gap-7 lg:px-10 lg:py-8">
      <p className="bg-band/25 text-ink rounded-md px-3 py-2 text-sm font-semibold lg:col-span-2">
        {t.demo.preview} · {t.demo.banner}
      </p>

      <header className="flex flex-wrap items-end justify-between gap-4 lg:col-span-2">
        <div>
          <Greeting name={nameOf(ME)} />
          <p className="text-ink-soft mt-2 font-semibold">
            {format(t.home.subtitle, { group: groups[0].name, count: members.length })}
          </p>
        </div>
        <div className="hidden gap-3 sm:flex">
          <Link href={`/${lang}/chat`} className={buttonClass("outline")}>
            <MessageCircle className="size-[18px]" strokeWidth={2.25} aria-hidden />
            {t.actions.askPesut}
          </Link>
          <Link href={`/${lang}/expenses/new`} className={buttonClass("primary")}>
            <Plus className="size-[18px]" strokeWidth={2.75} aria-hidden />
            {t.actions.addExpense}
          </Link>
        </div>
      </header>

      {/* Two columns on desktop; on phones the wrappers dissolve and `order` sets the stack. */}
      <div className="contents lg:flex lg:flex-col lg:gap-7">
        <Panel aria-labelledby="balance-title" className="order-1 lg:order-none">
          <PanelTitle id="balance-title">{t.balance.title}</PanelTitle>
          <p
            className={`figure mt-2 text-[4.25rem] leading-[0.9] sm:text-[5.5rem] ${mine < 0 ? "text-debt" : mine > 0 ? "text-credit" : "text-ink"}`}
          >
            {rupiah(mine, lang, { signed: true })}
          </p>
          <p className="mt-2 font-semibold">
            {mine === 0
              ? t.balance.even
              : [
                  iOwe.length > 0 && format(t.balance.owe, { count: iOwe.length }),
                  oweMe.length > 0 && format(t.balance.owed, { count: oweMe.length }),
                ]
                  .filter(Boolean)
                  .join(" · ")}
          </p>
          <div className="mt-5">
            <BalanceHull
              balance={mine}
              scale={scale}
              label={format(t.balance.hullLabel, { state })}
            />
          </div>
        </Panel>

        <div className="order-4 lg:order-none">
          <LedgerCard
            t={t}
            locale={lang}
            owed={side(1)}
            owing={side(-1)}
            rows={expenses.map((e) => ({
              number: e.number,
              title: e.title,
              people: e.shares.length,
              paidBy: nameOf(e.paidBy),
              total: e.total,
              recurring: e.recurring,
            }))}
          />
        </div>
      </div>
      <div className="contents lg:flex lg:flex-col lg:gap-7">
        <div className="order-3 lg:order-none">
          <TransferPlates
            me={ME}
            rows={transfers.map((r) => ({ ...r, fromName: nameOf(r.from), toName: nameOf(r.to) }))}
          />
        </div>

        <div className="order-2 lg:order-none">
          <PesutRiver
            mood={mine < 0 && oldestDays > 7 ? "worried" : mine === 0 ? "happy" : "idle"}
            opening={
              biggest
                ? format(t.pesut.idleOwe, {
                    amount: rupiah(biggest.amount, lang),
                    name: nameOf(biggest.to),
                    days: oldestDays,
                  })
                : t.pesut.idleEven
            }
          />
        </div>
      </div>
    </main>
  );
}
