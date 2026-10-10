"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { PROVIDER_CODES } from "@/domain/providers";
import { defaultLocale, isLocale } from "@/i18n/config";
import { getCurrentUser } from "@/server/auth";
import { supabaseForUser } from "@/server/supabase/server";
import { errorKeyFor, type FormState } from "./state";

const langOf = (formData: FormData) => {
  const raw = String(formData.get("lang") ?? "");
  return isLocale(raw) ? raw : defaultLocale;
};

const ProfileInput = z.object({
  name: z.string().trim().min(1).max(40),
  locale: z.enum(["id", "en"]),
});

export async function updateProfile(_prev: FormState, formData: FormData): Promise<FormState> {
  const user = await getCurrentUser();
  if (!user) return { status: "error", error: "notSignedIn" };
  const parsed = ProfileInput.safeParse({
    name: formData.get("name"),
    locale: formData.get("locale"),
  });
  if (!parsed.success) return { status: "error", error: "invalid", field: "name" };
  const supabase = await supabaseForUser();
  const { error } = await supabase
    .from("profiles")
    .update({ display_name: parsed.data.name, locale: parsed.data.locale })
    .eq("id", user.id);
  if (error) return { status: "error", error: errorKeyFor(error.code) };
  revalidatePath(`/${langOf(formData)}`, "layout");
  return { status: "ok", data: undefined };
}

const MethodInput = z.object({
  provider: z.enum(PROVIDER_CODES),
  // People paste numbers with spaces or dashes; e-wallets often start with +62.
  accountNumber: z
    .string()
    .transform((v) => v.replace(/[\s-]/g, "").replace(/^\+62/, "0"))
    .pipe(z.string().regex(/^[0-9]{4,24}$/)),
  accountName: z.string().trim().min(1).max(60),
});

export async function addPaymentMethod(_prev: FormState, formData: FormData): Promise<FormState> {
  const user = await getCurrentUser();
  if (!user) return { status: "error", error: "notSignedIn" };
  const parsed = MethodInput.safeParse({
    provider: formData.get("provider"),
    accountNumber: formData.get("accountNumber"),
    accountName: formData.get("accountName"),
  });
  if (!parsed.success) {
    return {
      status: "error",
      error: "invalid",
      field: String(parsed.error.issues[0]?.path[0] ?? ""),
    };
  }
  const supabase = await supabaseForUser();
  const { count } = await supabase
    .from("payment_methods")
    .select("id", { count: "exact", head: true })
    .eq("user_id", user.id);
  const { error } = await supabase.from("payment_methods").insert({
    user_id: user.id,
    provider: parsed.data.provider,
    account_number: parsed.data.accountNumber,
    account_name: parsed.data.accountName,
    priority: count ?? 0,
  });
  if (error) return { status: "error", error: errorKeyFor(error.code) };
  revalidatePath(`/${langOf(formData)}/settings`);
  return { status: "ok", data: undefined };
}

export async function removePaymentMethod(formData: FormData) {
  const user = await getCurrentUser();
  const id = z.uuid().safeParse(formData.get("id"));
  if (!user || !id.success) return;
  const supabase = await supabaseForUser();
  await supabase.from("payment_methods").delete().eq("id", id.data).eq("user_id", user.id);
  revalidatePath(`/${langOf(formData)}/settings`);
}

/** Moves a method to the top of the list: the one Pesut suggests first. */
export async function makePrimaryMethod(formData: FormData) {
  const user = await getCurrentUser();
  const id = z.uuid().safeParse(formData.get("id"));
  if (!user || !id.success) return;
  const supabase = await supabaseForUser();
  const { data } = await supabase
    .from("payment_methods")
    .select("id")
    .eq("user_id", user.id)
    .order("priority")
    .order("created_at");
  const ordered = [id.data, ...(data ?? []).map((m) => m.id).filter((m) => m !== id.data)];
  await Promise.all(
    ordered.map((methodId, priority) =>
      supabase
        .from("payment_methods")
        .update({ priority })
        .eq("id", methodId)
        .eq("user_id", user.id),
    ),
  );
  revalidatePath(`/${langOf(formData)}/settings`);
}

const QRIS_TYPES = new Set(["image/png", "image/jpeg", "image/webp"]);

export async function uploadQris(_prev: FormState, formData: FormData): Promise<FormState> {
  const user = await getCurrentUser();
  if (!user) return { status: "error", error: "notSignedIn" };
  const id = z.uuid().safeParse(formData.get("id"));
  const file = formData.get("qris");
  if (!id.success || !(file instanceof File) || !QRIS_TYPES.has(file.type)) {
    return { status: "error", error: "invalid" };
  }
  if (file.size > 2 * 1024 * 1024) return { status: "error", error: "tooLarge" };

  const supabase = await supabaseForUser();
  const path = `${user.id}/${id.data}`;
  const upload = await supabase.storage
    .from("qris")
    .upload(path, file, { upsert: true, contentType: file.type });
  if (upload.error) return { status: "error", error: "unknown" };
  const { error } = await supabase
    .from("payment_methods")
    .update({ qris_path: path })
    .eq("id", id.data)
    .eq("user_id", user.id);
  if (error) return { status: "error", error: errorKeyFor(error.code) };
  revalidatePath(`/${langOf(formData)}/settings`);
  return { status: "ok", data: undefined };
}
