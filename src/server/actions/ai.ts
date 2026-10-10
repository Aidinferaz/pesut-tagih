"use server";

import { generateText, Output } from "ai";
import { z } from "zod";
import { MAX_AMOUNT } from "@/domain/money";
import { isLocale } from "@/i18n/config";
import { aiEnabled, languageModel } from "@/server/ai/model";
import { expenseTextPrompt, RECEIPT_PROMPT } from "@/server/ai/prompts";
import { consumeQuota } from "@/server/ai/quota";
import { getCurrentUser } from "@/server/auth";
import { getGroup } from "@/server/db/groups";
import { supabaseForUser } from "@/server/supabase/server";
import type { FormState } from "./state";

const rupiah = z.number().int().min(0).max(MAX_AMOUNT);

const Receipt = z.object({
  merchant: z.string().max(80).nullable().optional(),
  items: z.array(z.object({ name: z.string().max(80), amount: rupiah })).max(60),
  tax: rupiah,
  service: rupiah,
  discount: rupiah,
  total: rupiah,
  unreadable: z.boolean().optional(),
});

export type ScannedReceipt = z.infer<typeof Receipt> & { receiptPath: string; mismatch: number };

const IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

/** Reads a receipt photo into items, tax, service and discount, and keeps the photo with the expense. */
export async function scanReceipt(
  _prev: FormState<ScannedReceipt>,
  formData: FormData,
): Promise<FormState<ScannedReceipt>> {
  if (!(await getCurrentUser())) return { status: "error", error: "notSignedIn" };
  if (!aiEnabled()) return { status: "error", error: "aiDisabled" };
  const groupId = z.uuid().safeParse(formData.get("groupId"));
  const file = formData.get("receipt");
  if (!groupId.success || !(file instanceof File) || !IMAGE_TYPES.has(file.type)) {
    return { status: "error", error: "invalid" };
  }
  if (file.size > 5 * 1024 * 1024) return { status: "error", error: "tooLarge" };
  if (!(await consumeQuota("scan"))) return { status: "error", error: "quota" };

  const supabase = await supabaseForUser();
  const receiptPath = `${groupId.data}/${crypto.randomUUID()}.${file.type.split("/")[1]}`;
  const upload = await supabase.storage
    .from("receipts")
    .upload(receiptPath, file, { contentType: file.type });
  if (upload.error) return { status: "error", error: "forbidden" };

  try {
    const { output } = await generateText({
      model: languageModel("agent", "receipt"),
      output: Output.object({ schema: Receipt }),
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: RECEIPT_PROMPT },
            {
              type: "image",
              image: new Uint8Array(await file.arrayBuffer()),
              mediaType: file.type,
            },
          ],
        },
      ],
      maxOutputTokens: 1500,
    });
    if (output.unreadable || output.items.length === 0)
      return { status: "error", error: "unreadable" };
    const sum =
      output.items.reduce((s, i) => s + i.amount, 0) +
      output.tax +
      output.service -
      output.discount;
    return { status: "ok", data: { ...output, receiptPath, mismatch: output.total - sum } };
  } catch {
    return { status: "error", error: "unreadable" };
  }
}

const Parsed = z.object({
  title: z.string().max(80),
  total: rupiah,
  paidByName: z.string().nullable(),
  participantNames: z.array(z.string()),
  unreadable: z.boolean().optional(),
});

export type ParsedExpense = {
  title: string;
  total: number;
  paidBy: string | null;
  participants: string[];
};

/** "bakso 120rb, aku yang bayar, bagi sama Budi" → form fields. Uses the cheap model. */
export async function parseExpenseText(
  groupId: string,
  text: string,
  lang: string,
): Promise<FormState<ParsedExpense>> {
  const user = await getCurrentUser();
  if (!user) return { status: "error", error: "notSignedIn" };
  if (!aiEnabled()) return { status: "error", error: "aiDisabled" };
  if (!z.uuid().safeParse(groupId).success || text.trim().length < 3 || text.length > 500) {
    return { status: "error", error: "invalid" };
  }
  const group = await getGroup(groupId);
  if (!group) return { status: "error", error: "notFound" };
  if (!(await consumeQuota("chat"))) return { status: "error", error: "quota" };

  try {
    const { output } = await generateText({
      model: languageModel("fast", "expense-text"),
      output: Output.object({ schema: Parsed }),
      prompt: expenseTextPrompt(
        text,
        group.members.map((m) => m.name),
        isLocale(lang) ? lang : "id",
      ),
      maxOutputTokens: 300,
    });
    if (output.unreadable) return { status: "error", error: "unreadable" };
    const idOf = (name: string | null) =>
      name
        ? (group.members.find((m) => m.name.toLowerCase() === name.toLowerCase())?.id ?? null)
        : null;
    return {
      status: "ok",
      data: {
        title: output.title,
        total: output.total,
        paidBy: idOf(output.paidByName) ?? user.id,
        participants: output.participantNames.map(idOf).filter((id): id is string => id !== null),
      },
    };
  } catch {
    return { status: "error", error: "unreadable" };
  }
}
