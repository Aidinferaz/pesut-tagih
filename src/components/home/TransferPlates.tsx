"use client";

import { Check } from "lucide-react";
import { useState } from "react";
import { usePesut } from "@/components/pesut/mood";
import { Button } from "@/components/ui/Button";
import { Panel, PanelTitle } from "@/components/ui/Panel";
import { Plate } from "@/components/ui/Plate";
import { providerName, type ProviderCode } from "@/domain/providers";
import { format } from "@/i18n/format";
import { useI18n } from "@/i18n/provider";
import { rupiah } from "@/lib/format";

export type RouteRow = {
  from: string;
  to: string;
  fromName: string;
  toName: string;
  amount: number;
  via: ProviderCode | null;
  fee: number | null;
};

/**
 * The settlement plan as bow plates. Your own transfers come first with their
 * actions; the rest of the group's routes follow, quieter, so the whole plan
 * stays visible without crowding what you have to do.
 */
export function TransferPlates({ rows, me }: { rows: RouteRow[]; me: string }) {
  const { t, locale } = useI18n();
  const [paid, setPaid] = useState<Set<number>>(new Set());
  const { act, say } = usePesut.getState();

  const mine = rows.map((r, i) => ({ ...r, i })).filter((r) => r.from === me || r.to === me);
  const others = rows.map((r, i) => ({ ...r, i })).filter((r) => r.from !== me && r.to !== me);

  const markPaid = (i: number, toName: string) => {
    setPaid((prev) => new Set(prev).add(i));
    act("celebrate");
    say(format(t.pesut.paidLine, { name: toName }));
  };
  const nudge = (fromName: string) => {
    act("squirt");
    say(format(t.pesut.nudgeLine, { name: fromName }));
  };

  const via = (r: RouteRow) => {
    if (!r.via) return <span className="text-muted">{t.routes.noMethod}</span>;
    const provider = format(t.routes.via, { provider: providerName(r.via) });
    return r.fee === 0 ? (
      <span className="text-credit">
        {provider} · {t.routes.free}
      </span>
    ) : (
      <span className="text-ink-soft">
        {provider} · {format(t.routes.fee, { fee: rupiah(r.fee ?? 0, locale) })}
      </span>
    );
  };

  return (
    <Panel aria-labelledby="routes-title">
      <PanelTitle id="routes-title">{t.routes.title}</PanelTitle>
      {rows.length === 0 ? (
        <p className="text-ink-soft mt-4">{t.routes.empty}</p>
      ) : (
        <ol className="mt-3">
          {mine.map((r) => {
            const outgoing = r.from === me;
            const done = paid.has(r.i);
            return (
              <li
                key={r.i}
                className="border-line grid grid-cols-[auto_1fr_auto] items-center gap-x-4 gap-y-2 border-b-2 py-3.5 last:border-0"
              >
                <Plate>{`R${mine.indexOf(r) + 1}`}</Plate>
                <div className="min-w-0">
                  <p className="font-bold">
                    {outgoing ? t.routes.you : r.fromName} → {outgoing ? r.toName : t.routes.you}
                  </p>
                  <p className="text-sm font-semibold">
                    {done ? (
                      <span className="text-ink-soft">
                        {format(t.routes.pendingTheirs, { name: r.toName })}
                      </span>
                    ) : (
                      via(r)
                    )}
                  </p>
                </div>
                <p
                  className={`figure text-[1.625rem] leading-none sm:text-[1.875rem] ${outgoing ? "text-debt" : "text-credit"}`}
                >
                  {rupiah(r.amount, locale)}
                </p>
                <div className="col-span-3 flex justify-end gap-2 sm:col-start-2 sm:col-end-4">
                  {outgoing ? (
                    <Button
                      variant={done ? "outline" : "primary"}
                      disabled={done}
                      onClick={() => markPaid(r.i, r.toName)}
                    >
                      {done && <Check className="size-4" strokeWidth={3} aria-hidden />}
                      {t.actions.markPaid}
                    </Button>
                  ) : (
                    <Button variant="outline" onClick={() => nudge(r.fromName)}>
                      {t.routes.nudge}
                    </Button>
                  )}
                </div>
              </li>
            );
          })}
        </ol>
      )}

      {others.length > 0 && (
        <>
          <h3 className="text-muted mt-5 mb-1 text-sm font-bold">{t.routes.others}</h3>
          <ul>
            {others.map((r) => (
              <li
                key={r.i}
                className="border-line flex items-baseline justify-between gap-4 border-b py-2 text-[0.9375rem] last:border-0"
              >
                <span>
                  <span className="font-semibold">
                    {r.fromName} → {r.toName}
                  </span>{" "}
                  <span className="text-sm">{via(r)}</span>
                </span>
                <span className="figure text-lg">{rupiah(r.amount, locale)}</span>
              </li>
            ))}
          </ul>
        </>
      )}
    </Panel>
  );
}
