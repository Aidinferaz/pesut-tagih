/**
 * Money is always a whole number of rupiah. Floats never touch a balance:
 * every split goes through `allocate`, which hands out the leftover rupiah
 * deterministically so the parts always add back up to the total.
 */

export type Rupiah = number;

/** Upper bound for a single amount. Keeps typos like "15000000000" out. */
export const MAX_AMOUNT: Rupiah = 1_000_000_000;

export function isRupiah(value: unknown): value is Rupiah {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0;
}

const SUFFIXES: Record<string, number> = {
  rb: 1_000,
  ribu: 1_000,
  k: 1_000,
  jt: 1_000_000,
  juta: 1_000_000,
  m: 1_000_000,
};

/**
 * Reads the way people actually type amounts: "120rb", "1,5jt", "Rp 45.000",
 * "2 juta", "35k". Returns null for anything it can't read with confidence.
 */
export function parseRupiah(input: string): Rupiah | null {
  const text = input
    .trim()
    .toLowerCase()
    .replace(/^rp\.?\s*/, "");
  const match = text.match(/^([\d.,\s]+?)\s*(rb|ribu|k|jt|juta|m)?$/);
  if (!match) return null;

  const [, rawNumber, suffix] = match;
  const digits = rawNumber.replace(/\s/g, "");
  const multiplier = suffix ? SUFFIXES[suffix] : 1;

  let value: number;
  if (suffix) {
    // With a suffix, "," or "." is a decimal mark: "1,5jt" / "1.5jt".
    value = Number(digits.replace(",", "."));
  } else {
    // Without one, both are thousands separators: "45.000" / "45,000".
    if (!/^\d{1,3}([.,]\d{3})*$|^\d+$/.test(digits)) return null;
    value = Number(digits.replace(/[.,]/g, ""));
  }

  if (!Number.isFinite(value)) return null;
  const amount = Math.round(value * multiplier);
  return amount > 0 && amount <= MAX_AMOUNT ? amount : null;
}

export function formatRupiah(amount: Rupiah, locale: string = "id-ID"): string {
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(amount);
}

/**
 * Splits `total` in proportion to `weights` using the largest-remainder method.
 * Ties on the remainder go to the earlier index, so the result is stable for
 * the same input order.
 */
export function allocate(total: Rupiah, weights: readonly number[]): Rupiah[] {
  if (!isRupiah(total)) throw new RangeError(`Invalid amount: ${total}`);
  if (weights.length === 0) throw new RangeError("Need at least one weight");
  if (weights.some((w) => !Number.isFinite(w) || w < 0)) {
    throw new RangeError("Weights must be non-negative numbers");
  }

  const weightSum = weights.reduce((sum, w) => sum + w, 0);
  if (weightSum === 0) {
    if (total === 0) return weights.map(() => 0);
    throw new RangeError("Cannot allocate a non-zero total over zero weights");
  }

  const exact = weights.map((w) => (total * w) / weightSum);
  const parts = exact.map(Math.floor);
  let leftover = total - parts.reduce((sum, p) => sum + p, 0);

  const order = exact
    .map((value, index) => ({ index, remainder: value - Math.floor(value) }))
    .sort((a, b) => b.remainder - a.remainder || a.index - b.index);

  for (let i = 0; leftover > 0; i += 1, leftover -= 1) {
    parts[order[i % order.length].index] += 1;
  }
  return parts;
}
