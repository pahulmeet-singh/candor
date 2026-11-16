import { randomUUID } from "node:crypto";
import { expect } from "@playwright/test";

export const PASSWORD = "Password123!";

/** A new, unique person, so tests never share an account or run into the duplicate-email rule. */
export function newAccount(name = "Asha Rao") {
  return { name, email: `e2e-${randomUUID().slice(0, 8)}@example.test`, password: PASSWORD };
}

/**
 * Opens a page and waits until the browser has finished loading its JavaScript. The forms are
 * React forms: submitting one before the page has hydrated would reload the page instead of
 * running the action, which makes a test fail at random.
 */
export async function open(page, path) {
  await page.goto(path);
  await page.waitForLoadState("networkidle");
}

/** Creates an account through the real sign-up form and returns once the dashboard is showing. */
export async function register(page, account = newAccount()) {
  await open(page, "/register");
  await page.locator("#name").fill(account.name);
  await page.locator("#email").fill(account.email);
  await page.locator("#password").fill(account.password);
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
  return account;
}

/** Signs in through the real login form. */
export async function signIn(page, account) {
  await open(page, "/login");
  await page.locator("#email").fill(account.email);
  await page.locator("#password").fill(account.password);
  await page.getByRole("button", { name: "Sign in" }).click();
}
