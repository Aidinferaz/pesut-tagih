import { allocate, isRupiah, type Rupiah } from "./money";

export type UserId = string;

/** What one person owes for one expense. The parts of an expense sum to its total. */
export type Share = { userId: UserId; amount: Rupiah };

export class SplitError extends Error {
  constructor(
    readonly code:
      | "no_participants"
      | "duplicate_participant"
      | "invalid_amount"
      | "sum_mismatch"
      | "unclaimed_item",
    message: string,
  ) {
    super(message);
    this.name = "SplitError";
  }
}

function assertUnique(ids: readonly UserId[]) {
  if (ids.length === 0) throw new SplitError("no_participants", "Pick at least one person");
  if (new Set(ids).size !== ids.length) {
    throw new SplitError("duplicate_participant", "A person appears twice");
  }
}

function assertAmount(amount: Rupiah) {
  if (!isRupiah(amount)) throw new SplitError("invalid_amount", `Invalid amount: ${amount}`);
}

export function splitEqual(total: Rupiah, participants: readonly UserId[]): Share[] {
  assertAmount(total);
  assertUnique(participants);
  const parts = allocate(
    total,
    participants.map(() => 1),
  );
  return participants.map((userId, i) => ({ userId, amount: parts[i] }));
}

export function splitExact(total: Rupiah, shares: readonly Share[]): Share[] {
  assertAmount(total);
  assertUnique(shares.map((s) => s.userId));
  shares.forEach((s) => assertAmount(s.amount));
  const sum = shares.reduce((acc, s) => acc + s.amount, 0);
  if (sum !== total) {
    throw new SplitError("sum_mismatch", `Shares add up to ${sum}, expected ${total}`);
  }
  return shares.map((s) => ({ ...s }));
}

export type ItemClaim = { userId: UserId; weight: number };
export type ClaimedItem = { amount: Rupiah; claims: readonly ItemClaim[] };

export type ItemizedInput = {
  items: readonly ClaimedItem[];
  /** Absolute amounts as printed on the receipt. */
  tax?: Rupiah;
  service?: Rupiah;
  discount?: Rupiah;
};

export function itemizedTotal({ items, tax = 0, service = 0, discount = 0 }: ItemizedInput) {
  return items.reduce((sum, item) => sum + item.amount, 0) + tax + service - discount;
}

/**
 * Each item goes to whoever claimed it (by weight, so "2 of the 3 satay
 * portions" works). Tax, service and discount are then spread in proportion
 * to each person's item subtotal, the way a restaurant bill really works.
 */
export function splitItemized(input: ItemizedInput): Share[] {
  const { items, tax = 0, service = 0, discount = 0 } = input;
  [tax, service, discount].forEach(assertAmount);

  const subtotals = new Map<UserId, Rupiah>();
  items.forEach((item, index) => {
    assertAmount(item.amount);
    const claims = item.claims.filter((c) => c.weight > 0);
    if (claims.length === 0) {
      throw new SplitError("unclaimed_item", `Item ${index + 1} has no owner`);
    }
    assertUnique(claims.map((c) => c.userId));
    const parts = allocate(
      item.amount,
      claims.map((c) => c.weight),
    );
    claims.forEach((c, i) => subtotals.set(c.userId, (subtotals.get(c.userId) ?? 0) + parts[i]));
  });

  const people = [...subtotals.keys()];
  if (people.length === 0) throw new SplitError("no_participants", "No items to split");

  const weights = people.map((id) => subtotals.get(id)!);
  const extra = allocate(tax + service, weights);
  const off = allocate(discount, weights);

  const shares = people.map((userId, i) => ({
    userId,
    amount: weights[i] + extra[i] - off[i],
  }));
  if (shares.some((s) => s.amount < 0)) {
    throw new SplitError("invalid_amount", "Discount is larger than the bill");
  }
  return shares;
}
