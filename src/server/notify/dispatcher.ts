import "server-only";
import { isLocale, type Locale } from "@/i18n/config";
import { env } from "@/server/env";
import { supabaseAdmin } from "@/server/supabase/admin";
import { sendWhatsApp, whatsappEnabled } from "./channels/fonnte";
import { sendTelegram, telegramEnabled } from "./channels/telegram";
import { pushEnabled, sendPush } from "./channels/webpush";
import { eventText } from "./messages";

export type Notice = {
  /** What kind of notice, for the log: "reminder", "expense", "paid", ... */
  kind: string;
  /** Same key, same notice: a key that was already sent is skipped. */
  dedupeKey: string;
  groupId: string | null;
  title: string;
  /** Built per recipient, in their language. */
  text: (locale: Locale) => string;
  /** Path inside the app, e.g. /groups/<id>. The locale prefix is added. */
  path: string;
};

type Channel = "telegram" | "push" | "whatsapp";

/**
 * Delivers one notice to one person on every channel they've switched on.
 * Runs with the secret key (cron, after-response hooks), never on behalf of a
 * browser request. Each (notice, channel) pair is claimed in notification_log
 * first, so retries and overlapping runs never double-send. Returns how many
 * channels delivered it.
 */
export async function notifyUser(userId: string, notice: Notice): Promise<number> {
  const db = supabaseAdmin();
  const [{ data: profile }, { data: channels }, { data: devices }] = await Promise.all([
    db.from("profiles").select("locale").eq("id", userId).maybeSingle(),
    db.from("contact_channels").select("*").eq("user_id", userId).maybeSingle(),
    db.from("push_subscriptions").select("id, endpoint, p256dh, auth").eq("user_id", userId),
  ]);
  if (!profile || !channels) return 0;
  const locale: Locale = isLocale(profile.locale) ? profile.locale : "id";
  const url = `${env.NEXT_PUBLIC_SITE_URL}/${locale}${notice.path}`;
  const text = notice.text(locale);

  const attempts: [Channel, () => Promise<boolean>][] = [];
  if (telegramEnabled() && channels.notify_telegram && channels.telegram_chat_id) {
    const chatId = channels.telegram_chat_id;
    attempts.push([
      "telegram",
      () => sendTelegram(chatId, text, [{ text: eventText(locale, "open"), url }]),
    ]);
  }
  if (pushEnabled() && channels.notify_push && devices?.length) {
    attempts.push([
      "push",
      async () => {
        const result = await sendPush(devices, {
          title: notice.title,
          body: text,
          url,
          tag: notice.dedupeKey,
        });
        if (result.dead.length) await db.from("push_subscriptions").delete().in("id", result.dead);
        return result.ok;
      },
    ]);
  }
  if (whatsappEnabled() && channels.notify_whatsapp && channels.wa_number) {
    const number = channels.wa_number;
    attempts.push(["whatsapp", () => sendWhatsApp(number, `${text}\n${url}`)]);
  }

  let delivered = 0;
  for (const [channel, send] of attempts) {
    const dedupe = `${notice.dedupeKey}:${channel}`;
    const { data: claimed } = await db
      .from("notification_log")
      .upsert(
        {
          user_id: userId,
          group_id: notice.groupId,
          kind: notice.kind,
          dedupe_key: dedupe,
          channel,
          ok: false,
        },
        { onConflict: "dedupe_key", ignoreDuplicates: true },
      )
      .select("id");
    if (!claimed?.length) continue;
    const ok = await send().catch(() => false);
    if (ok) delivered += 1;
    await db
      .from("notification_log")
      .update({ ok, error: ok ? null : "send failed" })
      .eq("id", claimed[0].id);
  }
  return delivered;
}

/** Posts to a group's linked Telegram chat, once per dedupe key. */
export async function notifyGroupChat(
  groupId: string,
  chatId: number,
  dedupeKey: string,
  text: string,
  url: string,
  button: string,
) {
  const db = supabaseAdmin();
  const { data: claimed } = await db
    .from("notification_log")
    .upsert(
      {
        group_id: groupId,
        kind: "recap",
        dedupe_key: dedupeKey,
        channel: "telegram_group",
        ok: false,
      },
      { onConflict: "dedupe_key", ignoreDuplicates: true },
    )
    .select("id");
  if (!claimed?.length) return;
  const ok = await sendTelegram(chatId, text, [{ text: button, url }]);
  await db.from("notification_log").update({ ok }).eq("id", claimed[0].id);
}
