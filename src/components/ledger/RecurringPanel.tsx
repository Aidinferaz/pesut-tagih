"use client";

import { Pencil, Plus, Trash2 } from "lucide-react";
import { useActionState, useEffect, useId, useRef, useState } from "react";
import { Field, FormMessage, inputClass, TextInput } from "@/components/forms/fields";
import { Button, buttonClass } from "@/components/ui/Button";
import { Panel, PanelTitle } from "@/components/ui/Panel";
import { intlLocale } from "@/i18n/config";
import { format } from "@/i18n/format";
import { useI18n } from "@/i18n/provider";
import { rupiah } from "@/lib/format";
import {
  createRecurringBill,
  deleteRecurringBill,
  setRecurringBillActive,
  updateRecurringBill,
} from "@/server/actions/ledger";
import type { FormState } from "@/server/actions/state";
import { ConfirmSubmit } from "./ConfirmSubmit";

export type Bill = {
  id: string;
  title: string;
  amount: number;
  paidBy: string;
  participants: string[];
  dayOfMonth: number;
  nextRunOn: string;
  active: boolean;
  createdBy: string;
};

type Member = { id: string; name: string };

export function RecurringPanel({
  groupId,
  bills,
  members,
  me,
  isAdmin,
}: {
  groupId: string;
  bills: Bill[];
  members: Member[];
  me: string;
  isAdmin: boolean;
}) {
  const { t, locale } = useI18n();
  const ids = useId();
  const [editing, setEditing] = useState<string | null>(null);
  const nameOf = (id: string) => members.find((m) => m.id === id)?.name ?? "?";
  const canChange = (b: Bill) => isAdmin || b.createdBy === me || b.paidBy === me;

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
            <li key={b.id} className="border-line border-b-2 py-3">
              {/* Details on top, actions on their own row on phones; side by side from sm up. */}
              <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center sm:gap-4">
                <div className="min-w-0">
                  <p className="flex items-baseline justify-between gap-3 font-bold">
                    <span className="min-w-0 break-words">{b.title}</span>
                    <span className="whitespace-nowrap tabular-nums">
                      {rupiah(b.amount, locale)}
                    </span>
                  </p>
                  <p className="text-ink-soft text-sm">
                    {nameOf(b.paidBy)} → {b.participants.map(nameOf).join(", ")}
                  </p>
                  <p
                    className={`text-sm font-semibold ${b.active ? "text-ink-soft" : "text-debt"}`}
                  >
                    {b.active
                      ? format(t.recurring.next, { date: date(b.nextRunOn) })
                      : t.recurring.paused}
                  </p>
                </div>
                {canChange(b) && (
                  <div className="-ml-3 flex flex-wrap gap-1 sm:ml-0">
                    <Button
                      variant="ghost"
                      className="text-sm"
                      aria-expanded={editing === b.id}
                      onClick={() => setEditing(editing === b.id ? null : b.id)}
                    >
                      <Pencil className="size-4" aria-hidden />
                      {editing === b.id ? t.recurring.cancel : t.recurring.edit}
                    </Button>
                    <form action={setRecurringBillActive}>
                      <input type="hidden" name="lang" value={locale} />
                      <input type="hidden" name="id" value={b.id} />
                      <input type="hidden" name="active" value={String(!b.active)} />
                      <Button type="submit" variant="ghost" className="text-sm">
                        {b.active ? t.recurring.pause : t.recurring.resume}
                      </Button>
                    </form>
                    <form action={deleteRecurringBill}>
                      <input type="hidden" name="lang" value={locale} />
                      <input type="hidden" name="id" value={b.id} />
                      <ConfirmSubmit
                        message={t.recurring.deleteConfirm}
                        className={buttonClass("ghost", "text-debt text-sm")}
                      >
                        <Trash2 className="size-4" aria-hidden />
                        {t.recurring.delete}
                      </ConfirmSubmit>
                    </form>
                  </div>
                )}
              </div>
              {editing === b.id && (
                <BillForm
                  groupId={groupId}
                  members={members}
                  me={me}
                  bill={b}
                  onDone={() => setEditing(null)}
                />
              )}
            </li>
          ))}
        </ul>
      )}

      <details className="group mt-4">
        <summary
          className={buttonClass(
            "outline",
            "w-fit cursor-pointer list-none [&::-webkit-details-marker]:hidden",
          )}
        >
          <Plus className="size-4" aria-hidden />
          {t.recurring.add}
        </summary>
        <BillForm groupId={groupId} members={members} me={me} />
      </details>
    </Panel>
  );
}

/** One form for a new bill and for editing an existing one. */
function BillForm({
  groupId,
  members,
  me,
  bill,
  onDone,
}: {
  groupId: string;
  members: Member[];
  me: string;
  bill?: Bill;
  onDone?: () => void;
}) {
  const { t, locale } = useI18n();
  const ids = useId();
  const form = useRef<HTMLFormElement>(null);
  const [state, action, pending] = useActionState<FormState, FormData>(
    bill ? updateRecurringBill : createRecurringBill,
    { status: "idle" },
  );

  useEffect(() => {
    if (state.status !== "ok") return;
    if (bill) onDone?.();
    else form.current?.reset();
  }, [state, bill, onDone]);

  return (
    <form ref={form} action={action} className="mt-4 grid gap-4">
      <input type="hidden" name="lang" value={locale} />
      <input type="hidden" name="groupId" value={groupId} />
      {bill && <input type="hidden" name="id" value={bill.id} />}
      <div className="grid gap-4 sm:grid-cols-[minmax(0,2fr)_minmax(0,1fr)_minmax(0,7rem)]">
        <Field id={`${ids}-name`} label={t.recurring.name}>
          <TextInput
            id={`${ids}-name`}
            name="title"
            required
            maxLength={80}
            placeholder="Netflix"
            defaultValue={bill?.title}
          />
        </Field>
        <Field id={`${ids}-amount`} label={t.recurring.amount}>
          <TextInput
            id={`${ids}-amount`}
            name="amount"
            required
            inputMode="decimal"
            placeholder="186rb"
            defaultValue={bill ? String(bill.amount) : undefined}
          />
        </Field>
        <Field id={`${ids}-day`} label={t.recurring.day}>
          <TextInput
            id={`${ids}-day`}
            name="day"
            type="number"
            min={1}
            max={28}
            defaultValue={bill?.dayOfMonth ?? 1}
            required
          />
        </Field>
      </div>
      <Field id={`${ids}-payer`} label={t.recurring.payer}>
        <select
          id={`${ids}-payer`}
          name="paidBy"
          defaultValue={bill?.paidBy ?? me}
          className={inputClass}
        >
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
              className="border-line has-[:checked]:border-line-strong has-[:checked]:bg-plate has-[:checked]:text-plate-ink flex min-h-10 cursor-pointer items-center gap-2 rounded-md border-2 px-3.5 text-sm font-bold"
            >
              <input
                type="checkbox"
                name="participants"
                value={m.id}
                defaultChecked={bill ? bill.participants.includes(m.id) : true}
                className="sr-only"
              />
              {m.name}
            </label>
          ))}
        </div>
      </fieldset>
      {bill ? (
        <p className="text-ink-soft text-sm">{t.recurring.editHint}</p>
      ) : (
        <div className="grid gap-1">
          <p className="text-ink-soft text-sm">{t.recurring.startHint}</p>
          <label className="flex items-start gap-3 text-sm font-semibold">
            <input
              type="checkbox"
              name="startNextMonth"
              className="mt-0.5 size-5 accent-[var(--plate)]"
            />
            {t.recurring.startNextMonth}
          </label>
        </div>
      )}
      {state.status === "error" && <FormMessage tone="error">{t.errors[state.error]}</FormMessage>}
      <div>
        <Button type="submit" variant={bill ? "primary" : "outline"} disabled={pending}>
          {bill ? t.recurring.save : t.recurring.create}
        </Button>
      </div>
    </form>
  );
}
