import "server-only";
import { rupiah } from "@/lib/format";
import { supabaseAdmin } from "@/server/supabase/admin";
import { notifyUser } from "./dispatcher";
import { eventText } from "./messages";

/**
 * Immediate notices for things that just happened. Called with next/server's
 * after(), so they run once the response has gone out and a slow channel
 * never holds up the person who clicked.
 */

export async function expenseLogged(expenseId: string) {
  const db = supabaseAdmin();
  const { data: e } = await db
    .from("expenses")
    .select(
      "id, group_id, title, created_by, groups (name), expense_shares (user_id, amount), creator:profiles!expenses_created_by_fkey (display_name)",
    )
    .eq("id", expenseId)
    .maybeSingle();
  if (!e) return;
  await Promise.all(
    e.expense_shares
      .filter((s) => s.user_id !== e.created_by && s.amount > 0)
      .map((s) =>
        notifyUser(s.user_id, {
          kind: "expense",
          dedupeKey: `expense:${e.id}:${s.user_id}`,
          groupId: e.group_id,
          title: e.groups.name,
          path: `/groups/${e.group_id}`,
          text: (locale) =>
            eventText(locale, "expenseLogged", {
              actor: e.creator?.display_name ?? "Pesut",
              title: e.title,
              group: e.groups.name,
              amount: rupiah(s.amount, locale),
            }),
        }),
      ),
  );
}

export async function settlementChanged(settlementId: string) {
  const db = supabaseAdmin();
  const { data: s } = await db
    .from("settlements")
    .select(
      "id, group_id, amount, status, groups (name), sender:profiles!settlements_from_user_fkey (id, display_name), receiver:profiles!settlements_to_user_fkey (id, display_name)",
    )
    .eq("id", settlementId)
    .maybeSingle();
  if (!s) return;
  // Pending: tell the receiver to check. Decided: tell the sender the outcome.
  const toReceiver = s.status === "pending";
  const recipient = toReceiver ? s.receiver : s.sender;
  const actor = toReceiver ? s.sender : s.receiver;
  const key = toReceiver ? "paid" : s.status === "confirmed" ? "confirmed" : "rejected";
  await notifyUser(recipient.id, {
    kind: key,
    dedupeKey: `settlement:${s.id}:${s.status}`,
    groupId: s.group_id,
    title: s.groups.name,
    path: toReceiver ? "/transfers" : `/groups/${s.group_id}`,
    text: (locale) =>
      eventText(locale, key, {
        actor: actor.display_name,
        amount: rupiah(s.amount, locale),
        group: s.groups.name,
      }),
  });
}
