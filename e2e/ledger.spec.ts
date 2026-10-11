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
  await alice.getByRole("link", { name: "Anggota & undangan" }).click();
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

  // Bob's home and transfers page both know he owes Alice.
  await bob.goto("/id/home");
  await expect(bob.getByText("−Rp50.000").first()).toBeVisible();
  await bob.goto("/id/transfers");
  await expect(bob.getByRole("heading", { name: "Kos Lt.2" })).toBeVisible();

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

  // The activity log tells the whole story.
  await alice.goto("/id/activity");
  await expect(alice.getByText(/mencatat Nasi kuning sebesar Rp100\.000/)).toBeVisible();
  await expect(alice.getByText(/menerima Rp50\.000 dari/)).toBeVisible();
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

test("an expense can be corrected and keeps its number", async ({ page }) => {
  await signIn(page, uniqueEmail("fixer"));
  await page.goto("/id/groups/new");
  await page.getByLabel("Nama grup").fill("Koreksi");
  await page.getByRole("button", { name: "Buat grup" }).click();
  await expect(page.getByRole("heading", { name: "Koreksi", exact: true })).toBeVisible();
  const group = new URL(page.url()).pathname;
  await page.goto(`${group}/expenses/new`);
  await page.getByLabel("Total").fill("100rb");
  await expect(page.getByText("= Rp100.000")).toBeVisible();
  await page.getByLabel("Untuk apa?").fill("Martabak");
  await page.getByRole("button", { name: "Simpan urunan" }).click();
  await expect(page).toHaveURL(/logged=1/);

  await page.getByText("Martabak").click();
  await page.getByRole("link", { name: "Ubah" }).click();
  // Visible fields only: Next keeps the earlier "new expense" page alive but hidden.
  await expect(page.getByRole("textbox", { name: "Untuk apa?" })).toHaveValue("Martabak");
  await page.getByRole("textbox", { name: "Total" }).fill("80rb");
  await expect(page.getByText("= Rp80.000")).toBeVisible();
  await page.getByRole("button", { name: "Simpan perubahan" }).click();
  await expect(page).toHaveURL(new RegExp(`${group}$`));
  // Same record, new total: the number survives the edit and there is still only one.
  const row = page.getByRole("group").filter({ hasText: "Martabak" });
  await expect(row).toContainText("PT-0001");
  await expect(row).toContainText("Rp80.000");
  await expect(page.getByRole("group").filter({ hasText: "PT-0002" })).toHaveCount(0);
});

test("a monthly bill bills this month at once and can be edited and deleted", async ({ page }) => {
  await signIn(page, uniqueEmail("biller"));
  await page.goto("/id/groups/new");
  await page.getByLabel("Nama grup").fill("Kos Bulanan");
  await page.getByRole("button", { name: "Buat grup" }).click();
  await expect(page.getByRole("heading", { name: "Kos Bulanan", exact: true })).toBeVisible();

  // Day 1 has always passed by now, so this month is billed straight away.
  await page.getByText("Tambah tagihan bulanan").click();
  await page.getByRole("textbox", { name: "Nama tagihan" }).fill("WiFi");
  await page.getByRole("textbox", { name: "Jumlah per bulan" }).fill("300rb");
  await page.getByRole("spinbutton", { name: "Tanggal tiap bulan" }).fill("1");
  await page.getByRole("button", { name: "Tambah tagihan", exact: true }).click();
  await expect(page.getByRole("group").filter({ hasText: "WiFi" })).toContainText("berulang");

  // Editing changes next month only; this month's charge keeps its amount.
  await page.getByRole("button", { name: "Ubah" }).first().click();
  await page.getByRole("textbox", { name: "Jumlah per bulan" }).first().fill("350rb");
  await page.getByRole("button", { name: "Simpan perubahan" }).click();
  const bill = page
    .getByRole("listitem")
    .filter({ hasText: "WiFi" })
    .filter({ hasText: "Rp350.000" });
  await expect(bill).toBeVisible();
  await expect(page.getByRole("group").filter({ hasText: "WiFi" })).toContainText("Rp300.000");

  page.once("dialog", (dialog) => dialog.accept());
  await page.getByRole("button", { name: "Hapus" }).first().click();
  await expect(bill).toHaveCount(0);
  await expect(page.getByText("Belum ada tagihan bulanan.")).toBeVisible();
});
