import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { lang as rootLang } from "next/root-params";
import { Suspense } from "react";
import { z } from "zod";
import { ExpenseForm, type ExpenseDraft } from "@/components/expenses/ExpenseForm";
import { Panel } from "@/components/ui/Panel";
import { isLocale, type Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/dictionaries/id";
import { getDictionary } from "@/i18n/get-dictionary";
import { plateNumber } from "@/lib/format";
import { requireUser } from "@/server/auth";
import { getGroup } from "@/server/db/groups";
import { getLedger, type LedgerExpense } from "@/server/db/ledger";

type Params = PageProps<"/[lang]/groups/[groupId]/expenses/[expenseId]/edit">;

export async function generateMetadata(): Promise<Metadata> {
  const lang = await rootLang();
  if (!isLocale(lang)) return {};
  return { title: (await getDictionary(lang)).expenseForm.editTitle };
}

export default async function EditExpensePage({ params }: Params) {
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

/** The stored expense in the form's own terms (amounts as text, items with owners). */
function toDraft(e: LedgerExpense): ExpenseDraft {
  return {
    expenseId: e.id,
    title: e.title,
    total: String(e.total),
    paidBy: e.paidBy,
    occurredOn: e.occurredOn,
    note: e.note ?? "",
    method: e.splitMethod,
    participants: e.shares.map((s) => s.userId),
    exact: Object.fromEntries(e.shares.map((s) => [s.userId, String(s.amount)])),
    items: e.items.map((item, key) => ({
      key,
      name: item.name,
      amount: String(item.amount),
      owners: item.claims.map((c) => c.userId),
    })),
    extras: {
      tax: e.tax ? String(e.tax) : "",
      service: e.service ? String(e.service) : "",
      discount: e.discount ? String(e.discount) : "",
    },
  };
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
  const { groupId, expenseId } = await params;
  if (!z.uuid().safeParse(groupId).success || !z.uuid().safeParse(expenseId).success) notFound();
  const user = await requireUser(lang);
  const [group, ledger] = await Promise.all([getGroup(groupId), getLedger(groupId)]);
  const expense = ledger.expenses.find((e) => e.id === expenseId);
  if (!group || !expense) notFound();
  const isAdmin = group.members.some((m) => m.id === user.id && m.role === "admin");
  if (!isAdmin && user.id !== expense.createdBy && user.id !== expense.paidBy) notFound();

  return (
    <>
      <Link href={`/${lang}/groups/${group.id}`} className="text-ink-soft font-semibold underline">
        {group.name}
      </Link>
      <h1 className="display mt-1 mb-6 text-[2.5rem] uppercase sm:text-[3rem]">
        {t.expenseForm.editTitle} · {plateNumber("PT", expense.number)}
      </h1>
      <Panel>
        <ExpenseForm
          aiEnabled={false}
          groupId={group.id}
          me={user.id}
          members={group.members.map((m) => ({ id: m.id, name: m.name }))}
          initial={toDraft(expense)}
        />
      </Panel>
    </>
  );
}
