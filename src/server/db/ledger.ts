import "server-only";
import { groupPosition, type SettlementStatus } from "@/domain/ledger";
import type { ProviderCode } from "@/domain/providers";
import type { Share } from "@/domain/split";
import { supabaseForUser } from "@/server/supabase/server";
import { getGroup, listMyGroups, type GroupDetail } from "./groups";
import { listPaymentMethods, type PaymentMethod } from "./profile";

export type LedgerItem = {
  name: string;
  amount: number;
  claims: { userId: string; weight: number }[];
};

export type LedgerExpense = {
  id: string;
  number: number;
  title: string;
  total: number;
  paidBy: string;
  createdBy: string;
  splitMethod: "equal" | "exact" | "itemized";
  occurredOn: string;
  createdAt: string;
  recurring: boolean;
  tax: number;
  service: number;
  discount: number;
  note: string | null;
  receiptPath: string | null;
  shares: Share[];
  items: LedgerItem[];
};

export type LedgerSettlement = {
  id: string;
  number: number;
  from: string;
  to: string;
  amount: number;
  status: SettlementStatus;
  provider: ProviderCode | null;
  proofPath: string | null;
  note: string | null;
  createdAt: string;
  decidedAt: string | null;
  autoConfirmed: boolean;
  rejectedReason: string | null;
};

/** Live expenses and every transfer in a group, newest first. RLS limits this to members. */
export async function getLedger(groupId: string) {
  const supabase = await supabaseForUser();
  const [expenses, settlements] = await Promise.all([
    supabase
      .from("expenses")
      .select(
        "id, number, title, total, paid_by, created_by, split_method, occurred_on, created_at, recurring_bill_id, tax, service, discount, note, receipt_path, expense_shares (user_id, amount), expense_items (position, name, amount, item_claims (user_id, weight))",
      )
      .eq("group_id", groupId)
      .is("deleted_at", null)
      .order("occurred_on", { ascending: false })
      .order("number", { ascending: false }),
    supabase
      .from("settlements")
      .select(
        "id, number, from_user, to_user, amount, status, provider, proof_path, note, created_at, decided_at, auto_confirmed, rejected_reason",
      )
      .eq("group_id", groupId)
      .order("created_at", { ascending: false }),
  ]);
  if (expenses.error) throw expenses.error;
  if (settlements.error) throw settlements.error;

  return {
    expenses: expenses.data.map((e): LedgerExpense => ({
      id: e.id,
      number: e.number,
      title: e.title,
      total: e.total,
      paidBy: e.paid_by,
      createdBy: e.created_by,
      splitMethod: e.split_method as LedgerExpense["splitMethod"],
      occurredOn: e.occurred_on,
      createdAt: e.created_at,
      recurring: e.recurring_bill_id !== null,
      tax: e.tax,
      service: e.service,
      discount: e.discount,
      note: e.note,
      receiptPath: e.receipt_path,
      shares: e.expense_shares.map((s) => ({ userId: s.user_id, amount: s.amount })),
      items: e.expense_items
        .toSorted((a, b) => a.position - b.position)
        .map((i) => ({
          name: i.name,
          amount: i.amount,
          claims: i.item_claims.map((c) => ({ userId: c.user_id, weight: c.weight })),
        })),
    })),
    settlements: settlements.data.map((s): LedgerSettlement => ({
      id: s.id,
      number: s.number,
      from: s.from_user,
      to: s.to_user,
      amount: s.amount,
      status: s.status as SettlementStatus,
      provider: s.provider as ProviderCode | null,
      proofPath: s.proof_path,
      note: s.note,
      createdAt: s.created_at,
      decidedAt: s.decided_at,
      autoConfirmed: s.auto_confirmed,
      rejectedReason: s.rejected_reason,
    })),
  };
}

export type GroupBook = {
  group: GroupDetail;
  expenses: LedgerExpense[];
  settlements: LedgerSettlement[];
  methods: PaymentMethod[];
} & ReturnType<typeof groupPosition>;

/** Everything a group page needs: members, ledger, receiving accounts and the computed position. */
export async function getGroupBook(groupId: string): Promise<GroupBook | null> {
  const group = await getGroup(groupId);
  if (!group) return null;
  const memberIds = group.members.map((m) => m.id);
  const [{ expenses, settlements }, methods] = await Promise.all([
    getLedger(groupId),
    listPaymentMethods(memberIds),
  ]);
  const book = new Map<string, ProviderCode[]>(memberIds.map((id) => [id, []]));
  methods.forEach((m) => book.get(m.userId)?.push(m.provider));
  return {
    group,
    expenses,
    settlements,
    methods,
    ...groupPosition({ expenses, settlements, methods: book, simplify: group.simplifyDebts }),
  };
}

/** Short-lived links to private files (receipts, proofs, QRIS) for people allowed to see them. */
export async function signedUrls(bucket: "receipts" | "proofs" | "qris", paths: string[]) {
  const unique = [...new Set(paths.filter(Boolean))];
  if (unique.length === 0) return new Map<string, string>();
  const supabase = await supabaseForUser();
  const { data } = await supabase.storage.from(bucket).createSignedUrls(unique, 60 * 10);
  return new Map(
    (data ?? []).flatMap((d) => (d.path && d.signedUrl ? [[d.path, d.signedUrl]] : [])),
  );
}

export async function listRecurringBills(groupId: string) {
  const supabase = await supabaseForUser();
  const { data, error } = await supabase
    .from("recurring_bills")
    .select(
      "id, title, amount, paid_by, participants, day_of_month, next_run_on, active, created_by",
    )
    .eq("group_id", groupId)
    .order("created_at");
  if (error) throw error;
  return data.map((b) => ({
    id: b.id,
    title: b.title,
    amount: b.amount,
    paidBy: b.paid_by,
    participants: b.participants,
    dayOfMonth: b.day_of_month,
    nextRunOn: b.next_run_on,
    active: b.active,
    createdBy: b.created_by,
  }));
}

/**
 * The derived pieces every view of a group needs for one person: names,
 * their routes, pending confirmations, and signed links to proofs and QRIS.
 */
export async function viewForMember(book: GroupBook, me: string) {
  const names = Object.fromEntries(book.group.members.map((m) => [m.id, m.name]));
  const pending = book.settlements.filter((s) => s.status === "pending");
  const outgoing = book.transfers.filter((r) => r.from === me);
  const incoming = book.transfers.filter((r) => r.to === me);
  const [proofUrls, qrisUrls] = await Promise.all([
    signedUrls(
      "proofs",
      pending.flatMap((s) => (s.proofPath ? [s.proofPath] : [])),
    ),
    signedUrls(
      "qris",
      book.methods
        .filter((m) => m.qrisPath && outgoing.some((r) => r.to === m.userId))
        .map((m) => m.qrisPath!),
    ),
  ]);
  const accounts = book.methods.map((m) => ({
    userId: m.userId,
    provider: m.provider,
    accountNumber: m.accountNumber,
    accountName: m.accountName,
    qrisUrl: m.qrisPath ? (qrisUrls.get(m.qrisPath) ?? null) : null,
  }));
  return {
    names,
    pending,
    outgoing,
    incoming,
    proofUrls,
    accounts,
    balance: book.balances.get(me) ?? 0,
  };
}

/** Books for every group the person is in, oldest membership first. */
export async function listMyBooks(userId: string) {
  const groups = await listMyGroups(userId);
  const books = await Promise.all(groups.map((g) => getGroupBook(g.id)));
  return books.filter((b): b is GroupBook => b !== null);
}
