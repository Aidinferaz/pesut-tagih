import { ImageIcon } from "lucide-react";
import { buttonClass } from "@/components/ui/Button";
import { Plate } from "@/components/ui/Plate";
import { Panel, PanelTitle } from "@/components/ui/Panel";
import type { Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/dictionaries/id";
import { format } from "@/i18n/format";
import { plateNumber, rupiah } from "@/lib/format";
import { decideSettlement } from "@/server/actions/ledger";
import type { LedgerSettlement } from "@/server/db/ledger";
import { PesutOnSubmit } from "./PesutOnSubmit";

/** Transfers someone has marked as sent but the receiver hasn't confirmed yet. */
export function PendingPanel({
  groupId,
  title,
  pending,
  me,
  names,
  proofUrls,
  autoConfirmDays,
  t,
  locale,
}: {
  groupId: string;
  /** Defaults to the generic heading; the transfers page names the group. */
  title?: string;
  pending: LedgerSettlement[];
  me: string;
  names: Record<string, string>;
  proofUrls: Map<string, string>;
  autoConfirmDays: number;
  t: Dictionary;
  locale: Locale;
}) {
  const relevant = pending.filter((s) => s.to === me || s.from === me);
  if (relevant.length === 0) return null;

  return (
    <Panel aria-labelledby={`pending-${groupId}`}>
      <PanelTitle id={`pending-${groupId}`}>{title ?? t.pending.title}</PanelTitle>
      <ul className="mt-3">
        {relevant.map((s) => {
          const incoming = s.to === me;
          const proof = s.proofPath ? proofUrls.get(s.proofPath) : undefined;
          return (
            <li key={s.id} className="border-line grid gap-2 border-b-2 py-3 last:border-0">
              <p>
                <span className="mr-2">
                  <Plate size="sm">{plateNumber("PT", s.number)}</Plate>
                </span>
                <span className="font-bold">
                  {format(incoming ? t.pending.incoming : t.pending.outgoing, {
                    name: names[incoming ? s.from : s.to],
                    amount: rupiah(s.amount, locale),
                  })}
                </span>
              </p>
              {s.note && <p className="text-ink-soft text-sm">“{s.note}”</p>}
              <div className="flex flex-wrap items-center gap-2">
                {proof && (
                  <a
                    href={proof}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={buttonClass("ghost", "px-2 text-sm")}
                  >
                    <ImageIcon className="size-4" aria-hidden />
                    {t.pending.proof}
                  </a>
                )}
                {incoming ? (
                  <>
                    <form action={decideSettlement}>
                      <input type="hidden" name="lang" value={locale} />
                      <input type="hidden" name="id" value={s.id} />
                      <input type="hidden" name="decision" value="accept" />
                      <PesutOnSubmit
                        action="celebrate"
                        line={t.pesut.confirmLine}
                        className={buttonClass("primary")}
                      >
                        {t.pending.accept}
                      </PesutOnSubmit>
                    </form>
                    <form action={decideSettlement}>
                      <input type="hidden" name="lang" value={locale} />
                      <input type="hidden" name="id" value={s.id} />
                      <input type="hidden" name="decision" value="reject" />
                      <PesutOnSubmit
                        action="squirt"
                        line={t.pesut.rejectLine}
                        className={buttonClass("outline")}
                      >
                        {t.pending.reject}
                      </PesutOnSubmit>
                    </form>
                  </>
                ) : (
                  <form action={decideSettlement}>
                    <input type="hidden" name="lang" value={locale} />
                    <input type="hidden" name="id" value={s.id} />
                    <input type="hidden" name="decision" value="reject" />
                    <button type="submit" className={buttonClass("ghost", "text-sm")}>
                      {t.pending.withdraw}
                    </button>
                  </form>
                )}
              </div>
            </li>
          );
        })}
      </ul>
      {autoConfirmDays > 0 && (
        <p className="text-muted mt-2 text-sm">
          {format(t.pending.autoNote, { days: autoConfirmDays })}
        </p>
      )}
    </Panel>
  );
}
