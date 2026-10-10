"use client";

import { QrCode } from "lucide-react";
import { useActionState, useRef } from "react";
import { FormMessage } from "@/components/forms/fields";
import { buttonClass } from "@/components/ui/Button";
import { useI18n } from "@/i18n/provider";
import { uploadQris } from "@/server/actions/profile";
import type { FormState } from "@/server/actions/state";

/** Picking a file submits immediately; there is nothing else to fill in. */
export function QrisUpload({ methodId, hasQris }: { methodId: string; hasQris: boolean }) {
  const { t, locale } = useI18n();
  const [state, action, pending] = useActionState<FormState, FormData>(uploadQris, {
    status: "idle",
  });
  const form = useRef<HTMLFormElement>(null);
  return (
    <form ref={form} action={action} className="flex items-center gap-2">
      <input type="hidden" name="lang" value={locale} />
      <input type="hidden" name="id" value={methodId} />
      <label className={buttonClass("ghost", "cursor-pointer px-2 text-sm")}>
        <QrCode className="size-4" aria-hidden />
        {hasQris ? t.settings.qrisHas : t.settings.qrisUpload}
        <input
          type="file"
          name="qris"
          accept="image/png,image/jpeg,image/webp"
          className="sr-only"
          disabled={pending}
          onChange={() => form.current?.requestSubmit()}
        />
      </label>
      {state.status === "error" && <FormMessage tone="error">{t.errors[state.error]}</FormMessage>}
    </form>
  );
}
