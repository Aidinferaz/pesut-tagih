import { expect, test } from "@playwright/test";
import { signIn, uniqueEmail } from "./helpers";

test("a new person creates a group, invites a friend, and the friend joins", async ({
  browser,
}) => {
  const alice = await browser.newPage();
  await signIn(alice, uniqueEmail("alice"));
  await expect(alice).toHaveURL(/\/id\/home$/);
  await expect(alice.getByRole("heading", { name: "Belum ada grup" })).toBeVisible();

  await alice.getByRole("link", { name: "Buat grup" }).first().click();
  await alice.getByLabel("Nama grup").fill("Trip Derawan");
  await alice.getByText("Oranye pelampung").click();
  await alice.getByRole("button", { name: "Buat grup" }).click();
  await expect(alice.getByRole("heading", { name: "Trip Derawan", exact: true })).toBeVisible();

  await alice.getByRole("link", { name: "Anggota & undangan" }).click();
  await alice.getByRole("button", { name: "Buat link undangan" }).click();
  const invite = await alice.getByRole("textbox", { name: "Undang teman" }).inputValue();
  expect(invite).toMatch(/\/id\/join\/[0-9a-f]{64}$/);

  const bob = await browser.newPage();
  const path = new URL(invite).pathname;
  await bob.goto(path);
  await expect(bob.getByRole("heading", { name: "Masuk dulu untuk bergabung." })).toBeVisible();
  await signIn(bob, uniqueEmail("bob"), "id", path);
  await expect(bob.getByRole("heading", { name: "Undangan ke Trip Derawan" })).toBeVisible();
  await bob.getByRole("button", { name: "Gabung grup" }).click();
  await expect(bob).toHaveURL(/\/id\/groups\/[0-9a-f-]{36}$/);
  await expect(bob.getByRole("heading", { name: "Trip Derawan", exact: true })).toBeVisible();
  await expect(bob.getByText("2 anggota").first()).toBeVisible();
  // Plain members don't get to hand out invites.
  await bob.getByRole("link", { name: "Anggota & undangan" }).click();
  await expect(bob.getByRole("heading", { name: "Anggota & undangan" })).toBeVisible();
  await expect(bob.getByRole("button", { name: "Buat link undangan" })).toHaveCount(0);
});

test("someone adds where they receive money", async ({ page }) => {
  await signIn(page, uniqueEmail("carol"));
  await page.goto("/id/settings");
  await expect(page.getByText("Belum ada rekening")).toBeVisible();
  await page.getByLabel("Bank / e-wallet").selectOption("gopay");
  await page.getByLabel("Nomor rekening / HP").fill("+62 812-3456-7890");
  await page.getByRole("button", { name: "Tambah" }).click();
  // The number is normalised: spaces, dashes and +62 become a plain 08… number.
  await expect(page.locator("li", { hasText: "081234567890" })).toContainText("GoPay");
});

test("signed-out visitors are sent to the landing page", async ({ page }) => {
  await page.goto("/id/home");
  await expect(page).toHaveURL(/\/id$/);
  await expect(page.getByRole("button", { name: "Masuk dengan Google" })).toBeVisible();
});
