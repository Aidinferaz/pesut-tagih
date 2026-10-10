import { expect, type Page } from "@playwright/test";

const MAILPIT = process.env.MAILPIT_URL ?? "http://127.0.0.1:58324";

type MailSummary = { ID: string; To: { Address: string }[]; Created: string };

/** Waits for the newest email to `address` and returns the first link in it. */
async function magicLinkFor(address: string, since: number): Promise<string> {
  for (let attempt = 0; attempt < 30; attempt += 1) {
    const list = (await (await fetch(`${MAILPIT}/api/v1/messages?limit=50`)).json()) as {
      messages: MailSummary[];
    };
    const mail = list.messages.find(
      (m) => m.To.some((to) => to.Address === address) && Date.parse(m.Created) >= since - 1000,
    );
    if (mail) {
      const body = (await (await fetch(`${MAILPIT}/api/v1/message/${mail.ID}`)).json()) as {
        Text: string;
      };
      const link = body.Text.match(/https?:\/\/\S+verify\S+/)?.[0];
      if (link) return link.replace(/[)>\]]+$/, "");
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error(`No sign-in email for ${address}`);
}

export function uniqueEmail(name: string) {
  return `${name}.${Date.now()}.${Math.floor(Math.random() * 1e6)}@example.com`;
}

/** Signs in through the development email form and lands on the app. */
export async function signIn(page: Page, email: string, lang = "id", next?: string) {
  const since = Date.now();
  await page.goto(next ? `/${lang}?next=${encodeURIComponent(next)}` : `/${lang}`);
  await page.locator("#dev-email").fill(email);
  await page.locator("#dev-email").press("Enter");
  await expect(page.getByText(/Mailpit/)).toBeVisible();
  await page.goto(await magicLinkFor(email, since));
}
