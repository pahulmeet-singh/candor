import { expect, test } from "@playwright/test";
import { newAccount, open, register, signIn } from "./helpers";

test.describe("accounts", () => {
  test("a new visitor can create an account and lands on a personal dashboard", async ({ page }) => {
    await register(page, newAccount("Asha Rao"));
    await expect(page.getByRole("heading", { level: 1 })).toContainText("Asha");
  });

  test("the sign-up form says what is wrong with each field", async ({ page }) => {
    await open(page, "/register");
    await page.locator("#name").fill("A");
    await page.locator("#email").fill(newAccount().email);
    await page.locator("#password").fill("short");
    await page.getByRole("button", { name: "Create account" }).click();

    await expect(page.locator("#name-error")).toContainText("Enter your name");
    await expect(page.locator("#password-error")).toContainText("at least 8 characters");
    await expect(page).toHaveURL(/\/register$/);
  });

  test("a second sign-up with the same email is refused", async ({ page, browser }) => {
    const account = await register(page, newAccount("First Person"));

    const other = await browser.newContext();
    try {
      const second = await other.newPage();
      await open(second, "/register");
      await second.locator("#name").fill("Second Person");
      await second.locator("#email").fill(account.email);
      await second.locator("#password").fill(account.password);
      await second.getByRole("button", { name: "Create account" }).click();
      await expect(second.locator("#email-error")).toContainText("already exists");
    } finally {
      await other.close();
    }
  });

  test("signing in again works from a clean browser", async ({ browser, page }) => {
    const account = await register(page, newAccount("Return Visitor"));

    const clean = await browser.newContext();
    try {
      const again = await clean.newPage();
      await signIn(again, account);
      await expect(again).toHaveURL(/\/dashboard$/);
      await expect(again.getByRole("heading", { level: 1 })).toContainText("Return");
    } finally {
      await clean.close();
    }
  });

  test("a wrong password gets one generic message", async ({ browser, page }) => {
    const account = await register(page, newAccount("Careful Person"));

    const clean = await browser.newContext();
    try {
      const again = await clean.newPage();
      await signIn(again, { email: account.email, password: "Wrong-password1" });
      await expect(again.getByText("Email or password is incorrect.")).toBeVisible();
      await expect(again).toHaveURL(/\/login/);
    } finally {
      await clean.close();
    }
  });

  test("an ordinary user gets the 404 page, not an admin screen", async ({ page }) => {
    await register(page);
    await page.goto("/admin");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("We could not find that page.");
  });
});
