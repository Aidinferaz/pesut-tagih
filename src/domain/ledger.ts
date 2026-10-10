import type { Rupiah } from "./money";
import {
  computeBalances,
  planSettlement,
  type ExpenseEntry,
  type MethodBook,
  type SettlementEntry,
  type Transfer,
} from "./settle";
import type { UserId } from "./split";

export type SettlementStatus = "pending" | "confirmed" | "rejected";
export type SettlementRecord = SettlementEntry & { status: SettlementStatus };

export type GroupPosition = {
  /** Confirmed money only: what each person is owed (+) or owes (−) right now. */
  balances: Map<UserId, Rupiah>;
  /** What still needs to be sent, with transfers awaiting confirmation treated as on their way. */
  transfers: Transfer[];
};

/**
 * Where a group stands. A transfer someone marked as paid stays out of the
 * balance until the receiver confirms it, but it is already taken out of the
 * suggested transfers so nobody is asked to pay the same debt twice.
 */
export function groupPosition({
  expenses,
  settlements,
  methods,
  simplify,
}: {
  expenses: readonly ExpenseEntry[];
  settlements: readonly SettlementRecord[];
  methods: MethodBook;
  simplify: boolean;
}): GroupPosition {
  const confirmed = settlements.filter((s) => s.status === "confirmed");
  const inFlight = settlements.filter((s) => s.status !== "rejected");
  return {
    balances: computeBalances(expenses, confirmed),
    transfers: planSettlement({ expenses, settlements: inFlight, methods, simplify }),
  };
}

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * How many days someone has owed money: counted from the oldest expense they
 * share (and didn't pay for) since their last confirmed payment. Dates are
 * calendar days in Kalimantan Timur (UTC+8).
 */
export function debtAgeDays(
  userId: UserId,
  expenses: readonly {
    paidBy: UserId;
    occurredOn: string;
    shares: readonly { userId: UserId; amount: Rupiah }[];
  }[],
  settlements: readonly { from: UserId; status: SettlementStatus; createdAt: string }[],
  now: number,
): number {
  const lastPaid = settlements
    .filter((s) => s.from === userId && s.status === "confirmed")
    .map((s) => s.createdAt.slice(0, 10))
    .reduce((a, b) => (a > b ? a : b), "");
  const dates = expenses
    .filter(
      (e) =>
        e.paidBy !== userId &&
        e.occurredOn >= lastPaid &&
        e.shares.some((s) => s.userId === userId && s.amount > 0),
    )
    .map((e) => e.occurredOn);
  if (dates.length === 0) return 0;
  const oldest = dates.reduce((a, b) => (a < b ? a : b));
  return Math.max(0, Math.floor((now - Date.parse(`${oldest}T00:00:00+08:00`)) / DAY_MS));
}
