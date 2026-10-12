import { expect, test } from "@playwright/test";
import { signIn, uniqueEmail } from "./helpers";

// Uses the fake bot configured for development: Telegram itself is never reached
// for linking; the test plays Telegram by calling the webhook directly.
const WEBHOOK_SECRET = "local-webhook-secret";
const CRON_SECRET = "local-cron-secret";

test("connecting Telegram through the bot's /start link", async ({ page, request }) => {
  await signIn(page, uniqueEmail("tele"));
  await page.goto("/id/settings");
  const popup = page.waitForEvent("popup");
  await page.getByRole("button", { name: "Sambungkan Telegram" }).click();
  const link = new URL((await popup).url());
  expect(link.host).toBe("t.me");
  const token = link.searchParams.get("start")!;
  expect(token).toMatch(/^[0-9a-f]{48}$/);

  const update = (secret: string) =>
    request.post("/api/telegram/webhook", {
      headers: { "x-telegram-bot-api-secret-token": secret },
      data: { message: { text: `/start ${token}`, chat: { id: Date.now(), type: "private" } } },
    });
  expect((await update("wrong-secret")).status()).toBe(401);
  expect((await update(WEBHOOK_SECRET)).status()).toBe(200);

  await page.reload();
  await expect(page.getByText("Tersambung", { exact: true })).toBeVisible();
});

test("a test notification says when nothing could be sent", async ({ page }) => {
  await signIn(page, uniqueEmail("tester"));
  await page.goto("/id/settings");
  await page.getByRole("button", { name: "Kirim notifikasi uji" }).click();
  await expect(page.getByText(/Belum ada yang terkirim/)).toBeVisible();
});

test("the daily job only runs for Vercel Cron", async ({ request }) => {
  expect((await request.get("/api/cron/daily")).status()).toBe(401);
  const run = await request.get("/api/cron/daily", {
    headers: { authorization: `Bearer ${CRON_SECRET}` },
  });
  expect(run.status()).toBe(200);
  expect(await run.json()).toMatchObject({ today: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/) });
});

test("the app can be installed", async ({ request }) => {
  const manifest = await (await request.get("/manifest.webmanifest")).json();
  expect(manifest.name).toBe("Pesut Tagih");
  const icon = await request.get(manifest.icons[0].src);
  expect(icon.headers()["content-type"]).toBe("image/png");
});
