import { expect, test } from "@playwright/test";
import { newAccount, open, register } from "./helpers";

const QUESTIONS = 5;

const ANSWER =
  "I would start by clarifying the goal and the constraints. Then I would compare two options, " +
  "explain the trade-offs, and choose the simpler one. Finally I would test the change, monitor it " +
  "after release, and describe how I would roll it back if something went wrong.";

test.describe("the whole interview journey", () => {
  test("book a slot, answer five questions, submit and read the report", async ({ page, browser }) => {
    test.setTimeout(180_000);
    await register(page, newAccount("Journey Tester"));

    // 1. Book tomorrow's first open slot. Tomorrow always has open slots; today may not.
    await open(page, "/interviews/new");
    await page.locator('label:has(input[name="day"])').nth(1).click();
    await expect(page.locator('input[name="day"]').nth(1)).toBeChecked();
    await expect(page.getByLabel("Loading slots")).toBeHidden();
    await page.locator('label:has(input[name="slot"]:not([disabled]))').first().click();
    await page.getByRole("button", { name: "Confirm booking" }).click();
    await expect(page).toHaveURL(/\/interviews\/(?!new)[a-z0-9]{20,}$/);
    const interviewUrl = page.url();

    // 2. Open the room (DEMO_MODE lets a booked interview start at once) and start the session.
    await page.getByRole("link", { name: "Open interview room" }).first().click();
    await expect(page).toHaveURL(/\/session$/);
    await page.getByRole("button", { name: "Start the interview" }).click();
    await expect(page.getByText(`Question 1 of ${QUESTIONS}`)).toBeVisible();

    // 3. Autosave: an answer survives a reload without pressing anything.
    await page.locator("#answer").fill(ANSWER);
    await expect(page.getByText(/Saved\b/)).toBeVisible();
    await page.reload();
    await expect(page.locator("#answer")).toHaveValue(ANSWER);

    // 4. Answer every question, moving forward with the Next button.
    for (let number = 1; number <= QUESTIONS; number++) {
      await expect(page.getByText(`Question ${number} of ${QUESTIONS}`)).toBeVisible();
      await page.locator("#answer").fill(ANSWER);
      if (number < QUESTIONS) await page.getByRole("button", { name: "Next question" }).click();
    }

    // 5. Review, submit, and wait for the report.
    await page.getByRole("button", { name: "Review and submit" }).click();
    await expect(page.getByRole("dialog")).toBeVisible();
    await page.getByRole("button", { name: "Submit answers" }).click();
    await expect(page).toHaveURL(/\/feedback\/[a-z0-9]{20,}$/, { timeout: 90_000 });

    // 6. The report shows an overall score and one card per question. Straight after submitting, it
    //    opens in a window over the room (an intercepted route), so this only checks what both views share.
    const reportUrl = page.url();
    await expect(page.getByText("out of 100").first()).toBeVisible();
    for (let number = 1; number <= QUESTIONS; number++) {
      await expect(page.getByRole("article", { name: `Question ${number}` })).toBeAttached();
    }

    // 7. The same address opened directly is the standalone report page, with its own heading.
    await open(page, reportUrl);
    await expect(page.getByRole("heading", { level: 1 })).toContainText("report");
    await expect(page.getByText("out of 100").first()).toBeVisible();
    // A practice interview is never watched, so its report has no presence section at all.
    await expect(page.getByRole("heading", { name: "Presence and focus" })).toHaveCount(0);

    // 8. A finished interview cannot be re-entered: its room sends you to the report.
    await page.goto(`${interviewUrl}/session`);
    await expect(page).toHaveURL(/\/feedback\/[a-z0-9]{20,}$/);

    // 9. Nobody else can open this interview or its report: both look like pages that do not exist.
    const stranger = await browser.newContext();
    try {
      const other = await stranger.newPage();
      await register(other, newAccount("Some Stranger"));
      for (const url of [interviewUrl, reportUrl]) {
        await other.goto(url);
        await expect(other.getByRole("heading", { level: 1 })).toHaveText("We could not find that page.");
      }
    } finally {
      await stranger.close();
    }
  });
});
