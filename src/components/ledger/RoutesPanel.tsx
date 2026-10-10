"use client";

import { Check, Copy, QrCode } from "lucide-react";
import { useActionState, useEffect, useId, useState } from "react";
import { Field, FormMessage, TextInput } from "@/components/forms/fields";
import { usePesut } from "@/components/pesut/mood";
import { Button, buttonClass } from "@/components/ui/Button";
import { Panel, PanelTitle } from "@/components/ui/Panel";
import { Plate } from "@/components/ui/Plate";
import { providerName, type ProviderCode } from "@/domain/providers";
import { format } from "@/i18n/format";
import { useI18n } from "@/i18n/provider";
import { rupiah } from "@/lib/format";
import { markPaid, recordReceived } from "@/server/actions/ledger";
import type { FormState } from "@/server/actions/state";

export type Route = {
  from: string;
  to: string;
  amount: number;
  via: ProviderCode | null;
  fee: number | null;
};

export type Account = {
  userId: string;
  provider: ProviderCode;
  accountNumber: string;
  accountName: string;
  qrisUrl: string | null;
};

type Props = {
  groupId: string;
  groupName: string;
  me: string;
  names: Record<string, string>;
  routes: Route[];
  accounts: Account[];
  siteUrl: string;
};

/**
 * The settlement plan as bow plates. Your own transfers come first and can be
 * acted on right here; the rest of the group's routes follow, quieter.
 */
export function RoutesPanel({ groupId, groupName, me, names, routes, accounts, siteUrl }: Props) {
  const { t, locale } = useI18n();
  const [open, setOpen] = useState<string | null>(null);
  const mine = routes.filter((r) => r.from === me || r.to === me);
  const others = routes.filter((r) => r.from !== me && r.to !== me);
  const key = (r: Route) => `${r.from}>${r.to}`;

  const via = (r: Route) => {
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

  const nudge = (r: Route) => {
    usePesut.getState().act("squirt");
    usePesut.getState().say(format(t.pesut.nudgeLine, { name: names[r.from] }));
    const text = format(t.routes.nudgeMessage, {
      name: names[r.from],
      amount: rupiah(r.amount, locale),
      me: names[me],
      group: groupName,
      url: `${siteUrl}/${locale}/groups/${groupId}`,
    });
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, "_blank", "noopener,noreferrer");
  };

  return (
    <Panel aria-labelledby="routes-title">
      <PanelTitle id="routes-title">{t.routes.title}</PanelTitle>
      {routes.length === 0 ? (
        <p className="text-ink-soft mt-3">{t.routes.empty}</p>
      ) : (
        <ol className="mt-3">
          {mine.map((r, index) => {
            const outgoing = r.from === me;
            const isOpen = open === key(r);
            return (
              <li key={key(r)} className="border-line border-b-2 py-3.5 last:border-0">
                <div className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-x-4 gap-y-2">
                  <Plate>{`R${index + 1}`}</Plate>
                  <div className="min-w-0">
                    <p className="font-bold">
                      {outgoing ? t.routes.you : names[r.from]} →{" "}
                      {outgoing ? names[r.to] : t.routes.you}
                    </p>
                    <p className="text-sm font-semibold">{via(r)}</p>
                  </div>
                  <p
                    className={`figure text-[1.625rem] leading-none sm:text-[1.875rem] ${outgoing ? "text-debt" : "text-credit"}`}
                  >
                    {rupiah(r.amount, locale)}
                  </p>
                  <div className="col-span-3 flex flex-wrap justify-end gap-2">
                    {outgoing ? (
                      <Button
                        variant={isOpen ? "outline" : "primary"}
                        aria-expanded={isOpen}
                        onClick={() => setOpen(isOpen ? null : key(r))}
                      >
                        {isOpen ? t.routes.cancel : t.actions.markPaid}
                      </Button>
                    ) : (
                      <>
                        <Button
                          variant="ghost"
                          aria-expanded={isOpen}
                          onClick={() => setOpen(isOpen ? null : key(r))}
                        >
                          {t.routes.recordCash}
                        </Button>
                        <Button variant="outline" onClick={() => nudge(r)}>
                          {t.routes.nudge}
                        </Button>
                      </>
                    )}
                  </div>
                </div>
                {isOpen &&
                  (outgoing ? (
                    <PayForm
                      groupId={groupId}
                      route={r}
                      receiverName={names[r.to]}
                      accounts={accounts.filter((a) => a.userId === r.to)}
                      onDone={() => setOpen(null)}
                    />
                  ) : (
                    <CashForm
                      groupId={groupId}
                      route={r}
                      payerName={names[r.from]}
                      onDone={() => setOpen(null)}
                    />
                  ))}
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
                key={key(r)}
                className="border-line flex items-baseline justify-between gap-4 border-b py-2 text-[0.9375rem] last:border-0"
              >
                <span>
                  <span className="font-semibold">
                    {names[r.from]} → {names[r.to]}
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

function CopyNumber({ value }: { value: string }) {
  const { t } = useI18n();
  const [copied, setCopied] = useState(false);
  return (
    <Button
      variant="ghost"
      className="min-h-9 px-2 text-sm"
      onClick={async () => {
        await navigator.clipboard.writeText(value);
        setCopied(true);
        window.setTimeout(() => setCopied(false), 1800);
      }}
    >
      {copied ? (
        <Check className="size-4" strokeWidth={3} aria-hidden />
      ) : (
        <Copy className="size-4" aria-hidden />
      )}
      {copied ? t.actions.copied : t.actions.copy}
    </Button>
  );
}

function PayForm({
  groupId,
  route,
  receiverName,
  accounts,
  onDone,
}: {
  groupId: string;
  route: Route;
  receiverName: string;
  accounts: Account[];
  onDone: () => void;
}) {
  const { t, locale } = useI18n();
  const ids = useId();
  const [state, action, pending] = useActionState<FormState, FormData>(markPaid, {
    status: "idle",
  });
  // The matching account first: that's the admin-free one.
  const ordered = [...accounts].sort(
    (a, b) => Number(b.provider === route.via) - Number(a.provider === route.via),
  );

  useEffect(() => {
    if (state.status !== "ok") return;
    usePesut.getState().act("celebrate");
    usePesut.getState().say(format(t.pesut.paidLine, { name: receiverName }));
    onDone();
  }, [state, onDone, receiverName, t]);

  return (
    <form action={action} className="bg-surface-sunk mt-4 grid gap-4 rounded-md p-4">
      <input type="hidden" name="lang" value={locale} />
      <input type="hidden" name="groupId" value={groupId} />
      <input type="hidden" name="to" value={route.to} />
      <div>
        <h4 className="text-sm font-bold">{format(t.routes.accountsOf, { name: receiverName })}</h4>
        {ordered.length === 0 ? (
          <p className="text-ink-soft mt-1 text-sm">
            {format(t.routes.noAccounts, { name: receiverName })}
          </p>
        ) : (
          <ul className="mt-2 grid gap-2">
            {ordered.map((a) => (
              <li
                key={`${a.provider}-${a.accountNumber}`}
                className={`bg-surface flex flex-wrap items-center gap-x-3 gap-y-1 rounded-md border-2 px-3 py-2 ${a.provider === route.via ? "border-line-strong" : "border-line"}`}
              >
                <label className="flex min-w-0 flex-1 items-center gap-3">
                  <input
                    type="radio"
                    name="provider"
                    value={a.provider}
                    defaultChecked={a.provider === ordered[0].provider}
                    className="size-4 accent-[var(--plate)]"
                  />
                  <span className="min-w-0">
                    <span className="block font-bold">
                      {providerName(a.provider)}
                      {a.provider === route.via && route.fee === 0 && (
                        <span className="text-credit ml-2 text-xs font-bold">
                          {t.routes.matched}
                        </span>
                      )}
                    </span>
                    <span className="block text-sm tabular-nums">
                      {a.accountNumber} · {a.accountName}
                    </span>
                  </span>
                </label>
                <CopyNumber value={a.accountNumber} />
                {a.qrisUrl && (
                  <a
                    href={a.qrisUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={buttonClass("ghost", "min-h-9 px-2 text-sm")}
                  >
                    <QrCode className="size-4" aria-hidden />
                    {t.routes.viewQris}
                  </a>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field id={`${ids}-amount`} label={t.routes.amountLabel}>
          <TextInput
            id={`${ids}-amount`}
            name="amount"
            defaultValue={String(route.amount)}
            inputMode="numeric"
            required
          />
        </Field>
        <Field id={`${ids}-proof`} label={t.routes.proof}>
          <input
            id={`${ids}-proof`}
            name="proof"
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="file:border-line-strong file:bg-surface text-sm file:mr-3 file:min-h-10 file:rounded-md file:border-2 file:px-3 file:font-bold"
          />
        </Field>
      </div>
      <Field id={`${ids}-note`} label={t.routes.note}>
        <TextInput id={`${ids}-note`} name="note" maxLength={280} />
      </Field>
      {state.status === "error" && <FormMessage tone="error">{t.errors[state.error]}</FormMessage>}
      <div>
        <Button type="submit" disabled={pending}>
          {t.routes.submitPaid}
        </Button>
      </div>
    </form>
  );
}

function CashForm({
  groupId,
  route,
  payerName,
  onDone,
}: {
  groupId: string;
  route: Route;
  payerName: string;
  onDone: () => void;
}) {
  const { t, locale } = useI18n();
  const ids = useId();
  const [state, action, pending] = useActionState<FormState, FormData>(recordReceived, {
    status: "idle",
  });

  useEffect(() => {
    if (state.status !== "ok") return;
    usePesut.getState().act("celebrate");
    usePesut.getState().say(t.pesut.confirmLine);
    onDone();
  }, [state, onDone, t]);

  return (
    <form
      action={action}
      className="bg-surface-sunk mt-4 grid gap-3 rounded-md p-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end"
    >
      <input type="hidden" name="lang" value={locale} />
      <input type="hidden" name="groupId" value={groupId} />
      <input type="hidden" name="from" value={route.from} />
      <Field id={`${ids}-cash`} label={`${t.routes.amountLabel} · ${payerName}`}>
        <TextInput
          id={`${ids}-cash`}
          name="amount"
          defaultValue={String(route.amount)}
          inputMode="numeric"
          required
        />
      </Field>
      <Button type="submit" disabled={pending}>
        {t.routes.recordCashSubmit}
      </Button>
      {state.status === "error" && <FormMessage tone="error">{t.errors[state.error]}</FormMessage>}
    </form>
  );
}
