import "server-only";
import { debtAgeDays } from "@/domain/ledger";
import { shouldRemind } from "@/domain/reminders";
import { isLocale, type Locale } from "@/i18n/config";
import { rupiah } from "@/lib/format";
import { env } from "@/server/env";
import { supabaseAdmin } from "@/server/supabase/admin";
import { loadAllBooks } from "./books";
import { notifyGroupChat, notifyUser } from "./dispatcher";
import { expenseLogged } from "./events";
import { eventText, reminderText } from "./messages";

const witaDate = (now: number) =>
  new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Makassar" }).format(now);
const isMondayWita = (now: number) =>
  new Intl.DateTimeFormat("en-US", { timeZone: "Asia/Makassar", weekday: "short" }).format(now) ===
  "Mon";

/**
 * The once-a-day job (Vercel Cron, 09:00 WITA):
 * 1. turn due monthly bills into expenses and tell the people on them,
 * 2. confirm transfers receivers ignored past the grace period,
 * 3. remind everyone who owes money, on the group's schedule,
 * 4. on Mondays, post a recap to each linked Telegram group.
 * Every send is de-duplicated per day, so running it twice is harmless.
 */
export async function runDaily(now = Date.now()) {
  const db = supabaseAdmin();
  const today = witaDate(now);

  const { data: billsMade } = await db.rpc("run_recurring_bills");
  const { data: fresh } = await db
    .from("expenses")
    .select("id")
    .not("recurring_bill_id", "is", null)
    .gte("created_at", new Date(now - 26 * 60 * 60 * 1000).toISOString());
  for (const e of fresh ?? []) await expenseLogged(e.id);

  const { data: autoConfirmed } = await db.rpc("auto_confirm_settlements");

  let reminders = 0;
  let recaps = 0;
  for (const book of await loadAllBooks()) {
    const { group, members } = book;
    const nameOf = (id: string) => members.find((m) => m.id === id)?.name ?? "?";

    for (const route of book.transfers) {
      const age = debtAgeDays(route.from, book.expenses, book.settlements, now);
      if (!shouldRemind(age, group.reminder_after_days, group.reminder_repeat_days)) continue;
      reminders += 1;
      await notifyUser(route.from, {
        kind: "reminder",
        dedupeKey: `remind:${group.id}:${route.from}:${route.to}:${today}`,
        groupId: group.id,
        title: group.name,
        path: `/groups/${group.id}`,
        text: (locale: Locale) =>
          reminderText(
            locale,
            {
              name: nameOf(route.from),
              amount: rupiah(route.amount, locale),
              creditor: nameOf(route.to),
              group: group.name,
              days: age,
            },
            `${route.from}${route.to}${today}`,
          ),
      });
    }

    if (isMondayWita(now) && group.telegram_chat_id) {
      const locale: Locale = members.map((m) => m.locale).find(isLocale) ?? "id";
      const lines = book.transfers.map((r) =>
        eventText(locale, group.telegram_recap_amounts ? "recapLineAmount" : "recapLine", {
          from: nameOf(r.from),
          to: nameOf(r.to),
          amount: rupiah(r.amount, locale),
        }),
      );
      const text = [
        eventText(locale, "recapTitle", { group: group.name }),
        ...(lines.length ? lines : [eventText(locale, "recapEmpty")]),
      ].join("\n");
      await notifyGroupChat(
        group.id,
        group.telegram_chat_id,
        `recap:${group.id}:${today}`,
        text,
        `${env.NEXT_PUBLIC_SITE_URL}/${locale}/groups/${group.id}`,
        eventText(locale, "open"),
      );
      recaps += 1;
    }
  }

  return { today, billsMade: billsMade ?? 0, autoConfirmed: autoConfirmed ?? 0, reminders, recaps };
}
