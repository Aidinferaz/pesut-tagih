"use client";

import { Monitor, Moon, Sun } from "lucide-react";
import { useSyncExternalStore } from "react";
import { useI18n } from "@/i18n/provider";
import { subscribeTheme } from "@/lib/browser";
import { THEME_STORAGE_KEY, type ThemeChoice } from "@/lib/theme";

function apply(choice: ThemeChoice) {
  const root = document.documentElement;
  if (choice === "system") delete root.dataset.theme;
  else root.dataset.theme = choice;
  try {
    if (choice === "system") localStorage.removeItem(THEME_STORAGE_KEY);
    else localStorage.setItem(THEME_STORAGE_KEY, choice);
  } catch {
    // Storage can be blocked; the choice still applies for this visit.
  }
}

function readChoice(): ThemeChoice {
  const value = document.documentElement.dataset.theme;
  return value === "light" || value === "dark" ? value : "system";
}

const OPTIONS = [
  { value: "light", icon: Sun },
  { value: "dark", icon: Moon },
  { value: "system", icon: Monitor },
] as const;

export function ThemeSwitch({ tone = "rail" }: { tone?: "rail" | "surface" }) {
  const { t } = useI18n();
  const choice = useSyncExternalStore(subscribeTheme, readChoice, () => "system" as const);
  const select = (value: ThemeChoice) => apply(value);

  const idle =
    tone === "rail" ? "text-rail-ink-soft hover:text-rail-ink" : "text-muted hover:text-ink";
  const on = tone === "rail" ? "bg-rail-deep text-rail-ink" : "bg-surface-sunk text-ink";

  return (
    <div role="radiogroup" aria-label={t.theme.label} className="inline-flex gap-1">
      {OPTIONS.map(({ value, icon: Icon }) => (
        <button
          key={value}
          type="button"
          role="radio"
          aria-checked={choice === value}
          aria-label={t.theme[value]}
          title={t.theme[value]}
          onClick={() => select(value)}
          className={`grid size-9 place-items-center rounded-md transition-colors ${choice === value ? on : idle}`}
        >
          <Icon className="size-[18px]" strokeWidth={2.25} aria-hidden />
        </button>
      ))}
    </div>
  );
}
