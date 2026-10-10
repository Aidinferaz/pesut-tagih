import path from "node:path";
import { expect, test, type Page } from "@playwright/test";
import { signIn, uniqueEmail } from "./helpers";

// These run against AI_PROVIDER=mock: canned, free answers, no real model.

async function soloGroup(page: Page, name: string) {
  await page.goto("/id/groups/new");
  await page.getByLabel("Nama grup").fill(name);
  await page.getByRole("button", { name: "Buat grup" }).click();
  await expect(page.getByRole("heading", { name, exact: true })).toBeVisible();
  return new URL(page.url()).pathname;
}

test("Pesut answers in the chat", async ({ page }) => {
  await signIn(page, uniqueEmail("chatty"));
  await page.goto("/id/chat");
  await page.getByLabel("Tanya soal utang, atau suruh catat urunan…").fill("Aku utang berapa?");
  await page.getByRole("button", { name: "Kirim" }).click();
  await expect(page.getByText(/Pesut \(mode uji\) dengar: "Aku utang berapa\?"/)).toBeVisible();
});

test("a receipt photo fills the itemised form", async ({ page }) => {
  await signIn(page, uniqueEmail("scanner"));
  const group = await soloGroup(page, "Warung");
  await page.goto(`${group}/expenses/new`);
  // Wait for hydration: the amount hint only appears once React is running.
  await page.getByLabel("Total").fill("1");
  await expect(page.getByText("= Rp1")).toBeVisible();
  await page
    .locator('input[type="file"][capture]')
    .setInputFiles(path.join(__dirname, "fixtures/receipt.png"));
  await expect(page.getByText("Terbaca dari struk Warung Uji")).toBeVisible();
  await expect(page.getByLabel("Nama item").first()).toHaveValue("Nasi goreng");
  await expect(page.getByLabel("Pajak")).toHaveValue("3000");
  await expect(page.getByLabel("Untuk apa?")).toHaveValue("Warung Uji");
});

test("a typed sentence fills the form", async ({ page }) => {
  await signIn(page, uniqueEmail("typist"));
  const group = await soloGroup(page, "Bakso");
  await page.goto(`${group}/expenses/new`);
  await page.getByLabel("Atau tulis saja").fill("bakso 120rb aku yang bayar");
  await page.getByRole("button", { name: "Isi otomatis" }).click();
  await expect(page.getByLabel("Untuk apa?")).toHaveValue("Bakso");
  await expect(page.getByLabel("Total")).toHaveValue("120000");
});
