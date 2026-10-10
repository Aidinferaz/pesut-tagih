import { createHash, timingSafeEqual } from "node:crypto";
import { z } from "zod";
import type { Locale } from "@/i18n/config";
import { env } from "@/server/env";
import { sendTelegram } from "@/server/notify/channels/telegram";
import { eventText } from "@/server/notify/messages";
import { supabaseAdmin } from "@/server/supabase/admin";

/**
 * Telegram's webhook. It only links things: a person's private chat
 * (/start <token>, from the app's "Connect Telegram" button), a group chat
 * (/hubungkan <code>, created by a group admin), and /stop to unlink. Every
 * call must carry the secret token Telegram was configured with.
 */
const Update = z.object({
  message: z
    .object({
      text: z.string().optional(),
      chat: z.object({ id: z.number(), type: z.string() }),
      from: z.object({ language_code: z.string().optional() }).optional(),
    })
    .optional(),
});

const sha256 = (token: string) => `\\x${createHash("sha256").update(token).digest("hex")}`;

function authorized(request: Request) {
  const given = Buffer.from(request.headers.get("x-telegram-bot-api-secret-token") ?? "");
  const expected = Buffer.from(env.TELEGRAM_WEBHOOK_SECRET ?? "");
  return (
    expected.length > 0 && given.length === expected.length && timingSafeEqual(given, expected)
  );
}

export async function POST(request: Request) {
  if (!env.TELEGRAM_BOT_TOKEN || !authorized(request))
    return new Response("Unauthorized", { status: 401 });
  const update = Update.safeParse(await request.json().catch(() => null));
  const message = update.success ? update.data.message : undefined;
  if (!message?.text) return Response.json({ ok: true });

  const locale: Locale = message.from?.language_code?.startsWith("en") ? "en" : "id";
  const [command, argument = ""] = message.text.trim().split(/\s+/, 2);
  const name = command.split("@")[0].toLowerCase();
  const chatId = message.chat.id;
  const isPrivate = message.chat.type === "private";
  const db = supabaseAdmin();

  if (isPrivate && name === "/start") {
    if (!/^[0-9a-f]{48}$/.test(argument)) {
      await sendTelegram(chatId, eventText(locale, "linkHelp"));
      return Response.json({ ok: true });
    }
    const { data: link } = await db
      .from("telegram_link_tokens")
      .delete()
      .eq("token_hash", sha256(argument))
      .gt("expires_at", new Date().toISOString())
      .select("user_id")
      .maybeSingle();
    if (link) {
      // One Telegram chat belongs to one account.
      await db
        .from("contact_channels")
        .update({ telegram_chat_id: null })
        .eq("telegram_chat_id", chatId);
      await db
        .from("contact_channels")
        .update({ telegram_chat_id: chatId })
        .eq("user_id", link.user_id);
    }
    await sendTelegram(chatId, eventText(locale, link ? "linked" : "linkHelp"));
  } else if (isPrivate && name === "/stop") {
    await db
      .from("contact_channels")
      .update({ telegram_chat_id: null })
      .eq("telegram_chat_id", chatId);
    await sendTelegram(chatId, eventText(locale, "unlinked"));
  } else if (!isPrivate && (name === "/hubungkan" || name === "/link")) {
    if (!/^[0-9a-f]{24}$/.test(argument)) {
      await sendTelegram(chatId, eventText(locale, "groupLinkHelp"));
      return Response.json({ ok: true });
    }
    const { data: link } = await db
      .from("telegram_group_links")
      .delete()
      .eq("token_hash", sha256(argument))
      .gt("expires_at", new Date().toISOString())
      .select("group_id, groups (name)")
      .maybeSingle();
    if (link) {
      await db.from("groups").update({ telegram_chat_id: null }).eq("telegram_chat_id", chatId);
      await db.from("groups").update({ telegram_chat_id: chatId }).eq("id", link.group_id);
      await sendTelegram(chatId, eventText(locale, "groupLinked", { group: link.groups.name }));
    } else {
      await sendTelegram(chatId, eventText(locale, "groupLinkHelp"));
    }
  }
  return Response.json({ ok: true });
}
