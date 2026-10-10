"use client";

import { useActionState, useEffect, useId, useRef } from "react";
import { Field, FormMessage, inputClass, TextInput } from "@/components/forms/fields";
import { Button } from "@/components/ui/Button";
import { Panel, PanelTitle } from "@/components/ui/Panel";
import { intlLocale } from "@/i18n/config";
import { format } from "@/i18n/format";
import { useI18n } from "@/i18n/provider";
import { rupiah } from "@/lib/format";
import { createRecurringBill, setRecurringBillActive } from "@/server/actions/ledger";
import type { FormState } from "@/server/actions/state";

export type Bill = {
  id: string;
  title: string;
  amount: number;
  paidBy: string;
  participants: string[];
  dayOfMonth: number;
  nextRunOn: string;
  active: boolean;
};

export function RecurringPanel({
  groupId,
  bills,
  members,
  me,
}: {
  groupId: string;
  bills: Bill[];
  members: { id: string; name: string }[];
  me: string;
}) {
  const { t, locale } = useI18n();
  const ids = useId();
  const form = useRef<HTMLFormElement>(null);
  const [state, action, pending] = useActionState<FormState, FormData>(createRecurringBill, {
    status: "idle",
  });
  const nameOf = (id: string) => members.find((m) => m.id === id)?.name ?? "?";

  useEffect(() => {
    if (state.status === "ok") form.current?.reset();
  }, [state]);

  const date = (iso: string) => {
    const [y, m, d] = iso.split("-").map(Number);
    return new Intl.DateTimeFormat(intlLocale[locale], {
      day: "numeric",
      month: "short",
      timeZone: "UTC",
    }).format(new Date(Date.UTC(y, m - 1, d)));
  };

  return (
    <Panel aria-labelledby={`${ids}-title`}>
      <PanelTitle id={`${ids}-title`}>{t.recurring.title}</PanelTitle>
      <p className="text-ink-soft mt-2">{t.recurring.body}</p>

      {bills.length === 0 ? (
        <p className="text-muted mt-3 text-sm font-semibold">{t.recurring.empty}</p>
      ) : (
        <ul className="border-line mt-3 border-t-2">
          {bills.map((b) => (
            <li
              key={b.id}
              className="border-line flex flex-wrap items-center gap-x-4 gap-y-1 border-b-2 py-3"
            >
              <div className="min-w-0 flex-1">
                <p className="font-bold">
                  {b.title} · {rupiah(b.amount, locale)}
                </p>
                <p className="text-ink-soft text-sm">
                  {nameOf(b.paidBy)} → {b.participants.map(nameOf).join(", ")} ·{" "}
                  {b.active
                    ? format(t.recurring.next, { date: date(b.nextRunOn) })
                    : t.recurring.paused}
                </p>
              </div>
              <form action={setRecurringBillActive}>
                <input type="hidden" name="lang" value={locale} />
                <input type="hidden" name="id" value={b.id} />
                <input type="hidden" name="active" value={String(!b.active)} />
                <Button type="submit" variant="ghost" className="text-sm">
                  {b.active ? t.recurring.pause : t.recurring.resume}
                </Button>
              </form>
            </li>
          ))}
        </ul>
      )}

      <form ref={form} action={action} className="mt-5 grid gap-4">
        <input type="hidden" name="lang" value={locale} />
        <input type="hidden" name="groupId" value={groupId} />
        <div className="grid gap-4 sm:grid-cols-[minmax(0,2fr)_minmax(0,1fr)_minmax(0,7rem)]">
          <Field id={`${ids}-name`} label={t.recurring.name}>
            <TextInput
              id={`${ids}-name`}
              name="title"
              required
              maxLength={80}
              placeholder="Netflix"
            />
          </Field>
          <Field id={`${ids}-amount`} label={t.recurring.amount}>
            <TextInput
              id={`${ids}-amount`}
              name="amount"
              required
              inputMode="decimal"
              placeholder="186rb"
            />
          </Field>
          <Field id={`${ids}-day`} label={t.recurring.day}>
            <TextInput
              id={`${ids}-day`}
              name="day"
              type="number"
              min={1}
              max={28}
              defaultValue={1}
              required
            />
          </Field>
        </div>
        <Field id={`${ids}-payer`} label={t.recurring.payer}>
          <select id={`${ids}-payer`} name="paidBy" defaultValue={me} className={inputClass}>
            {members.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
              </option>
            ))}
          </select>
        </Field>
        <fieldset>
          <legend className="mb-2 text-sm font-bold">{t.recurring.who}</legend>
          <div className="flex flex-wrap gap-2">
            {members.map((m) => (
              <label
                key={m.id}
                className="border-line has-[:checked]:border-line-strong has-[:checked]:bg-plate has-[:checked]:text-plate-ink flex min-h-10 cursor-pointer items-center gap-2 rounded-full border-2 px-3.5 text-sm font-bold"
              >
                <input
                  type="checkbox"
                  name="participants"
                  value={m.id}
                  defaultChecked
                  className="sr-only"
                />
                {m.name}
              </label>
            ))}
          </div>
        </fieldset>
        {state.status === "error" && (
          <FormMessage tone="error">{t.errors[state.error]}</FormMessage>
        )}
        <div>
          <Button type="submit" variant="outline" disabled={pending}>
            {t.recurring.create}
          </Button>
        </div>
      </form>
    </Panel>
  );
}
