/**
 * Banks and e-wallets people can receive money on. The codes are stored in the
 * database (`payment_methods.provider`), so a new provider needs a matching
 * migration that extends the check constraint.
 */

export type ProviderKind = "bank" | "ewallet";

export const PROVIDERS = [
  { code: "bca", name: "BCA", kind: "bank" },
  { code: "mandiri", name: "Mandiri", kind: "bank" },
  { code: "bni", name: "BNI", kind: "bank" },
  { code: "bri", name: "BRI", kind: "bank" },
  { code: "bsi", name: "BSI", kind: "bank" },
  { code: "cimb", name: "CIMB Niaga", kind: "bank" },
  { code: "permata", name: "Permata", kind: "bank" },
  { code: "btn", name: "BTN", kind: "bank" },
  { code: "danamon", name: "Danamon", kind: "bank" },
  { code: "jago", name: "Bank Jago", kind: "bank" },
  { code: "seabank", name: "SeaBank", kind: "bank" },
  { code: "blu", name: "blu by BCA", kind: "bank" },
  { code: "jenius", name: "Jenius", kind: "bank" },
  { code: "superbank", name: "Superbank", kind: "bank" },
  { code: "gopay", name: "GoPay", kind: "ewallet" },
  { code: "ovo", name: "OVO", kind: "ewallet" },
  { code: "dana", name: "DANA", kind: "ewallet" },
  { code: "shopeepay", name: "ShopeePay", kind: "ewallet" },
  { code: "linkaja", name: "LinkAja", kind: "ewallet" },
] as const satisfies readonly { code: string; name: string; kind: ProviderKind }[];

export type ProviderCode = (typeof PROVIDERS)[number]["code"];

export const PROVIDER_CODES = PROVIDERS.map((p) => p.code) as [ProviderCode, ...ProviderCode[]];

export function providerName(code: ProviderCode): string {
  return PROVIDERS.find((p) => p.code === code)?.name ?? code;
}

/**
 * Rough cost of a transfer between two different providers. BI-FAST is the
 * common case today; adjust here if fees change. Same-provider transfers are
 * treated as free.
 */
export const CROSS_PROVIDER_FEE = 2_500;
