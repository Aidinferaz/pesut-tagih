import "server-only";
import type { Locale } from "./config";
import type { Dictionary } from "./dictionaries/id";

const loaders: Record<Locale, () => Promise<Dictionary>> = {
  id: () => import("./dictionaries/id").then((m) => m.id),
  en: () => import("./dictionaries/en").then((m) => m.en),
};

export function getDictionary(locale: Locale): Promise<Dictionary> {
  return loaders[locale]();
}
