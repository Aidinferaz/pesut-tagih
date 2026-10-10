"use client";

import { Check, Copy, Link2, Share2 } from "lucide-react";
import { useActionState, useState } from "react";
import { FormMessage } from "@/components/forms/fields";
import { Button, buttonClass } from "@/components/ui/Button";
import { Panel, PanelTitle } from "@/components/ui/Panel";
import { format } from "@/i18n/format";
import { useI18n } from "@/i18n/provider";
import { createInviteLink } from "@/server/actions/groups";
import type { FormState } from "@/server/actions/state";

export function InvitePanel({ groupId, groupName }: { groupId: string; groupName: string }) {
  const { t, locale } = useI18n();
  const [state, action, pending] = useActionState<FormState<{ url: string }>, FormData>(
    createInviteLink,
    {
      status: "idle",
    },
  );
  const [copied, setCopied] = useState(false);
  const url = state.status === "ok" ? state.data.url : null;

  const copy = async () => {
    if (!url) return;
    await navigator.clipboard.writeText(url);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Panel aria-labelledby="invite-title">
      <PanelTitle id="invite-title">{t.groups.inviteTitle}</PanelTitle>
      <p className="text-ink-soft mt-2">{t.groups.inviteBody}</p>
      {url ? (
        <div className="mt-4 grid gap-3">
          <input
            readOnly
            value={url}
            aria-label={t.groups.inviteTitle}
            onFocus={(e) => e.currentTarget.select()}
            className="border-line-strong bg-surface-sunk min-h-11 w-full rounded-md border-2 px-3 font-mono text-sm"
          />
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={copy}>
              {copied ? (
                <Check className="size-4" strokeWidth={3} aria-hidden />
              ) : (
                <Copy className="size-4" aria-hidden />
              )}
              {copied ? t.groups.inviteCopied : t.groups.inviteCopy}
            </Button>
            <a
              className={buttonClass("outline")}
              href={`https://wa.me/?text=${encodeURIComponent(format(t.groups.inviteMessage, { group: groupName, url }))}`}
              target="_blank"
              rel="noopener noreferrer"
            >
              <Share2 className="size-4" aria-hidden />
              {t.groups.inviteShareWa}
            </a>
          </div>
        </div>
      ) : (
        <form action={action} className="mt-4">
          <input type="hidden" name="lang" value={locale} />
          <input type="hidden" name="groupId" value={groupId} />
          <Button type="submit" disabled={pending}>
            <Link2 className="size-4" aria-hidden />
            {t.groups.inviteCreate}
          </Button>
        </form>
      )}
      {state.status === "error" && (
        <div className="mt-3">
          <FormMessage tone="error">{t.errors[state.error]}</FormMessage>
        </div>
      )}
    </Panel>
  );
}
