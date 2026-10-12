"use client";

import { Bell, BellOff, BellRing, Send } from "lucide-react";
import { useActionState, useEffect, useState, useSyncExternalStore, useTransition } from "react";
import { Field, FormMessage, TextInput } from "@/components/forms/fields";
import { Button } from "@/components/ui/Button";
import { Panel, PanelTitle } from "@/components/ui/Panel";
import { format } from "@/i18n/format";
import { useI18n } from "@/i18n/provider";
import {
  createTelegramLink,
  removePushSubscription,
  savePushSubscription,
  sendTestNotice,
  unlinkTelegram,
  updateChannels,
} from "@/server/actions/notifications";
import type { FormState } from "@/server/actions/state";

type Props = {
  telegramBot: boolean;
  telegramLinked: boolean;
  vapidKey: string | null;
  whatsappGateway: boolean;
  channels: { waNumber: string; telegram: boolean; push: boolean; whatsapp: boolean };
};

const noop = () => () => {};

type PushState = "unknown" | "unsupported" | "denied" | "off" | "on";

function base64ToBytes(base64: string) {
  const padded = (base64 + "=".repeat((4 - (base64.length % 4)) % 4))
    .replace(/-/g, "+")
    .replace(/_/g, "/");
  return Uint8Array.from(atob(padded), (c) => c.charCodeAt(0));
}

export function NotificationsPanel({
  telegramBot,
  telegramLinked,
  vapidKey,
  whatsappGateway,
  channels,
}: Props) {
  const { t, locale } = useI18n();
  const [state, action, pending] = useActionState<FormState, FormData>(updateChannels, {
    status: "idle",
  });
  const supported = useSyncExternalStore(
    noop,
    () => "serviceWorker" in navigator && "PushManager" in window && "Notification" in window,
    () => true,
  );
  const [subscribed, setSubscribed] = useState<PushState>("unknown");
  const push: PushState = !supported ? "unsupported" : subscribed;
  const [busy, startBusy] = useTransition();
  const [linkError, setLinkError] = useState(false);
  const [test, setTest] = useState<FormState<{ delivered: number }>>({ status: "idle" });

  // What this browser can do, and whether it's already subscribed.
  useEffect(() => {
    if (!supported || !vapidKey) return;
    navigator.serviceWorker
      .register("/sw.js")
      .then((reg) => reg.pushManager.getSubscription())
      .then((sub) =>
        setSubscribed(sub ? "on" : Notification.permission === "denied" ? "denied" : "off"),
      )
      .catch(() => setSubscribed("unsupported"));
  }, [supported, vapidKey]);

  const enablePush = () =>
    startBusy(async () => {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        setSubscribed("denied");
        return;
      }
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: base64ToBytes(vapidKey!),
      });
      setSubscribed((await savePushSubscription(sub.toJSON())) ? "on" : "off");
    });

  const disablePush = () =>
    startBusy(async () => {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      if (sub) {
        await removePushSubscription(sub.endpoint);
        await sub.unsubscribe();
      }
      setSubscribed("off");
    });

  const connectTelegram = () =>
    startBusy(async () => {
      const result = await createTelegramLink();
      if (result.status === "ok") window.open(result.data.url, "_blank", "noopener,noreferrer");
      else setLinkError(true);
    });

  const sendTest = () => startBusy(async () => setTest(await sendTestNotice()));

  return (
    <Panel aria-labelledby="notifications-title">
      <PanelTitle id="notifications-title">{t.notifications.title}</PanelTitle>
      <p className="text-ink-soft mt-2 max-w-prose">{t.notifications.body}</p>

      <div className="mt-5 grid gap-5">
        {telegramBot && (
          <section className="border-line grid gap-2 border-t-2 pt-4">
            <h3 className="font-bold">{t.notifications.telegram}</h3>
            {telegramLinked ? (
              <form action={unlinkTelegram} className="flex flex-wrap items-center gap-3">
                <input type="hidden" name="lang" value={locale} />
                <span className="text-credit font-semibold">{t.notifications.telegramLinked}</span>
                <Button type="submit" variant="ghost" className="text-sm">
                  {t.notifications.telegramUnlink}
                </Button>
              </form>
            ) : (
              <div className="grid gap-2">
                <div>
                  <Button variant="outline" onClick={connectTelegram} disabled={busy}>
                    <Send className="size-4" aria-hidden />
                    {t.notifications.telegramConnect}
                  </Button>
                </div>
                <p className="text-ink-soft text-sm">{t.notifications.telegramOpen}</p>
                {linkError && <FormMessage tone="error">{t.errors.unknown}</FormMessage>}
              </div>
            )}
          </section>
        )}

        {vapidKey && (
          <section className="border-line grid gap-2 border-t-2 pt-4">
            <h3 className="font-bold">{t.notifications.push}</h3>
            {push === "unsupported" ? (
              <p className="text-ink-soft text-sm">{t.notifications.pushUnsupported}</p>
            ) : push === "denied" ? (
              <p className="text-debt text-sm">{t.notifications.pushDenied}</p>
            ) : push === "on" ? (
              <div className="flex flex-wrap items-center gap-3">
                <span className="text-credit font-semibold">{t.notifications.pushEnabled}</span>
                <Button variant="ghost" className="text-sm" onClick={disablePush} disabled={busy}>
                  <BellOff className="size-4" aria-hidden />
                  {t.notifications.pushDisable}
                </Button>
              </div>
            ) : (
              <div>
                <Button
                  variant="outline"
                  onClick={enablePush}
                  disabled={busy || push === "unknown"}
                >
                  <Bell className="size-4" aria-hidden />
                  {t.notifications.pushEnable}
                </Button>
              </div>
            )}
          </section>
        )}

        <form action={action} className="border-line grid gap-4 border-t-2 pt-4">
          <input type="hidden" name="lang" value={locale} />
          <h3 className="font-bold">{t.notifications.whatsapp}</h3>
          {!whatsappGateway && <p className="text-ink-soft text-sm">{t.notifications.waOff}</p>}
          <Field
            id="wa-number"
            label={t.notifications.waNumber}
            error={
              state.status === "error" && state.field === "waNumber" ? t.errors.invalid : undefined
            }
          >
            <TextInput
              id="wa-number"
              name="waNumber"
              defaultValue={channels.waNumber}
              inputMode="tel"
              autoComplete="tel"
              aria-describedby="wa-hint"
            />
          </Field>
          <p id="wa-hint" className="text-muted -mt-2 text-sm">
            {t.notifications.waHint}
          </p>
          {/* Channels this server can't deliver on keep their saved choice. */}
          {!telegramBot && channels.telegram && <input type="hidden" name="telegram" value="on" />}
          {!vapidKey && channels.push && <input type="hidden" name="push" value="on" />}
          {!whatsappGateway && channels.whatsapp && (
            <input type="hidden" name="whatsapp" value="on" />
          )}
          <fieldset className="grid gap-2">
            {(
              [
                ["telegram", t.notifications.telegram, channels.telegram, telegramBot],
                ["push", t.notifications.push, channels.push, Boolean(vapidKey)],
                ["whatsapp", t.notifications.whatsapp, channels.whatsapp, whatsappGateway],
              ] as const
            )
              .filter(([, , , available]) => available)
              .map(([name, label, checked]) => (
                <label key={name} className="flex items-center gap-3 font-semibold">
                  <input
                    type="checkbox"
                    name={name}
                    defaultChecked={checked}
                    className="size-5 accent-[var(--plate)]"
                  />
                  {format(t.notifications.receive, { channel: label })}
                </label>
              ))}
          </fieldset>
          <div className="flex items-center gap-3">
            <Button type="submit" disabled={pending}>
              {t.notifications.save}
            </Button>
            {state.status === "ok" && <FormMessage tone="ok">{t.notifications.saved}</FormMessage>}
          </div>
        </form>

        {(telegramBot || vapidKey || whatsappGateway) && (
          <section className="border-line grid gap-2 border-t-2 pt-4">
            <div>
              <Button variant="outline" onClick={sendTest} disabled={busy}>
                <BellRing className="size-4" aria-hidden />
                {t.notifications.test}
              </Button>
            </div>
            <p className="text-ink-soft text-sm">{t.notifications.testHint}</p>
            <div aria-live="polite">
              {test.status === "ok" &&
                (test.data.delivered > 0 ? (
                  <FormMessage tone="ok">
                    {format(t.notifications.testSent, { count: test.data.delivered })}
                  </FormMessage>
                ) : (
                  <FormMessage tone="error">{t.notifications.testNone}</FormMessage>
                ))}
              {test.status === "error" && (
                <FormMessage tone="error">{t.errors[test.error]}</FormMessage>
              )}
            </div>
          </section>
        )}
      </div>
    </Panel>
  );
}
