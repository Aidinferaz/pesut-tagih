import "server-only";
import { supabaseForUser } from "@/server/supabase/server";

export type ActivityEntry = {
  id: number;
  groupId: string;
  groupName: string;
  actor: string | null;
  action: string;
  details: Record<string, unknown>;
  createdAt: string;
};

/** The latest entries across every group you're in; RLS keeps out everyone else's. */
export async function listActivity(
  limit = 100,
): Promise<{ entries: ActivityEntry[]; names: Record<string, string> }> {
  const supabase = await supabaseForUser();
  const { data, error } = await supabase
    .from("activity_log")
    .select("id, group_id, actor, action, details, created_at, groups (name)")
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw error;

  // Names of everyone mentioned, as far as RLS lets you see them (people who left show as unknown).
  const ids = new Set<string>();
  for (const row of data) {
    if (row.actor) ids.add(row.actor);
    const d = row.details as Record<string, unknown>;
    for (const key of ["from", "to", "paid_by"])
      if (typeof d[key] === "string") ids.add(d[key] as string);
  }
  const { data: people } = ids.size
    ? await supabase
        .from("profiles")
        .select("id, display_name")
        .in("id", [...ids])
    : { data: [] };

  return {
    entries: data.map((row) => ({
      id: row.id,
      groupId: row.group_id,
      groupName: row.groups?.name ?? "",
      actor: row.actor,
      action: row.action,
      details: row.details as Record<string, unknown>,
      createdAt: row.created_at,
    })),
    names: Object.fromEntries((people ?? []).map((p) => [p.id, p.display_name])),
  };
}
