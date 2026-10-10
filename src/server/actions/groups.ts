"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { defaultLocale, isLocale } from "@/i18n/config";
import { getCurrentUser } from "@/server/auth";
import { env } from "@/server/env";
import { supabaseForUser } from "@/server/supabase/server";
import { errorKeyFor, type FormState } from "./state";

const langOf = (formData: FormData) => {
  const raw = String(formData.get("lang") ?? "");
  return isLocale(raw) ? raw : defaultLocale;
};

const NewGroup = z.object({
  name: z.string().trim().min(1).max(40),
  hull: z.enum(["band", "action", "surface", "debt"]),
});

export async function createGroup(_prev: FormState, formData: FormData): Promise<FormState> {
  if (!(await getCurrentUser())) return { status: "error", error: "notSignedIn" };
  const parsed = NewGroup.safeParse({ name: formData.get("name"), hull: formData.get("hull") });
  if (!parsed.success) return { status: "error", error: "invalid", field: "name" };

  const supabase = await supabaseForUser();
  const { data, error } = await supabase.rpc("create_group", {
    group_name: parsed.data.name,
    group_hull: parsed.data.hull,
  });
  if (error || !data) return { status: "error", error: errorKeyFor(error?.code) };
  redirect(`/${langOf(formData)}/groups/${data}`);
}

export async function createInviteLink(
  _prev: FormState<{ url: string }>,
  formData: FormData,
): Promise<FormState<{ url: string }>> {
  const groupId = z.uuid().safeParse(formData.get("groupId"));
  if (!groupId.success) return { status: "error", error: "invalid" };
  const supabase = await supabaseForUser();
  const { data, error } = await supabase.rpc("create_invite", { gid: groupId.data });
  if (error || !data) return { status: "error", error: errorKeyFor(error?.code) };
  return {
    status: "ok",
    data: { url: `${env.NEXT_PUBLIC_SITE_URL}/${langOf(formData)}/join/${data}` },
  };
}

export async function acceptInvite(formData: FormData) {
  const lang = langOf(formData);
  const token = String(formData.get("token") ?? "");
  const supabase = await supabaseForUser();
  const { data, error } = await supabase.rpc("accept_invite", { token });
  if (error || !data) redirect(`/${lang}/join/${encodeURIComponent(token)}?error=1`);
  revalidatePath(`/${lang}`, "layout");
  redirect(`/${lang}/groups/${data}`);
}

export async function leaveGroup(_prev: FormState, formData: FormData): Promise<FormState> {
  const user = await getCurrentUser();
  if (!user) return { status: "error", error: "notSignedIn" };
  const groupId = z.uuid().safeParse(formData.get("groupId"));
  if (!groupId.success) return { status: "error", error: "invalid" };
  const supabase = await supabaseForUser();
  const { error } = await supabase
    .from("group_members")
    .delete()
    .eq("group_id", groupId.data)
    .eq("user_id", user.id);
  if (error) return { status: "error", error: errorKeyFor(error.code) };
  redirect(`/${langOf(formData)}/home`);
}
