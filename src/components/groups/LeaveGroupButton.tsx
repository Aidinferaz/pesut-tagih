"use client";

import { LogOut } from "lucide-react";
import { useActionState } from "react";
import { FormMessage } from "@/components/forms/fields";
import { Button } from "@/components/ui/Button";
import { useI18n } from "@/i18n/provider";
import { leaveGroup } from "@/server/actions/groups";
import type { FormState } from "@/server/actions/state";

export function LeaveGroupButton({ groupId }: { groupId: string }) {
  const { t, locale } = useI18n();
  const [state, action, pending] = useActionState<FormState, FormData>(leaveGroup, {
    status: "idle",
  });
  return (
    <form
      action={action}
      onSubmit={(e) => {
        if (!window.confirm(t.groups.leaveConfirm)) e.preventDefault();
      }}
      className="grid gap-2"
    >
      <input type="hidden" name="lang" value={locale} />
      <input type="hidden" name="groupId" value={groupId} />
      <div>
        <Button
          type="submit"
          variant="outline"
          disabled={pending}
          className="border-debt text-debt"
        >
          <LogOut className="size-4" aria-hidden />
          {t.groups.leave}
        </Button>
      </div>
      {state.status === "error" && <FormMessage tone="error">{t.errors[state.error]}</FormMessage>}
    </form>
  );
}
