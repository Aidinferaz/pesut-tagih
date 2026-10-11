import { ChevronDown, Pencil, Receipt, Trash2 } from "lucide-react";
import Link from "next/link";
import { Panel, PanelTitle } from "@/components/ui/Panel";
import { Plate } from "@/components/ui/Plate";
import type { Locale } from "@/i18n/config";
import { intlLocale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/dictionaries/id";
import { format } from "@/i18n/format";
import { plateNumber, rupiah } from "@/lib/format";
import { deleteExpense } from "@/server/actions/ledger";
import type { LedgerExpense, LedgerSettlement } from "@/server/db/ledger";
import { ConfirmSubmit } from "./ConfirmSubmit";

type Side = { name: string; amount: number }[];

/** "10 Okt" from a YYYY-MM-DD date, without the server's time zone getting involved. */
function shortDate(isoDate: string, locale: Locale) {
  const [y, m, d] = isoDate.slice(0, 10).split("-").map(Number);
  return new Intl.DateTimeFormat(intlLocale[locale], {
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  }).format(new Date(Date.UTC(y, m - 1, d)));
}

/**
 * Proof that the book balances: what the group is owed and what it owes are
 * two tracks of exactly the same length, split by person and labelled, so you
 * can see who holds what.
 */
function CloseBar({
  owed,
  owing,
  t,
  locale,
}: {
  owed: Side;
  owing: Side;
  t: Dictionary;
  locale: Locale;
}) {
  const total = owed.reduce((s, p) => s + p.amount, 0);
  if (total === 0) return null;
  // Segments and their labels share flex-basis 0, so each label sits under its own segment.
  const row = (side: Side, tone: string[], text: string) => (
    <div className="min-w-0">
      <p className="text-ink-soft mb-1 text-sm font-semibold">{text}</p>
      <div className="border-line-strong flex h-5 overflow-hidden rounded-[4px] border-2">
        {side.map((p, i) => (
          <i
            key={p.name}
            className={`block h-full ${tone[i % tone.length]} ${i > 0 ? "border-line-strong border-l-2" : ""}`}
            style={{ flex: `${p.amount} 1 0` }}
          />
        ))}
      </div>
      <div className="mt-1 flex text-xs">
        {side.map((p) => (
          <span key={p.name} className="min-w-0 truncate pr-2" style={{ flex: `${p.amount} 1 0` }}>
            <span className="font-bold">{p.name}</span>{" "}
            <span className="text-ink-soft tabular-nums">{rupiah(p.amount, locale)}</span>
          </span>
        ))}
      </div>
    </div>
  );
  return (
    <div className="mt-4 grid grid-cols-1 gap-3">
      {row(
        owed,
        ["bg-credit", "bg-credit/65", "bg-credit/35"],
        format(t.ledger.owedSide, { amount: rupiah(total, locale) }),
      )}
      {row(
        owing,
        ["bg-debt", "bg-debt/65", "bg-debt/35"],
        format(t.ledger.oweSide, { amount: rupiah(total, locale) }),
      )}
    </div>
  );
}

type Row =
  | { kind: "expense"; at: string; expense: LedgerExpense }
  | { kind: "settlement"; at: string; settlement: LedgerSettlement };

/**
 * The group's book: every expense and every transfer, newest first, each with
 * its registration number. Expenses open up to show who owes what.
 */
export function GroupLedger({
  groupId,
  expenses,
  settlements,
  balances,
  names,
  me,
  isAdmin,
  receiptUrls,
  t,
  locale,
}: {
  groupId: string;
  expenses: LedgerExpense[];
  settlements: LedgerSettlement[];
  balances: Map<string, number>;
  names: Record<string, string>;
  me: string;
  isAdmin: boolean;
  receiptUrls: Map<string, string>;
  t: Dictionary;
  locale: Locale;
}) {
  const rows: Row[] = [
    ...expenses.map((expense): Row => ({
      kind: "expense",
      at: `${expense.occurredOn}T${expense.createdAt.slice(11)}`,
      expense,
    })),
    ...settlements
      .filter((s) => s.status !== "pending")
      .map((settlement): Row => ({
        kind: "settlement",
        at: settlement.decidedAt ?? settlement.createdAt,
        settlement,
      })),
  ].sort((a, b) => b.at.localeCompare(a.at));

  const side = (sign: 1 | -1): Side =>
    [...balances]
      .filter(([, v]) => v * sign > 0)
      .sort((a, b) => Math.abs(b[1]) - Math.abs(a[1]))
      .map(([id, v]) => ({ name: names[id] ?? "?", amount: Math.abs(v) }));

  return (
    <Panel aria-labelledby="ledger-title">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <PanelTitle id="ledger-title">{t.ledger.title}</PanelTitle>
        {rows.length > 0 && (
          <span className="text-credit text-sm font-bold">{t.ledger.closes}</span>
        )}
      </div>
      <CloseBar owed={side(1)} owing={side(-1)} t={t} locale={locale} />

      {rows.length === 0 ? (
        <p className="text-ink-soft mt-4">{t.ledger.empty}</p>
      ) : (
        <ul className="border-line mt-5 border-t-2">
          {rows.map((row) =>
            row.kind === "settlement" ? (
              <li
                key={row.settlement.id}
                className="border-line grid grid-cols-[auto_minmax(0,1fr)_auto] items-baseline gap-3 border-b py-3 text-[0.9375rem]"
              >
                <span>
                  <Plate size="sm">{plateNumber("PT", row.settlement.number)}</Plate>
                </span>
                <span className="min-w-0">
                  <span className="font-semibold">
                    {format(t.ledger.transfer, {
                      from: names[row.settlement.from],
                      to: names[row.settlement.to],
                    })}
                  </span>
                  <span
                    className={`ml-2 text-sm font-bold ${row.settlement.status === "confirmed" ? "text-credit" : "text-debt"}`}
                  >
                    {t.ledger.status[row.settlement.status]}
                    {row.settlement.autoConfirmed && ` · ${t.ledger.auto}`}
                  </span>
                </span>
                <span
                  className={`tabular-nums ${row.settlement.status === "rejected" ? "text-muted line-through" : ""}`}
                >
                  {rupiah(row.settlement.amount, locale)}
                </span>
              </li>
            ) : (
              <ExpenseRow
                key={row.expense.id}
                expense={row.expense}
                groupId={groupId}
                names={names}
                canDelete={isAdmin || row.expense.createdBy === me || row.expense.paidBy === me}
                receiptUrl={
                  row.expense.receiptPath ? receiptUrls.get(row.expense.receiptPath) : undefined
                }
                t={t}
                locale={locale}
              />
            ),
          )}
        </ul>
      )}
    </Panel>
  );
}

function ExpenseRow({
  expense: e,
  groupId,
  names,
  canDelete,
  receiptUrl,
  t,
  locale,
}: {
  expense: LedgerExpense;
  groupId: string;
  names: Record<string, string>;
  canDelete: boolean;
  receiptUrl?: string;
  t: Dictionary;
  locale: Locale;
}) {
  return (
    <li className="border-line border-b">
      <details className="group">
        <summary className="grid cursor-pointer list-none grid-cols-[auto_minmax(0,1fr)_auto] items-start gap-3 py-3 text-[0.9375rem] sm:grid-cols-[auto_minmax(0,1fr)_auto_auto] [&::-webkit-details-marker]:hidden">
          <span>
            <Plate size="sm">{plateNumber("PT", e.number)}</Plate>
          </span>
          <span className="min-w-0">
            <span className="block font-semibold">{e.title}</span>
            <span className="text-ink-soft flex justify-between gap-3 text-sm">
              <span>
                {names[e.paidBy]} ·{" "}
                <span className="whitespace-nowrap">{shortDate(e.occurredOn, locale)}</span>
                {e.recurring && ` · ${t.ledger.recurring}`}
              </span>
              {/* On phones the amount drops here so the title gets the whole row. */}
              <span className="text-ink font-semibold tabular-nums sm:hidden">
                {rupiah(e.total, locale)}
              </span>
            </span>
          </span>
          <span className="hidden font-semibold tabular-nums sm:block">
            {rupiah(e.total, locale)}
          </span>
          <ChevronDown
            className="text-muted size-4 self-center transition-transform group-open:rotate-180"
            aria-hidden
          />
        </summary>
        <div className="bg-surface-sunk mb-3 grid gap-3 rounded-md p-3 text-sm">
          {e.items.length > 0 && (
            <div>
              <h4 className="font-bold">{t.ledger.items}</h4>
              <ul className="mt-1">
                {e.items.map((item, i) => (
                  <li key={i} className="flex justify-between gap-3 py-0.5">
                    <span>
                      {item.name}
                      <span className="text-ink-soft">
                        {" "}
                        · {item.claims.map((c) => names[c.userId]).join(", ")}
                      </span>
                    </span>
                    <span className="tabular-nums">{rupiah(item.amount, locale)}</span>
                  </li>
                ))}
                {(
                  [
                    ["tax", e.tax],
                    ["service", e.service],
                    ["discount", -e.discount],
                  ] as const
                )
                  .filter(([, v]) => v !== 0)
                  .map(([k, v]) => (
                    <li key={k} className="text-ink-soft flex justify-between gap-3 py-0.5">
                      <span>{t.ledger[k]}</span>
                      <span className="tabular-nums">{rupiah(v, locale, { signed: v < 0 })}</span>
                    </li>
                  ))}
              </ul>
            </div>
          )}
          <div>
            <h4 className="font-bold">{t.ledger.shares}</h4>
            <ul className="mt-1 grid gap-x-6 sm:grid-cols-2">
              {e.shares.map((s) => (
                <li key={s.userId} className="flex justify-between gap-3 py-0.5">
                  <span>{names[s.userId]}</span>
                  <span className="tabular-nums">{rupiah(s.amount, locale)}</span>
                </li>
              ))}
            </ul>
          </div>
          {e.note && <p className="text-ink-soft">“{e.note}”</p>}
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-muted">
              {format(t.ledger.loggedBy, { name: names[e.createdBy] ?? "?" })}
            </span>
            <div className="flex gap-2">
              {receiptUrl && (
                <a
                  href={receiptUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 font-bold underline"
                >
                  <Receipt className="size-4" aria-hidden />
                  {t.ledger.receipt}
                </a>
              )}
              {canDelete && (
                <Link
                  href={`/${locale}/groups/${groupId}/expenses/${e.id}/edit`}
                  className="inline-flex items-center gap-1 font-bold underline"
                >
                  <Pencil className="size-4" aria-hidden />
                  {t.ledger.edit}
                </Link>
              )}
              {canDelete && (
                <form action={deleteExpense}>
                  <input type="hidden" name="lang" value={locale} />
                  <input type="hidden" name="id" value={e.id} />
                  <input type="hidden" name="groupId" value={groupId} />
                  <ConfirmSubmit
                    message={t.ledger.deleteConfirm}
                    className="text-debt inline-flex items-center gap-1 font-bold"
                  >
                    <Trash2 className="size-4" aria-hidden />
                    {t.ledger.delete}
                  </ConfirmSubmit>
                </form>
              )}
            </div>
          </div>
        </div>
      </details>
    </li>
  );
}
