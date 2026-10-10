import "server-only";
import { groupPosition, type SettlementStatus } from "@/domain/ledger";
import type { ProviderCode } from "@/domain/providers";
import { supabaseAdmin } from "@/server/supabase/admin";

/**
 * Every group's ledger, read with the secret key for jobs that act for
 * nobody in particular (the daily reminders and recaps). The position is
 * computed with the same domain code the pages use.
 */
export async function loadAllBooks() {
  const db = supabaseAdmin();
  const [groups, expenses, settlements, methods] = await Promise.all([
    db
      .from("groups")
      .select(
        "id, name, simplify_debts, reminder_after_days, reminder_repeat_days, telegram_chat_id, telegram_recap_amounts, group_members (user_id, profiles (display_name, locale))",
      ),
    db
      .from("expenses")
      .select("group_id, paid_by, occurred_on, expense_shares (user_id, amount)")
      .is("deleted_at", null),
    db.from("settlements").select("group_id, from_user, to_user, amount, status, created_at"),
    db.from("payment_methods").select("user_id, provider, priority").order("priority"),
  ]);
  for (const r of [groups, expenses, settlements, methods]) if (r.error) throw r.error;

  return groups.data!.map((g) => {
    const members = g.group_members.map((m) => ({
      id: m.user_id,
      name: m.profiles.display_name,
      locale: m.profiles.locale,
    }));
    const ids = new Set(members.map((m) => m.id));
    const book = new Map<string, ProviderCode[]>(members.map((m) => [m.id, []]));
    methods.data!.forEach((m) => {
      if (ids.has(m.user_id)) book.get(m.user_id)!.push(m.provider as ProviderCode);
    });
    const groupExpenses = expenses
      .data!.filter((e) => e.group_id === g.id)
      .map((e) => ({
        paidBy: e.paid_by,
        occurredOn: e.occurred_on,
        shares: e.expense_shares.map((s) => ({ userId: s.user_id, amount: s.amount })),
      }));
    const groupSettlements = settlements
      .data!.filter((s) => s.group_id === g.id)
      .map((s) => ({
        from: s.from_user,
        to: s.to_user,
        amount: s.amount,
        status: s.status as SettlementStatus,
        createdAt: s.created_at,
      }));
    return {
      group: g,
      members,
      expenses: groupExpenses,
      settlements: groupSettlements,
      ...groupPosition({
        expenses: groupExpenses,
        settlements: groupSettlements,
        methods: book,
        simplify: g.simplify_debts,
      }),
    };
  });
}
