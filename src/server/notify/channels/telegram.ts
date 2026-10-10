import "server-only";
import { env } from "@/server/env";

export type TelegramButton = { text: string; url: string };

export const telegramEnabled = () => Boolean(env.TELEGRAM_BOT_TOKEN);

/** Plain-text message (no HTML parsing, so names typed by users can't inject markup), with optional link buttons. */
export async function sendTelegram(
  chatId: number,
  text: string,
  buttons: TelegramButton[] = [],
): Promise<boolean> {
  if (!env.TELEGRAM_BOT_TOKEN) return false;
  const response = await fetch(
    `https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/sendMessage`,
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text: text.slice(0, 4000),
        disable_web_page_preview: true,
        ...(buttons.length && {
          reply_markup: { inline_keyboard: [buttons.map((b) => ({ text: b.text, url: b.url }))] },
        }),
      }),
      signal: AbortSignal.timeout(10_000),
    },
  ).catch(() => null);
  return response?.ok ?? false;
}
