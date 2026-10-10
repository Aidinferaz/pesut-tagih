export const locales = ["id", "en"] as const;
export type Locale = (typeof locales)[number];
export const defaultLocale: Locale = "id";

export function isLocale(value: string): value is Locale {
  return (locales as readonly string[]).includes(value);
}

/** BCP 47 tag for Intl formatting. */
export const intlLocale: Record<Locale, string> = { id: "id-ID", en: "en-US" };

/** Set when someone picks a language explicitly; read by the proxy. */
export const LOCALE_COOKIE = "pesut-locale";
