"use client";

import { Plus, X } from "lucide-react";
import { useActionState, useId, useMemo, useState } from "react";
import { Field, FormMessage, inputClass, TextInput } from "@/components/forms/fields";
import { Button } from "@/components/ui/Button";
import { parseRupiah } from "@/domain/money";
import {
  itemizedTotal,
  splitEqual,
  splitExact,
  splitItemized,
  SplitError,
  type Share,
} from "@/domain/split";
import { format } from "@/i18n/format";
import { useI18n } from "@/i18n/provider";
import { rupiah } from "@/lib/format";
import { createExpense, type ExpenseInput } from "@/server/actions/ledger";
import type { FormState } from "@/server/actions/state";

type Member = { id: string; name: string };
type Method = "equal" | "exact" | "itemized";
type Item = { key: number; name: string; amount: string; owners: string[] };

const amountOf = (text: string) => (text.trim() === "" ? 0 : parseRupiah(text));

/** Today's date in Kalimantan Timur (WITA), as YYYY-MM-DD for the date input. */
function todayWita() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Makassar" }).format(new Date());
}

/**
 * Logging an expense. The split is previewed live with the same domain code
 * the server uses; the server recomputes it from the raw inputs anyway.
 */
export function ExpenseForm({
  groupId,
  members,
  me,
}: {
  groupId: string;
  members: Member[];
  me: string;
}) {
  const { t, locale } = useI18n();
  const ids = useId();
  const [state, action, pending] = useActionState<FormState, FormData>(createExpense, {
    status: "idle",
  });

  const [title, setTitle] = useState("");
  const [total, setTotal] = useState("");
  const [paidBy, setPaidBy] = useState(me);
  const [date, setDate] = useState(todayWita);
  const [note, setNote] = useState("");
  const [method, setMethod] = useState<Method>("equal");
  const [participants, setParticipants] = useState<string[]>(members.map((m) => m.id));
  const [exact, setExact] = useState<Record<string, string>>({});
  const [items, setItems] = useState<Item[]>([{ key: 0, name: "", amount: "", owners: [] }]);
  const [extras, setExtras] = useState({ tax: "", service: "", discount: "" });

  const nameOf = (id: string) => members.find((m) => m.id === id)?.name ?? "";
  const parsedTotal = amountOf(total);

  // The live preview: either the shares, or the reason there aren't any yet.
  const preview = useMemo((): { shares: Share[]; total: number } | { error: string } => {
    try {
      if (method === "itemized") {
        const input = {
          items: items.map((i) => ({
            amount: amountOf(i.amount) ?? NaN,
            claims: i.owners.map((userId) => ({ userId, weight: 1 })),
          })),
          tax: amountOf(extras.tax) ?? NaN,
          service: amountOf(extras.service) ?? NaN,
          discount: amountOf(extras.discount) ?? NaN,
        };
        return { shares: splitItemized(input), total: itemizedTotal(input) };
      }
      if (!parsedTotal) return { error: "total" };
      if (method === "equal")
        return { shares: splitEqual(parsedTotal, participants), total: parsedTotal };
      const entries = members
        .map((m) => ({ userId: m.id, amount: amountOf(exact[m.id] ?? "") ?? NaN }))
        .filter((s) => s.amount !== 0);
      return { shares: splitExact(parsedTotal, entries), total: parsedTotal };
    } catch (error) {
      return { error: error instanceof SplitError ? error.code : "invalid_amount" };
    }
  }, [method, items, extras, parsedTotal, participants, members, exact]);

  const exactSum = members.reduce((s, m) => s + (amountOf(exact[m.id] ?? "") ?? 0), 0);
  const ready = "shares" in preview && title.trim() !== "" && preview.total > 0;

  const payload: ExpenseInput = {
    groupId,
    title: title.trim(),
    paidBy,
    occurredOn: date || undefined,
    note: note.trim() || undefined,
    method,
    ...(method === "itemized"
      ? {
          items: items.map((i) => ({
            name: i.name.trim() || "-",
            amount: i.amount,
            claims: i.owners.map((userId) => ({ userId, weight: 1 })),
          })),
          ...extras,
        }
      : { total }),
    ...(method === "equal" && { participants }),
    ...(method === "exact" && {
      exact: members
        .filter((m) => (exact[m.id] ?? "").trim() !== "")
        .map((m) => ({ userId: m.id, amount: exact[m.id] })),
    }),
  };

  const toggle = (list: string[], id: string) =>
    list.includes(id) ? list.filter((x) => x !== id) : [...list, id];
  const updateItem = (key: number, patch: Partial<Item>) =>
    setItems((all) => all.map((i) => (i.key === key ? { ...i, ...patch } : i)));

  const errorText = (code: string) =>
    code in t.expenseForm.splitErrors
      ? t.expenseForm.splitErrors[code as keyof typeof t.expenseForm.splitErrors]
      : t.errors.invalid;

  return (
    <form action={action} className="grid gap-6">
      <input type="hidden" name="lang" value={locale} />
      <input type="hidden" name="payload" value={JSON.stringify(payload)} />

      <div className="grid gap-4 sm:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <Field id={`${ids}-title`} label={t.expenseForm.whatFor}>
          <TextInput
            id={`${ids}-title`}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
            maxLength={80}
            autoComplete="off"
            placeholder={t.expenseForm.whatForPlaceholder}
          />
        </Field>
        <Field id={`${ids}-date`} label={t.expenseForm.date}>
          <TextInput
            id={`${ids}-date`}
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
          />
        </Field>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field id={`${ids}-payer`} label={t.expenseForm.paidBy}>
          <select
            id={`${ids}-payer`}
            value={paidBy}
            onChange={(e) => setPaidBy(e.target.value)}
            className={inputClass}
          >
            {members.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
              </option>
            ))}
          </select>
        </Field>
        {method !== "itemized" && (
          <Field id={`${ids}-total`} label={t.expenseForm.total}>
            <AmountInput
              id={`${ids}-total`}
              value={total}
              onChange={setTotal}
              hint={t.expenseForm.totalHint}
              required
            />
          </Field>
        )}
      </div>

      <fieldset>
        <legend className="mb-2 text-sm font-bold">{t.expenseForm.method}</legend>
        <div className="border-line-strong inline-flex flex-wrap gap-1 rounded-md border-2 p-1">
          {(["equal", "exact", "itemized"] as const).map((m) => (
            <label
              key={m}
              className="has-[:checked]:bg-plate has-[:checked]:text-plate-ink cursor-pointer rounded px-3 py-2 text-sm font-bold has-[:focus-visible]:outline-3 has-[:focus-visible]:outline-[var(--focus)]"
            >
              <input
                type="radio"
                name="method"
                value={m}
                checked={method === m}
                onChange={() => setMethod(m)}
                className="sr-only"
              />
              {t.expenseForm.methods[m]}
            </label>
          ))}
        </div>
      </fieldset>

      {method === "equal" && (
        <fieldset>
          <div className="mb-2 flex items-center justify-between gap-2">
            <legend className="text-sm font-bold">{t.expenseForm.who}</legend>
            <div className="flex gap-1">
              <Button
                variant="ghost"
                className="min-h-9 px-2 text-sm"
                onClick={() => setParticipants(members.map((m) => m.id))}
              >
                {t.expenseForm.all}
              </Button>
              <Button
                variant="ghost"
                className="min-h-9 px-2 text-sm"
                onClick={() => setParticipants([])}
              >
                {t.expenseForm.clear}
              </Button>
            </div>
          </div>
          <PeoplePicker
            members={members}
            selected={participants}
            onToggle={(id) => setParticipants((p) => toggle(p, id))}
          />
        </fieldset>
      )}

      {method === "exact" && (
        <fieldset className="grid gap-2">
          <legend className="mb-1 text-sm font-bold">{t.expenseForm.who}</legend>
          {members.map((m) => (
            <div
              key={m.id}
              className="grid grid-cols-[minmax(0,1fr)_minmax(0,12rem)] items-center gap-3"
            >
              <label htmlFor={`${ids}-exact-${m.id}`} className="font-semibold">
                {m.name}
              </label>
              <AmountInput
                id={`${ids}-exact-${m.id}`}
                value={exact[m.id] ?? ""}
                onChange={(v) => setExact((e) => ({ ...e, [m.id]: v }))}
              />
            </div>
          ))}
          {parsedTotal ? (
            <p
              className={`text-sm font-bold ${exactSum === parsedTotal ? "text-credit" : "text-debt"}`}
            >
              {exactSum === parsedTotal
                ? t.expenseForm.balanced
                : format(exactSum < parsedTotal ? t.expenseForm.remaining : t.expenseForm.over, {
                    amount: rupiah(Math.abs(parsedTotal - exactSum), locale),
                  })}
            </p>
          ) : null}
        </fieldset>
      )}

      {method === "itemized" && (
        <div className="grid gap-4">
          <ol className="grid gap-3">
            {items.map((item, index) => (
              <li key={item.key} className="border-line grid gap-3 rounded-md border-2 p-3">
                <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,9rem)_auto] items-end gap-2">
                  <Field id={`${ids}-item-${item.key}`} label={t.expenseForm.itemName}>
                    <TextInput
                      id={`${ids}-item-${item.key}`}
                      value={item.name}
                      maxLength={80}
                      onChange={(e) => updateItem(item.key, { name: e.target.value })}
                    />
                  </Field>
                  <Field id={`${ids}-item-amount-${item.key}`} label={t.expenseForm.itemAmount}>
                    <AmountInput
                      id={`${ids}-item-amount-${item.key}`}
                      value={item.amount}
                      onChange={(v) => updateItem(item.key, { amount: v })}
                    />
                  </Field>
                  <Button
                    variant="ghost"
                    className="px-2"
                    aria-label={format(t.expenseForm.removeItem, { n: index + 1 })}
                    disabled={items.length === 1}
                    onClick={() => setItems((all) => all.filter((i) => i.key !== item.key))}
                  >
                    <X className="size-4" aria-hidden />
                  </Button>
                </div>
                <div>
                  <p className="mb-1.5 text-sm font-bold">{t.expenseForm.whoHad}</p>
                  <PeoplePicker
                    members={members}
                    selected={item.owners}
                    onToggle={(id) => updateItem(item.key, { owners: toggle(item.owners, id) })}
                  />
                </div>
              </li>
            ))}
          </ol>
          <div>
            <Button
              variant="outline"
              onClick={() =>
                setItems((all) => [
                  ...all,
                  { key: Math.max(...all.map((i) => i.key)) + 1, name: "", amount: "", owners: [] },
                ])
              }
            >
              <Plus className="size-4" aria-hidden />
              {t.expenseForm.addItem}
            </Button>
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            {(["tax", "service", "discount"] as const).map((k) => (
              <Field key={k} id={`${ids}-${k}`} label={t.expenseForm[k]}>
                <AmountInput
                  id={`${ids}-${k}`}
                  value={extras[k]}
                  onChange={(v) => setExtras((e) => ({ ...e, [k]: v }))}
                />
              </Field>
            ))}
          </div>
        </div>
      )}

      <Field id={`${ids}-note`} label={t.expenseForm.note}>
        <TextInput
          id={`${ids}-note`}
          value={note}
          onChange={(e) => setNote(e.target.value)}
          maxLength={280}
        />
      </Field>

      <section
        aria-labelledby={`${ids}-summary`}
        aria-live="polite"
        className="bg-surface-sunk rounded-md p-4"
      >
        <h2 id={`${ids}-summary`} className="display text-xl uppercase">
          {t.expenseForm.summary}
          {"shares" in preview && (
            <span className="text-ink-soft ml-2">{rupiah(preview.total, locale)}</span>
          )}
        </h2>
        {"shares" in preview ? (
          <ul className="mt-2 grid gap-1 sm:grid-cols-2">
            {preview.shares.map((s) => (
              <li key={s.userId} className="border-line flex justify-between gap-3 border-b py-1.5">
                <span className="font-semibold">{nameOf(s.userId)}</span>
                <span className="tabular-nums">{rupiah(s.amount, locale)}</span>
              </li>
            ))}
          </ul>
        ) : (
          preview.error !== "total" && (
            <p className="text-debt mt-2 text-sm font-semibold">{errorText(preview.error)}</p>
          )
        )}
      </section>

      {state.status === "error" && (
        <FormMessage tone="error">
          {state.field ? errorText(state.field) : t.errors[state.error]}
        </FormMessage>
      )}
      <div>
        <Button type="submit" disabled={!ready || pending} className="min-h-12 px-6">
          {t.expenseForm.save}
        </Button>
      </div>
    </form>
  );
}

/** Text amount field that shows how it was read, so "120rb" visibly becomes Rp120.000. */
function AmountInput({
  id,
  value,
  onChange,
  hint,
  required,
}: {
  id: string;
  value: string;
  onChange: (value: string) => void;
  hint?: string;
  required?: boolean;
}) {
  const { locale } = useI18n();
  const read = value.trim() === "" ? null : parseRupiah(value);
  const invalid = value.trim() !== "" && read === null;
  return (
    <div className="grid gap-1">
      <input
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        inputMode="decimal"
        autoComplete="off"
        required={required}
        aria-invalid={invalid}
        aria-describedby={`${id}-read`}
        className={`${inputClass} tabular-nums`}
      />
      <span
        id={`${id}-read`}
        className={`text-xs font-semibold ${invalid ? "text-debt" : "text-muted"}`}
      >
        {read !== null ? `= ${rupiah(read, locale)}` : (hint ?? " ")}
      </span>
    </div>
  );
}

function PeoplePicker({
  members,
  selected,
  onToggle,
}: {
  members: Member[];
  selected: string[];
  onToggle: (id: string) => void;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {members.map((m) => {
        const on = selected.includes(m.id);
        return (
          <button
            key={m.id}
            type="button"
            aria-pressed={on}
            onClick={() => onToggle(m.id)}
            className={`min-h-10 rounded-full border-2 px-3.5 text-sm font-bold transition-colors ${
              on
                ? "border-line-strong bg-plate text-plate-ink"
                : "border-line text-ink-soft hover:border-line-strong"
            }`}
          >
            {m.name}
          </button>
        );
      })}
    </div>
  );
}
