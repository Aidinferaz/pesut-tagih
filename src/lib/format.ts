import { intlLocale, type Locale } from "@/i18n/config";

const MINUS = "−";

/** "Rp108.500", "−Rp51.000". Whole rupiah, grouped for the locale, no space after Rp. */
export function rupiah(amount: number, locale: Locale, { signed = false } = {}): string {
  const digits = new Intl.NumberFormat(intlLocale[locale], { maximumFractionDigits: 0 }).format(
    Math.abs(amount),
  );
  const sign = amount < 0 ? MINUS : signed && amount > 0 ? "+" : "";
  return `${sign}Rp${digits}`;
}

/** Registration number painted on every record, e.g. PT-0141. */
export function plateNumber(prefix: string, n: number): string {
  return `${prefix}-${String(n).padStart(4, "0")}`;
}
