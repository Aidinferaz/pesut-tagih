"use client";

import { useActionState } from "react";
import { Field, FormMessage, inputClass, TextInput } from "@/components/forms/fields";
import { Button } from "@/components/ui/Button";
import { useI18n } from "@/i18n/provider";
import { updateProfile } from "@/server/actions/profile";
import type { FormState } from "@/server/actions/state";

export function ProfileForm({ name, locale: saved }: { name: string; locale: "id" | "en" }) {
  const { t, locale } = useI18n();
  const [state, action, pending] = useActionState<FormState, FormData>(updateProfile, {
    status: "idle",
  });
  return (
    <form action={action} className="grid gap-4 sm:max-w-md">
      <input type="hidden" name="lang" value={locale} />
      <Field id="profile-name" label={t.settings.name}>
        <TextInput
          id="profile-name"
          name="name"
          defaultValue={name}
          required
          maxLength={40}
          autoComplete="nickname"
        />
      </Field>
      <Field id="profile-locale" label={t.settings.language}>
        <select id="profile-locale" name="locale" defaultValue={saved} className={inputClass}>
          <option value="id">{t.language.id}</option>
          <option value="en">{t.language.en}</option>
        </select>
      </Field>
      <div className="flex items-center gap-3">
        <Button type="submit" disabled={pending}>
          {t.settings.save}
        </Button>
        {state.status === "ok" && <FormMessage tone="ok">{t.settings.saved}</FormMessage>}
        {state.status === "error" && (
          <FormMessage tone="error">{t.errors[state.error]}</FormMessage>
        )}
      </div>
    </form>
  );
}
