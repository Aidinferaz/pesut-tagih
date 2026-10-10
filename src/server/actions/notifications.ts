"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { defaultLocale, isLocale } from "@/i18n/config";
import { getCurrentUser } from "@/server/auth";
import { env } from "@/server/env";
import { supabaseAdmin } from "@/server/supabase/admin";
import { supabaseForUser } from "@/server/supabase/server";
import { errorKeyFor, type FormState } from "./state";

const langOf = (formData: FormData) => {
  const raw = String(formData.get("lang") ?? "");
  return isLocale(raw) ? raw : defaultLocale;
};

/** Opens t.me/<bot>?start=<one-time token>; the bot links the chat when it receives it. */
export async function createTelegramLink(): Promise<FormState<{ url: string }>> {
  if (!env.TELEGRAM_BOT_USERNAME) return { status: "error", error: "forbidden" };
  const supabase = await supabaseForUser();
  const { data, error } = await supabase.rpc("create_telegram_link");
  if (error || !data) return { status: "error", error: errorKeyFor(error?.code) };
  return { status: "ok", data: { url: `https://t.me/${env.TELEGRAM_BOT_USERNAME}?start=${data}` } };
}

export async function unlinkTelegram(formData: FormData) {
  const user = await getCurrentUser();
  if (!user) return;
  // Only the bot may set this column; clearing your own is done here on your behalf.
  await supabaseAdmin()
    .from("contact_channels")
    .update({ telegram_chat_id: null })
    .eq("user_id", user.id);
  revalidatePath(`/${langOf(formData)}/settings`);
}

const Channels = z.object({
  waNumber: z
    .string()
    .transform((v) =>
      v
        .replace(/[\s()-]/g, "")
        .replace(/^\+/, "")
        .replace(/^0/, "62"),
    )
    .pipe(z.union([z.literal(""), z.string().regex(/^62[0-9]{8,13}$/)])),
  telegram: z.boolean(),
  push: z.boolean(),
  whatsapp: z.boolean(),
});

export async function updateChannels(_prev: FormState, formData: FormData): Promise<FormState> {
  const user = await getCurrentUser();
  if (!user) return { status: "error", error: "notSignedIn" };
  const parsed = Channels.safeParse({
    waNumber: String(formData.get("waNumber") ?? ""),
    telegram: formData.get("telegram") === "on",
    push: formData.get("push") === "on",
    whatsapp: formData.get("whatsapp") === "on",
  });
  if (!parsed.success) return { status: "error", error: "invalid", field: "waNumber" };
  const supabase = await supabaseForUser();
  const { error } = await supabase
    .from("contact_channels")
    .update({
      wa_number: parsed.data.waNumber || null,
      notify_telegram: parsed.data.telegram,
      notify_push: parsed.data.push,
      notify_whatsapp: parsed.data.whatsapp,
      updated_at: new Date().toISOString(),
    })
    .eq("user_id", user.id);
  if (error) return { status: "error", error: errorKeyFor(error.code) };
  revalidatePath(`/${langOf(formData)}/settings`);
  return { status: "ok", data: undefined };
}

const Subscription = z.object({
  endpoint: z.url().startsWith("https://"),
  keys: z.object({ p256dh: z.string().min(10).max(200), auth: z.string().min(10).max(100) }),
});

export async function savePushSubscription(raw: unknown): Promise<boolean> {
  const user = await getCurrentUser();
  const sub = Subscription.safeParse(raw);
  if (!user || !sub.success) return false;
  const supabase = await supabaseForUser();
  await supabase.from("push_subscriptions").delete().eq("endpoint", sub.data.endpoint);
  const { error } = await supabase.from("push_subscriptions").insert({
    user_id: user.id,
    endpoint: sub.data.endpoint,
    p256dh: sub.data.keys.p256dh,
    auth: sub.data.keys.auth,
  });
  return !error;
}

export async function removePushSubscription(endpoint: string): Promise<void> {
  const supabase = await supabaseForUser();
  await supabase.from("push_subscriptions").delete().eq("endpoint", endpoint);
}

export async function createTelegramGroupLink(
  groupId: string,
): Promise<FormState<{ code: string }>> {
  if (!z.uuid().safeParse(groupId).success) return { status: "error", error: "invalid" };
  const supabase = await supabaseForUser();
  const { data, error } = await supabase.rpc("create_telegram_group_link", { gid: groupId });
  if (error || !data) return { status: "error", error: errorKeyFor(error?.code) };
  return { status: "ok", data: { code: data } };
}

export async function unlinkTelegramGroup(formData: FormData) {
  const groupId = z.uuid().safeParse(formData.get("groupId"));
  if (!groupId.success) return;
  const supabase = await supabaseForUser();
  await supabase.rpc("unlink_telegram_group", { gid: groupId.data });
  revalidatePath(`/${langOf(formData)}/groups/${groupId.data}`);
}

const GroupSettings = z.object({
  groupId: z.uuid(),
  simplify: z.boolean(),
  recapAmounts: z.boolean(),
  autoConfirmDays: z.coerce.number().int().min(0).max(30),
});

export async function updateGroupSettings(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const parsed = GroupSettings.safeParse({
    groupId: formData.get("groupId"),
    simplify: formData.get("simplify") === "on",
    recapAmounts: formData.get("recapAmounts") === "on",
    autoConfirmDays: formData.get("autoConfirmDays"),
  });
  if (!parsed.success) return { status: "error", error: "invalid" };
  const supabase = await supabaseForUser();
  const { data, error } = await supabase
    .from("groups")
    .update({
      simplify_debts: parsed.data.simplify,
      telegram_recap_amounts: parsed.data.recapAmounts,
      auto_confirm_days: parsed.data.autoConfirmDays,
    })
    .eq("id", parsed.data.groupId)
    .select("id");
  if (error) return { status: "error", error: errorKeyFor(error.code) };
  if (!data?.length) return { status: "error", error: "forbidden" };
  revalidatePath(`/${langOf(formData)}`, "layout");
  return { status: "ok", data: undefined };
}
