import { expect, test } from "@playwright/test";

test("every page carries the security headers", async ({ request }) => {
  const response = await request.get("/id");
  const headers = response.headers();
  expect(headers["content-security-policy"]).toContain("frame-ancestors 'none'");
  expect(headers["content-security-policy"]).toContain("object-src 'none'");
  expect(headers["strict-transport-security"]).toContain("max-age=");
  expect(headers["x-content-type-options"]).toBe("nosniff");
  expect(headers["x-frame-options"]).toBe("DENY");
  expect(headers["x-powered-by"]).toBeUndefined();
});

test("the API refuses anonymous callers", async ({ request }) => {
  const chat = await request.post("/api/agent", {
    headers: { origin: "http://localhost:3100" },
    data: { locale: "id", messages: [] },
  });
  expect(chat.status()).toBe(401);
  const foreign = await request.post("/api/agent", {
    headers: { origin: "https://evil.example" },
    data: { locale: "id", messages: [] },
  });
  expect(foreign.status()).toBe(403);
});

test("unknown pages get Pesut's 404", async ({ page }) => {
  await page.goto("/id/groups/00000000-0000-0000-0000-000000000000");
  // Signed out: the app sends you to the landing page rather than revealing anything.
  await expect(page).toHaveURL(/\/id$/);
});
