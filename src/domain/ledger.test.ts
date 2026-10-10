import { describe, expect, it } from "vitest";
import { groupPosition } from "./ledger";
import type { ExpenseEntry } from "./settle";

const dinner: ExpenseEntry = {
  paidBy: "a",
  shares: [
    { userId: "a", amount: 50 },
    { userId: "b", amount: 50 },
  ],
};

describe("groupPosition", () => {
  it("keeps a pending transfer out of the balance but out of the plan too", () => {
    const { balances, transfers } = groupPosition({
      expenses: [dinner],
      settlements: [{ from: "b", to: "a", amount: 50, status: "pending" }],
      methods: new Map(),
      simplify: true,
    });
    expect(balances.get("b")).toBe(-50);
    expect(transfers).toEqual([]);
  });

  it("counts confirmed transfers and ignores rejected ones", () => {
    const { balances, transfers } = groupPosition({
      expenses: [dinner],
      settlements: [
        { from: "b", to: "a", amount: 20, status: "confirmed" },
        { from: "b", to: "a", amount: 30, status: "rejected" },
      ],
      methods: new Map(),
      simplify: true,
    });
    expect(balances.get("b")).toBe(-30);
    expect(transfers.map((t) => [t.from, t.to, t.amount])).toEqual([["b", "a", 30]]);
  });
});
