import "server-only";
import { env } from "@/server/env";

/**
 * WhatsApp through Fonnte (an unofficial gateway on a dedicated number).
 * It breaks WhatsApp's terms, so the number can be banned: keep it separate
 * from anyone's personal number. When this fails, people still have the
 * wa.me share buttons in the app.
 */
export const whatsappEnabled = () => env.WA_GATEWAY === "fonnte" && Boolean(env.FONNTE_TOKEN);

export async function sendWhatsApp(number: string, text: string): Promise<boolean> {
  if (!whatsappEnabled()) return false;
  const body = new URLSearchParams({
    target: number,
    message: text.slice(0, 1500),
    countryCode: "62",
  });
  const response = await fetch("https://api.fonnte.com/send", {
    method: "POST",
    headers: { Authorization: env.FONNTE_TOKEN! },
    body,
    signal: AbortSignal.timeout(15_000),
  }).catch(() => null);
  if (!response?.ok) return false;
  const result = (await response.json().catch(() => null)) as { status?: boolean } | null;
  return result?.status === true;
}
