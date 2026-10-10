import { Panel, PanelTitle } from "@/components/ui/Panel";
import type { Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/dictionaries/id";
import { format } from "@/i18n/format";
import { plateNumber, rupiah } from "@/lib/format";

export type LedgerRow = {
  number: number;
  title: string;
  people: number;
  paidBy: string;
  total: number;
  recurring?: boolean;
};

type Side = { name: string; amount: number }[];

/**
 * Proof that the book balances: what the group is owed and what it owes are
 * drawn as two bars of exactly the same length, split by person.
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
  const row = (side: Side, tone: string[], text: string) => (
    <div>
      <p className="text-ink-soft mb-1 text-sm font-semibold">{text}</p>
      <div className="border-line-strong flex h-4 overflow-hidden rounded-[4px] border-2">
        {side.map((p, i) => (
          <i
            key={p.name}
            title={`${p.name} · ${rupiah(p.amount, locale)}`}
            className={`block h-full ${tone[i % tone.length]} ${i > 0 ? "border-line-strong border-l-2" : ""}`}
            style={{ flexGrow: p.amount }}
          />
        ))}
      </div>
    </div>
  );
  return (
    <div className="mt-4 grid gap-3">
      {row(
        owed,
        ["bg-credit", "bg-band", "bg-plate"],
        format(t.ledger.owedSide, { amount: rupiah(total, locale) }),
      )}
      {row(
        owing,
        ["bg-debt", "bg-action", "bg-ink-soft"],
        format(t.ledger.oweSide, { amount: rupiah(total, locale) }),
      )}
    </div>
  );
}

export function LedgerCard({
  rows,
  owed,
  owing,
  t,
  locale,
}: {
  rows: LedgerRow[];
  owed: Side;
  owing: Side;
  t: Dictionary;
  locale: Locale;
}) {
  return (
    <Panel aria-labelledby="ledger-title">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <PanelTitle id="ledger-title">{t.ledger.title}</PanelTitle>
        <span className="text-credit text-sm font-bold">{t.ledger.closes}</span>
      </div>
      <CloseBar owed={owed} owing={owing} t={t} locale={locale} />
      <div className="-mx-1 mt-5 overflow-x-auto">
        <table className="w-full min-w-[30rem] border-collapse text-[0.9375rem]">
          <thead>
            <tr className="label border-line border-b-2 text-left">
              <th scope="col" className="px-1 py-2 font-bold">
                {t.ledger.number}
              </th>
              <th scope="col" className="px-1 py-2 font-bold">
                {t.ledger.expense}
              </th>
              <th scope="col" className="px-1 py-2 font-bold">
                {t.ledger.paidBy}
              </th>
              <th scope="col" className="px-1 py-2 text-right font-bold">
                {t.ledger.total}
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.number} className="border-line border-b last:border-0">
                <td className="text-muted px-1 py-3 font-semibold tabular-nums">
                  {plateNumber("PT", r.number)}
                </td>
                <td className="px-1 py-3">
                  <span className="font-semibold">{r.title}</span>
                  <span className="text-ink-soft">
                    {" · "}
                    {format(t.ledger.people, { count: r.people })}
                    {r.recurring && ` · ${t.ledger.recurring}`}
                  </span>
                </td>
                <td className="px-1 py-3">{r.paidBy}</td>
                <td className="px-1 py-3 text-right font-semibold tabular-nums">
                  {rupiah(r.total, locale)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Panel>
  );
}
