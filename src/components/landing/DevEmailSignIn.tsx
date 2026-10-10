"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/Button";
import { useI18n } from "@/i18n/provider";
import { signInWithEmail, type EmailSignInState } from "@/server/actions/auth";

export function DevEmailSignIn({ next }: { next: string }) {
  const { t, locale } = useI18n();
  const [state, action, pending] = useActionState<EmailSignInState, FormData>(signInWithEmail, {
    status: "idle",
  });

  return (
    <form
      action={action}
      className="border-line-strong mt-6 max-w-md rounded-[10px] border-2 border-dashed p-4"
    >
      <input type="hidden" name="lang" value={locale} />
      <input type="hidden" name="next" value={next} />
      <label htmlFor="dev-email" className="text-sm font-bold">
        {t.landing.devEmail}
      </label>
      <div className="mt-2 flex gap-2">
        <input
          id="dev-email"
          name="email"
          type="email"
          required
          autoComplete="email"
          placeholder={t.landing.devEmailPlaceholder}
          className="border-line-strong bg-surface placeholder:text-muted min-h-11 min-w-0 flex-1 rounded-md border-2 px-3 text-[0.9375rem]"
        />
        <Button type="submit" variant="outline" disabled={pending}>
          {t.landing.devEmailSend}
        </Button>
      </div>
      <p aria-live="polite" className="mt-2 text-sm font-semibold">
        {state.status === "sent" && <span className="text-credit">{t.landing.devEmailSent}</span>}
        {state.status === "error" && <span className="text-debt">{t.landing.devEmailError}</span>}
      </p>
    </form>
  );
}
