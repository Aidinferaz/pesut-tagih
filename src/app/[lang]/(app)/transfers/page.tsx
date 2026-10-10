import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { PesutRiver } from "@/components/home/PesutRiver";
import { PendingPanel } from "@/components/ledger/PendingPanel";
import { RoutesPanel } from "@/components/ledger/RoutesPanel";
import { Panel } from "@/components/ui/Panel";
import { isLocale, type Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/dictionaries/id";
import { getDictionary } from "@/i18n/get-dictionary";
import { requireUser } from "@/server/auth";
import { listMyBooks, viewForMember } from "@/server/db/ledger";
import { env } from "@/server/env";

export async function generateMetadata({
  params,
}: PageProps<"/[lang]/transfers">): Promise<Metadata> {
  const { lang } = await params;
  if (!isLocale(lang)) return {};
  return { title: (await getDictionary(lang)).transfers.title };
}

export default async function TransfersPage({ params }: PageProps<"/[lang]/transfers">) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();
  const t = await getDictionary(lang);
  return (
    <main className="mx-auto grid max-w-4xl gap-5 px-4 py-6 sm:px-8 lg:gap-7 lg:py-10">
      <div>
        <h1 className="display text-[2.5rem] uppercase sm:text-[3rem]">{t.transfers.title}</h1>
        <p className="text-ink-soft mt-2 max-w-prose">{t.transfers.body}</p>
      </div>
      <Suspense
        fallback={<div className="bg-surface-sunk h-96 animate-pulse rounded-[10px]" aria-hidden />}
      >
        <Everything lang={lang} t={t} />
      </Suspense>
    </main>
  );
}

async function Everything({ lang, t }: { lang: Locale; t: Dictionary }) {
  const user = await requireUser(lang);
  const books = await listMyBooks(user.id);
  const views = await Promise.all(
    books.map(async (book) => ({ book, view: await viewForMember(book, user.id) })),
  );
  const relevant = views.filter(
    ({ view }) =>
      view.outgoing.length + view.incoming.length > 0 ||
      view.pending.some((s) => s.from === user.id || s.to === user.id),
  );

  if (relevant.length === 0) {
    return (
      <>
        <Panel>
          <p className="text-ink-soft">{t.transfers.empty}</p>
        </Panel>
        <PesutRiver mood="happy" opening={t.pesut.idleEven} />
      </>
    );
  }

  return relevant.map(({ book, view }) => (
    <section key={book.group.id} aria-label={book.group.name} className="grid gap-5">
      <PendingPanel
        groupId={book.group.id}
        title={`${t.pending.title} · ${book.group.name}`}
        pending={view.pending}
        me={user.id}
        names={view.names}
        proofUrls={view.proofUrls}
        autoConfirmDays={book.group.autoConfirmDays}
        t={t}
        locale={lang}
      />
      {view.outgoing.length + view.incoming.length > 0 && (
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
      )}
    </section>
  ));
}
