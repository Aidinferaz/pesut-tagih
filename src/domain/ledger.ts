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
