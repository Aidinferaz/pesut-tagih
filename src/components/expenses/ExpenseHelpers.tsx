"use client";

import { Camera, Sparkles } from "lucide-react";
import { useEffect, useId, useState, useTransition } from "react";
import { FormMessage, inputClass } from "@/components/forms/fields";
import { usePesut } from "@/components/pesut/mood";
import { Button, buttonClass } from "@/components/ui/Button";
import { format } from "@/i18n/format";
import { useI18n } from "@/i18n/provider";
import { shrinkImage } from "@/lib/image";
import { rupiah } from "@/lib/format";
import {
  parseExpenseText,
  scanReceipt,
  type ParsedExpense,
  type ScannedReceipt,
} from "@/server/actions/ai";
import type { ErrorKey, FormState } from "@/server/actions/state";

/**
 * Two ways to let Pesut fill the form: a receipt photo, or a sentence. Both
 * only fill fields; the person still reviews and saves.
 */
export function ExpenseHelpers({
  groupId,
  onReceipt,
  onParsed,
}: {
  groupId: string;
  onReceipt: (receipt: ScannedReceipt) => void;
  onParsed: (parsed: ParsedExpense) => void;
}) {
  const { t, locale } = useI18n();
  const ids = useId();
  const [scan, setScan] = useState<FormState<ScannedReceipt>>({ status: "idle" });
  const [scanning, startScan] = useTransition();
  const [text, setText] = useState("");
  const [parsing, startParsing] = useTransition();
  const [parseResult, setParseResult] = useState<"ok" | ErrorKey | null>(null);

  useEffect(() => {
    usePesut.getState().setMood(scanning || parsing ? "thinking" : "idle");
  }, [scanning, parsing]);

  const pickReceipt = (file: File | undefined) => {
    if (!file) return;
    startScan(async () => {
      const data = new FormData();
      data.set("groupId", groupId);
      data.set("receipt", await shrinkImage(file));
      const result = await scanReceipt({ status: "idle" }, data);
      setScan(result);
      if (result.status === "ok") {
        onReceipt(result.data);
        usePesut.getState().act("jump");
      }
    });
  };

  const fill = () =>
    startParsing(async () => {
      const result = await parseExpenseText(groupId, text, locale);
      if (result.status === "ok") {
        onParsed(result.data);
        setParseResult("ok");
      } else if (result.status === "error") {
        setParseResult(result.error);
      }
    });

  return (
    <section
      aria-labelledby={`${ids}-helpers`}
      className="border-line-strong grid gap-3 rounded-md border-2 border-dashed p-4"
    >
      <h2 id={`${ids}-helpers`} className="display text-xl uppercase">
        {t.expenseForm.helpers}
      </h2>
      <div className="flex flex-wrap items-center gap-3">
        <label
          className={buttonClass(
            "outline",
            scanning ? "pointer-events-none opacity-60" : "cursor-pointer",
          )}
        >
          <Camera className="size-[18px]" aria-hidden />
          {scanning ? t.expenseForm.scanning : t.expenseForm.scan}
          <input
            type="file"
            accept="image/*"
            capture="environment"
            className="sr-only"
            disabled={scanning}
            onChange={(e) => pickReceipt(e.target.files?.[0])}
          />
        </label>
      </div>
      {scan.status === "ok" && (
        <FormMessage tone="ok">
          {format(t.expenseForm.scanned, {
            merchant: scan.data.merchant ? ` ${scan.data.merchant}` : "",
          })}
        </FormMessage>
      )}
      {scan.status === "ok" && scan.data.mismatch !== 0 && (
        <FormMessage tone="error">
          {format(t.expenseForm.mismatch, { amount: rupiah(Math.abs(scan.data.mismatch), locale) })}
        </FormMessage>
      )}
      {scan.status === "error" && <FormMessage tone="error">{t.errors[scan.error]}</FormMessage>}

      <label htmlFor={`${ids}-quick`} className="text-sm font-bold">
        {t.expenseForm.quick}
      </label>
      <div className="flex gap-2">
        <input
          id={`${ids}-quick`}
          value={text}
          onChange={(e) => setText(e.target.value)}
          maxLength={500}
          placeholder={t.expenseForm.quickPlaceholder}
          className={`${inputClass} min-w-0 flex-1`}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              if (text.trim().length >= 3) fill();
            }
          }}
        />
        <Button variant="outline" disabled={parsing || text.trim().length < 3} onClick={fill}>
          <Sparkles className="size-4" aria-hidden />
          {t.expenseForm.quickFill}
        </Button>
      </div>
      {parseResult === "ok" && <FormMessage tone="ok">{t.expenseForm.quickFilled}</FormMessage>}
      {parseResult && parseResult !== "ok" && (
        <FormMessage tone="error">{t.errors[parseResult]}</FormMessage>
      )}
    </section>
  );
}
