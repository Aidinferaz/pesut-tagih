"use client";

import { useActionState } from "react";
import { Field, FormMessage, TextInput } from "@/components/forms/fields";
import { Button } from "@/components/ui/Button";
import { HullSwatch } from "@/components/ui/HullSwatch";
import { useI18n } from "@/i18n/provider";
import { createGroup } from "@/server/actions/groups";
import type { FormState } from "@/server/actions/state";

const HULLS = ["band", "action", "surface", "debt"] as const;

export function CreateGroupForm() {
  const { t, locale } = useI18n();
  const [state, action, pending] = useActionState<FormState, FormData>(createGroup, {
    status: "idle",
  });
  const nameError = state.status === "error" && state.field === "name";

  return (
    <form action={action} className="grid max-w-lg gap-5">
      <input type="hidden" name="lang" value={locale} />
      <Field id="group-name" label={t.groups.name} error={nameError ? t.errors.invalid : undefined}>
        <TextInput
          id="group-name"
          name="name"
          required
          maxLength={40}
          autoComplete="off"
          placeholder={t.groups.namePlaceholder}
          aria-invalid={nameError}
          aria-describedby={nameError ? "group-name-error" : undefined}
        />
      </Field>
      <fieldset>
        <legend className="mb-2 text-sm font-bold">{t.groups.hull}</legend>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {HULLS.map((hull, i) => (
            <label
              key={hull}
              className="border-line has-[:checked]:border-line-strong has-[:checked]:bg-surface-sunk flex cursor-pointer flex-col gap-2 rounded-md border-2 p-3 has-[:focus-visible]:outline-3 has-[:focus-visible]:outline-[var(--focus)]"
            >
              <input
                type="radio"
                name="hull"
                value={hull}
                defaultChecked={i === 0}
                className="sr-only"
              />
              <HullSwatch hull={hull} className="h-6 w-14" />
              <span className="text-sm font-semibold">{t.groups.hulls[hull]}</span>
            </label>
          ))}
        </div>
      </fieldset>
      {state.status === "error" && !nameError && (
        <FormMessage tone="error">{t.errors[state.error]}</FormMessage>
      )}
      <div>
        <Button type="submit" disabled={pending}>
          {t.groups.create}
        </Button>
      </div>
    </form>
  );
}
