import { describe, expect, it } from "vitest";
import { debtAgeDays, groupPosition } from "./ledger";
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

describe("debtAgeDays", () => {
  const now = Date.parse("2026-10-20T12:00:00+08:00");
  const expense = (occurredOn: string, paidBy = "a") => ({
    paidBy,
    occurredOn,
    shares: [
      { userId: "a", amount: 10 },
      { userId: "b", amount: 10 },
    ],
  });

  it("counts from the oldest shared expense", () => {
    expect(debtAgeDays("b", [expense("2026-10-13"), expense("2026-10-18")], [], now)).toBe(7);
  });

  it("restarts after a confirmed payment", () => {
    const paid = [{ from: "b", status: "confirmed" as const, createdAt: "2026-10-15T10:00:00Z" }];
    expect(debtAgeDays("b", [expense("2026-10-13"), expense("2026-10-18")], paid, now)).toBe(2);
  });

  it("ignores expenses the person paid for themselves", () => {
    expect(debtAgeDays("a", [expense("2026-10-13")], [], now)).toBe(0);
  });
});
