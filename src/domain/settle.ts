import type { Rupiah } from "./money";
import { CROSS_PROVIDER_FEE, type ProviderCode } from "./providers";
import type { Share, UserId } from "./split";

export type ExpenseEntry = { paidBy: UserId; shares: readonly Share[] };

/** A transfer that already happened and was confirmed by the receiver. */
export type SettlementEntry = { from: UserId; to: UserId; amount: Rupiah };

/** Each person's receiving methods, most preferred first. */
export type MethodBook = ReadonlyMap<UserId, readonly ProviderCode[]>;

export type Transfer = {
  from: UserId;
  to: UserId;
  amount: Rupiah;
  /** Which of the receiver's providers to send to; null if they listed none. */
  via: ProviderCode | null;
  /** Estimated admin fee; null when it can't be known (receiver has no methods). */
  fee: Rupiah | null;
};

/** Positive balance: the group owes you. Negative: you owe the group. */
export function computeBalances(
  expenses: readonly ExpenseEntry[],
  settlements: readonly SettlementEntry[] = [],
): Map<UserId, Rupiah> {
  const balances = new Map<UserId, Rupiah>();
  const add = (id: UserId, delta: Rupiah) => balances.set(id, (balances.get(id) ?? 0) + delta);

  for (const expense of expenses) {
    add(expense.paidBy, 0);
    for (const share of expense.shares) {
      if (share.userId === expense.paidBy) continue;
      add(expense.paidBy, share.amount);
      add(share.userId, -share.amount);
    }
  }
  for (const s of settlements) {
    add(s.from, s.amount);
    add(s.to, -s.amount);
  }
  return balances;
}

/**
 * Who owes whom without any simplification: every share is a debt to the
 * person who paid, netted per pair. Used when a group turns simplification off.
 */
export function pairwiseDebts(
  expenses: readonly ExpenseEntry[],
  settlements: readonly SettlementEntry[] = [],
): { from: UserId; to: UserId; amount: Rupiah }[] {
  const owed = new Map<string, Rupiah>();
  const key = (a: UserId, b: UserId) => `${a}\u0000${b}`;
  const add = (from: UserId, to: UserId, amount: Rupiah) =>
    owed.set(key(from, to), (owed.get(key(from, to)) ?? 0) + amount);

  for (const expense of expenses) {
    for (const share of expense.shares) {
      if (share.userId !== expense.paidBy) add(share.userId, expense.paidBy, share.amount);
    }
  }
  for (const s of settlements) add(s.from, s.to, -s.amount);

  const result: { from: UserId; to: UserId; amount: Rupiah }[] = [];
  const seen = new Set<string>();
  for (const k of owed.keys()) {
    const [a, b] = k.split("\u0000");
    const pair = a < b ? key(a, b) : key(b, a);
    if (seen.has(pair)) continue;
    seen.add(pair);
    const net = (owed.get(key(a, b)) ?? 0) - (owed.get(key(b, a)) ?? 0);
    if (net > 0) result.push({ from: a, to: b, amount: net });
    else if (net < 0) result.push({ from: b, to: a, amount: -net });
  }
  return result.sort((x, y) => y.amount - x.amount || x.from.localeCompare(y.from));
}

/** Picks the receiver's method that the sender also has, if any. */
export function pickRoute(
  senderMethods: readonly ProviderCode[],
  receiverMethods: readonly ProviderCode[],
): Pick<Transfer, "via" | "fee"> {
  const shared = receiverMethods.find((p) => senderMethods.includes(p));
  if (shared) return { via: shared, fee: 0 };
  if (receiverMethods.length === 0) return { via: null, fee: null };
  return { via: receiverMethods[0], fee: CROSS_PROVIDER_FEE };
}

/**
 * Turns balances into as few transfers as the greedy pass allows (at most
 * n − 1), preferring pairs that share a bank or e-wallet so nobody pays admin.
 *
 * Each round takes the person who owes the most and pays the largest creditor
 * they share a provider with, or the largest creditor overall if there is none.
 * Every round clears at least one person, which is what bounds the count.
 */
export function simplifyDebts(balances: ReadonlyMap<UserId, Rupiah>, methods: MethodBook) {
  const sum = [...balances.values()].reduce((a, b) => a + b, 0);
  if (sum !== 0) throw new RangeError(`Balances must net to zero, got ${sum}`);

  const byId = (a: { id: UserId }, b: { id: UserId }) => a.id.localeCompare(b.id);
  const debtors = [...balances]
    .filter(([, v]) => v < 0)
    .map(([id, v]) => ({ id, left: -v }))
    .sort(byId);
  const creditors = [...balances]
    .filter(([, v]) => v > 0)
    .map(([id, v]) => ({ id, left: v }))
    .sort(byId);

  const largest = <T extends { left: number }>(list: T[]) =>
    list.reduce((best, cur) => (cur.left > best.left ? cur : best));

  const transfers: Transfer[] = [];
  while (debtors.length > 0) {
    const debtor = largest(debtors);
    const mine = methods.get(debtor.id) ?? [];
    const sharing = creditors.filter((c) =>
      (methods.get(c.id) ?? []).some((p) => mine.includes(p)),
    );
    const creditor = largest(sharing.length > 0 ? sharing : creditors);

    const amount = Math.min(debtor.left, creditor.left);
    transfers.push({
      from: debtor.id,
      to: creditor.id,
      amount,
      ...pickRoute(mine, methods.get(creditor.id) ?? []),
    });

    debtor.left -= amount;
    creditor.left -= amount;
    if (debtor.left === 0) debtors.splice(debtors.indexOf(debtor), 1);
    if (creditor.left === 0) creditors.splice(creditors.indexOf(creditor), 1);
  }
  return transfers;
}

export type PlanInput = {
  expenses: readonly ExpenseEntry[];
  settlements?: readonly SettlementEntry[];
  methods: MethodBook;
  simplify: boolean;
};

/** The transfers that would bring everyone in a group back to zero. */
export function planSettlement({
  expenses,
  settlements = [],
  methods,
  simplify,
}: PlanInput): Transfer[] {
  if (simplify) return simplifyDebts(computeBalances(expenses, settlements), methods);
  return pairwiseDebts(expenses, settlements).map((debt) => ({
    ...debt,
    ...pickRoute(methods.get(debt.from) ?? [], methods.get(debt.to) ?? []),
  }));
}
