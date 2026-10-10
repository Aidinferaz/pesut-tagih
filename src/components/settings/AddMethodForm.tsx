"use client";

import { useActionState, useEffect, useRef } from "react";
import { Field, FormMessage, inputClass, TextInput } from "@/components/forms/fields";
import { Button } from "@/components/ui/Button";
import { PROVIDERS } from "@/domain/providers";
import { useI18n } from "@/i18n/provider";
import { addPaymentMethod } from "@/server/actions/profile";
import type { FormState } from "@/server/actions/state";

export function AddMethodForm({ defaultName }: { defaultName: string }) {
  const { t, locale } = useI18n();
  const [state, action, pending] = useActionState<FormState, FormData>(addPaymentMethod, {
    status: "idle",
  });
  const form = useRef<HTMLFormElement>(null);
  const invalid = (field: string) => state.status === "error" && state.field === field;

  // After a successful add, clear the form and put the cursor back for the next one.
  useEffect(() => {
    if (state.status !== "ok" || !form.current) return;
    form.current.reset();
    form.current.querySelector<HTMLInputElement>("#method-number")?.focus();
  }, [state]);

  return (
    <form
      ref={form}
      action={action}
      className="grid gap-4 sm:grid-cols-[minmax(0,12rem)_minmax(0,1fr)_minmax(0,1fr)_auto] sm:items-end"
    >
      <input type="hidden" name="lang" value={locale} />
      <Field id="method-provider" label={t.settings.provider}>
        <select id="method-provider" name="provider" className={inputClass} defaultValue="bca">
          <optgroup label="Bank">
            {PROVIDERS.filter((p) => p.kind === "bank").map((p) => (
              <option key={p.code} value={p.code}>
                {p.name}
              </option>
            ))}
          </optgroup>
          <optgroup label="E-wallet">
            {PROVIDERS.filter((p) => p.kind === "ewallet").map((p) => (
              <option key={p.code} value={p.code}>
                {p.name}
              </option>
            ))}
          </optgroup>
        </select>
      </Field>
      <Field
        id="method-number"
        label={t.settings.accountNumber}
        error={invalid("accountNumber") ? t.errors.invalid : undefined}
      >
        <TextInput
          id="method-number"
          name="accountNumber"
          required
          inputMode="numeric"
          autoComplete="off"
          aria-invalid={invalid("accountNumber")}
        />
      </Field>
      <Field
        id="method-name"
        label={t.settings.accountName}
        error={invalid("accountName") ? t.errors.invalid : undefined}
      >
        <TextInput
          id="method-name"
          name="accountName"
          required
          maxLength={60}
          defaultValue={defaultName}
          aria-invalid={invalid("accountName")}
        />
      </Field>
      <Button type="submit" disabled={pending}>
        {t.settings.add}
      </Button>
      {state.status === "error" && !state.field && (
        <div className="sm:col-span-4">
          <FormMessage tone="error">{t.errors[state.error]}</FormMessage>
        </div>
      )}
    </form>
  );
}
