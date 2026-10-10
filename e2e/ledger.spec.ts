import { expect, test, type Page } from "@playwright/test";
import { expectNoSidewaysScroll, signIn, uniqueEmail } from "./helpers";

async function addAccount(page: Page, provider: string, number: string) {
  await page.goto("/id/settings");
  await page.getByLabel("Bank / e-wallet").selectOption(provider);
  await page.getByLabel("Nomor rekening / HP").fill(number);
  await page.getByRole("button", { name: "Tambah" }).click();
  await expect(page.locator("li", { hasText: number })).toBeVisible();
}

test("log an expense, pay it back along the free route, and confirm it", async ({ browser }) => {
  const alice = await browser.newPage();
  await signIn(alice, uniqueEmail("alice"));
  await addAccount(alice, "bca", "1112223334");
  await alice.goto("/id/groups/new");
  await alice.getByLabel("Nama grup").fill("Kos Lt.2");
  await alice.getByRole("button", { name: "Buat grup" }).click();
  await expect(alice.getByRole("heading", { name: "Kos Lt.2", exact: true })).toBeVisible();
  const groupUrl = new URL(alice.url()).pathname;
  await alice.getByRole("button", { name: "Buat link undangan" }).click();
  const invite = new URL(await alice.getByRole("textbox", { name: "Undang teman" }).inputValue())
    .pathname;

  const bob = await browser.newPage();
  await signIn(bob, uniqueEmail("bob"));
  await addAccount(bob, "bca", "5556667778");
  await bob.goto(invite);
  await bob.getByRole("button", { name: "Gabung grup" }).click();
  await expect(bob).toHaveURL(new RegExp(`${groupUrl}$`));

  // Alice pays for dinner and splits it evenly.
  await alice.goto(`${groupUrl}/expenses/new`);
  await alice.getByLabel("Untuk apa?").fill("Nasi kuning");
  await alice.getByLabel("Total").fill("100rb");
  await expect(alice.getByText("= Rp100.000")).toBeVisible();
  await expect(alice.getByRole("region", { name: /Ringkasan/ }).getByText("Rp50.000")).toHaveCount(
    2,
  );
  await alice.getByRole("button", { name: "Simpan urunan" }).click();
  await expect(alice).toHaveURL(/logged=1/);
  await expect(alice.getByText("PT-0001")).toBeVisible();
  await expect(alice.getByText("+Rp50.000").first()).toBeVisible();

  // Bob sees the route to Alice on the shared bank, and marks it paid.
  await bob.goto(groupUrl);
  await expect(bob.getByText("−Rp50.000").first()).toBeVisible();
  await expect(bob.getByText("via BCA · bebas admin")).toBeVisible();
  await expectNoSidewaysScroll(bob);
  await bob.getByRole("button", { name: "Sudah transfer" }).click();
  await expect(bob.getByText("1112223334")).toBeVisible();
  await bob.getByRole("button", { name: "Tandai sudah transfer" }).click();
  await expect(bob.getByText("Kamu sudah transfer Rp50.000")).toBeVisible();
  await expect(bob.getByText("Tidak ada yang perlu ditransfer")).toBeVisible();

  // Alice confirms; the book closes.
  await alice.goto(groupUrl);
  await expect(alice.getByText(/bilang sudah transfer Rp50\.000/)).toBeVisible();
  await alice.getByRole("button", { name: "Sudah masuk" }).click();
  await expect(alice.getByText("diterima")).toBeVisible();
  await expect(alice.getByText(/bilang sudah transfer/)).toHaveCount(0);
  await expect(alice.getByText("Rp0").first()).toBeVisible();
  await expectNoSidewaysScroll(alice);
});

test("an itemised receipt spreads tax by what each person had", async ({ page }) => {
  const email = uniqueEmail("solo");
  await signIn(page, email);
  await page.goto("/id/groups/new");
  await page.getByLabel("Nama grup").fill("Makan siang");
  await page.getByRole("button", { name: "Buat grup" }).click();
  await expect(page.getByRole("heading", { name: "Makan siang", exact: true })).toBeVisible();
  await page.getByRole("link", { name: "Catat urunan" }).first().click();

  await page.getByLabel("Untuk apa?").fill("Warung");
  await page.getByText("Per item").click();
  await page.getByLabel("Nama item").fill("Nasi");
  await page.getByLabel("Harga").fill("20000");
  const me = page.getByRole("button", { name: email.split("@")[0] });
  await me.click();
  await page.getByLabel("Pajak").fill("2000");
  const summary = page.getByRole("region", { name: /Ringkasan/ });
  await expect(summary).toContainText("Rp22.000");
  await page.getByRole("button", { name: "Simpan urunan" }).click();
  await expect(page.getByText("PT-0001")).toBeVisible();
});
