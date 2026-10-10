import "server-only";
import { supabaseForUser } from "@/server/supabase/server";

export type Hull = "band" | "action" | "surface" | "debt";

export type GroupSummary = {
  id: string;
  name: string;
  hull: Hull;
  memberCount: number;
  role: "admin" | "member";
};

export type Member = {
  id: string;
  name: string;
  avatarUrl: string | null;
  role: "admin" | "member";
};

/** Groups the signed-in person belongs to, oldest membership first. */
export async function listMyGroups(userId: string): Promise<GroupSummary[]> {
  const supabase = await supabaseForUser();
  const { data, error } = await supabase
    .from("group_members")
    .select("role, joined_at, groups!inner (id, name, hull, group_members (count))")
    .eq("user_id", userId)
    .order("joined_at");
  if (error) throw error;
  return data.map((row) => ({
    id: row.groups.id,
    name: row.groups.name,
    hull: row.groups.hull as Hull,
    memberCount: row.groups.group_members[0]?.count ?? 0,
    role: row.role as GroupSummary["role"],
  }));
}

export type GroupDetail = {
  id: string;
  name: string;
  hull: Hull;
  simplifyDebts: boolean;
  autoConfirmDays: number;
  recapAmounts: boolean;
  telegramLinked: boolean;
  members: Member[];
};

/** A group and its members, or null if it doesn't exist or you're not in it. */
export async function getGroup(groupId: string): Promise<GroupDetail | null> {
  const supabase = await supabaseForUser();
  const { data, error } = await supabase
    .from("groups")
    .select(
      "id, name, hull, simplify_debts, auto_confirm_days, telegram_recap_amounts, telegram_chat_id, group_members (role, joined_at, profiles (id, display_name, avatar_url))",
    )
    .eq("id", groupId)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  return {
    id: data.id,
    name: data.name,
    hull: data.hull as Hull,
    simplifyDebts: data.simplify_debts,
    autoConfirmDays: data.auto_confirm_days,
    recapAmounts: data.telegram_recap_amounts,
    telegramLinked: data.telegram_chat_id !== null,
    members: data.group_members
      .toSorted((a, b) => a.joined_at.localeCompare(b.joined_at))
      .map((m) => ({
        id: m.profiles.id,
        name: m.profiles.display_name,
        avatarUrl: m.profiles.avatar_url,
        role: m.role as Member["role"],
      })),
  };
}

export async function peekInvite(
  token: string,
): Promise<{ groupName: string; memberCount: number } | null> {
  const supabase = await supabaseForUser();
  const { data, error } = await supabase.rpc("peek_invite", { token });
  if (error || !data?.[0]) return null;
  return { groupName: data[0].group_name, memberCount: data[0].member_count };
}
