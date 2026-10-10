import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { allocate, formatRupiah, parseRupiah } from "./money";

describe("parseRupiah", () => {
  it.each([
    ["120rb", 120_000],
    ["120 rb", 120_000],
    ["35k", 35_000],
    ["1,5jt", 1_500_000],
    ["1.5jt", 1_500_000],
    ["2 juta", 2_000_000],
    ["Rp 45.000", 45_000],
    ["Rp45,000", 45_000],
    ["rp. 1.250.000", 1_250_000],
    ["7500", 7_500],
  ])("reads %s", (input, expected) => {
    expect(parseRupiah(input)).toBe(expected);
  });

  it.each(["", "abc", "12.34", "-5000", "0", "1.2.3jt", "5000000000"])("rejects %s", (input) => {
    expect(parseRupiah(input)).toBeNull();
  });
});

describe("formatRupiah", () => {
  it("formats without decimals", () => {
    expect(formatRupiah(120_000).replace(/\s/g, " ")).toMatch(/^Rp\s?120\.000$/);
  });
});

describe("allocate", () => {
  it("hands leftover rupiah to the largest remainders, earliest first", () => {
    expect(allocate(100, [1, 1, 1])).toEqual([34, 33, 33]);
    expect(allocate(10, [1, 2])).toEqual([3, 7]);
  });

  it("handles zero totals and zero weights", () => {
    expect(allocate(0, [0, 0])).toEqual([0, 0]);
    expect(allocate(50, [0, 1])).toEqual([0, 50]);
    expect(() => allocate(5, [0, 0])).toThrow();
  });

  it("always sums back to the total and stays within one rupiah of the exact share", () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 100_000_000 }),
        fc.array(fc.integer({ min: 1, max: 1000 }), { minLength: 1, maxLength: 30 }),
        (total, weights) => {
          const parts = allocate(total, weights);
          const weightSum = weights.reduce((a, b) => a + b, 0);
          expect(parts.reduce((a, b) => a + b, 0)).toBe(total);
          parts.forEach((p, i) => {
            expect(Number.isInteger(p)).toBe(true);
            expect(Math.abs(p - (total * weights[i]) / weightSum)).toBeLessThan(1);
          });
        },
      ),
    );
  });
});
