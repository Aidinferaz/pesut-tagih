"use client";

import { Check, Copy, Send } from "lucide-react";
import { useActionState, useState, useTransition } from "react";
import { Field, FormMessage, TextInput } from "@/components/forms/fields";
import { Button } from "@/components/ui/Button";
import { Panel, PanelTitle } from "@/components/ui/Panel";
import { format } from "@/i18n/format";
import { useI18n } from "@/i18n/provider";
import {
  createTelegramGroupLink,
  unlinkTelegramGroup,
  updateGroupSettings,
} from "@/server/actions/notifications";
import type { FormState } from "@/server/actions/state";

/** Admin-only switches for how a group settles and where its recap goes. */
export function GroupSettingsPanel({
  groupId,
  simplify,
  autoConfirmDays,
  recapAmounts,
  telegramLinked,
  bot,
}: {
  groupId: string;
  simplify: boolean;
  autoConfirmDays: number;
  recapAmounts: boolean;
  telegramLinked: boolean;
  bot: string | null;
}) {
  const { t, locale } = useI18n();
  const [state, action, pending] = useActionState<FormState, FormData>(updateGroupSettings, {
    status: "idle",
  });
  const [code, setCode] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [busy, startBusy] = useTransition();
  const command = code ? `/hubungkan ${code}` : "";

  return (
    <Panel aria-labelledby={`settings-${groupId}`}>
      <PanelTitle id={`settings-${groupId}`}>{t.groupSettings.title}</PanelTitle>
      <form action={action} className="mt-4 grid gap-4">
        <input type="hidden" name="lang" value={locale} />
        <input type="hidden" name="groupId" value={groupId} />
        <label className="flex items-start gap-3 font-semibold">
          <input
            type="checkbox"
            name="simplify"
            defaultChecked={simplify}
            className="mt-0.5 size-5 accent-[var(--plate)]"
          />
          {t.groupSettings.simplify}
        </label>
        {bot && (
          <label className="flex items-start gap-3 font-semibold">
            <input
              type="checkbox"
              name="recapAmounts"
              defaultChecked={recapAmounts}
              className="mt-0.5 size-5 accent-[var(--plate)]"
            />
            {t.groupSettings.recapAmounts}
          </label>
        )}
        <Field id={`auto-${groupId}`} label={t.groupSettings.autoConfirm}>
          <TextInput
            id={`auto-${groupId}`}
            name="autoConfirmDays"
            type="number"
            min={0}
            max={30}
            defaultValue={autoConfirmDays}
            className="max-w-28"
          />
        </Field>
        <div className="flex items-center gap-3">
          <Button type="submit" variant="outline" disabled={pending}>
            {t.groupSettings.save}
          </Button>
          {state.status === "ok" && <FormMessage tone="ok">{t.groupSettings.saved}</FormMessage>}
          {state.status === "error" && (
            <FormMessage tone="error">{t.errors[state.error]}</FormMessage>
          )}
        </div>
      </form>

      {bot && (
        <section className="border-line mt-5 grid gap-3 border-t-2 pt-4">
          <h3 className="font-bold">{t.groupSettings.telegram}</h3>
          {telegramLinked ? (
            <form action={unlinkTelegramGroup} className="flex flex-wrap items-center gap-3">
              <input type="hidden" name="lang" value={locale} />
              <input type="hidden" name="groupId" value={groupId} />
              <span className="text-credit font-semibold">{t.groupSettings.telegramLinked}</span>
              <Button type="submit" variant="ghost" className="text-sm">
                {t.groupSettings.telegramUnlink}
              </Button>
            </form>
          ) : code ? (
            <div className="grid gap-2">
              <p className="text-ink-soft text-sm">
                {format(t.groupSettings.telegramSteps, { bot })}
              </p>
              <div className="flex gap-2">
                <input
                  readOnly
                  value={command}
                  aria-label={t.groupSettings.telegram}
                  className="border-line-strong bg-surface-sunk min-h-11 flex-1 rounded-md border-2 px-3 font-mono text-sm"
                />
                <Button
                  variant="outline"
                  onClick={async () => {
                    await navigator.clipboard.writeText(command);
                    setCopied(true);
                  }}
                >
                  {copied ? (
                    <Check className="size-4" strokeWidth={3} aria-hidden />
                  ) : (
                    <Copy className="size-4" aria-hidden />
                  )}
                </Button>
              </div>
            </div>
          ) : (
            <div className="grid gap-1">
              <p className="text-muted text-sm">{t.groupSettings.telegramNone}</p>
              <div>
                <Button
                  variant="outline"
                  disabled={busy}
                  onClick={() =>
                    startBusy(async () => {
                      const result = await createTelegramGroupLink(groupId);
                      if (result.status === "ok") setCode(result.data.code);
                    })
                  }
                >
                  <Send className="size-4" aria-hidden />
                  {t.groupSettings.telegramCreate}
                </Button>
              </div>
            </div>
          )}
        </section>
      )}
    </Panel>
  );
}
