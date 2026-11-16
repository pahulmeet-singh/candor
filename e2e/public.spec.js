import { expect, test } from "@playwright/test";
import { open } from "./helpers";

test.describe("pages anyone can open", () => {
  test("the landing page says what the product does", async ({ page }) => {
    await open(page, "/");
    await expect(page.getByRole("heading", { level: 1 })).toContainText("the exact sentence that sank your answer");
  });

  test("the categories page invites you to pick a round", async ({ page }) => {
    await open(page, "/categories");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Pick the round you are worried about.");
  });

  test("the sample report opens without an account", async ({ page }) => {
    await open(page, "/sample-report");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("A sample report");
  });

  test("the health endpoint answers with JSON", async ({ request }) => {
    const response = await request.get("/api/health");
    expect(response.ok()).toBe(true);
    expect(await response.json()).toMatchObject({ status: "ok", service: "candor" });
  });

  test("an unknown address shows the friendly 404 page", async ({ page }) => {
    await page.goto("/no-such-page");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("We could not find that page.");
  });
});

test.describe("pages that need a login", () => {
  for (const path of ["/dashboard", "/interviews", "/interviews/new", "/feedback", "/resume", "/admin"]) {
    test(`${path} sends a signed-out visitor to the login page and remembers where they were going`, async ({
      page,
    }) => {
      await page.goto(path);
      await expect(page).toHaveURL(new RegExp(`/login\\?callbackUrl=${encodeURIComponent(path)}$`));
      await expect(page.locator("#email")).toBeVisible();
    });
  }
});
