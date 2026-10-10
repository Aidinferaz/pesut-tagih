import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { CROSS_PROVIDER_FEE, type ProviderCode } from "./providers";
import {
  computeBalances,
  pairwiseDebts,
  pickRoute,
  planSettlement,
  simplifyDebts,
  type ExpenseEntry,
  type MethodBook,
} from "./settle";

const noMethods: MethodBook = new Map();

describe("computeBalances", () => {
  it("credits the payer and debits everyone else, then applies settlements", () => {
    const expenses: ExpenseEntry[] = [
      {
        paidBy: "a",
        shares: [
          { userId: "a", amount: 10 },
          { userId: "b", amount: 10 },
          { userId: "c", amount: 10 },
        ],
      },
    ];
    const balances = computeBalances(expenses, [{ from: "b", to: "a", amount: 10 }]);
    expect(Object.fromEntries(balances)).toEqual({ a: 10, b: 0, c: -10 });
  });
});

describe("pairwiseDebts", () => {
  it("nets debts within each pair but never across people", () => {
    const debts = pairwiseDebts([
      { paidBy: "a", shares: [{ userId: "b", amount: 50 }] },
      { paidBy: "b", shares: [{ userId: "c", amount: 50 }] },
      { paidBy: "b", shares: [{ userId: "a", amount: 20 }] },
    ]);
    expect(debts).toEqual([
      { from: "c", to: "b", amount: 50 },
      { from: "b", to: "a", amount: 30 },
    ]);
  });
});

describe("pickRoute", () => {
  it("prefers a provider both sides have, in the receiver's order", () => {
    expect(pickRoute(["gopay", "bca"], ["bca", "gopay"])).toEqual({ via: "bca", fee: 0 });
  });
  it("falls back to the receiver's first method with a fee", () => {
    expect(pickRoute(["bri"], ["bca"])).toEqual({ via: "bca", fee: CROSS_PROVIDER_FEE });
  });
  it("reports an unknown route when the receiver listed nothing", () => {
    expect(pickRoute(["bri"], [])).toEqual({ via: null, fee: null });
  });
});

describe("simplifyDebts", () => {
  it("collapses a chain into a single transfer", () => {
    const balances = computeBalances([
      { paidBy: "b", shares: [{ userId: "a", amount: 100 }] },
      { paidBy: "c", shares: [{ userId: "b", amount: 100 }] },
    ]);
    expect(simplifyDebts(balances, noMethods)).toEqual([
      { from: "a", to: "c", amount: 100, via: null, fee: null },
    ]);
  });

  it("routes debtors to a creditor on the same provider when one exists", () => {
    // d owes 100; b and c are owed 100 each; e owes 100.
    const balances = new Map([
      ["b", 100],
      ["c", 100],
      ["d", -100],
      ["e", -100],
    ]);
    const methods: MethodBook = new Map<string, ProviderCode[]>([
      ["b", ["bca"]],
      ["c", ["gopay"]],
      ["d", ["gopay"]],
      ["e", ["bca"]],
    ]);
    const transfers = simplifyDebts(balances, methods);
    expect(transfers).toEqual([
      { from: "d", to: "c", amount: 100, via: "gopay", fee: 0 },
      { from: "e", to: "b", amount: 100, via: "bca", fee: 0 },
    ]);
  });

  it("rejects balances that don't net to zero", () => {
    expect(() => simplifyDebts(new Map([["a", 5]]), noMethods)).toThrow();
  });

  it("clears every balance in at most n - 1 transfers", () => {
    const people = ["a", "b", "c", "d", "e", "f", "g"];
    const providers: ProviderCode[] = ["bca", "mandiri", "gopay", "dana"];
    fc.assert(
      fc.property(
        fc.array(
          fc.record({
            paidBy: fc.constantFrom(...people),
            shares: fc.uniqueArray(
              fc.record({
                userId: fc.constantFrom(...people),
                amount: fc.integer({ min: 1, max: 1_000_000 }),
              }),
              { minLength: 1, maxLength: people.length, selector: (s) => s.userId },
            ),
          }),
          { minLength: 1, maxLength: 25 },
        ),
        fc.array(fc.subarray(providers), { minLength: people.length, maxLength: people.length }),
        (expenses, methodLists) => {
          const methods: MethodBook = new Map(people.map((p, i) => [p, methodLists[i]]));
          const balances = computeBalances(expenses);
          const transfers = planSettlement({ expenses, methods, simplify: true });

          const after = new Map(balances);
          for (const t of transfers) {
            expect(t.amount).toBeGreaterThan(0);
            after.set(t.from, (after.get(t.from) ?? 0) + t.amount);
            after.set(t.to, (after.get(t.to) ?? 0) - t.amount);
          }
          for (const value of after.values()) expect(value).toBe(0);

          const nonZero = [...balances.values()].filter((v) => v !== 0).length;
          expect(transfers.length).toBeLessThanOrEqual(Math.max(0, nonZero - 1));
        },
      ),
    );
  });
});

describe("planSettlement", () => {
  it("keeps direct debts when simplification is off", () => {
    const expenses: ExpenseEntry[] = [
      { paidBy: "b", shares: [{ userId: "a", amount: 100 }] },
      { paidBy: "c", shares: [{ userId: "b", amount: 100 }] },
    ];
    const transfers = planSettlement({ expenses, methods: noMethods, simplify: false });
    expect(transfers.map((t) => [t.from, t.to, t.amount])).toEqual([
      ["a", "b", 100],
      ["b", "c", 100],
    ]);
  });
});
