import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { itemizedTotal, splitEqual, splitExact, splitItemized, SplitError } from "./split";

const sum = (shares: { amount: number }[]) => shares.reduce((a, s) => a + s.amount, 0);

describe("splitEqual", () => {
  it("splits evenly and keeps the total", () => {
    const shares = splitEqual(100_000, ["a", "b", "c"]);
    expect(shares.map((s) => s.amount)).toEqual([33_334, 33_333, 33_333]);
    expect(sum(shares)).toBe(100_000);
  });

  it("rejects empty or duplicate participants", () => {
    expect(() => splitEqual(1000, [])).toThrow(SplitError);
    expect(() => splitEqual(1000, ["a", "a"])).toThrow(SplitError);
  });
});

describe("splitExact", () => {
  it("accepts shares that add up", () => {
    expect(
      splitExact(50_000, [
        { userId: "a", amount: 20_000 },
        { userId: "b", amount: 30_000 },
      ]),
    ).toHaveLength(2);
  });

  it("rejects shares that don't add up", () => {
    expect(() => splitExact(50_000, [{ userId: "a", amount: 20_000 }])).toThrow(/expected 50000/);
  });
});

describe("splitItemized", () => {
  it("spreads tax and service by subtotal and shares items by weight", () => {
    const input = {
      items: [
        { amount: 40_000, claims: [{ userId: "a", weight: 1 }] },
        { amount: 60_000, claims: [{ userId: "b", weight: 1 }] },
        {
          amount: 30_000,
          claims: [
            { userId: "a", weight: 2 },
            { userId: "b", weight: 1 },
          ],
        },
      ],
      tax: 13_000,
      service: 6_500,
      discount: 10_000,
    };
    const shares = splitItemized(input);
    // a: 40k + 20k = 60k, b: 60k + 10k = 70k -> extra 19.5k and discount 10k split 60:70
    expect(shares).toEqual([
      { userId: "a", amount: 60_000 + 9_000 - 4_615 },
      { userId: "b", amount: 70_000 + 10_500 - 5_385 },
    ]);
    expect(sum(shares)).toBe(itemizedTotal(input));
  });

  it("refuses an item nobody claimed", () => {
    expect(() => splitItemized({ items: [{ amount: 1000, claims: [] }] })).toThrow(/no owner/);
  });

  it("always sums to the receipt total", () => {
    const people = ["a", "b", "c", "d"];
    fc.assert(
      fc.property(
        fc.array(
          fc.record({
            amount: fc.integer({ min: 1, max: 2_000_000 }),
            claims: fc.uniqueArray(
              fc.record({
                userId: fc.constantFrom(...people),
                weight: fc.integer({ min: 1, max: 5 }),
              }),
              { minLength: 1, maxLength: 4, selector: (c) => c.userId },
            ),
          }),
          { minLength: 1, maxLength: 20 },
        ),
        fc.integer({ min: 0, max: 500_000 }),
        fc.integer({ min: 0, max: 500_000 }),
        (items, tax, service) => {
          const input = { items, tax, service };
          expect(sum(splitItemized(input))).toBe(itemizedTotal(input));
        },
      ),
    );
  });
});
