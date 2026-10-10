"use client";

import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, type InferUITools, type UIDataTypes, type UIMessage } from "ai";
import { ArrowUp, Check, Copy, RotateCcw, Send, Square } from "lucide-react";
import { useActionState, useEffect, useRef, useState } from "react";
import { FormMessage } from "@/components/forms/fields";
import { PesutStage } from "@/components/pesut/PesutStage";
import { usePesut } from "@/components/pesut/mood";
import { Button, buttonClass } from "@/components/ui/Button";
import { format } from "@/i18n/format";
import { useI18n } from "@/i18n/provider";
import { rupiah } from "@/lib/format";
import { createExpense } from "@/server/actions/ledger";
import type { FormState } from "@/server/actions/state";
import type { PesutTools } from "@/server/ai/tools";

type PesutMessage = UIMessage<unknown, UIDataTypes, InferUITools<PesutTools>>;
type Draft = Extract<
  NonNullable<Extract<PesutMessage["parts"][number], { type: "tool-propose_expense" }>["output"]>,
  { ok: true }
>["draft"];

/**
 * Chatting with Pesut. Answers stream in; tool results that need a decision
 * (a draft expense, a reminder to send) render as cards with real buttons.
 */
export function PesutChat({ enabled }: { enabled: boolean }) {
  const { t, locale } = useI18n();
  const [input, setInput] = useState("");
  const list = useRef<HTMLOListElement>(null);
  const { messages, sendMessage, status, stop, setMessages, error } = useChat<PesutMessage>({
    transport: new DefaultChatTransport({ api: "/api/agent", body: { locale } }),
  });
  const busy = status === "submitted" || status === "streaming";

  // Pesut thinks while the answer is on its way.
  useEffect(() => {
    usePesut.getState().setMood(busy ? "thinking" : "idle");
    if (status === "ready" && messages.length > 0) usePesut.getState().act("poke");
  }, [busy, status, messages.length]);

  useEffect(() => {
    list.current?.lastElementChild?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages]);

  const send = (text: string) => {
    if (!text.trim() || busy) return;
    sendMessage({ text: text.trim() });
    setInput("");
  };

  const failure = error?.message.includes("quota")
    ? t.errors.quota
    : error?.message.includes("aiDisabled")
      ? t.errors.aiDisabled
      : error
        ? t.chat.failed
        : null;

  return (
    <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_22rem] lg:gap-7">
      <section
        aria-label={t.chat.title}
        className="border-line-strong bg-surface flex min-h-[32rem] flex-col rounded-[10px] border-2"
      >
        <ol
          ref={list}
          aria-live="polite"
          className="flex flex-1 flex-col gap-4 overflow-y-auto p-4 sm:p-6"
        >
          <li className="bg-surface-sunk max-w-[44rem] rounded-[10px] px-4 py-3">{t.chat.intro}</li>
          {messages.map((message) => (
            <li key={message.id} className={message.role === "user" ? "self-end" : "max-w-[44rem]"}>
              {message.parts.map((part, i) => {
                const key = `${message.id}-${i}`;
                switch (part.type) {
                  case "text":
                    return (
                      <p
                        key={key}
                        className={`whitespace-pre-wrap ${message.role === "user" ? "bg-plate text-plate-ink rounded-[10px] px-4 py-3" : "px-1"}`}
                      >
                        {part.text}
                      </p>
                    );
                  case "tool-propose_expense":
                    return part.state === "output-available" && part.output.ok ? (
                      <DraftCard key={key} draft={part.output.draft} />
                    ) : null;
                  case "tool-draft_reminder":
                    return part.state === "output-available" && part.output.ok ? (
                      <ReminderCard
                        key={key}
                        to={part.output.to}
                        message={part.output.message}
                        waUrl={part.output.waUrl}
                      />
                    ) : null;
                  case "tool-get_my_overview":
                  case "tool-get_group":
                    return part.state !== "output-available" ? (
                      <p key={key} className="text-muted px-1 text-sm font-semibold">
                        {t.chat.checking}
                      </p>
                    ) : null;
                  default:
                    return null;
                }
              })}
            </li>
          ))}
          {status === "submitted" && (
            <li className="text-muted px-1 text-sm font-semibold">{t.chat.checking}</li>
          )}
        </ol>

        {failure && (
          <div className="px-4 pb-2 sm:px-6">
            <FormMessage tone="error">{failure}</FormMessage>
          </div>
        )}

        {messages.length === 0 && enabled && (
          <div className="flex flex-wrap gap-2 px-4 pb-3 sm:px-6">
            {t.chat.suggestions.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => send(s)}
                className="border-line hover:border-line-strong min-h-10 rounded-md border-2 px-3.5 text-left text-sm font-semibold"
              >
                {s}
              </button>
            ))}
          </div>
        )}

        <form
          className="border-line flex items-end gap-2 border-t-2 p-3 sm:p-4"
          onSubmit={(e) => {
            e.preventDefault();
            send(input);
          }}
        >
          <label htmlFor="chat-input" className="sr-only">
            {t.chat.placeholder}
          </label>
          <textarea
            id="chat-input"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                send(input);
              }
            }}
            rows={1}
            maxLength={1000}
            disabled={!enabled}
            placeholder={enabled ? t.chat.placeholder : t.errors.aiDisabled}
            className="border-line-strong bg-surface placeholder:text-muted [field-sizing:content] max-h-40 min-h-11 flex-1 resize-none rounded-md border-2 px-3 py-2.5 text-[0.9375rem]"
          />
          {busy ? (
            <Button variant="outline" onClick={() => stop()} aria-label={t.chat.stop}>
              <Square className="size-4" aria-hidden />
            </Button>
          ) : (
            <Button type="submit" disabled={!enabled || !input.trim()} aria-label={t.chat.send}>
              <ArrowUp className="size-5" strokeWidth={2.75} aria-hidden />
            </Button>
          )}
        </form>
      </section>

      <aside className="grid content-start gap-4">
        <div className="border-line-strong bg-surface relative isolate min-h-[16rem] overflow-hidden rounded-[10px] border-2 lg:min-h-[20rem]">
          <PesutStage label={t.pesut.sceneLabel} className="absolute inset-0" />
        </div>
        <p className="text-ink-soft text-sm">{t.chat.privacy}</p>
        {messages.length > 0 && (
          <div>
            <Button variant="ghost" onClick={() => setMessages([])} disabled={busy}>
              <RotateCcw className="size-4" aria-hidden />
              {t.chat.restart}
            </Button>
          </div>
        )}
      </aside>
    </div>
  );
}

function DraftCard({ draft }: { draft: Draft }) {
  const { t, locale } = useI18n();
  const [state, action, pending] = useActionState<FormState, FormData>(createExpense, {
    status: "idle",
  });
  useEffect(() => {
    if (state.status === "ok") usePesut.getState().act("celebrate");
  }, [state]);
  const payload = {
    groupId: draft.groupId,
    title: draft.title,
    paidBy: draft.paidBy.id,
    method: "equal",
    total: draft.total,
    participants: draft.participants.map((p) => p.id),
  };
  return (
    <form
      action={action}
      className="border-line-strong mt-2 grid gap-3 rounded-[10px] border-2 p-4"
    >
      <input type="hidden" name="lang" value={locale} />
      <input type="hidden" name="stay" value="1" />
      <input type="hidden" name="payload" value={JSON.stringify(payload)} />
      <p className="text-muted text-sm font-bold">
        {format(t.chat.draftTitle, { group: draft.groupName })}
      </p>
      <p className="flex flex-wrap items-baseline justify-between gap-2">
        <span className="font-bold">{draft.title}</span>
        <span className="figure text-2xl">{rupiah(draft.total, locale)}</span>
      </p>
      <p className="text-ink-soft text-sm">
        {format(t.chat.draftPaidBy, { name: draft.paidBy.name })}
      </p>
      <ul className="grid gap-x-6 text-sm sm:grid-cols-2">
        {draft.shares.map((s) => (
          <li key={s.name} className="border-line flex justify-between gap-3 border-b py-1">
            <span>{s.name}</span>
            <span className="tabular-nums">{rupiah(s.amount, locale)}</span>
          </li>
        ))}
      </ul>
      {state.status === "ok" ? (
        <FormMessage tone="ok">{format(t.chat.saved, { group: draft.groupName })}</FormMessage>
      ) : (
        <div>
          <Button type="submit" disabled={pending}>
            <Check className="size-4" strokeWidth={3} aria-hidden />
            {t.chat.save}
          </Button>
        </div>
      )}
      {state.status === "error" && <FormMessage tone="error">{t.errors[state.error]}</FormMessage>}
    </form>
  );
}

function ReminderCard({ to, message, waUrl }: { to: string; message: string; waUrl: string }) {
  const { t } = useI18n();
  const [copied, setCopied] = useState(false);
  return (
    <div className="border-line-strong mt-2 grid gap-3 rounded-[10px] border-2 p-4">
      <p className="text-muted text-sm font-bold">{format(t.chat.reminderTitle, { name: to })}</p>
      <p className="whitespace-pre-wrap">{message}</p>
      <div className="flex flex-wrap gap-2">
        <a
          href={waUrl}
          target="_blank"
          rel="noopener noreferrer"
          onClick={() => usePesut.getState().act("squirt")}
          className={buttonClass("primary")}
        >
          <Send className="size-4" aria-hidden />
          {t.chat.sendWa}
        </a>
        <Button
          variant="outline"
          onClick={async () => {
            await navigator.clipboard.writeText(message);
            setCopied(true);
          }}
        >
          {copied ? (
            <Check className="size-4" strokeWidth={3} aria-hidden />
          ) : (
            <Copy className="size-4" aria-hidden />
          )}
          {copied ? t.chat.copied : t.chat.copy}
        </Button>
      </div>
    </div>
  );
}
