import "server-only";
import webpush from "web-push";
import { env } from "@/server/env";

export type PushTarget = { id: string; endpoint: string; p256dh: string; auth: string };
export type PushPayload = { title: string; body: string; url: string; tag?: string };

export const pushEnabled = () =>
  Boolean(env.VAPID_PRIVATE_KEY && env.NEXT_PUBLIC_VAPID_PUBLIC_KEY && env.VAPID_SUBJECT);

/**
 * Sends to every device of one person. Returns which subscriptions are dead
 * (the browser unsubscribed) so the caller can forget them.
 */
export async function sendPush(targets: PushTarget[], payload: PushPayload) {
  if (!pushEnabled() || targets.length === 0) return { ok: false, dead: [] as string[] };
  webpush.setVapidDetails(
    env.VAPID_SUBJECT!,
    env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!,
    env.VAPID_PRIVATE_KEY!,
  );
  const dead: string[] = [];
  let delivered = 0;
  await Promise.all(
    targets.map(async (t) => {
      try {
        await webpush.sendNotification(
          { endpoint: t.endpoint, keys: { p256dh: t.p256dh, auth: t.auth } },
          JSON.stringify(payload),
          { TTL: 60 * 60 * 24, timeout: 10_000 },
        );
        delivered += 1;
      } catch (error) {
        const status = (error as { statusCode?: number }).statusCode;
        if (status === 404 || status === 410) dead.push(t.id);
      }
    }),
  );
  return { ok: delivered > 0, dead };
}
