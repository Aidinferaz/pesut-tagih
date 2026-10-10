"use client";

import { format } from "@/i18n/format";
import { useI18n } from "@/i18n/provider";
import { useClock } from "@/lib/browser";

type Part = "morning" | "afternoon" | "evening" | "night";

/** Indonesian time-of-day greeting, computed on the person's own clock. */
function partOfDay(hour: number): Part {
  if (hour >= 4 && hour < 11) return "morning";
  if (hour >= 11 && hour < 15) return "afternoon";
  if (hour >= 15 && hour < 18) return "evening";
  return "night";
}

export function Greeting({ name }: { name: string }) {
  const { t } = useI18n();
  const part = useClock<Part | null>(() => partOfDay(new Date().getHours()), null);
  return (
    <h1 className="display text-[2.5rem] uppercase sm:text-[3rem]">
      {format(t.greeting[part ?? "night"], { name })}
    </h1>
  );
}
