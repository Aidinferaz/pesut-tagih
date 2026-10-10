import { BalanceHull } from "@/components/home/BalanceHull";
import { Panel, PanelTitle } from "@/components/ui/Panel";
import type { Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/dictionaries/id";
import { format } from "@/i18n/format";
import { rupiah } from "@/lib/format";

/** Your net balance in big painted figures, with the river taxi sitting at its waterline. */
export function BalancePanel({
  title,
  balance,
  scale,
  oweCount,
  owedCount,
  t,
  locale,
}: {
  title: string;
  balance: number;
  scale: number;
  oweCount: number;
  owedCount: number;
  t: Dictionary;
  locale: Locale;
}) {
  const state =
    balance < 0 ? t.balance.sinking : balance > 0 ? t.balance.floating : t.balance.level;
  const tone = balance < 0 ? "text-debt" : balance > 0 ? "text-credit" : "text-ink";
  const summary =
    balance === 0 && oweCount === 0 && owedCount === 0
      ? t.balance.even
      : [
          oweCount > 0 && format(t.balance.owe, { count: oweCount }),
          owedCount > 0 && format(t.balance.owed, { count: owedCount }),
        ]
          .filter(Boolean)
          .join(" · ");

  return (
    <Panel aria-labelledby="balance-title">
      <PanelTitle id="balance-title">{title}</PanelTitle>
      <p className={`figure mt-2 text-[3.75rem] leading-[0.9] sm:text-[5.5rem] ${tone}`}>
        {rupiah(balance, locale, { signed: true })}
      </p>
      <p className="mt-2 font-semibold">{summary}</p>
      <div className="mt-5">
        <BalanceHull
          balance={balance}
          scale={scale}
          label={format(t.balance.hullLabel, { state })}
        />
      </div>
    </Panel>
  );
}
