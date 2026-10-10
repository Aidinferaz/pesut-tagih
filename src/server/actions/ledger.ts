"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { MAX_AMOUNT, parseRupiah } from "@/domain/money";
import { PROVIDER_CODES } from "@/domain/providers";
import { itemizedTotal, splitEqual, splitExact, splitItemized, SplitError } from "@/domain/split";
import { defaultLocale, isLocale } from "@/i18n/config";
import { getCurrentUser } from "@/server/auth";
import { supabaseForUser } from "@/server/supabase/server";
import { errorKeyFor, type FormState } from "./state";

const langOf = (formData: FormData) => {
  const raw = String(formData.get("lang") ?? "");
  return isLocale(raw) ? raw : defaultLocale;
};

/** Accepts 45000, "45.000", "45rb", "1,5jt" from forms; the browser never decides the final number. */
const rupiahField = z.union([z.number(), z.string()]).transform((v, ctx) => {
  const n = typeof v === "number" ? v : v.trim() === "" ? 0 : parseRupiah(v);
  if (n === null || !Number.isSafeInteger(n) || n < 0 || n > MAX_AMOUNT) {
    ctx.addIssue({ code: "custom", message: "amount" });
    return z.NEVER;
  }
  return n;
});

const ExpenseInput = z
  .object({
    groupId: z.uuid(),
    title: z.string().trim().min(1).max(80),
    paidBy: z.uuid(),
    occurredOn: z.iso.date().optional(),
    note: z.string().trim().max(280).optional(),
    method: z.enum(["equal", "exact", "itemized"]),
    total: rupiahField.optional(),
    participants: z.array(z.uuid()).max(50).default([]),
    exact: z
      .array(z.object({ userId: z.uuid(), amount: rupiahField }))
      .max(50)
      .default([]),
    items: z
      .array(
        z.object({
          name: z.string().trim().min(1).max(80),
          amount: rupiahField,
          claims: z
            .array(z.object({ userId: z.uuid(), weight: z.number().int().min(1).max(99) }))
            .max(50),
        }),
      )
      .max(100)
      .default([]),
    tax: rupiahField.default(0),
    service: rupiahField.default(0),
    discount: rupiahField.default(0),
  })
  .strict();

export type ExpenseInput = z.input<typeof ExpenseInput>;

/** Recomputes the split on the server from the raw inputs, then stores it in one transaction. */
export async function createExpense(_prev: FormState, formData: FormData): Promise<FormState> {
  if (!(await getCurrentUser())) return { status: "error", error: "notSignedIn" };
  let raw: unknown;
  try {
    raw = JSON.parse(String(formData.get("payload") ?? ""));
  } catch {
    return { status: "error", error: "invalid" };
  }
  const parsed = ExpenseInput.safeParse(raw);
  if (!parsed.success) {
    return {
      status: "error",
      error: "invalid",
      field: String(parsed.error.issues[0]?.path[0] ?? ""),
    };
  }
  const input = parsed.data;

  let total: number;
  let shares: { userId: string; amount: number }[];
  try {
    if (input.method === "itemized") {
      total = itemizedTotal(input);
      shares = splitItemized(input);
    } else {
      total = input.total ?? 0;
      shares =
        input.method === "equal"
          ? splitEqual(total, input.participants)
          : splitExact(total, input.exact);
    }
  } catch (error) {
    if (error instanceof SplitError)
      return { status: "error", error: "invalid", field: error.code };
    throw error;
  }
  if (total <= 0) return { status: "error", error: "invalid", field: "total" };

  const supabase = await supabaseForUser();
  const { error } = await supabase.rpc("create_expense", {
    gid: input.groupId,
    expense_title: input.title,
    expense_total: total,
    payer: input.paidBy,
    method: input.method,
    shares: shares
      .filter((s) => s.amount > 0)
      .map((s) => ({ user_id: s.userId, amount: s.amount })),
    items: input.items.map((i) => ({
      name: i.name,
      amount: i.amount,
      claims: i.claims.map((c) => ({ user_id: c.userId, weight: c.weight })),
    })),
    tax_amount: input.tax,
    service_amount: input.service,
    discount_amount: input.discount,
    on_date: input.occurredOn,
    expense_note: input.note,
  });
  if (error) return { status: "error", error: errorKeyFor(error.code) };

  const lang = langOf(formData);
  revalidatePath(`/${lang}`, "layout");
  redirect(`/${lang}/groups/${input.groupId}?logged=1`);
}

export async function deleteExpense(formData: FormData) {
  const id = z.uuid().safeParse(formData.get("id"));
  const groupId = z.uuid().safeParse(formData.get("groupId"));
  if (!id.success || !groupId.success) return;
  const supabase = await supabaseForUser();
  await supabase.rpc("delete_expense", { eid: id.data });
  revalidatePath(`/${langOf(formData)}`, "layout");
}

const PROOF_TYPES: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

const PaidInput = z.object({
  groupId: z.uuid(),
  to: z.uuid(),
  amount: rupiahField.refine((n) => n > 0),
  provider: z.enum(PROVIDER_CODES).optional(),
  note: z.string().trim().max(280).optional(),
});

/** "I've transferred": records a pending transfer, with an optional photo of the receipt. */
export async function markPaid(_prev: FormState, formData: FormData): Promise<FormState> {
  if (!(await getCurrentUser())) return { status: "error", error: "notSignedIn" };
  const parsed = PaidInput.safeParse({
    groupId: formData.get("groupId"),
    to: formData.get("to"),
    amount: formData.get("amount"),
    provider: formData.get("provider") || undefined,
    note: formData.get("note") || undefined,
  });
  if (!parsed.success) return { status: "error", error: "invalid" };
  const { groupId, to, amount, provider, note } = parsed.data;

  const supabase = await supabaseForUser();
  let proof: string | undefined;
  const file = formData.get("proof");
  if (file instanceof File && file.size > 0) {
    const ext = PROOF_TYPES[file.type];
    if (!ext) return { status: "error", error: "invalid" };
    if (file.size > 5 * 1024 * 1024) return { status: "error", error: "tooLarge" };
    proof = `${groupId}/${crypto.randomUUID()}.${ext}`;
    const upload = await supabase.storage
      .from("proofs")
      .upload(proof, file, { contentType: file.type });
    if (upload.error) return { status: "error", error: "unknown" };
  }

  const { error } = await supabase.rpc("mark_paid", {
    gid: groupId,
    receiver: to,
    paid_amount: amount,
    via: provider,
    proof,
    settlement_note: note,
  });
  if (error) return { status: "error", error: errorKeyFor(error.code) };
  revalidatePath(`/${langOf(formData)}`, "layout");
  return { status: "ok", data: undefined };
}

export async function decideSettlement(formData: FormData) {
  const id = z.uuid().safeParse(formData.get("id"));
  if (!id.success) return;
  const accept = formData.get("decision") === "accept";
  const reason = String(formData.get("reason") ?? "").slice(0, 280) || undefined;
  const supabase = await supabaseForUser();
  await supabase.rpc("decide_settlement", { sid: id.data, accept, reason });
  revalidatePath(`/${langOf(formData)}`, "layout");
}

const ReceivedInput = z.object({
  groupId: z.uuid(),
  from: z.uuid(),
  amount: rupiahField.refine((n) => n > 0),
});

/** The receiver records cash handed over in person. */
export async function recordReceived(_prev: FormState, formData: FormData): Promise<FormState> {
  const parsed = ReceivedInput.safeParse({
    groupId: formData.get("groupId"),
    from: formData.get("from"),
    amount: formData.get("amount"),
  });
  if (!parsed.success) return { status: "error", error: "invalid" };
  const supabase = await supabaseForUser();
  const { error } = await supabase.rpc("record_received", {
    gid: parsed.data.groupId,
    payer: parsed.data.from,
    paid_amount: parsed.data.amount,
  });
  if (error) return { status: "error", error: errorKeyFor(error.code) };
  revalidatePath(`/${langOf(formData)}`, "layout");
  return { status: "ok", data: undefined };
}

const BillInput = z.object({
  groupId: z.uuid(),
  title: z.string().trim().min(1).max(80),
  amount: rupiahField.refine((n) => n > 0),
  paidBy: z.uuid(),
  participants: z.array(z.uuid()).min(1).max(50),
  day: z.coerce.number().int().min(1).max(28),
});

export async function createRecurringBill(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const parsed = BillInput.safeParse({
    groupId: formData.get("groupId"),
    title: formData.get("title"),
    amount: formData.get("amount"),
    paidBy: formData.get("paidBy"),
    participants: formData.getAll("participants"),
    day: formData.get("day"),
  });
  if (!parsed.success) {
    return {
      status: "error",
      error: "invalid",
      field: String(parsed.error.issues[0]?.path[0] ?? ""),
    };
  }
  const supabase = await supabaseForUser();
  const { error } = await supabase.rpc("create_recurring_bill", {
    gid: parsed.data.groupId,
    bill_title: parsed.data.title,
    bill_amount: parsed.data.amount,
    payer: parsed.data.paidBy,
    people: parsed.data.participants,
    day: parsed.data.day,
  });
  if (error) return { status: "error", error: errorKeyFor(error.code) };
  revalidatePath(`/${langOf(formData)}/groups/${parsed.data.groupId}`);
  return { status: "ok", data: undefined };
}

export async function setRecurringBillActive(formData: FormData) {
  const id = z.uuid().safeParse(formData.get("id"));
  if (!id.success) return;
  const supabase = await supabaseForUser();
  await supabase.rpc("set_recurring_bill_active", {
    bid: id.data,
    is_active: formData.get("active") === "true",
  });
  revalidatePath(`/${langOf(formData)}`, "layout");
}
